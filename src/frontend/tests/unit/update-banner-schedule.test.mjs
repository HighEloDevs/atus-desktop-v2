// @vitest-environment jsdom
/** Banner schedule: once per day and version, and a store that can fail or be corrupt. */
import { expect, it } from "vitest";
import {
  BANNER_STORAGE_KEY,
  localDay,
  readBannerRecord,
  shouldShowBanner,
  writeBannerRecord,
} from "../../src/features/updates/banner-schedule";

/** A minimal `Storage` backed by a map. */
function memory(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, String(value)),
  };
}
const broken = {
  getItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("blocked");
  },
};

it("describes the local day with padding", () => {
  expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  expect(localDay(new Date(2026, 10, 13, 0, 0))).toBe("2026-11-13");
});

it("shows once a day for each version", () => {
  const record = { version: "0.3.0", day: "2026-11-13" };
  expect(shouldShowBanner(null, "0.3.0", "2026-11-13")).toBe(true);
  expect(shouldShowBanner(record, "0.3.0", "2026-11-13")).toBe(false);
  expect(shouldShowBanner(record, "0.3.0", "2026-11-14")).toBe(true);
  expect(shouldShowBanner(record, "0.3.1", "2026-11-13")).toBe(true);
});

it("round-trips the record", () => {
  const storage = memory();
  expect(readBannerRecord(storage)).toBeNull();
  writeBannerRecord({ version: "0.3.0", day: "2026-11-13" }, storage);
  expect(readBannerRecord(storage)).toEqual({ version: "0.3.0", day: "2026-11-13" });
});

it.each(["not json", "null", "[]", '"text"', '{"version":1,"day":"x"}', '{"version":"1"}'])(
  "treats the corrupt record %s as none",
  (raw) => {
    expect(readBannerRecord(memory({ [BANNER_STORAGE_KEY]: raw }))).toBeNull();
  },
);

it("survives a store that refuses", () => {
  expect(readBannerRecord(broken)).toBeNull();
  expect(() => writeBannerRecord({ version: "1.0.0", day: "2026-11-13" }, broken)).not.toThrow();
});

it("uses localStorage by default", () => {
  localStorage.removeItem(BANNER_STORAGE_KEY);
  expect(readBannerRecord()).toBeNull();
  writeBannerRecord({ version: "0.3.0", day: "2026-11-13" });
  expect(readBannerRecord()).toEqual({ version: "0.3.0", day: "2026-11-13" });
  localStorage.removeItem(BANNER_STORAGE_KEY);
});
