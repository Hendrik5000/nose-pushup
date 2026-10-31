import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file: string) => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");

test("Mira, Nexus and Health expose tailored menu items and quick actions", () => {
  const sidebar = read("components/alo/AloPageSidebar.tsx");
  for (const name of ["Mira", "Nexus", "Alo Health"]) {
    assert.ok(sidebar.includes(`name: "${name}"`), `missing app name ${name}`);
  }
  for (const label of [
    "Neuer Chat",
    "Gesprächsverlauf",
    "Aufgaben & Beispiele",
    "KI-Einstellungen",
    "Neuer Raum",
    "Neue Direktnachricht",
    "Chats & Räume",
    "Nachrichten suchen",
    "Aktiven Chat exportieren",
    "Werte erfassen",
    "Datenquelle verbinden",
    "Schlaf & Erholung",
    "Datenquellen",
  ]) {
    assert.ok(sidebar.includes(`label: "${label}"`), `missing app-specific label ${label}`);
  }
  assert.match(sidebar, /mira:\s*\{/);
  assert.match(sidebar, /nexus:\s*\{/);
  assert.match(sidebar, /health:\s*\{/);
  assert.match(sidebar, /href: "#health-entry"/);
  assert.match(sidebar, /href: "#health-sources"/);
  assert.match(sidebar, /to="\/profile"/);
  assert.match(sidebar, /data-app=\{active\}/);
  assert.match(sidebar, /data-alo-sidebar-action=\{id\}/);
  assert.match(sidebar, /collapsible="offcanvas"/);
});

test("sidebar trigger and mobile close expose controlled state and use the existing Radix drawer", () => {
  const sidebar = read("components/alo/AloPageSidebar.tsx");
  const primitive = read("components/ui/sidebar.tsx");
  const sheet = read("components/ui/sheet.tsx");
  assert.match(sidebar, /aria-controls="alo-page-sidebar-navigation"/);
  assert.match(sidebar, /aria-expanded=\{expanded\}/);
  assert.match(sidebar, /aria-label=\{label\}/);
  assert.match(sidebar, /aria-label="Bereichsmenü schließen"/);
  assert.match(sidebar, /onClick=\{\(\) => setOpenMobile\(false\)\}/);
  assert.match(sidebar, /aria-label=\{`\$\{menu\.name\}-Menü`\}/);
  assert.match(primitive, /<Sheet open=\{openMobile\} onOpenChange=\{setOpenMobile\}/);
  assert.match(primitive, /<SheetTitle>Seitenmenü<\/SheetTitle>/);
  assert.match(sheet, /@radix-ui\/react-dialog/);
  assert.match(sheet, /<SheetPrimitive\.Content/);
});

test("the three routes retain their pages, Health data sources and new Classic dashboard", () => {
  const mira = read("routes/_authenticated/ai.tsx");
  const nexus = read("routes/_authenticated/chat.tsx");
  const health = read("routes/_authenticated/health.tsx");
  assert.match(mira, /<AloPageSidebar active="mira">[\s\S]*?<SuperAiPage \/>/);
  assert.match(
    nexus,
    /<AloPageSidebar active="nexus">[\s\S]*?<LocalChatShell initialDmId=\{dm\} \/>/,
  );
  assert.match(
    health,
    /<AloPageSidebar active="health">[\s\S]*?<DesignView variant="classic">[\s\S]*?<DesignView variant="sport">/,
  );
  assert.match(health, /health_entries/);
  assert.match(health, /<HealthConnectPanel \/>/);
  assert.match(health, /<SmartwatchPanel \/>/);
  assert.match(health, /className="classic-only health-classic-dashboard/);
  assert.match(health, /className="health-classic-hero"/);
  assert.match(health, /id="health-classic-today-title"/);
  assert.match(health, /className="health-classic-sources-grid"/);
  assert.match(health, /id="health-entry"/);
});

test("Mira sidebar actions reuse its existing session, view and settings handlers", () => {
  const mira = read("components/mira/SuperAiPage.tsx");
  assert.match(mira, /useAloPageSidebarCommands\(sidebarCommands, activeSidebarItem\)/);
  assert.match(mira, /"mira-new-chat": \(\) => \{[\s\S]*?startNewSession\(\)/);
  assert.match(
    mira,
    /"mira-view-history": \(\) => \{[\s\S]*?setSportAiView\("history"\)[\s\S]*?setSessionsOpen\(true\)/,
  );
  assert.match(mira, /"mira-view-tasks": \(\) => \{[\s\S]*?setSportAiView\("coach"\)/);
  assert.match(mira, /"mira-open-settings": \(\) => setSettingsOpen\(true\)/);
});

test("Nexus menu actions invoke existing handlers and keep the room-list switcher separate", () => {
  const chat = read("components/chat/LocalChatShell.tsx");
  assert.match(chat, /useAloPageSidebarCommands\(sidebarCommands, activeSidebarItem\)/);
  assert.match(chat, /"nexus-new-room": \(\) => \{[\s\S]*?setNewRoomOpen\(true\)/);
  assert.match(chat, /"nexus-new-dm": \(\) => \{[\s\S]*?setDmPickerOpen\(true\)/);
  assert.match(chat, /"nexus-open-search": \(\) => \{[\s\S]*?setSearchOpen\(true\)/);
  assert.match(chat, /"nexus-export-current": \(\) => void exportActive\(\)/);
  assert.match(chat, /open=\{dmPickerOpen\}/);
  assert.match(
    chat,
    /onClick=\{\(\) => setMenuOpen\(true\)\}[\s\S]*?aria-label="Chatliste öffnen"/,
  );
  assert.match(
    chat,
    /className="community-back"[\s\S]*?onClick=\{\(\) => setMobileListOpen\(true\)\}/,
  );
  assert.match(chat, /aria-controls="nexus-mobile-chat-list"/);
  assert.match(chat, /id="nexus-mobile-chat-list"/);
  assert.match(chat, /<AloPageSidebarTrigger \/>/);
  assert.match(
    chat,
    /setActive\(\{ kind: "room", id: r\.id \}\)[\s\S]*?setMobileListOpen\(false\)/,
  );
});

test("sidebar, quick actions, app-menu controls and mobile anchors retain touch/accessibility sizing", () => {
  const sidebarCss = read("alo-page-sidebar.css");
  const healthCss = read("health-reference.css");
  assert.match(sidebarCss, /\.alo-page-sidebar-close\s*\{[^}]*width: 44px;[^}]*height: 44px;/s);
  assert.match(
    sidebarCss,
    /\.alo-page-sidebar-trigger\s*\{[^}]*width: 44px !important;[^}]*min-width: 44px !important;[^}]*height: 44px !important;[^}]*min-height: 44px !important;/s,
  );
  assert.match(sidebarCss, /\.alo-page-sidebar-quick-action\s*\{[^}]*min-height: 50px;/s);
  assert.match(
    sidebarCss,
    /\.sport-ai-tabs button\s*\{[^}]*min-width: 44px;[^}]*min-height: 44px;/s,
  );
  assert.match(
    sidebarCss,
    /\.sport-chat-app \.community-back,[\s\S]*?width: 44px;[\s\S]*?height: 44px;/,
  );
  assert.match(sidebarCss, /@media \(max-width: 767px\)/);
  assert.match(sidebarCss, /@media \(min-width: 768px\) and \(max-width: 1000px\)/);
  assert.match(healthCss, /\.health-classic-action-primary\s*\{[^}]*min-height: 44px;/s);
  assert.match(
    healthCss,
    /\.health-classic-sources-grid[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/,
  );
  assert.match(
    healthCss,
    /html:not\(\[data-design-style="performance"\]\)\[data-theme="glacier"\]\s+body:has\(\.health-classic-dashboard\)/,
  );
  assert.match(healthCss, /\.health-classic-dashboard #health-today[\s\S]*?scroll-margin-top/);
});

test("reference glows follow theme tokens and existing personal themes stay scoped", () => {
  const sidebarCss = read("alo-page-sidebar.css");
  const mira = read("ai-reference.css");
  const nexus = read("community-reference.css");
  const health = read("health-reference.css");
  assert.match(sidebarCss, /color-mix\(in srgb, var\(--primary\)/);
  assert.doesNotMatch(sidebarCss, /#38bdf8|#8b5cf6/);
  assert.match(
    mira,
    /html\[data-design-style="performance"\]\[data-theme="glacier"\] main\.sport-ai-page/,
  );
  assert.match(nexus, /\[data-theme="glacier"\]:has\(\.sport-chat-app\)/);
  assert.match(
    health,
    /html\[data-design-style="performance"\]\[data-theme="glacier"\] body:has\(\.sport-health-page\)/,
  );
  assert.match(
    health,
    /html:not\(\[data-design-style="performance"\]\)\[data-theme="glacier"\]\s+body:has\(\.health-classic-dashboard\)/,
  );
  const classicStyles = health.split("/* Classic remains a separate saved design choice")[1] ?? "";
  assert.doesNotMatch(classicStyles, /#[0-9a-fA-F]{3,8}/);
  assert.doesNotMatch(health, /data-design-style="performance"\]:not\(\[data-theme="daylight"\]/);
});
