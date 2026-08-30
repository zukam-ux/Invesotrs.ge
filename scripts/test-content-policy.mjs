import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  APPROVED_NEWS_SOURCES,
  GEORGIAN_PUBLISHERS,
  NEWS_CATEGORIES,
  approvedNewsSourcesSql,
  isApprovedNewsSource,
  normalizeNewsCategory,
} from "../src/content-policy.mjs";

// A story may only be stored if the site can also display it. Both sides now
// read one list, and no copy of it may reappear in the worker: a source added
// to one place and missed in another produced archive entries whose article
// pages returned 404.
const worker = await readFile(new URL("../src/worker.mjs", import.meta.url), "utf8");
assert.ok(
  !/source IN \('Yahoo Finance'/.test(worker),
  "worker must use approvedNewsSourcesSql() rather than its own copy of the source list",
);
assert.ok(
  worker.includes("isApprovedNewsSource(article.source)"),
  "the ingest endpoint must reject stories from unapproved sources",
);
for (const source of ["Yahoo Finance", "MarketWatch", "BM.GE"]) {
  assert.ok(isApprovedNewsSource(source), `${source} must be approved`);
}
for (const source of ["Reuters", "CNBC", "CoinDesk", "Barron's", "", null]) {
  assert.ok(!isApprovedNewsSource(source), `${source} must not be approved`);
}
for (const publisher of GEORGIAN_PUBLISHERS) {
  assert.ok(APPROVED_NEWS_SOURCES.includes(publisher), `${publisher} must be in the approved list`);
}
assert.ok(approvedNewsSourcesSql().startsWith("source IN ("));
assert.ok(approvedNewsSourcesSql("a.source").startsWith("a.source IN ("));

assert.equal(normalizeNewsCategory("აქციები"), NEWS_CATEGORIES.stocks);
assert.equal(normalizeNewsCategory("ETF"), NEWS_CATEGORIES.stocks);
assert.equal(normalizeNewsCategory("ტექნოლოგიები და AI", "OpenAI launches a new model"), NEWS_CATEGORIES.ai);
assert.equal(normalizeNewsCategory("ტექნოლოგიები და AI", "Cloud software company reports earnings"), NEWS_CATEGORIES.technology);
assert.equal(normalizeNewsCategory("ბაზრები და ეკონომიკა | კრიპტო"), NEWS_CATEGORIES.crypto);
assert.equal(normalizeNewsCategory("უცნობი"), NEWS_CATEGORIES.markets);

console.log("Content taxonomy policy checks passed.");
