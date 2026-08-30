---
platform: tiktok
date: 2026-08-30
status: draft
source_article: 73c4718f2a999d37
source_publisher: Investing.com (distributed via Yahoo Finance)
figures_verified: no
disclaimer_included: yes
ai_assisted: yes
---

# TikTok — "რას ნიშნავს ეს რიცხვი?"

**Format:** format 1 — one number from the news, explained (tiktok-marketing spec)
**Language:** ka-GE
**Estimated runtime:** 42 seconds
**Story:** `73c4718f2a999d37` — Investing.com via Yahoo Finance, 2026-08-29 09:49 UTC.
**Teaching point:** correlation — why an asset's nickname is a claim about behaviour, not
a promise. The concept outlives the headline, which is why it is the payload rather than
the price.

---

## Script

### HOOK — 0–3s

- **Spoken:** „78 000 დოლარი. ამ რიცხვს ერთი კითხვა მოსდევს — და ის ფასზე არ არის.“
- **On-screen text:** `78 000 $ — რას ნიშნავს?`
- **Visual:** the number alone on a plain dark background. No chart yet, no ticker tape.

### SETUP — 3–9s

- **Spoken:** „29 აგვისტოს, Investing.com-ის მასალის მიხედვით, ბიტკოინი 78 000 დოლარს ჩამოსცდა. ეს ფასი სტატიის მომენტისაა და შესაძლოა დაყოვნებული იყოს.“
- **On-screen text:** `წყარო: Investing.com · 29.08.2026`
- **Visual:** a plain source card — publisher, date, and the words „შესაძლოა დაყოვნებული“. Hold it long enough to read.

### BODY — 9–35s

**Beat 1 (9–16s)**
- **Spoken:** „ბიტკოინს ხშირად „ციფრულ ოქროს“ უწოდებენ. ეს დაპირება არ არის. ეს მტკიცებაა იმაზე, თუ როგორ იქცევა ის სხვა აქტივებთან შედარებით.“
- **On-screen text:** `სახელი ≠ დაპირება`
- **Visual:** presenter to camera, whiteboard behind with the two words.

**Beat 2 (16–26s)**
- **Spoken:** „ოქროსგან ელოდებიან, რომ დაძაბულ დღეებში სხვა ბაზრებისგან დამოუკიდებლად იმოძრაოს. ტექნოლოგიური აქტივი კი ჩვეულებრივ იმავე მიმართულებით მიდის, საითაც აქციები — მხოლოდ უფრო მკვეთრად.“
- **On-screen text:** `ერთად თუ ცალკე?`
- **Visual:** hand-drawn on whiteboard — two lines, first moving together, then apart.
  **Must carry the on-screen label `საილუსტრაციო` and must not resemble a real price chart
  or be captioned with any instrument name.**

**Beat 3 (26–35s)**
- **Spoken:** „ამ განსხვავებას სახელი ვერ გადაწყვეტს. ის იზომება იმით, ერთად მოძრაობს თუ არა ორი აქტივი — ამას კორელაცია ჰქვია. სტატიის ავტორის თქმით, სწორედ ეს მტკიცება დგას ახლა ტესტის წინაშე.“
- **On-screen text:** `კორელაცია`
- **Visual:** the word written on the whiteboard and circled.

### PAYOFF — 35–42s

- **Spoken:** „ასე რომ, როცა შემდეგ ჯერზე რომელიმე აქტივს „უსაფრთხოს“ ან „ციფრულ ოქროს“ დაარქმევენ, ერთი კითხვა დასვი: რის მიმართ? პასუხი ციფრებშია და არა სახელში.“
- **On-screen text:** `რის მიმართ?`
- **Visual:** presenter to camera; last frame shows `investors.ge` in small text, no
  call-to-action animation.

---

## Caption

„ციფრული ოქრო“ სახელია, არა დაპირება. რას ზომავს კორელაცია — 40 წამში. წყარო: Investing.com, 29.08.2026.

ინფორმაცია საგანმანათლებლო ხასიათისაა და არ წარმოადგენს საინვესტიციო რჩევას.

## Hashtags

#ფინანსურიგანათლება #ინვესტიცია #კრიპტო #ბიტკოინი #საქართველო #investorsge

## Cover text

`სახელი ≠ დაპირება`

---

## Compliance notes

- **Only one figure is spoken:** $78,000, in the publisher's own framing. The "three-month
  highs" detail was left out of the script deliberately — it is in the source, but at
  speaking pace it invites a viewer to hear a trend claim we are not making.
- **Standard 04 is met in speech, not only in text:** the source and the delay caveat are
  said aloud in the SETUP beat, as the channel spec requires.
- **No return, no direction, no "best asset", no urgency.** The video ends on a question a
  viewer can use, not on an action.
- **The chart is illustrative and labelled as such on screen.** It must not be built from,
  or made to look like, real price data.

## What a human must verify before filming

1. **The $78,000 level, against the live Investing.com article.** Taken verbatim from the
   publisher's summary text in `data/global-news.json`; the live article could not be
   opened from this environment. `figures_verified: no` until checked.
2. **If the level has since been overtaken by events, re-cut the SETUP beat rather than
   the whole script** — the teaching payload (correlation) does not depend on the price, so
   the video survives a stale number only if the source card is updated honestly.
3. **The presenter must actually say the delay caveat.** If it is cut for pacing in the
   edit, the video does not ship.
