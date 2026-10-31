import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file: string) => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");

test("shared page navigation exposes Mira, Nexus, Alo Health and existing settings destinations", () => {
  const sidebar = read("components/alo/AloPageSidebar.tsx");
  for (const destination of ["/ai", "/chat", "/health", "/exercises", "/profile"]) {
    assert.ok(sidebar.includes(`to: "${destination}"`), `missing destination ${destination}`);
  }
  for (const label of ["Mira", "Nexus", "Alo Health", "Training", "Einstellungen"])
    assert.ok(sidebar.includes(`label: "${label}"`), `missing label ${label}`);
  assert.match(sidebar, /collapsible="offcanvas"/);
  assert.match(sidebar, /<nav\s+id="alo-page-sidebar-navigation"\s+aria-label="Alo-Bereiche"/);
  assert.match(sidebar, /aria-current=\{isActive \? "page" : undefined\}/);
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
  assert.match(primitive, /<Sheet open=\{openMobile\} onOpenChange=\{setOpenMobile\}/);
  assert.match(primitive, /<SheetTitle>Seitenmenü<\/SheetTitle>/);
  assert.match(sheet, /@radix-ui\/react-dialog/);
  assert.match(sheet, /<SheetPrimitive\.Content/);
});

test("all three routes keep their existing pages and mark the corresponding section active", () => {
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
});

test("Nexus app navigation remains independent from the room-list switcher and mobile back action", () => {
  const chat = read("components/chat/LocalChatShell.tsx");
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

test("sidebar close, triggers, Mira tabs and Nexus back controls remain at least 44px", () => {
  const css = read("alo-page-sidebar.css");
  assert.match(css, /\.alo-page-sidebar-close\s*\{[^}]*width: 44px;[^}]*height: 44px;/s);
  assert.match(
    css,
    /\.alo-page-sidebar-trigger\s*\{[^}]*width: 44px !important;[^}]*min-width: 44px !important;[^}]*height: 44px !important;[^}]*min-height: 44px !important;/s,
  );
  assert.match(css, /\.sport-ai-tabs button\s*\{[^}]*min-width: 44px;[^}]*min-height: 44px;/s);
  assert.match(css, /\.sport-chat-app \.community-back,[\s\S]*?width: 44px;[\s\S]*?height: 44px;/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /@media \(min-width: 768px\) and \(max-width: 1000px\)/);
});

test("reference palettes apply only to Glacier so personal themes remain intact", () => {
  const mira = read("ai-reference.css");
  const nexus = read("community-reference.css");
  const health = read("health-reference.css");
  assert.match(
    mira,
    /html\[data-design-style="performance"\]\[data-theme="glacier"\] main\.sport-ai-page/,
  );
  assert.match(nexus, /\[data-theme="glacier"\]:has\(\.sport-chat-app\)/);
  assert.match(
    health,
    /html\[data-design-style="performance"\]\[data-theme="glacier"\] body:has\(\.sport-health-page\)/,
  );
  assert.doesNotMatch(health, /data-design-style="performance"\]:not\(\[data-theme="daylight"\]/);
});
