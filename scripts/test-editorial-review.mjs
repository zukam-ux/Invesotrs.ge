import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = await readFile(new URL("../src/worker.mjs", import.meta.url), "utf8");
const migration = await readFile(new URL("../migrations/0003_georgian_editorial_review.sql", import.meta.url), "utf8");
const workflow = await readFile(new URL("../.github/workflows/review-georgian-news.yml", import.meta.url), "utf8");

for (const field of ["editorial_status", "reviewed_by", "reviewed_at", "revision"]) {
  assert.ok(migration.includes(field), `Migration must add ${field}`);
}
assert.ok(migration.includes("editorial_reviews"));
assert.ok(worker.includes("CASE WHEN ? = 'საქართველო' THEN 'pending' ELSE 'published' END"));
assert.ok(worker.includes("category != 'საქართველო' OR editorial_status = 'published'"));
assert.ok(worker.includes('reviewerRole: "Investors.ge Editor"'));
assert.ok(worker.includes('!["approve", "reject"].includes(action)'));
assert.ok(workflow.includes("Review Georgian news"));
assert.ok(workflow.includes("EDITORIAL_REVIEW_TOKEN"));
assert.ok(worker.includes("env.EDITORIAL_REVIEW_TOKEN"));

console.log("Georgian editorial review checks passed.");
