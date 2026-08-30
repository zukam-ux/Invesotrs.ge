import assert from "node:assert/strict";
import { extractGeorgianField, extractJsonObject } from "./news-text.mjs";

// Well-formed responses
assert.equal(
  extractGeorgianField(JSON.stringify({ bodyKa: "ბიტკოინის ფასი გაიზარდა" }), "bodyKa"),
  "ბიტკოინის ფასი გაიზარდა",
);
assert.equal(
  extractGeorgianField('```json\n{"bodyKa":"ტესტური სტატია"}\n```', "bodyKa"),
  "ტესტური სტატია",
);

// Truncated JSON: the model hit its output cap mid-string. The article text
// must survive instead of the whole enrichment being discarded.
const truncated = extractGeorgianField(
  '{"bodyKa": "## ბაზრის მიმოხილვა\\n\\nბიტკოინის ფასი გაიზარდა ინსტიტუციური მოთხოვნის გამო',
  "bodyKa",
);
assert.ok(truncated.includes("ბიტკოინის ფასი გაიზარდა"), "truncated JSON must still yield the article");
assert.ok(truncated.includes("\n"), "escaped newlines must be decoded");
assert.ok(!truncated.includes("\\n"), "raw escape sequences must not survive");

// The audit step uses a different field name.
assert.ok(
  extractGeorgianField('{"correctedBodyKa": "შესწორებული ქართული ტექსტი აქ', "correctedBodyKa").startsWith(
    "შესწორებული",
  ),
);

// No JSON wrapper at all: some fallback responses answer in plain markdown.
assert.equal(
  extractGeorgianField("## ბიტკოინი\n\nსტატიის ტექსტი", "bodyKa"),
  "## ბიტკოინი\n\nსტატიის ტექსტი",
);

// Empty or non-Georgian answers must not be published.
assert.equal(extractGeorgianField('{"bodyKa": ""}', "bodyKa"), "");
assert.equal(extractGeorgianField("Sorry, I cannot help with that.", "bodyKa"), "");
assert.equal(extractGeorgianField("", "bodyKa"), "");

// Escaped quotes inside a truncated payload
assert.ok(
  extractGeorgianField('{"bodyKa": "კომპანიამ თქვა \\"ზრდა\\" და გააგრძელა', "bodyKa").includes('"ზრდა"'),
);

// extractJsonObject still isolates objects from surrounding prose.
assert.equal(extractJsonObject('noise {"a":1} trailing'), '{"a":1}');

console.log("News text extraction checks passed.");
