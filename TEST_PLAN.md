# Test plan: Mini Checkout

## 1. Scope

**In scope:** the single-page checkout in `public/`. That covers adding and removing the two synthetic products, changing quantities, line totals and the order total, the required *Full name* field, validation messages, placing an order, the confirmation and its reference, and protection against double submission.

**Out of scope:** there is no backend, payment, persistence, tax, shipping or discount logic, so none of these is tested. Load and performance testing, and cross-browser testing beyond Chromium, are also out of scope (see section 7).

**Test data:** Desk Plant **$4.35** and Linen Notebook **$12.99**. Quantity 1–10 per line. Name up to 80 characters.
The $4.35 price is deliberate: `4.35 × 3` is `13.049999999999999` in floating point, so a total that is computed or rounded wrongly shows up as $13.04 instead of $13.05.

## 2. Risks, prioritised

Priority = impact on the customer or business × likelihood in a checkout like this one.

| ID | Risk | Impact | Likelihood | Priority | Covered by |
|---|---|---|---|---|---|
| R1 | **Wrong total shown or charged**: quantity not applied, floating-point rounding, stale total after an edit | High | Medium | **P1** | TC-01, **TC-03**, TC-11, TC-12, TC-13 · mutants M1–M3 |
| R2 | **Duplicate order** from a double-click, repeated clicks or repeated Enter | High | High | **P1** | TC-07, TC-08, TC-09 · **MT-03 – MT-06** · mutants M4, M5 |
| R3 | **Order placed with missing data**: empty cart, blank or whitespace-only name | High | Medium | **P1** | **TC-02**, TC-04, TC-05, TC-06 · **MT-01, MT-02** · mutants M6–M8 |
| R4 | **Customer's input lost** after a validation error (name or cart cleared) | Medium | Medium | P2 | TC-02, TC-04, TC-06 · mutant M9 |
| R5 | **Missing or unclear confirmation**: no reference, or the confirmed total differs from the cart | High | Low | P2 | **TC-01**, TC-10 |
| R6 | **Cart changed during processing**, so the confirmation doesn't match what the customer saw | Medium | Low | P2 | TC-10, TC-19 · mutant M10 |
| R7 | **Invalid quantity input** (0, negative, decimal, text, blank, over max) accepted or breaks the total | Medium | Medium | P2 | TC-11 |
| R8 | **Layout breaks** on phone widths or with long input | Medium | Medium | P3 | TC-17, TC-18 · MT-07, MT-08 |
| R9 | **Keyboard and screen-reader users can't complete checkout** | Medium | Low | P3 | TC-16 |
| R10 | **HTML/script in the name** is rendered as markup | Low (no backend) | Low | P3 | TC-14 |

## 3. Approach

1. **Automated browser tests** (Playwright with Chromium) cover the three required checks, plus regression checks for each risk above.
   * **Clean state:** each test gets a new browser context (no cookies or storage) and loads the page fresh. The app keeps no state between page loads.
   * **Customer-visible assertions:** locators use roles, accessible names and labels (`getByRole`, `getByLabel`). Totals are asserted as exact strings (`'$26.04'`), not with regexes or as numbers.
   * **No fixed waits:** there are no `waitForTimeout` calls. Assertions are web-first `expect`s that retry until they pass. Where a test must prove that something did *not* happen later (a duplicate confirmation, a confirmation after a validation error), it installs Playwright's fake clock and calls `clock.runFor()` to run every pending timer, instead of sleeping and hoping.
   * **No retries** (`retries: 0`), so a flaky test fails visibly.
2. **Manual exploratory testing** of the two required scenarios (empty cart, rapid double-click) and nearby edge cases (MT-01 – MT-09). Every step is recorded with what the customer sees and a screenshot.
3. **Checking the tests themselves:**
   * *Mutation check:* inject 10 realistic checkout bugs, one at a time, and confirm that at least one test fails for each.
   * *Flakiness check:* run the whole suite many times in parallel.

## 4. Automated test cases

