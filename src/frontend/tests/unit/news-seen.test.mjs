// @vitest-environment jsdom
/** News seen: when the news open by themselves after an update, and the unseen marker. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  NEWS_SEEN_KEY,
  UPDATE_SEEN_KEY,
  readSeen,
  versionToShowAfterUpdate,
  writeSeen,
} from "../../src/features/news/news-seen";
import { useUpdateSeen } from "../../src/features/news/use-update-seen";

const broken = {
  getItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("blocked");
  },
};

it("opens the news on the first launch after an update, never on the very first run", () => {
  expect(versionToShowAfterUpdate(null, "0.3.0")).toBeNull();
  expect(versionToShowAfterUpdate("0.2.8", "0.3.0")).toBe("0.3.0");
  expect(versionToShowAfterUpdate("0.3.0", "0.3.0")).toBeNull();
  expect(versionToShowAfterUpdate("0.3.1", "0.3.0")).toBeNull();
  expect(versionToShowAfterUpdate("0.9.0", "0.10.0")).toBe("0.10.0");
});

it("stores a version and ignores a store that is missing, refuses or holds rubbish", () => {
  localStorage.clear();
  expect(readSeen(NEWS_SEEN_KEY)).toBeNull();
  writeSeen(NEWS_SEEN_KEY, "0.3.0");
  expect(readSeen(NEWS_SEEN_KEY)).toBe("0.3.0");
  localStorage.setItem(NEWS_SEEN_KEY, "not a version");
  expect(readSeen(NEWS_SEEN_KEY)).toBeNull();
  expect(readSeen(NEWS_SEEN_KEY, broken)).toBeNull();
  expect(() => writeSeen(NEWS_SEEN_KEY, "0.3.0", broken)).not.toThrow();
  localStorage.clear();
});

let root;
let node;
let seen;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});
afterEach(async () => {
  await act(async () => root.unmount());
  node.remove();
  localStorage.clear();
});
function Probe({ offered }) {
  seen = useUpdateSeen(offered);
  return null;
}
const render = (offered) => act(async () => root.render(createElement(Probe, { offered })));

it("is unseen while an update is offered and its news were not opened", async () => {
  await render(null);
  expect(seen.unseen).toBe(false);
  await render("0.3.0");
  expect(seen.unseen).toBe(true);
  await act(async () => seen.markSeen());
  expect(seen.unseen).toBe(false);
  expect(localStorage.getItem(UPDATE_SEEN_KEY)).toBe("0.3.0");
  // A newer update is news again; the old record does not hide it.
  await render("0.3.1");
  expect(seen.unseen).toBe(true);
});

it("remembers across launches, and marking with nothing offered does nothing", async () => {
  localStorage.setItem(UPDATE_SEEN_KEY, "0.3.0");
  await render("0.3.0");
  expect(seen.unseen).toBe(false);
  await render(null);
  await act(async () => seen.markSeen());
  expect(localStorage.getItem(UPDATE_SEEN_KEY)).toBe("0.3.0");
});
