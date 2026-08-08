# Investors.ge Product and Safe Architecture Specification

Status: Proposed direction for approval  
Version: 1.0  
Date: 2026-08-08  
Scope: Product definition, information architecture, data architecture, newsroom controls, reliability, governance, and phased delivery.  

## 1. Executive decision

Investors.ge will become Georgia's trusted Georgian-language market intelligence and financial news platform.

It will combine:

1. Global stocks, ETFs, indices, commodities, currencies, and market information.
2. A separate cryptocurrency product.
3. Important global investment news from attributable, approved sources.
4. Original Georgian explanations, briefings, and analysis.
5. Dedicated coverage of Georgia's investment environment.
6. Practical education and decision-support tools for Georgian investors.

Investors.ge is inspired by the usefulness of Google Finance and Yahoo Finance, but it will not claim feature parity or real-time data until those capabilities are demonstrably available.

## 2. Approved positioning

### 2.1 Current truthful description

> Investors.ge is a Georgian-language investment information platform combining global market data, international and Georgian financial news, investor education, and practical tools.

### 2.2 Target positioning

> Investors.ge is Georgia's trusted market intelligence and financial news platform—the primary Georgian-language destination for understanding global markets, Georgian investment opportunities, stocks, ETFs, crypto, technology, and AI.

### 2.3 Long-term differentiator

> Global market intelligence, responsibly interpreted in Georgian, with the strongest structured coverage of Georgia's investment environment.

### 2.4 Mission

Make investing understandable, responsible, and widely accessible in Georgia without turning financial information into hype, gambling, or undisclosed promotion.

### 2.5 Product boundaries

Investors.ge is:

- an information, market-intelligence, news, and education platform;
- a Georgian financial publisher with attributable sources;
- a structured discovery layer for global and Georgian investments;
- a provider of neutral tools and comparisons.

Investors.ge is not, unless separately licensed and explicitly launched:

- a broker, exchange, investment adviser, portfolio manager, or custodian;
- a source of personalized buy or sell recommendations;
- a guarantor of investment returns;
- a real-time exchange-data vendor;
- an undisclosed advertising or lead-generation channel.

## 3. Product principles

1. **Correct before fast.** Do not publish unverified facts merely to appear current.
2. **Source before summary.** Every factual market or news item must be traceable.
3. **Freshness must be measurable.** Show timestamps, market status, delay type, and source.
4. **Failure must be visible.** Never substitute invented, mismatched, or silently stale data.
5. **Georgia is a first-class product.** Georgian investment coverage is not a secondary category.
6. **Stocks and crypto are different products.** They may share infrastructure but not definitions or risk language.
7. **AI assists; accountable people publish.** High-risk content requires human editorial control.
8. **Commercial influence is labelled.** Advertising never silently controls editorial ranking.
9. **Education avoids hype.** Explain both opportunity and risk.
10. **Claims follow evidence.** Never claim popularity, traffic, real-time data, or market leadership without proof.

## 4. Primary audiences

### 4.1 New Georgian investor

Needs plain-language education, risk framing, trusted starting points, comparisons, and scam-resistant guidance.

### 4.2 Active retail investor

Needs current market context, asset discovery, watchlists, company events, alerts, and Georgian explanations of global developments.

### 4.3 Georgian business and finance professional

Needs Georgian company financing news, bonds, macroeconomic data, regulation, disclosures, and reliable source links.

### 4.4 Institutional and media audience

Needs attributable facts, corrections, methodology, structured archives, dependable uptime, and exportable or embeddable information.

## 5. Product pillars

### 5.1 Markets

Dependable and timestamped information for:

- stocks;
- ETFs;
- indices;
- bonds;
- commodities;
- currencies and GEL reference rates.

### 5.2 Crypto

A separate 24/7 product for:

- coins and tokens;
- stablecoins;
- market rankings;
- trading pairs;
- market capitalization, supply, and volume;
- crypto-specific news and risk disclosures.

### 5.3 Newsroom

Important global financial news, responsible Georgian summaries, original briefings, and analysis.

### 5.4 Georgia

Structured coverage of Georgia's investment environment, including official data, local capital markets, financial products, regulation, and company financing.

### 5.5 Learn and Tools

Education, calculators, comparisons, glossaries, and decision-support experiences that connect back to sourced market information.

## 6. Information architecture

### 6.1 Primary navigation

- Today
- Markets
- Crypto
- News
- Georgia
- Learn
- Tools

### 6.2 Markets

- Overview
- Stocks
- ETFs
- Indices
- Bonds
- Commodities
- Currencies
- Market calendar
- Screener, when validated

### 6.3 Crypto

- Overview
- Coins
- Stablecoins
- Rankings
- Crypto news
- Learn crypto

