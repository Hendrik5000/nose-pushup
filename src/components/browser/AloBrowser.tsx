/**
 * Alo-Browser – integriert aus Monicas Entwurf (Notion, 15.11.2026).
 * Bereinigt für das Alo-Repo: Notion-Markdown-Artefakte entfernt, TypeScript-Typen
 * angepasst (FormEvent/MouseEvent), SEARCH_DOMAINS-Regex korrigiert.
 * Sicherheit: Webseiten laufen in einem sandboxed iframe ohne allow-same-origin;
 * externe KI-/Proxy-Endpunkte sind frei zugängliche Dienste ohne Schlüssel.
 * Design: vollständig über die Alo-Theme-Tokens (Apple-HIG-fähig, Light/Dark).
 * Tempo: Proxy- und Reader-Quellen werden parallel geraced (siehe lib/browser-fetch),
 * Seiten werden kurz gecacht. Fällt alles aus, bleibt die Seite über Visuell +
 * „Im neuen Tab öffnen“ erreichbar.
 */
import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { fetchBrowserPage, fetchFirstUsable } from "@/lib/browser-fetch";
import { parseJinaSearchResults, takeBrowserOpenUrl } from "@/lib/mira-browser";
import { miraServePageText, runMiraSiteAction } from "@/lib/mira-browser-agent";
import { emitMiraPointer } from "@/lib/mira-computer-use";
import {
  Globe,
  Search,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Sparkles,
  BookOpen,
  Layout,
  Image as ImageIcon,
  ExternalLink,
  Plus,
  X,
  ShieldCheck,
  Loader2,
  Send,
  Activity,
} from "lucide-react";

type ViewMode = "home" | "google" | "search" | "web" | "reader" | "visual";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface MiraActivityEntry {
  id: string;
  text: string;
  at: number;
}

interface Tab {
  id: string;
  title: string;
  url: string;
  input: string;
  mode: ViewMode;
  htmlDoc: string;
  readerText: string;
  aiOverview: string;
  results: SearchResult[];
  loading: boolean;
  history: string[];
  historyIndex: number;
}

const QUICK_LINKS = [
  { num: "01", title: "Google Suche", desc: "Direkt im Alo-Browser suchen", special: "google" },
  {
    num: "02",
    title: "Wikipedia",
    desc: "Enzyklopädie & Wissen",
    url: "https://de.m.wikipedia.org/wiki/Wikipedia:Hauptseite",
  },
  {
    num: "03",
    title: "Tagesschau",
    desc: "Aktuelle Nachrichten",
    url: "https://www.tagesschau.de",
  },
  {
    num: "04",
    title: "Krafttraining",
    desc: "Wissen rund ums Training",
    url: "https://de.m.wikipedia.org/wiki/Krafttraining",
  },
];

// Bekannte Seiten für Sprachbefehle wie "Öffne YouTube", "Öffne Spiegel" usw.
const KNOWN_SITES: Record<string, string> = {
  wikipedia: "https://de.m.wikipedia.org/wiki/Wikipedia:Hauptseite",
  wiki: "https://de.m.wikipedia.org/wiki/Wikipedia:Hauptseite",
  tagesschau: "https://www.tagesschau.de",
  spiegel: "https://www.spiegel.de",
  zeit: "https://www.zeit.de",
  heise: "https://www.heise.de",
  github: "https://github.com",
  reddit: "https://www.reddit.com",
  hackernews: "https://news.ycombinator.com",
  youtube: "https://www.youtube.com",
  google: "https://google.com",
  alo: "https://alo-web.lovable.app",
};

const SEARCH_DOMAINS =
  /^(https?:\/\/)?(www\.)?(google\.(com|de|at|ch)|bing\.com|duckduckgo\.com|yahoo\.com)\/?$/i;

