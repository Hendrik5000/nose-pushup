import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearEmergencyStop,
  coupleDevice,
  createEmptyStore,
  loadMiraDeviceStore,
  pauseDevice,
  resumeDevice,
  revokeDevice,
  setDevicePermission,
  setDeviceState,
  triggerEmergencyStop,
} from "../src/lib/mira-device-control";

test("Kopplung startet bewusst im Offline-Zustand", () => {
  const { store, device } = coupleDevice(createEmptyStore(), "Hendriks PC", "windows");
  assert.equal(device.state, "gekoppelt-offline");
  assert.equal(store.devices.length, 1);
  assert.match(device.couplingCode ?? "", /^\d{6}$/);
  assert.ok(store.activity[0].message.includes("offline"));
});

test("Kopplung ohne Namen schlaegt fehl", () => {
  assert.throws(() => coupleDevice(createEmptyStore(), "   ", "windows"));
});

test("Verbunden ist ohne echtes Gateway verboten", () => {
  const { store, device } = coupleDevice(createEmptyStore(), "PC", "windows");
  assert.throws(() => setDeviceState(store, device.id, "verbunden"), /Gateway/);
});

test("Berechtigungen werden pro Funktionsgruppe gesetzt und protokolliert", () => {
  const { store, device } = coupleDevice(createEmptyStore(), "PC", "windows");
  const next = setDevicePermission(store, device.id, "bildschirm", "lesen");
  const updated = next.devices.find((d) => d.id === device.id);
  assert.equal(updated?.permissions.bildschirm, "lesen");
  assert.ok(next.activity[0].message.includes("Bildschirm"));
});

test("Pausieren und Fortsetzen bleibt offline", () => {
  const { store, device } = coupleDevice(createEmptyStore(), "PC", "windows");
  const paused = pauseDevice(store, device.id);
  assert.equal(paused.devices[0].state, "pausiert");
  const resumed = resumeDevice(paused, device.id);
  assert.equal(resumed.devices[0].state, "gekoppelt-offline");
});

test("Not-Aus pausiert alle Geraete und ist widerrufbar", () => {
  const a = coupleDevice(createEmptyStore(), "PC", "windows").store;
  const b = coupleDevice(a, "Tablet", "ipad").store;
  const stopped = triggerEmergencyStop(b);
  assert.ok(stopped.devices.every((d) => d.state === "pausiert"));
  assert.equal(stopped.emergencyStopActive, true);
  const cleared = clearEmergencyStop(stopped);
  assert.equal(cleared.emergencyStopActive, false);
  assert.ok(cleared.devices.every((d) => d.state === "pausiert"));
});

test("Widerruf entfernt Geraet und Berechtigungen", () => {
  const { store, device } = coupleDevice(createEmptyStore(), "PC", "windows");
  const next = revokeDevice(store, device.id);
  assert.equal(next.devices.length, 0);
});

test("Speicher-Einlesen toleriert kaputte Daten", () => {
  const fake = { getItem: () => "kein json", setItem: () => undefined };
  const store = loadMiraDeviceStore(fake as unknown as Pick<Storage, "getItem">);
  assert.deepEqual(store, createEmptyStore());
});
