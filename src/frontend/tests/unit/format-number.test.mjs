/** Full-precision formatting used by the data table. */
import { expect, it } from "vitest";
import { formatFullPrecision } from "../../src/lib/format-number";

it("keeps every digit that identifies the double, with a decimal comma", () => {
  expect(formatFullPrecision(0.1234567890123456)).toBe("0,1234567890123456");
  expect(formatFullPrecision(0.30000000000000004)).toBe("0,30000000000000004");
  expect(formatFullPrecision(-3.3333333333333335)).toBe("-3,3333333333333335");
  expect(Number(formatFullPrecision(1 / 3).replace(",", "."))).toBe(1 / 3);
});

it("does not group thousands and keeps integers plain", () => {
  expect(formatFullPrecision(299792458)).toBe("299792458");
  expect(formatFullPrecision(1234567.8901234567)).toBe("1234567,8901234567");
  expect(formatFullPrecision(0)).toBe("0");
});

it("uses scientific notation for extreme magnitudes with a real minus sign", () => {
  expect(formatFullPrecision(6.62607015e-34)).toBe("6,62607015e−34");
  expect(formatFullPrecision(4.440892098500626e-16)).toBe("4,440892098500626e−16");
  expect(formatFullPrecision(1e21)).toBe("1e21");
});

it("does not round small uncertainties to zero", () => {
  expect(formatFullPrecision(0.000031415926535897935)).not.toBe("0");
  expect(formatFullPrecision(0.000031415926535897935)).toBe("0,000031415926535897935");
});