### 6.4 News taxonomy

Every article has exactly one primary category and may have multiple controlled tags.

Primary categories:

- Global Markets
- Companies
- Economy and Central Banks
- Technology
- AI
- Crypto
- Georgia

Controlled tags may include asset symbols, companies, countries, industries, event types, and source types.

Invalid combined category strings are prohibited. An article related to several subjects receives one primary category plus tags.

### 6.5 Georgia

- Latest Georgian investment news
- NBG and monetary policy
- Georgian Stock Exchange and disclosures
- Government securities
- Corporate bonds
- Bank deposits
- Pension and asset management
- Georgian companies and transactions
- FDI and economic indicators
- Taxes and regulation
- Brokers and investment platforms

## 7. Market-data contract

### 7.1 Separate freshness concepts

The platform must never confuse:

1. **Directory freshness:** when the list of available instruments was updated.
2. **Quote freshness:** when the provider last observed the price.
3. **Exchange delay:** real-time, delayed, end-of-day, indicative, or unavailable.
4. **Interface refresh:** how frequently the user's screen requests new data.

### 7.2 Required fields for every quote

- internal instrument ID;
- canonical symbol;
- exchange or venue;
- instrument type;
- currency;
- price;
- absolute and percentage change;
- market state;
- provider timestamp;
- ingestion timestamp;
- display timestamp;
- source;
- delay classification;
- stale status;
- licensing/redistribution class.

### 7.3 Price-state labels

Allowed user-facing states:

- Real-time
- Delayed by approximately N minutes
- End of day
- Official daily reference rate
- Indicative
- Stale—last valid update at [time]
- Temporarily unavailable

The label “live” is prohibited unless the underlying provider contract and measured delivery support it.

### 7.4 Safe failure behavior

- Never display `0`, a placeholder, or a previous instrument's price as a fallback.
- Never silently map one instrument to another.
- Never present an ETF proxy as its tracked index.
- Keep a last known value only with a visible stale label and timestamp.
- Remove percentage movement when the comparison basis is missing.
- Record provider errors and alert operators.
- Reject impossible values, invalid currencies, reversed pairs, duplicate timestamps, and extreme unexplained moves for review.

### 7.5 Provider strategy

Phase 1 may use clearly disclosed delayed or third-party data. Second-level stock updates require a contracted provider with redistribution rights.

Provider selection must evaluate:

- exchange coverage;
- delay and update frequency;
- redistribution permission;
- historical data availability;
- corporate actions;
- fundamentals;
- uptime and rate limits;
- WebSocket/streaming support;
- cost at expected traffic;
- fallback rights;
- auditability and support.

Critical market indicators should use a validated secondary provider where licensing permits. A fallback may preserve availability but must not change the meaning of the instrument.

## 8. Instrument and entity model

Every market instrument receives a stable internal ID independent of provider symbols.

Core entities:

- Instrument
- Listing
- Issuer
- Exchange
- Quote
- PriceBar
- CorporateAction
- FundamentalPeriod
- Event
- NewsArticle
- Source
- Topic
- Watchlist
- Alert
- PortfolioHolding, in a later phase

Stocks, ETFs, indices, bonds, currencies, commodities, and crypto must have distinct type-specific validation.

## 9. Newsroom architecture

### 9.1 Content types

#### Source update

A short, clearly labelled summary of facts from an attributable external source. It is not presented as original reporting.

#### Investors.ge briefing

An original Georgian explanation synthesizing verified sources and explaining relevance to Georgian investors. It has an accountable editor.

#### Investors.ge analysis

Original reporting or analysis with an author, methodology, disclosures, citations, and clear separation between fact and interpretation.

#### Sponsored content

Commercial material visibly labelled at card, article, metadata, and distribution level. It cannot be presented as independent editorial selection.

### 9.2 Ingestion pipeline

1. Collect approved feeds, official disclosures, and direct publisher material.
2. Normalize URLs, source identity, publication time, and language.
3. Deduplicate the same event across publishers.
4. Score investment relevance, source quality, timeliness, and Georgian relevance.
5. Extract claims, entities, numbers, dates, currencies, and quotations.
6. Translate or draft with AI assistance where appropriate.
7. Validate output against extracted source facts.
8. Route high-risk and high-importance material to human review.
9. Publish with source, timestamps, content type, author/editor, and revision ID.
10. Monitor corrections, link availability, and freshness.

### 9.3 Mandatory human-review subjects

- market-moving claims;
- prices and percentage changes;
- earnings and forecasts;
- taxes and regulation;
- central-bank decisions;
- allegations, litigation, and named individuals;
- Georgian investment products;
- personalized or prescriptive financial language;
- content whose translation confidence is below the approved threshold.

### 9.4 AI rules

