import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const homePath = resolve(process.cwd(), "src/routes/_authenticated/index.tsx");
const home = readFileSync(homePath, "utf8");
const hubStart = home.indexOf("function HomeAppHub");
const cardsStart = home.indexOf("function HubAppCard", hubStart);
const hub = home.slice(hubStart, cardsStart);

test("Alo home hub points only to existing app routes and uses real profile data", () => {
  assert.notEqual(hubStart, -1, "HomeAppHub should exist");
  assert.notEqual(cardsStart, -1, "HubAppCard should follow HomeAppHub");

  for (const [destination, routeFile] of [
    ["/ai", "ai.tsx"],
    ["/chat", "chat.tsx"],
    ["/exercises", "exercises.tsx"],
    ["/profile", "profile.tsx"],
  ] as const) {
    assert.ok(existsSync(resolve(process.cwd(), "src/routes/_authenticated", routeFile)));
    assert.ok(hub.includes(`to="${destination}"`), `hub should link to ${destination}`);
  }

  assert.match(hub, /aria-label="Freunde öffnen"/);
  assert.match(hub, /to="\/profile"\s+hash="profile-training"/);
  assert.match(hub, /aria-label="Profil und Einstellungen öffnen"/);
  assert.match(hub, /avatarUrl\s*\?/);
  assert.match(hub, /Nose Pushup, Übungen und Training/);
  assert.match(hub, /artwork="mira"/);
  assert.match(hub, /artwork="nexus"/);
  assert.match(hub, /artwork="health"/);
  assert.match(hub, /artwork="settings"/);
});

test("the planned original game stays a visibly non-interactive placeholder", () => {
  const gameStart = hub.indexOf("Spielwelt");
  assert.notEqual(gameStart, -1);
  const gameAndFooter = hub.slice(gameStart);
  assert.match(gameAndFooter, /Eigenständiges Abenteuer/);
  assert.match(gameAndFooter, /noch nicht spielbar/);
  assert.match(gameAndFooter, /Privat · in Arbeit/);
  assert.doesNotMatch(gameAndFooter, /<Link\b|href=/);
  assert.doesNotMatch(hub, /\.from\(|fetch\(|\.insert\(|dispatchEvent\(/);
});

test("the home view has original artwork and keeps the existing training dashboard collapsible", () => {
  const artworkStart = home.indexOf("function HubArtwork");
  const dashboardStart = home.indexOf("function Dashboard", artworkStart);
  const artwork = home.slice(artworkStart, dashboardStart);
  assert.notEqual(artworkStart, -1);
  assert.match(artwork, /<svg[\s\S]*?viewBox="0 0 280 132"/);
  assert.match(artwork, /kind === "mira"/);
  assert.match(artwork, /kind === "nexus"/);
  assert.match(artwork, /kind === "health"/);
  assert.match(artwork, /kind === "settings"/);

  const trainingSection = home.slice(home.indexOf('id="training-overview"'));
  assert.match(trainingSection, /<summary[\s\S]*?Trainingsübersicht & Gym-Partner/);
  assert.match(trainingSection, /<GymPartnerPanel \/>/);
  assert.match(trainingSection, /<DashboardGrid renderWidget=\{renderWidget\} \/>/);
  assert.doesNotMatch(trainingSection.slice(0, trainingSection.indexOf(">")), /\bopen\b/);
});
