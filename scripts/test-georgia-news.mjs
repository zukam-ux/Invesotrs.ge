import assert from "node:assert/strict";
import {
  GEORGIAN_NEWS_SOURCES,
  isEligibleGeorgianStory,
  normalizeGeorgianSource,
} from "./georgia-news-policy.mjs";

assert.deepEqual([...GEORGIAN_NEWS_SOURCES], [
  "National Bank of Georgia",
  "Georgian Stock Exchange",
  "Ministry of Finance of Georgia",
  "GeoStat",
  "BM.GE",
  "Entrepreneur.ge",
  "Marketer.ge",
]);
assert.equal(normalizeGeorgianSource("NBG", "https://nbg.gov.ge/media/news/example"), "National Bank of Georgia");
assert.equal(normalizeGeorgianSource("GSE", "https://gse.ge/en/news/example"), "Georgian Stock Exchange");
assert.equal(normalizeGeorgianSource("MoF", "https://mof.ge/en/n/news/example"), "Ministry of Finance of Georgia");
assert.equal(isEligibleGeorgianStory({ source: "National Bank of Georgia", title: "Monetary policy interest rate decision" }), true);
assert.equal(normalizeGeorgianSource("BM.GE"), "BM.GE");
assert.equal(normalizeGeorgianSource("Marketer", "https://www.marketer.ge/story"), "Marketer.ge");
assert.equal(isEligibleGeorgianStory({ source: "BM.GE", title: "ახალი ობლიგაციები საქართველოში" }), true);
assert.equal(isEligibleGeorgianStory({ source: "Entrepreneur.ge", title: "ინვესტიციები სტარტაპებში" }), true);
assert.equal(isEligibleGeorgianStory({ source: "Marketer.ge", title: "ბრენდის ახალი კამპანია" }), false);
assert.equal(isEligibleGeorgianStory({ source: "Other.ge", title: "ფასიანი ქაღალდები" }), false);

console.log("Georgian news source and keyword checks passed.");