- AI-generated text is never treated as a factual source.
- Numbers, dates, names, quotes, and currencies must match attributable evidence.
- Missing facts may not be inferred.
- Translation failure must stop the affected item, not corrupt or erase the archive.
- Model/provider failure must raise an operational alert.
- Prompts, model version, source snapshot, validation result, and revision must be retained for audit where practical.

### 9.5 Source hierarchy

Preferred order:

1. Regulators, exchanges, statistical agencies, courts, and official government sources.
2. Company filings, investor-relations announcements, and audited documents.
3. Identified global and Georgian financial publishers.
4. Reputable general publications with direct reporting.
5. Aggregators used for discovery, followed by verification at the original publisher.

Social posts, anonymous claims, promotional releases, and unattributed aggregation cannot be the sole basis for material financial claims.

## 10. Georgian investment desk

The Georgian desk must use direct official sources wherever possible and maintain a visible coverage calendar.

Minimum source families:

- National Bank of Georgia;
- Georgian Stock Exchange and issuer disclosures;
- Ministry of Finance and Treasury information;
- GeoStat;
- Revenue Service and official legal publications;
- Competition and financial regulators;
- company investor-relations or official announcements;
- approved Georgian financial and business publishers.

Minimum recurring outputs:

- daily Georgian investment briefing;
- weekly Georgian market summary;
- NBG decision explainer;
- bond and Treasury issuance calendar;
- deposit/product comparison review cycle;
- material Georgian company financing and transaction coverage;
- correction and update log.

## 11. Trust and governance

The site must publish:

- ownership and operator identity;
- named editor-in-chief or accountable editorial owner;
- masthead and contributor biographies;
- editorial standards;
- corrections policy and correction history;
- AI-use policy;
- source and market-data methodology;
- advertising and sponsorship policy;
- conflicts-of-interest policy;
- privacy, cookies, and newsletter consent rules;
- terms and financial-information disclaimer;
- accessible contact and correction channels.

Editorial ranking must not be sold. Sponsored placements must be visibly separated and excluded from claims of independent importance.

## 12. Technical target architecture

### 12.1 Services

1. **Market Data Gateway** — provider adapters, symbol normalization, quote validation, licensing rules, and freshness state.
2. **Asset Master** — stable instrument, listing, issuer, and provider mappings.
3. **News Ingestion Service** — feed collection, source identity, extraction, and deduplication.
4. **Editorial Service** — AI assistance, validation, review queue, revisions, approvals, and corrections.
5. **Georgia Data Service** — official Georgian sources, disclosures, products, and economic series.
6. **Public API** — versioned read APIs for markets, crypto, news, Georgia, search, and tools.
7. **Web Application** — server-rendered discoverable pages plus controlled client refresh.
8. **Operations Layer** — logs, metrics, traces, alerts, audit history, and status reporting.

### 12.2 Data stores

- relational database for instruments, issuers, editorial records, users, and governance;
- time-series-capable storage for quotes and historical bars;
- object storage for source snapshots and media where rights permit;
- cache for hot public data with explicit freshness metadata;
- search index for Georgian and English names, symbols, entities, and articles;
- append-only audit records for publication and correction events.

### 12.3 API boundaries

- `/api/v1/markets/*`
- `/api/v1/crypto/*`
- `/api/v1/instruments/*`
- `/api/v1/news/*`
- `/api/v1/georgia/*`
- `/api/v1/search`
- `/api/v1/status`

Every response containing changeable financial data should include `source`, `asOf`, `ingestedAt`, `delay`, and `stale` metadata.

### 12.4 Security controls

- least-privilege service credentials;
- separate production, staging, and development environments;
- secret rotation and no secrets in the repository;
- authenticated and authorized editorial actions;
- multi-factor authentication for administrators;
- rate limiting, bot protection, input validation, and output encoding;
- dependency and vulnerability scanning;
- encrypted transport and protected backups;
- immutable audit events for approvals, edits, and corrections;
- tested incident response and credential-revocation process.

## 13. Reliability and observability

### 13.1 Initial service targets

These are proposed internal targets, not public guarantees until measured consistently.

- Public page availability: 99.9% monthly.
- Market API successful-response rate: at least 99.5% excluding upstream-wide outages.
- News pipeline freshness: successful run or explicit alert within 30 minutes.
- Georgian feed freshness: source-specific target with visible last successful ingestion.
- Critical alert acknowledgement: within 15 minutes during staffed coverage.
- No silent stale data.

### 13.2 Required monitoring

- provider request success, latency, quota, and rate-limit state;
- quote age and stale-instrument count;
- symbol mapping failures;
- feed success and article volume by source;
- translation and validation success rate;
- publication lag;
- empty or unusually large categories;
- duplicate articles;
- broken source links;
- database, cache, and queue health;
- client-side errors and key journey failures;
- administrative changes and correction events.

