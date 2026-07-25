import assert from "node:assert/strict";
import { RANGE_LABELS, buildChartGeometry, calculateChange } from "../market-chart.js";

assert.equal(RANGE_LABELS["1m"], "ბოლო 1 თვე");
assert.equal(RANGE_LABELS["1y"], "ბოლო 1 წელი");

const points = [
  { timestamp: 1, close: 100 },
  { timestamp: 2, close: 105 },
  { timestamp: 3, close: 110 },
];
assert.deepEqual(calculateChange(points), {
  start: 100,
  latest: 110,
  value: 10,
  percent: 10,
});
assert.equal(calculateChange([{ timestamp: 1, close: 100 }]), null);

const geometry = buildChartGeometry(points);
assert.ok(geometry.line.startsWith("M"));
assert.ok(geometry.line.includes(" L"));
assert.ok(geometry.area.endsWith(" Z"));
assert.equal(geometry.min, 100);
assert.equal(geometry.max, 110);

console.log("Market chart regression checks passed.");