// Robuste KI-Abfrage mit mehreren Fallbacks (verhindert "Keine Antwort erhalten.")
async function fetchSmartAI(
  systemPrompt: string,
  userPrompt: string,
  fallbackContext = "",
): Promise<string> {
  // Versuch 1: Schneller GET-Text-Endpunkt von Pollinations (kein CORS-Preflight-Problem!)
  try {
    const combined = `${systemPrompt}\n\n${userPrompt}`.slice(0, 1800);
    const url = `https://text.pollinations.ai/${encodeURIComponent(combined)}?model=openai&seed=${Date.now() % 10000}`;
    const r1 = await fetch(url);
    if (r1.ok) {
      const txt = (await r1.text()).trim();
      if (txt && txt.length > 2 && !txt.startsWith("<!DOCTYPE")) {
        // Falls JSON zurückkommt, sauber auspacken
        if (txt.startsWith("{")) {
          try {
            const j = JSON.parse(txt);
            const extracted = j.choices?.[0]?.message?.content || j.content || j.response || "";
            if (extracted) return extracted.trim();
          } catch (_) {
            /* weiter zum nächsten Versuch */
          }
        }
        return txt;
      }
    }
  } catch (_) {
    /* weiter zum nächsten Versuch */
  }

  // Versuch 2: POST-Endpunkt mit flexiblem JSON/Text-Parser
  try {
    const r2 = await fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt.slice(0, 4000) },
        ],
      }),
    });
    if (r2.ok) {
      const raw = (await r2.text()).trim();
      if (raw.startsWith("{")) {
        try {
          const j = JSON.parse(raw);
          const content = j.choices?.[0]?.message?.content || j.message?.content || j.text || "";
          if (content) return content.trim();
        } catch (_) {
          /* weiter zum nächsten Versuch */
        }
      } else if (raw.length > 2) {
        return raw;
      }
    }
  } catch (_) {
    /* weiter zum nächsten Versuch */
  }

  // Versuch 3: Intelligenter lokaler Extraktor, damit NIEMALS eine leere Fehlermeldung erscheint
  if (fallbackContext && fallbackContext.length > 60) {
    const lines = fallbackContext
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 45 && !l.startsWith("http") && !l.startsWith("!["));
    if (lines.length > 0) {
      return (
        "📌 **Wichtigste Auszüge der geöffneten Seite:**\n\n" +
        lines
          .slice(0, 5)
          .map((l) => `• ${l.slice(0, 220)}`)
          .join("\n\n")
      );
    }
  }

  return "Ich bin bereit! Sag mir z. B. **„Öffne Wikipedia“**, **„Suche nach Push-Up Weltrekord“** oder öffne eine Webseite, damit ich sie dir zusammenfasse.";
}

