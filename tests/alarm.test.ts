import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_ALARM_SETTINGS,
  getDueAlarm,
  getNextAlarmDate,
  isValidAlarmTime,
  localAlarmDateKey,
} from "../src/lib/alarm";

test("accepts valid 24-hour alarm times only", () => {
  assert.equal(isValidAlarmTime("00:00"), true);
  assert.equal(isValidAlarmTime("23:59"), true);
  assert.equal(isValidAlarmTime("24:00"), false);
  assert.equal(isValidAlarmTime("7:05"), false);
  assert.equal(isValidAlarmTime(null), false);
});

test("daily alarm is due once inside its short resume grace period", () => {
  const now = new Date(2026, 0, 12, 7, 3, 0);
  const settings = { ...DEFAULT_ALARM_SETTINGS, time: "07:00", enabled: true };
  assert.equal(getDueAlarm(settings, now), localAlarmDateKey(now));
  assert.equal(getDueAlarm({ ...settings, lastTriggeredFor: localAlarmDateKey(now) }, now), null);
  assert.equal(getDueAlarm(settings, new Date(2026, 0, 12, 6, 59, 59)), null);
  assert.equal(getDueAlarm(settings, new Date(2026, 0, 12, 7, 6, 0)), null);
});

test("disabled alarm is never due", () => {
  assert.equal(
    getDueAlarm({ ...DEFAULT_ALARM_SETTINGS, time: "07:00" }, new Date(2026, 0, 12, 7, 0)),
    null,
  );
});

test("snooze alarm is due once and expires after the grace period", () => {
  const snooze = new Date(2026, 0, 12, 7, 5, 0);
  const settings = {
    ...DEFAULT_ALARM_SETTINGS,
    enabled: true,
    time: "07:00",
    snoozeUntil: snooze.toISOString(),
  };
  const token = `snooze:${Math.floor(snooze.getTime() / 60_000)}`;
  assert.equal(getDueAlarm(settings, new Date(2026, 0, 12, 7, 5, 1)), token);
  assert.equal(
    getDueAlarm({ ...settings, lastTriggeredFor: token }, new Date(2026, 0, 12, 7, 5, 1)),
    null,
  );
  assert.equal(getDueAlarm(settings, new Date(2026, 0, 12, 7, 11, 0)), null);
});

test("next alarm uses today when still ahead, otherwise tomorrow", () => {
  const now = new Date(2026, 0, 12, 6, 59, 0);
  const next = getNextAlarmDate("07:00", now);
  assert.ok(next);
  assert.equal(next.getDate(), 12);
  assert.equal(next.getHours(), 7);
  const tomorrow = getNextAlarmDate("06:00", now);
  assert.ok(tomorrow);
  assert.equal(tomorrow.getDate(), 13);
  assert.equal(getNextAlarmDate("bad", now), null);
});