| ID | Priority | Check | Key assertions |
|---|---|---|---|
| **TC-01** | P1 | **Successful checkout gives one confirmation** *(required)* | Exactly 1 confirmation region · heading "Order confirmed" · thanks message with the name · reference matches `^ORD-[A-HJ-NP-Z2-9]{6}$` · total `$17.34` · line items listed · Place order button gone |
| **TC-02** | P1 | **Missing name blocks checkout** *(required)* | Error summary shown and focused · "Enter your full name." in summary and under the field · `aria-invalid="true"` · 0 confirmations even after all timers are flushed · cart (qty 2, `$25.98`) preserved · fixing the name clears the error and checkout then succeeds |
| **TC-03** | P1 | **Quantity change updates the exact total** *(required)* | Typed qty 3 gives line `$13.05` and total `$26.04` · `+` gives `$39.03` · `−` gives `$34.68` · qty 10 gives `$138.60` and `+` disabled · item count follows |
| TC-04 | P1 | Empty cart blocks checkout | Empty-cart message shown · name `Asha Rao` preserved · 0 confirmations · adding an item clears the error |
| TC-05 | P1 | Empty cart and blank name together | Both messages listed, in order |
| TC-06 | P1 | Whitespace-only name | Treated as blank · typed value kept |
| TC-07 | P1 | Double-click Place order | Button shows "Placing order…" and is disabled · exactly 1 confirmation after all timers flushed |
| TC-08 | P1 | 5 rapid clicks plus 3 × Enter | Exactly 1 confirmation |
| TC-09 | P1 | 3 × `form.requestSubmit()` in the same tick | Exactly 1 confirmation: proves the JS guard works even without the disabled button |
| TC-10 | P2 | Editing locked while processing | Name, quantity, Remove disabled · confirmed total `$4.35` |
| TC-11 | P2 | Invalid quantities `0 -1 2.5 abc "" 11 35 1e1` | Each one reverts to 2, total stays `$8.70`, message explains why · a valid value clears the message |
| TC-12 | P2 | Adding the same product twice | One line, qty 2, `$8.70` |
| TC-13 | P2 | Removing items | Total updates · empty state and `$0.00` restored |
| TC-14 | P3 | HTML in the name | Shown as literal text · no `<img>` injected · no dialog |
| TC-15 | P2 | Start a new order | Cart, name and confirmation reset · button re-enabled |
| TC-16 | P3 | Keyboard-only checkout | Enter in the quantity box commits the quantity (doesn't submit) · focus kept on `+` · Enter in the name field places the order · focus moves to the confirmation heading |
| TC-17 | P3 | Regression for D-01 | 80-character unbroken name wraps · no horizontal page scroll |
| TC-18 | P3 | Regression for D-02 | No horizontal scroll at 375 px · checkout still works there |
| TC-19 | P3 | Regression for D-03 | Add to cart disabled while processing, re-enabled after reset |

## 5. Manual tests

Run against `npm start`, then open http://localhost:4173 with a fresh tab for each test.

| ID | Steps | Expected |
|---|---|---|
| **MT-01** | With an empty cart and a blank name, click **Place order** | No confirmation. Error summary lists "Your cart is empty…" and "Enter your full name." Name field marked invalid. |
| **MT-02** | Empty cart. Type `Asha Rao`. Click **Place order** | No confirmation. Only the empty-cart message. Name still `Asha Rao`. |
| **MT-03** | Add Desk Plant. Type a name. **Double-click** Place order. Wait 3 s | Button goes to "Placing order…" and is disabled. Exactly **one** confirmation and one reference. |
| MT-04 | As MT-03, but click once and click again ~300 ms later | One confirmation. |
| MT-05 | As MT-03, but triple-click | One confirmation. |
| MT-06 | As MT-03, but press **Enter** 5 times quickly in the name field | One confirmation. |
| MT-07 | Add an item. Enter an 80-character name with no spaces. Place order | Name wraps inside the confirmation. No horizontal scrolling. |
| MT-08 | Narrow the window to 375 px (phone). Add both products | Cart fits the screen with no horizontal scrolling. |
| MT-09 | Place an order and reload while "Placing order…" shows | Recorded as an observation (see RESULTS.md). |

## 6. Entry and exit criteria

* **Entry:** the page loads at `/` with an empty cart and a `$0.00` total.
* **Exit:** all P1 and P2 automated tests pass with 0 retries, and repeated runs show no flakiness. All MT steps are recorded with evidence. Every defect found is either fixed with a regression test, or documented with its status.

## 7. Environment and limitations

* Chromium only: Google Chrome for Testing 153 (`PW_CHANNEL=chrome`), and Playwright 1.63 on Linux, headless.
* Firefox and WebKit projects are configured (`ALL_BROWSERS=1`) but **were not run**: the browser downloads were blocked in the test environment.
* The order "processing" is a simulated 800 ms delay. There is no server, so server-side idempotency (for example, retries after a network failure) cannot be tested here.