export default function AloBrowser() {
  const [tabs, setTabs] = useState<Tab[]>([
    {
      id: "1",
      title: "Start",
      url: "",
      input: "",
      mode: "home",
      htmlDoc: "",
      readerText: "",
      aiOverview: "",
      results: [],
      loading: false,
      history: [],
      historyIndex: -1,
    },
  ]);
  const [activeId, setActiveId] = useState<string>("1");
  const [boxQuery, setBoxQuery] = useState<string>("");
  const [aiOpen, setAiOpen] = useState<boolean>(false);
  const [aiInput, setAiInput] = useState<string>("");
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [miraActivity, setMiraActivity] = useState<MiraActivityEntry[]>([]);
  const [aiMessages, setAiMessages] = useState<{ role: "user" | "ai"; text: string }[]>([
    {
      role: "ai",
      text: "Hallo! Ich bin Mira. Du kannst mir Befehle geben wie:\n• „Öffne Google“\n• „Suche nach Krafttraining“\n• „Öffne tagesschau.de“\nOder lass dir jede geöffnete Seite zusammenfassen!",
    },
  ]);

  const activeTab = tabs.find((t) => t.id === activeId) || tabs[0];
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const updateTab = (id: string, patch: Partial<Tab>) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const logMiraActivity = (text: string) => {
    setMiraActivity((prev) =>
      [
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text, at: Date.now() },
        ...prev,
      ].slice(0, 12),
    );
  };

  const pointMiraPointerAt = (el: Element | null, label: string) => {
    if (!el || typeof window === "undefined") return;
    const rect = el.getBoundingClientRect();
    emitMiraPointer({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      label,
      active: true,
    });
  };

  const pointMiraPointerAtAddressBar = (label: string) => {
    pointMiraPointerAt(document.querySelector(".alo-browser-toolbar input"), label);
  };

  useEffect(() => {
    const pending = takeBrowserOpenUrl();
    if (pending) void openUrl("1", pending, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (ev.data?.type === "ALO_NAVIGATE" && typeof ev.data.url === "string") {
        openUrl(activeTabRef.current.id, ev.data.url, true);
      }
      if (ev.data?.type === "ALO_SEARCH" && typeof ev.data.query === "string") {
        runSearch(activeTabRef.current.id, ev.data.query);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLikelyUrl = (val: string) => {
    const trimmed = val.trim();
    if (trimmed.includes(" ")) return false;
    return /^https?:\/\//i.test(trimmed) || /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(trimmed);
  };

  const normalizeUrl = (val: string) => {
    const trimmed = val.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };

  const buildSafeSrcDoc = (rawHtml: string, baseUrl: string) => {
    const cleaned = rawHtml
      .replace(/<meta[^>]*http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, "")
      .replace(/<meta[^>]*http-equiv=["']?X-Frame-Options["']?[^>]*>/gi, "");

    const injected = `
    <base href="${baseUrl}">
    <style>html,body{max-width:100vw!important;overflow-x:hidden!important}</style>
    <script>
      document.addEventListener('click', function(e) {
        var a = e.target && e.target.closest ? e.target.closest('a') : null;
        if (a && a.href && /^https?:/i.test(a.href)) {
          e.preventDefault();
          parent.postMessage({ type: 'ALO_NAVIGATE', url: a.href }, '*');
        }
      }, true);
    </script>
  `;
    if (/<head[^>]*>/i.test(cleaned)) {
      return cleaned.replace(/<head[^>]*>/i, (m) => `${m}${injected}`);
    }
    return `<!DOCTYPE html><html><head>${injected}</head><body>${cleaned}</body></html>`;
  };

  const openGoogleMode = (tabId: string) => {
    updateTab(tabId, {
      title: "Google Suche",
      url: "",
      input: "https://google.com",
      mode: "google",
      loading: false,
    });
  };

  const openUrl = async (tabId: string, rawTarget: string, pushHistory = true) => {
    const targetUrl = normalizeUrl(rawTarget);

    if (SEARCH_DOMAINS.test(targetUrl)) {
      openGoogleMode(tabId);
      return;
    }

    try {
      const u = new URL(targetUrl);
      if (u.hostname.includes("google.") && u.searchParams.get("q")) {
        runSearch(tabId, u.searchParams.get("q") || "");
        return;
      }
    } catch (_) {
      /* normale URL-Behandlung */
    }

    const current = tabs.find((t) => t.id === tabId);
    const nextHistory =
      pushHistory && current
        ? [...current.history.slice(0, current.historyIndex + 1), targetUrl]
        : current?.history || [targetUrl];
    const nextIndex = pushHistory ? nextHistory.length - 1 : (current?.historyIndex ?? 0);

    let domain = targetUrl;
    try {
      domain = new URL(targetUrl).hostname.replace(/^www\./, "");
    } catch (_) {
      /* Fallback: volle URL als Titel */
    }

    updateTab(tabId, {
      url: targetUrl,
      input: targetUrl,
      title: domain,
      loading: true,
      mode: "web",
      history: nextHistory,
      historyIndex: nextIndex,
    });

    const ytMatch = targetUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
      const ytDoc = `<!DOCTYPE html><html style="height:100%;margin:0;background:#000"><body style="height:100%;margin:0"><iframe src="https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1" style="width:100%;height:100%;border:0" allow="autoplay; fullscreen"></iframe></body></html>`;
      updateTab(tabId, {
        htmlDoc: ytDoc,
        readerText: `YouTube Video: ${targetUrl}`,
        loading: false,
        mode: "web",
      });
      return;
    }

    const { html: rawHtml, reader: readerTxt } = await fetchBrowserPage(targetUrl);

    if (rawHtml) {
      updateTab(tabId, {
        htmlDoc: buildSafeSrcDoc(rawHtml, targetUrl),
        readerText: readerTxt || "Kein separater Reader-Text gefunden.",
        mode: "web",
        loading: false,
      });
    } else if (readerTxt) {
      updateTab(tabId, { htmlDoc: "", readerText: readerTxt, mode: "reader", loading: false });
    } else {
      updateTab(tabId, {
        htmlDoc: "",
        readerText: "",
        mode: "visual",
        loading: false,
      });
    }
  };

  const runSearch = async (tabId: string, query: string) => {
    const q = query.trim();
    if (!q) return;

    updateTab(tabId, {
      title: `${q} – Suche`,
      input: q,
      url: "",
      mode: "search",
      loading: true,
      aiOverview: "",
      results: [],
    });

    const fetchResults = async (): Promise<SearchResult[]> => {
      try {
        const res = await fetchFirstUsable([`https://s.jina.ai/${encodeURIComponent(q)}`], {
          minLength: 40,
          headers: { Accept: "text/plain" },
        });
        const parsed = parseJinaSearchResults(res);
        if (parsed.length > 0) return parsed;
      } catch (_) {
        /* Fallback unten */
      }

      try {
        const wikiRes = await fetch(
          `https://de.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=6&format=json&origin=*`,
        );
        const w = await wikiRes.json();
        return (w[1] || []).map((title: string, i: number) => ({
          title,
          snippet: w[2]?.[i] || "Wikipedia-Artikel im Alo-Browser lesen",
          url: w[3]?.[i] || `https://de.m.wikipedia.org/wiki/${encodeURIComponent(title)}`,
        }));
      } catch (_) {
        return [];
      }
    };

    const [found, overview] = await Promise.all([
      fetchResults(),
      fetchSmartAI(
        "Antworte kompakt in maximal 3 klaren Sätzen auf Deutsch wie Google AI Overview.",
        q,
      ),
    ]);

    updateTab(tabId, {
      results: found,
      aiOverview: overview,
      readerText:
        `Suche: ${q}\n\n${overview}\n\n` + found.map((f) => `${f.title}: ${f.snippet}`).join("\n"),
      loading: false,
    });
  };

  // Prüft, ob der Nutzer Mira einen direkten Browser-Befehl gibt ("Öffne Google", "Suche nach X" ...)
  const tryExecuteBrowserCommand = async (rawText: string): Promise<string | null> => {
    const clean = rawText.trim();
    const lower = clean.toLowerCase();

    // 1. "Öffne Google" / "Geh zu Google"
    if (
      /(öffne|oeffne|starte|geh auf|gehe auf|zeig|open)\s+(mir\s+)?(bitte\s+)?google/i.test(
        lower,
      ) ||
      lower === "google"
    ) {
      openGoogleMode(activeTab.id);
      pointMiraPointerAtAddressBar("Öffne Google");
      logMiraActivity("Google-Suche geöffnet");
      if (window.innerWidth < 640) setAiOpen(false);
      return "✅ Ich habe die integrierte Google-Suche für dich geöffnet!";
    }

    // 1b. Browser-Use: Mira bedient fremde Seiten (Links klicken, site-interne Suche)
    const operatesSite =
      Boolean(activeTab.url) &&
      (/^(?:klicke?|durchsuche)\b/i.test(clean) ||
        /^suche\s+(?:auf|im)\s+(?:dieser\s+|der\s+|dem\s+)?(?:seite|website|shop|angebot)\b/i.test(
          clean,
        ) ||
        /^öffne\s+.+\s+auf\s+(?:dieser\s+)?(?:seite|website)\b/i.test(clean));
    if (operatesSite && activeTab.url) {
      const siteAction = await runMiraSiteAction(clean, activeTab.url);
      if (siteAction.kind === "navigated" || siteAction.kind === "search") {
        pointMiraPointerAtAddressBar(siteAction.label);
        logMiraActivity(`${siteAction.label} · ${activeTab.title}`);
        void openUrl(activeTab.id, siteAction.url, true);
        if (window.innerWidth < 640) setAiOpen(false);
        return siteAction.kind === "search"
          ? `🔍 ${siteAction.label} …`
          : `🖱 Ich habe „${siteAction.label}“ geöffnet.`;
      }
      return `⚠️ ${siteAction.kind === "failed" ? siteAction.detail : "Das ging nicht."}`;
    }

    // 2. "Suche nach ..." / "Google nach ..."
    const searchMatch = clean.match(
      /^(?:suche\s+nach|such\s+nach|suche|google\s+nach|finde\s+infos\s+über|recherchiere)\s+(.+)$/i,
    );
    if (searchMatch && searchMatch[1]) {
      const term = searchMatch[1].replace(/^["']|["']$/g, "").trim();
      pointMiraPointerAtAddressBar(`Suche: ${term}`);
      logMiraActivity(`Websuche: „${term}“`);
      runSearch(activeTab.id, term);
      if (window.innerWidth < 640) setAiOpen(false);
      return `🔍 Ich suche im Web nach „${term}“ …`;
    }

    // 3. "Öffne <Website oder bekannter Name>"
    const openMatch = clean.match(/^(?:öffne|oeffne|geh\s+auf|gehe\s+auf|lade|open)\s+(.+)$/i);
    if (openMatch && openMatch[1]) {
      const target = openMatch[1].trim().replace(/[.!?]+$/, "");
      const key = target.toLowerCase().replace(/\s+/g, "");

      if (key.includes("youtube")) {
        pointMiraPointerAtAddressBar("YouTube-Suche");
        logMiraActivity("YouTube-Suche gestartet");
        runSearch(activeTab.id, "YouTube Trends Videos");
        if (window.innerWidth < 640) setAiOpen(false);
        return "🎬 Ich habe YouTube-Treffer geladen (klicke ein Video an, um es direkt abzuspielen).";
      }
      if (KNOWN_SITES[key]) {
        pointMiraPointerAtAddressBar(`Öffne ${target}`);
        logMiraActivity(`Öffne ${target}`);
        openUrl(activeTab.id, KNOWN_SITES[key], true);
        if (window.innerWidth < 640) setAiOpen(false);
        return `🌐 Ich öffne ${target} für dich …`;
      }
      if (isLikelyUrl(target)) {
        pointMiraPointerAtAddressBar(`Öffne ${target}`);
        logMiraActivity(`Öffne ${target}`);
        openUrl(activeTab.id, target, true);
        if (window.innerWidth < 640) setAiOpen(false);
        return `🌐 Ich öffne ${target} …`;
      }
      // Falls keine Domain angegeben ("Öffne Bayern München"), direkt danach suchen!
      pointMiraPointerAtAddressBar(`Suche: ${target}`);
      logMiraActivity(`Websuche: „${target}“`);
      runSearch(activeTab.id, target);
      if (window.innerWidth < 640) setAiOpen(false);
      return `🔍 Ich habe die passenden Ergebnisse zu „${target}“ geöffnet!`;
    }

    return null;
  };

  const askMira = async (promptText?: string) => {
    const q = (promptText ?? aiInput).trim();
    if (!q || aiLoading) return;
    setAiInput("");
    setAiOpen(true);
    setAiMessages((m) => [...m, { role: "user", text: q }]);

    // Erst prüfen, ob es ein Browser-Steuerbefehl ist!
    const commandReply = await tryExecuteBrowserCommand(q);
    if (commandReply) {
      setAiMessages((m) => [...m, { role: "ai", text: commandReply }]);
      return;
    }

    setAiLoading(true);
    let servedText: string | null = null;
    if (!activeTab.readerText && activeTab.url) {
      servedText = await miraServePageText(activeTab.url);
    }
    const context = activeTab.readerText
      ? activeTab.readerText.slice(0, 4500)
      : servedText
        ? servedText.slice(0, 4500)
        : `Aktueller Modus: ${activeTab.mode}, URL: ${activeTab.url || "Startseite"}`;
    if (activeTab.url) logMiraActivity(`Seiteninhalt gelesen: ${activeTab.title}`);

    const answer = await fetchSmartAI(
      "Du bist Mira, der hilfreiche KI-Browser-Agent in der App Alo. Antworte immer auf Deutsch, freundlich, direkt und gut lesbar.",
      `Seiteninhalt:\n${context}\n\nNutzer-Nachricht: ${q}`,
      activeTab.readerText,
    );

    setAiMessages((m) => [...m, { role: "ai", text: answer }]);
    setAiLoading(false);
  };

  const handleBarSubmit = (e: FormEvent) => {
    e.preventDefault();
    const val = activeTab.input.trim();
    if (!val) return;
    if (isLikelyUrl(val)) openUrl(activeTab.id, val, true);
    else runSearch(activeTab.id, val);
  };

  const goBack = () => {
    if (activeTab.historyIndex > 0) {
      const prev = activeTab.history[activeTab.historyIndex - 1];
      updateTab(activeTab.id, { historyIndex: activeTab.historyIndex - 1 });
      openUrl(activeTab.id, prev, false);
    } else {
      updateTab(activeTab.id, { mode: "home", url: "", input: "", title: "Start" });
    }
  };

  const goForward = () => {
    if (activeTab.historyIndex < activeTab.history.length - 1) {
      const next = activeTab.history[activeTab.historyIndex + 1];
      updateTab(activeTab.id, { historyIndex: activeTab.historyIndex + 1 });
      openUrl(activeTab.id, next, false);
    }
  };

  const addTab = () => {
    const id = String(Date.now());
    setTabs((prev) => [
      ...prev,
      {
        id,
        title: "Start",
        url: "",
        input: "",
        mode: "home",
        htmlDoc: "",
        readerText: "",
        aiOverview: "",
        results: [],
        loading: false,
        history: [],
        historyIndex: -1,
      },
    ]);
    setActiveId(id);
  };

  const closeTab = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) {
      updateTab(id, {
        title: "Start",
        url: "",
        input: "",
        mode: "home",
        htmlDoc: "",
        readerText: "",
      });
      return;
    }
    const rest = tabs.filter((t) => t.id !== id);
    setTabs(rest);
    if (activeId === id) setActiveId(rest[rest.length - 1].id);
  };

  return (
    <div className="alo-browser flex h-screen w-full flex-col bg-background font-sans text-foreground antialiased">
      {/* Tab-Leiste */}
      <div className="alo-browser-tabbar flex items-center gap-1 overflow-x-auto border-b border-border bg-background px-2 pt-2">
        <span className="shrink-0 px-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          ALO · WEB
        </span>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveId(tab.id)}
            className={`flex max-w-40 shrink-0 cursor-pointer items-center gap-1.5 rounded-t-xl px-3 py-1.5 text-xs font-medium ${
              tab.id === activeId
                ? "border-x border-t border-border bg-card text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Globe className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{tab.title}</span>
            <button
              onClick={(e) => closeTab(tab.id, e)}
              className="rounded p-0.5 hover:bg-muted"
              aria-label={`Tab ${tab.title} schließen`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          onClick={addTab}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
          aria-label="Neuen Tab öffnen"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Einzeilige, saubere Mobile-Navigationsleiste */}
      <div className="alo-browser-toolbar flex items-center gap-1.5 border-b border-border bg-card px-2 py-2">
        <button
          onClick={goBack}
          className="shrink-0 rounded-lg p-2 text-muted-foreground hover:text-foreground"
          aria-label="Zurück"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() =>
            activeTab.url
              ? openUrl(activeTab.id, activeTab.url, false)
              : updateTab(activeTab.id, { mode: "home", input: "" })
          }
          className="shrink-0 rounded-lg p-2 text-muted-foreground hover:text-foreground"
          aria-label="Neu laden"
        >
          <RotateCw className={`h-4 w-4 ${activeTab.loading ? "animate-spin text-primary" : ""}`} />
        </button>

        <form
          onSubmit={handleBarSubmit}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-2.5 py-1.5 focus-within:border-primary/60"
        >
          <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
          <input
            type="text"
            value={activeTab.input}
            onChange={(e) => updateTab(activeTab.id, { input: e.target.value })}
            placeholder="Suchen oder URL …"
            className="w-full min-w-0 bg-transparent text-sm text-foreground placeholder-muted-foreground focus:outline-none"
          />
          <button
            type="submit"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Los"
          >
            <Search className="h-4 w-4" />
          </button>
        </form>

        <button
          onClick={() => setAiOpen(!aiOpen)}
          aria-pressed={aiOpen}
          className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
            aiOpen
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground hover:bg-accent"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Mira</span>
        </button>
      </div>

      {/* Sub-Bar nur wenn eine Webseite aktiv ist */}
      {activeTab.url && (
        <div className="flex items-center justify-between border-b border-border/80 bg-card/60 px-3 py-1.5 text-xs">
          <div className="flex items-center gap-1">
            <button
              onClick={() => updateTab(activeTab.id, { mode: "web" })}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-medium ${
                activeTab.mode === "web" ? "bg-muted text-foreground" : "text-muted-foreground"
              }`}
            >
              <Layout className="h-3.5 w-3.5" /> Web
            </button>
            <button
              onClick={() => updateTab(activeTab.id, { mode: "reader" })}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-medium ${
                activeTab.mode === "reader" ? "bg-muted text-foreground" : "text-muted-foreground"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" /> Reader
            </button>
            <button
              onClick={() => updateTab(activeTab.id, { mode: "visual" })}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-medium ${
                activeTab.mode === "visual" ? "bg-muted text-foreground" : "text-muted-foreground"
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" /> Visuell
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goForward}
              disabled={activeTab.historyIndex >= activeTab.history.length - 1}
              className="p-1 text-muted-foreground disabled:opacity-30"
              aria-label="Vorwärts"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <a
              href={activeTab.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 text-muted-foreground hover:text-foreground"
              aria-label="Im neuen Tab öffnen"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Hauptbereich */}
      <div className="relative flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto bg-background">
          {activeTab.loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-sm">Wird im Alo-Browser geladen …</p>
            </div>
          ) : activeTab.mode === "google" ? (
            /* Dedizierte Google-Suchansicht (für "Öffne Google" oder google.com) */
            <div className="flex h-full flex-col items-center justify-center px-5 pb-16">
              <div className="mb-2 text-4xl font-bold tracking-tight">
                <span className="text-blue-400">G</span>
                <span className="text-red-400">o</span>
                <span className="text-amber-300">o</span>
                <span className="text-blue-400">g</span>
                <span className="text-emerald-400">l</span>
                <span className="text-red-400">e</span>
                <span className="ml-2 align-middle text-xs font-semibold text-muted-foreground">
                  via Alo
                </span>
              </div>
              <p className="mb-6 text-xs text-muted-foreground">
                Ungesperrte Web-Suche mit KI-Zusammenfassung
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!boxQuery.trim()) return;
                  runSearch(activeTab.id, boxQuery);
                  setBoxQuery("");
                }}
                className="flex w-full max-w-md items-center gap-3 rounded-full border border-border bg-card px-4 py-3 shadow-xl focus-within:border-primary"
              >
                <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
                <input
                  type="text"
                  autoFocus
                  value={boxQuery}
                  onChange={(e) => setBoxQuery(e.target.value)}
                  placeholder="Auf Google suchen …"
                  className="w-full bg-transparent text-sm text-foreground placeholder-muted-foreground focus:outline-none"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  Suchen
                </button>
              </form>

              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {["Push-Up Trainingsplan", "KI News 2026", "Gesunde Ernährung Muskelaufbau"].map(
                  (sample) => (
                    <button
                      key={sample}
                      onClick={() => runSearch(activeTab.id, sample)}
                      className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:border-foreground/40"
                    >
                      {sample}
                    </button>
                  ),
                )}
              </div>
            </div>
          ) : activeTab.mode === "home" ? (
            /* Alo Startseite */
            <div className="mx-auto max-w-xl px-5 py-9">
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                ALO · WEB &amp; MIRA
              </span>
              <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Surfen. Suchen. Verstehen.
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Tippe einen Begriff ein oder sag Mira rechts oben einfach „Öffne Google“.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!boxQuery.trim()) return;
                  if (isLikelyUrl(boxQuery)) openUrl(activeTab.id, boxQuery, true);
                  else runSearch(activeTab.id, boxQuery);
                  setBoxQuery("");
                }}
                className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg focus-within:border-primary"
              >
                <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
                <input
                  type="text"
                  value={boxQuery}
                  onChange={(e) => setBoxQuery(e.target.value)}
                  placeholder="Im Web suchen oder Adresse eingeben …"
                  className="w-full bg-transparent text-sm text-foreground placeholder-muted-foreground focus:outline-none"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-xl bg-foreground px-3.5 py-1.5 text-xs font-semibold text-background"
                >
                  Start
                </button>
              </form>

              <div className="mt-6 grid grid-cols-2 gap-3">
                {QUICK_LINKS.map((item) => (
                  <button
                    key={item.num}
                    onClick={() =>
                      item.special === "google"
                        ? openGoogleMode(activeTab.id)
                        : openUrl(activeTab.id, item.url || "", true)
                    }
                    className="rounded-2xl border border-border bg-card p-4 text-left transition hover:border-foreground/40"
                  >
                    <span className="font-mono text-xs text-primary">{item.num}</span>
                    <div className="mt-1 text-sm font-semibold text-foreground">{item.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : activeTab.mode === "search" ? (
            /* Suchergebnisse */
            <div className="mx-auto max-w-3xl space-y-4 px-4 py-5">
              {activeTab.aiOverview && (
                <div className="rounded-2xl border border-primary/30 bg-card p-4">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <Sparkles className="h-3.5 w-3.5" /> Mira Direkt-Antwort
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {activeTab.aiOverview}
                  </p>
                </div>
              )}

              <div className="space-y-2.5">
                {activeTab.results.map((r, i) => (
                  <div
                    key={i}
                    onClick={() => openUrl(activeTab.id, r.url, true)}
                    className="cursor-pointer rounded-2xl border border-border bg-card p-4 transition hover:border-foreground/40"
                  >
                    <div className="truncate text-xs text-primary">{r.url}</div>
                    <div className="mt-0.5 text-base font-semibold text-foreground">{r.title}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{r.snippet}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab.mode === "web" && activeTab.htmlDoc ? (
            <iframe
              srcDoc={activeTab.htmlDoc}
              title={activeTab.title}
              className="h-full w-full border-none bg-white"
              sandbox="allow-scripts allow-forms allow-popups"
            />
          ) : activeTab.mode === "visual" && activeTab.url ? (
            <div className="mx-auto max-w-4xl space-y-3 p-4">
              <img
                src={`https://image.thum.io/get/width/1200/noanimate/${activeTab.url}`}
                alt={activeTab.title}
                className="w-full rounded-xl border border-border bg-card"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">
                  Die Seite blockiert das Einbetten. Du kannst sie trotzdem öffnen:
                </p>
                <a
                  href={activeTab.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Im neuen Tab öffnen
                </a>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl px-5 py-6">
              <div className="mb-5 flex items-center justify-between gap-2 border-b border-border pb-4">
                <span className="truncate text-xs text-muted-foreground">{activeTab.url}</span>
                <button
                  onClick={() => askMira("Fasse diese Seite in 5 kurzen Stichpunkten zusammen.")}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground"
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> Zusammenfassen
                </button>
              </div>
              <article className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {activeTab.readerText || "Kein Seiteninhalt gefunden."}
              </article>
            </div>
          )}
        </div>

        {/* Mira Agenten- & Seiten-KI Panel */}
        {aiOpen && (
          <aside
            className="alo-browser-mira-panel absolute inset-0 z-20 flex flex-col border-l border-border bg-background sm:static sm:w-80 sm:bg-card md:w-96"
            aria-label="Mira Browser-Agent"
          >
            <div className="flex items-center justify-between border-b border-border bg-card p-3.5">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-primary">
                  MIRA · BROWSER-AGENT
                </div>
                <div className="text-xs text-muted-foreground">
                  Steuert Web, Suche &amp; Zusammenfassungen
                </div>
              </div>
              <button
                onClick={() => setAiOpen(false)}
                className="rounded-lg bg-muted p-1.5 text-foreground"
                aria-label="Mira-Panel schließen"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex gap-1.5 overflow-x-auto border-b border-border bg-card/50 p-2.5">
              <button
                onClick={() => askMira("Öffne Google")}
                className="shrink-0 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
              >
                ⚡ Öffne Google
              </button>
              <button
                onClick={() => askMira("Fasse die aktuelle Seite kurz zusammen.")}
                className="shrink-0 rounded-lg bg-muted px-2.5 py-1 text-xs text-foreground"
              >
                Zusammenfassen
              </button>
              <button
                onClick={() => askMira("Öffne Tagesschau")}
                className="shrink-0 rounded-lg bg-muted px-2.5 py-1 text-xs text-foreground"
              >
                ⚡ Tagesschau
              </button>
            </div>

            <div className="alo-browser-mira-activity border-b border-border bg-card/50 px-3.5 py-2.5">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Activity className="h-3 w-3" /> Was Mira macht
              </div>
              {miraActivity.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Noch keine Aktion – gib Mira einen Befehl.
                </p>
              ) : (
                <ul className="space-y-1">
                  {miraActivity.map((entry) => (
                    <li key={entry.id} className="flex items-center gap-2 text-xs text-foreground">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {new Date(entry.at).toLocaleTimeString("de-DE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="truncate">{entry.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-3.5 text-xs leading-relaxed">
              {aiMessages.map((m, i) => (
                <div
                  key={i}
                  className={`whitespace-pre-wrap rounded-2xl p-3 ${
                    m.role === "user"
                      ? "ml-10 bg-foreground font-medium text-background"
                      : "mr-6 border border-border bg-card text-foreground"
                  }`}
                >
                  {m.text}
                </div>
              ))}
              {aiLoading && (
                <div className="flex items-center gap-2 p-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" /> Mira arbeitet …
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                askMira();
              }}
              className="flex gap-2 border-t border-border bg-card p-3"
            >
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Befehl („Öffne Google“) oder Frage …"
                className="flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-xs text-foreground placeholder-muted-foreground focus:border-primary/60 focus:outline-none"
              />
              <button
                type="submit"
                disabled={aiLoading}
                className="rounded-xl bg-primary p-2.5 font-semibold text-primary-foreground disabled:opacity-40"
                aria-label="Senden"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </aside>
        )}
      </div>
    </div>
  );
}
