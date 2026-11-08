import assert from "node:assert/strict";
import test from "node:test";
import { getMood, getWaterMl, setMood, setWaterMl } from "../src/lib/extra-features.ts";

test("water and mood trackers are account-scoped and ignore unattributed legacy values", () => {
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => data.set(key, value),
      },
    },
  });

  try {
    const day = "2026-11-08";
    const legacyWater = JSON.stringify({ [day]: 1800 });
    const legacyMood = JSON.stringify({ [day]: 5 });
    data.set("np-water", legacyWater);
    data.set("np-mood", legacyMood);

    assert.equal(getWaterMl("account-a", day), 0);
    assert.equal(getMood("account-a", day), null);
    assert.equal(setWaterMl("account-a", 450, day), 450);
    assert.equal(setMood("account-a", 4, day), true);

    assert.equal(getWaterMl("account-b", day), 0);
    assert.equal(getMood("account-b", day), null);
    assert.equal(getWaterMl("account-a", day), 450);
    assert.equal(getMood("account-a", day), 4);
    assert.equal(data.get("np-water:account-a"), JSON.stringify({ [day]: 450 }));
    assert.equal(data.get("np-mood:account-a"), JSON.stringify({ [day]: 4 }));

    // These historical global values cannot be attributed safely, so leave them untouched but never display them.
    assert.equal(data.get("np-water"), legacyWater);
    assert.equal(data.get("np-mood"), legacyMood);
  } finally {
    if (priorWindow) Object.defineProperty(globalThis, "window", priorWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
