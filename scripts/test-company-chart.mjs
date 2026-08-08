import assert from "node:assert/strict";
import { chartGeometry } from "../company-chart.js";
const geometry = chartGeometry([{ close: 10 }, { close: 12 }, { close: 11 }]);
assert.equal(geometry.min, 10);
assert.equal(geometry.max, 12);
assert.match(geometry.line, /^M/);
assert.match(geometry.area, /Z$/);
assert.equal(chartGeometry([{ close: 1 }]), null);
console.log("Company chart regression tests passed.");
