import assert from "node:assert/strict";
import fs from "node:fs";
import { rankAssets } from "../asset-search.js";

const assets = JSON.parse(fs.readFileSync(new URL("../data/assets.json", import.meta.url), "utf8")).assets;

function first(query) {
  return rankAssets(assets, query, 10)[0];
}

assert.equal(first("rocket lab")?.symbol, "RKLB", "Rocket Lab name should find the Nasdaq stock first");
assert.equal(first("rklb")?.type, "security", "RKLB should prefer the listed security over tokenized assets");
assert.equal(first("bitcoin")?.id, "bitcoin", "Bitcoin name should find canonical Bitcoin first");
assert.equal(first("btc")?.id, "bitcoin", "BTC should find canonical Bitcoin first");
assert.equal(first("ethereum")?.id, "ethereum", "Ethereum name should find canonical Ethereum first");
assert.equal(first("eth")?.id, "ethereum", "ETH should find canonical Ethereum first");
assert.equal(rankAssets(assets, "btc", 10).some(asset => asset.id === "bitcoin"), true, "BTC results must retain canonical Bitcoin when an ETF shares the ticker");
assert.equal(rankAssets(assets, "eth", 10).some(asset => asset.id === "ethereum"), true, "ETH results must retain canonical Ethereum when an ETF shares the ticker");
assert.equal(first("apple")?.symbol, "AAPL", "Apple should find AAPL first");
assert.equal(first("spacex")?.symbol, "SPCX", "SpaceX should find the listed SPCX equity first");
assert.equal(first("spacex")?.type, "security", "SpaceX should prefer the Nasdaq equity over crypto namesakes");
assert.equal(first("space x")?.symbol, "SPCX", "Space X spelling should find the listed SPCX equity first");
assert.equal(rankAssets(assets, "spacex", 10).some(asset => asset.type === "crypto"), true, "Matching crypto assets remain available in their own category");
assert.equal(rankAssets(assets, "definitely-not-an-asset", 10).length, 0, "Unmatched queries must return no results");

console.log("Asset search regression tests passed.");
