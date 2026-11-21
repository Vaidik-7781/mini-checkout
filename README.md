# Mini Checkout and Browser Test Suite

A single-page checkout for a small online store, with Playwright browser tests, a risk-based test plan and recorded results.

* **App:** two synthetic products (Desk Plant **$4.35**, Linen Notebook **$12.99**). Customers can add and remove items, change quantities (stepper or typed, 1–10), and see the line totals and order total update live. The required *Full name* field is validated. A successful order shows a confirmation with an `ORD-XXXXXX` reference.
* **Mistake handling:** an empty cart or a blank or whitespace-only name blocks checkout with a clear message, and everything the customer entered is kept. Place order is idempotent, so double-clicks, repeated clicks and repeated Enter all produce one confirmation.
* **Tests:** 3 required checks plus 16 regression checks. All 19 pass, verified by a 10× repeat run and a mutation check (10/10 injected bugs caught).
* **Defects:** exploratory testing found 3 real defects in build 1 (layout overflow ×2, misleading button state). They are fixed in build 2, with evidence and regression tests. See [RESULTS.md](RESULTS.md).

No backend, database, payments or external services. The app has no dependencies: plain HTML, CSS and JavaScript served by a tiny Node static server.

## Project layout

```
public/            the app (index.html, checkout.js, styles.css)
server.js          zero-dependency static server (port 4173)
tests/
  checkout.spec.js     TC-01..TC-03: the three required checks
  regression.spec.js   TC-04..TC-19: double submit, empty cart, edge inputs, defect regressions
  checkout-page.js     page object (role/label-based locators)
scripts/
  exploratory-evidence.js   replays the manual session and captures screenshots + log
  mutation-check.js         injects 10 realistic bugs and shows the tests catch each one
TEST_PLAN.md       risks, priorities, test cases, manual test steps
RESULTS.md         results, manual session log, defect reports, observations
results/           raw test output, flakiness run, mutation table
evidence/          screenshots and session logs for build-1 (defects) and build-2 (fixed)
```

## Run the app

Requires Node 18 or later.

```bash
npm install
npm start            # serves http://localhost:4173
```

Open http://localhost:4173. Reloading the page always gives a clean state.

## Run the browser tests

```bash
npx playwright install chromium     # one-time: downloads Playwright's Chromium
npm test                            # all 19 tests (starts the server automatically)
npm run test:required               # only TC-01..TC-03
npm run test:headed                 # watch the tests run in a visible browser
npm run report                      # open the HTML report from the last run
```

* To use an installed Google Chrome instead of downloading Chromium: `npm run test:chrome` (or set `PW_CHANNEL=chrome`).
* To also run Firefox and WebKit: `npx playwright install && ALL_BROWSERS=1 npm test`.
* To check for flakiness: `npm run test:repeat`, which runs the suite 10 times.
* Playwright starts `node server.js` itself, so you don't need to run `npm start` first. If something is already running on port 4173, set `PORT=xxxx`.

### How the tests are written

* **Clean state:** every test gets a fresh browser context and a fresh page load. The app stores nothing between loads.
* **Customer-visible assertions:**
  * Elements are found by role, label and accessible name (`getByRole('button', { name: 'Place order' })`).
  * Totals are checked as exact strings, for example `'$13.05'` for 3 × $4.35. That value is `13.049999999999999` in floating point, so it catches money-rounding bugs.
* **No fixed waits:** there are no `waitForTimeout` calls. Assertions auto-retry. To prove something does *not* happen later (no second confirmation, no confirmation after a validation error), tests use Playwright's fake clock and `clock.runFor()` to run every pending timer immediately.
* **No retries:** `retries: 0`, so a flaky test fails instead of hiding.

## Reproduce the manual session and the defects

```bash
npm start                                       # terminal 1
npm run evidence                                # terminal 2 -> evidence/latest/*.png + session-log.md
```

The defects were found on the original build, which is tagged in git. To see them yourself:

```bash
git checkout build-1 -- public && npm start     # D-01: 80-char name overflows; D-02: 375px overflow; D-03
git checkout build-2 -- public                  # back to the fixed build
```

Step-by-step manual instructions are in [TEST_PLAN.md §5](TEST_PLAN.md#5-manual-tests). They take about 5 minutes by hand.

## Test that the tests work

```bash
npm run mutation      # injects 10 checkout bugs one at a time; each must make at least one test fail
```

## Design notes

* **Money is handled as integer cents** and only formatted with `Intl.NumberFormat` for display.
* **Double-submit protection has two layers:**
  1. A synchronous status check-and-set in the submit handler (`editing → submitting → confirmed`).
  2. Disabling the whole form, plus the Add to cart buttons, the moment an order is submitted.

  TC-09 bypasses layer 2 with three same-tick `requestSubmit()` calls to show that layer 1 holds on its own.
* **The cart is snapshotted at submit time**, so the confirmation always matches what the customer saw.
* **Invalid typed quantities** (`0`, `-1`, `2.5`, `abc`, blank, `11`) revert to the previous quantity with an explanation. They never reach the total.
* **Accessibility:**
  * The error summary uses `role="alert"` and receives focus.
  * Field errors are linked with `aria-describedby` and `aria-invalid`.
  * The total is announced through `aria-live`.
  * Focus moves to the confirmation heading.
  * Keyboard focus is kept when you edit quantities.
* **Customer input is rendered with `textContent` only**, so HTML in the name is shown as text (TC-14).
