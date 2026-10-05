# Oneflare Hotels – Automated Test Suite

Playwright + TypeScript suite for **https://hotel-plaza-preview.vercel.app**, built from
`Oneflare_Bug_Reports_and_Test_Cases_WebSite_v2.xlsx` (TC-001 to TC-123, BUG-001 to BUG-049).
Every test title starts with its test case ID and linked bug IDs, so a failure maps straight back to the spreadsheet.

## Setup

```bash
npm install
npx playwright install chromium   # skip if browsers are already installed
```

Credentials come from `.env`. Both formats work:

```
Email: user@example.com        # or USER_EMAIL=...
Password: secret               # or USER_PASSWORD=...
```

Environment variables override `.env`: `BASE_URL`, `USER_EMAIL`, `USER_PASSWORD`, `CONFIRM_BOOKINGS`, `EXPECT_KNOWN_BUGS`, `BROWSERS`, `AGENT_EMAIL`.

## Running

| Command | What it runs |
|---|---|
| `npm test` | Everything (API, desktop 1440px, mobile 375px) |
| `npm run test:api` | HTTP/API checks only (fast, no browser) |
| `npm run test:booking` | Booking and reservation flows |
| `npm run test:mobile` | 375px mobile specs |
| `npm run test:known-bugs` | Tests linked to open bugs are marked as expected failures. The run stays green, and a fixed bug shows up as "expected to fail but passed" |
| `npm run test:cross-browser` | Adds Firefox, WebKit and iPhone projects for the E2E flows (TC-049/050) |
| `npx playwright test --grep @security` | Filter by tag: `@regression @negative @boundary @security @accessibility @performance @booking …` |
| `npm run report` | Opens the HTML report |

## Booking and reservation simulation

`tests/e2e/booking.spec.ts` walks the full flow: search → select room → room detail → guest details → review → confirm.

- **Default:** the final "Confirm booking" POST is intercepted and answered with a simulated reservation (`SIM-QA-0001`). The UI flow is exercised and no real reservation is created.
- **`CONFIRM_BOOKINGS=1`:** creates real pay-at-hotel reservations. This also enables TC-006 (inventory decrements), TC-037 (two sessions racing for the last room) and TC-042 (cancel from the account).
- TC-038 simulates the room being taken while the guest is idle, by returning HTTP 409 from the API.
- The quote API (`/api/booking/quote`) is tested directly for pricing, taxes, the 5-night offer and server-side validation.

## Layout

```
playwright.config.ts      projects: api, desktop-chromium, mobile-chromium (+ firefox/webkit with BROWSERS=all)
pages/                    page objects (Home, Rooms, RoomDetail, Booking, AuthModal, Contact, Branches, Gallery)
utils/                    env loader, fixtures (diagnostics, knownBug), test data, WAT date helpers
tests/api/                API, HTTP status, security headers, SEO files, load (TC-054)
tests/ui/                 rooms listing/search/filters/details, home, navigation, branches, gallery, about, contact
tests/e2e/                booking flow, reservations, account/sign-in
tests/nonfunctional/      accessibility (axe), performance (LCP/CLS, Slow 4G), responsive
.github/workflows/e2e.yml CI: runs daily and on PRs, with EXPECT_KNOWN_BUGS=1. Add USER_EMAIL/USER_PASSWORD secrets
```

## Notes

- TC-034/035/036 (card payment) are `fixme` placeholders. The site only offers pay at hotel.
- TC-106 (agent role) needs an agent account (`AGENT_EMAIL`).
- The contact-form tests intercept the submission, so no real enquiries reach the front office.
- Selectors use roles and visible text taken from the exploratory sessions. If the UI copy changes, update `pages/`.