### 13.3 Incident behavior

Every incident has:

- severity;
- owner;
- detection time;
- affected products and sources;
- containment action;
- user-visible status where material;
- recovery verification;
- root-cause review and prevention action.

## 14. Popularizing responsible investment in Georgia

Growth must be based on trust and usefulness rather than sensational return claims.

Programs:

- a Georgian beginner pathway from saving to diversified investing;
- short explainers tied to current Georgian questions;
- weekly market briefing and Georgian opportunity digest;
- university and professional education partnerships;
- calculators with assumptions and risks shown;
- neutral comparisons of brokers, deposits, bonds, and funds;
- scam and misinformation warnings;
- glossary and searchable question library;
- transparent community questions answered by qualified contributors.

## 15. Measurement framework

Do not invent baseline values. Measure first, then set public targets.

### Trust and correctness

- material correction rate;
- percentage of articles with complete source attribution;
- percentage of market records with complete freshness metadata;
- stale-data exposure time;
- high-risk content reviewed before publication.

### Product usefulness

- successful asset searches;
- asset-page return usage;
- watchlist activation when launched;
- tool completion;
- learning-path completion;
- newsletter retention when launched.

### Georgian impact

- share of useful output covering Georgia;
- official-source coverage completeness;
- recurring Georgian briefing readership;
- beginner learning completion;
- measured improvement in investment-literacy exercises.

Popularity, traffic, audience, or conversion claims require verified analytics and a stated measurement period.

## 16. Delivery roadmap and gates

### Phase 1 — Trust foundation

Deliverables:

- approve product definition and boundaries;
- introduce clean taxonomy and controlled tags;
- display timestamps, sources, market state, delay, and stale status;
- formalize editorial, correction, AI, commercial, and data policies;
- establish monitoring and alerting;
- remove or qualify unsupported real-time and leadership claims.

Exit gate:

- no silent stale data in tested critical journeys;
- source and freshness metadata visible;
- failed feeds and publishing runs alert operators;
- governance pages name accountable owners;
- taxonomy validation rejects invalid categories.

### Phase 2 — Georgian newsroom

Deliverables:

- direct official-source ingestion;
- editor-controlled Georgian queue;
- Georgian bonds, deposits, disclosures, regulation, and company coverage;
- daily and weekly briefing workflows;
- source coverage dashboard.

Exit gate:

- agreed official sources monitored;
- high-risk Georgian material receives human review;
- scheduled briefings publish consistently;
- correction workflow is tested end to end.

### Phase 3 — Market products

Deliverables:

- separate Stocks and Crypto products;
- permanent canonical asset pages;
- fundamentals, events, financial statements, and comparisons;
- watchlists and alerts;
- licensed market-data integration;
- provider fallback and mapping validation.

Exit gate:

- licensing covers the displayed data and update claims;
- quote timestamps and delays are accurate;
- no cross-instrument fallback;
- watchlist and alert behavior is verified across failure states.

### Phase 4 — Authority and responsible growth

Deliverables:

- named newsroom and expert contributors;
- research and original reporting program;
- university and financial-sector partnerships;
- newsletter and retention programs;
- public methodology and periodic transparency reports.

Exit gate:

- authority claims supported by verified evidence;
- sponsored activity remains visibly separated;
- growth metrics include trust, retention, and educational outcomes.

## 17. Decisions required before implementation

The following decisions require explicit approval:

1. Final product positioning and public wording.
2. Whether Investors.ge will operate legally and organizationally as a publisher/news agency.
3. Editorial owner and human-review capacity.
4. Initial market-data budget and acceptable quote delay.
5. Which Georgian official sources are mandatory at launch.
6. Whether accounts, watchlists, alerts, and portfolios belong in the next delivery phase.
7. Advertising and sponsorship boundaries.
8. Initial reliability targets and staffed incident coverage.
9. Data retention, privacy, and newsletter consent choices.
10. The exact Phase 1 implementation scope.

## 18. Definition of a trustworthy release

A release is trustworthy only when:

- the claim made to the user matches the measured capability;
- the source and timestamp are visible;
- stale and unavailable states are honest;
- important news has attributable evidence;
- high-risk content has passed the required review;
- stocks and crypto use correct type-specific interpretation;
- commercial influence is disclosed;
- monitoring proves the release continues to work after deployment;
- rollback and correction paths are tested;
- no material verification gap is described as complete.

## 19. Immediate recommendation

Approve or revise this specification first. After approval, convert Phase 1 into a technical implementation plan with individually reviewable changes. No redesign, data-provider commitment, workflow change, or deployment should begin until its exact scope and acceptance tests are approved.
