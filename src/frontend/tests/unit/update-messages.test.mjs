/** Update texts: the manual-install reasons, sizes and progress. */
import { expect, it } from "vitest";
import {
  formatMegabytes,
  manualMessage,
  percent,
} from "../../src/features/updates/update-messages";

it.each([
  ["permissionDenied", "permissão"],
  ["installFailed", "automática não funcionou"],
  ["notWritable", "substituir o próprio arquivo"],
  ["readOnlyLocation", "pasta Aplicativos"],
  ["previousAttemptFailed", "não terminou"],
])("explains %s and names the version", (reason, text) => {
  const message = manualMessage(reason, "0.3.0");
  expect(message).toContain(text);
  expect(message).toContain("0.3.0");
});

it("formats megabytes with a decimal comma", () => {
  expect(formatMegabytes(0)).toBe("0,0 MB");
  expect(formatMegabytes(91_647_590)).toBe("87,4 MB");
});

it("computes whole percentages and gives up without a size", () => {
  expect(percent(0, 100)).toBe(0);
  expect(percent(419, 1000)).toBe(41);
  expect(percent(2000, 1000)).toBe(100);
  expect(percent(5, null)).toBeNull();
  expect(percent(5, 0)).toBeNull();
});
