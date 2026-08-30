# Design QA — Editorial Cover Homepage

- selected reference: `exec-5010d69c-1295-4a04-9f44-5fed34ea7f90.png` (Option 1)
- implementation screenshots: `design-implementation-desktop-viewport.png`, `design-implementation-mobile.png`
- combined comparison: `design-qa-comparison.png`
- desktop viewport: 1440 × 1024
- mobile viewport: 390 × 844

## Visual comparison

- Preserved the warm ivory paper, dark forest-green ink, thin editorial rules, restrained accent color, serif display typography, and minimal card treatment.
- Matched the reference hierarchy: masthead and search, navigation, six-item market pulse, three-column lead package, chronological news list, compact lower utility columns, trust strip, and structured footer.
- Kept one strong editorial image in the lead package and removed the repeated blue imagery and dashboard-card clutter from the previous homepage.
- Adapted the selected concept to live, variable-length Georgian headlines. The lead type scale is capped at 56px on desktop and 36px on mobile to prevent collisions.
- Mobile QA confirmed the document width equals the viewport width; market and navigation rows scroll inside their own containers without forcing page-level horizontal overflow.

## Functional checks

- Live translated news archive populates the lead and six latest-news rows.
- All homepage story links point to internal `/news/<id>` Georgian article routes.
- Search and primary navigation remain intact.
- Existing regression suite passed: asset search, market chart, news source/category policy, and Georgian article rendering.
- The previous detached-DOM refresh error was guarded after the homepage shell replacement.

## Severity review

- P0 blockers: none
- P1 functional or responsive defects: none
- P2 visual polish defects: none outstanding

final result: passed
