/** Strict line coverage validation for LCOV reports. */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Returns whether integer counters describe coverage strictly above 90%. */
export function lineCoveragePasses(hit, total) {
  return Number.isSafeInteger(hit) && Number.isSafeInteger(total) &&
    total > 0 && hit >= 0 && hit <= total && hit / total > 0.9;
}

/** Parses LCOV per-file summary counters; malformed or empty reports are rejected. */
export function parseLcov(contents) {
  let hit = 0;
  let total = 0;
  let record = null;
  let count = 0;
  for (const line of contents.split(/\r?\n/)) {
    if (line.startsWith("SF:")) {
      if (record || !line.slice(3)) throw new Error("Invalid LCOV source record");
      record = {};
    } else if (/^(LF|LH):/.test(line)) {
      const match = /^(LF|LH):(\d+)$/.exec(line);
      if (!record || !match || Object.hasOwn(record, match[1])) throw new Error("Invalid LCOV line counter");
      record[match[1]] = Number(match[2]);
    } else if (line === "end_of_record") {
      if (!record || !Number.isSafeInteger(record.LF) || !Number.isSafeInteger(record.LH) || record.LH > record.LF) throw new Error("Incomplete LCOV record");
      total += record.LF;
      hit += record.LH;
      count++;
      record = null;
    }
  }
  if (record || count === 0 || !Number.isSafeInteger(total) || !Number.isSafeInteger(hit)) throw new Error("Incomplete or empty LCOV report");
  return { hit, total };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error("Usage: node check.mjs <report.lcov>");
    const { hit, total } = parseLcov(readFileSync(process.argv[2], "utf8"));
    console.log(`Line coverage: ${hit}/${total} (${total ? (100 * hit / total).toFixed(2) : "0.00"}%)`);
    if (!lineCoveragePasses(hit, total)) process.exitCode = 1;
  } catch (error) {
    console.error(`Coverage check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
