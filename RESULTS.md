# Test results: Mini Checkout

**Date:** 21 Nov 2026 · **Build tested:** `build-2` (git tag; defects were found on `build-1`)
**Environment:** Linux, Node 22, Playwright 1.63, Google Chrome for Testing 153.0.8010.12 (headless), viewport 1280×720 unless stated.

## Summary

| Area | Result |
|---|---|
| Required automated checks (TC-01 – TC-03) | **3 / 3 passed** |
| All automated checks (TC-01 – TC-19) | **19 / 19 passed**, 0 retries ([`results/test-run.txt`](results/test-run.txt)) |
| Flakiness check | **190 / 190 passed**: suite × 10 repeats, 4 parallel workers ([`results/flakiness-run.txt`](results/flakiness-run.txt)). An earlier 20-repeat run on build 1 also passed 320 / 320. |
| Mutation check (do the tests catch real bugs?) | **10 / 10 injected bugs caught** ([`results/mutation-results.md`](results/mutation-results.md)) |
| Manual: empty cart (MT-01, MT-02) | **Pass.** Checkout blocked, clear message, name preserved. |
| Manual: rapid double-click (MT-03 – MT-06) | **Pass.** Exactly one confirmation in every variant. **No defect found.** |
| Defects found | **3**: D-01 (Medium), D-02 (Medium), D-03 (Low). All found on build 1 in exploratory testing, all fixed in build 2, each covered by a regression test. |

## 1. Automated checks

Command: `npm run test:chrome` (installed Google Chrome). Full output is in [`results/test-run.txt`](results/test-run.txt).

| ID | Check | Result | Time |
|---|---|---|---|
| **TC-01** | Successful checkout shows exactly one confirmation with a reference | ✅ Pass | 1.5 s |
| **TC-02** | Missing name blocks checkout, explains why, keeps the cart | ✅ Pass | 0.6 s |
| **TC-03** | Quantity changes update line totals and the exact order total | ✅ Pass | 0.7 s |
| TC-04 | Empty cart blocks checkout and keeps the name | ✅ Pass | 1.8 s |
| TC-05 | Empty cart and blank name reported together | ✅ Pass | 0.4 s |
| TC-06 | Whitespace-only name treated as blank | ✅ Pass | 0.5 s |
| TC-07 | Double-click gives one confirmation | ✅ Pass | 0.5 s |
| TC-08 | 5 rapid clicks plus repeated Enter give one confirmation | ✅ Pass | 0.5 s |
| TC-09 | Same-tick duplicate submits ignored (JS guard) | ✅ Pass | 0.5 s |
| TC-10 | Cart and name locked while processing | ✅ Pass | 0.6 s |
| TC-11 | Invalid typed quantities rejected and reverted | ✅ Pass | 1.0 s |
| TC-12 | Adding the same product increments its quantity | ✅ Pass | 0.5 s |
| TC-13 | Removing items updates the total and empty state | ✅ Pass | 0.5 s |
| TC-14 | HTML in the name shown as text | ✅ Pass | 1.3 s |
| TC-15 | Start a new order resets to a clean state | ✅ Pass | 1.3 s |
| TC-16 | Keyboard-only checkout | ✅ Pass | 1.4 s |
| TC-17 | [D-01] 80-character name wraps | ✅ Pass | 1.8 s |
| TC-18 | [D-02] 375 px: no horizontal scroll, checkout works | ✅ Pass | 1.4 s |
| TC-19 | [D-03] Add to cart disabled while processing | ✅ Pass | 0.5 s |

The same suite run against **build 1** gives **16 passed, 3 failed** (TC-17, TC-18, TC-19), which confirms the regression tests detect the original defects ([`results/build-1-test-run.txt`](results/build-1-test-run.txt)).

### Mutation check: do the assertions catch real bugs?

`node scripts/mutation-check.js` injects one realistic bug at a time into a copy of the app and runs the full suite against it. All 10 were caught:

| Mutant | Injected bug | Caught by |
|---|---|---|
| M1 | Totals truncated from floating-point dollars instead of integer cents | TC-01, **TC-03**, TC-10, TC-11, TC-12, TC-16, TC-18 |
| M2 | Order total ignores quantity | TC-02, **TC-03**, TC-11, TC-12, TC-16, TC-18 |
| M3 | Typed quantity doesn't update totals | **TC-03**, TC-11, TC-16 |
| M4 | No double-submit protection at all | TC-07, TC-08, TC-09, TC-10 |
| M5 | Double-submit protection relies only on disabling the button | TC-09 |
| M6 | Blank-name check doesn't trim whitespace | TC-06 |
| M7 | Required name not validated | **TC-02**, TC-05, TC-06 |
| M8 | Empty cart not blocked | TC-04, TC-05 |
| M9 | Name cleared when validation fails | TC-04, TC-06 |
| M10 | Cart editable while the order is processing | TC-10, TC-15 |

The three required checks alone don't catch M4/M5 (double submit), M8 (empty cart) or M9. That is why the double-click and empty-cart scenarios were also tested by hand and then automated (TC-04 – TC-09).

## 2. Manual tests

**How they were run:** each step was carried out as real mouse and keyboard input in Google Chrome. Every step was driven through [`scripts/exploratory-evidence.js`](scripts/exploratory-evidence.js), so it is recorded and can be replayed exactly. Each scenario starts in a fresh browser context. The table records what the customer sees. The same steps can be repeated by hand from [TEST_PLAN.md §5](TEST_PLAN.md#5-manual-tests) in about 5 minutes.

### Build 2 (current), full log: [`evidence/build-2/session-log.md`](evidence/build-2/session-log.md)

| Step | What I did | What happened | Verdict | Evidence |
|---|---|---|---|---|
| **MT-01** | Empty cart, blank name, clicked **Place order** | No confirmation. Error summary (focused) lists "Your cart is empty. Add at least one item before placing your order." and "Enter your full name." Name field outlined red with its own message. Total stays $0.00. | ✅ Pass | [MT-01.png](evidence/build-2/MT-01.png) |
| **MT-02** | Empty cart, typed `Asha Rao`, clicked **Place order** | No confirmation. Only the empty-cart message is shown. Name field still `Asha Rao`. | ✅ Pass | [MT-02.png](evidence/build-2/MT-02.png) |
| **MT-03** | Desk Plant + name, **real mouse double-click** on Place order, waited 3 s | Button immediately changed to "Placing order…" and was disabled, along with the form. After processing: **1** confirmation, **1** reference (`ORD-…`), total $4.35. | ✅ Pass | [MT-03-processing.png](evidence/build-2/MT-03-processing.png), [MT-03.png](evidence/build-2/MT-03.png) |
| MT-04 | Clicked, then clicked again 300 ms later during "Placing order…" | 1 confirmation | ✅ Pass | [MT-04.png](evidence/build-2/MT-04.png) |
| MT-05 | Triple-click, no delay | 1 confirmation | ✅ Pass | [MT-05.png](evidence/build-2/MT-05.png) |
| MT-06 | Pressed Enter 5× quickly in the name field | 1 confirmation | ✅ Pass | [MT-06.png](evidence/build-2/MT-06.png) |
| MT-07 | 80-character name without spaces | Name wraps inside the confirmation. Page width 1280 = viewport. | ✅ Pass (was D-01) | [MT-07.png](evidence/build-2/MT-07.png) |
| MT-08 | 375 px viewport, both products in cart | Cart lines shown as compact cards. Page width 375 = viewport. | ✅ Pass (was D-02) | [MT-08.png](evidence/build-2/MT-08.png) |
| MT-09 | Reloaded during "Placing order…" | Page returns to an empty cart. No confirmation, no order. | ℹ️ Observation O-1 | [MT-09.png](evidence/build-2/MT-09.png) |

**Rapid double-click conclusion:** none of the four variants (MT-03 – MT-06, on both builds) produced more than one confirmation. Two independent protections are in place:

1. A synchronous status check-and-set in the submit handler.
2. Disabling the form as soon as the order is submitted.

TC-09 shows the first protection works even when the second is bypassed, and mutant M5 shows that relying on the disabled button alone would not be caught by the UI-level tests. **No double-submit defect exists, so none is reported.**

## 3. Defects

All three were found on **build 1** during exploratory testing (MT-07, MT-08, and the MT-03 mid-processing screenshot). They are fixed in **build 2**. To reproduce one on the original code: `git checkout build-1 -- public && npm start`.

### D-01: An 80-character name without spaces overflows the confirmation and the page scrolls sideways

| | |
|---|---|
| **Severity / priority** | Medium / P3 (cosmetic, but on the most important screen; the field explicitly allows 80 characters) |
| **Build** | build-1 · Chrome 153 · 1280×800 |
| **Steps** | 1. Open `/`. 2. Click **Add to cart** for Desk Plant. 3. In *Full name* type 80 × `W` (no spaces). 4. Click **Place order**. |
| **Expected** | The name wraps within the confirmation panel. No horizontal scrolling. |
| **Actual** | The name runs out of the green panel. Panel `scrollWidth` 1315 px vs `clientWidth` 638 px. Page `scrollWidth` **1636 px** in a 1280 px viewport, so the page scrolls sideways. |
| **Evidence** | Before: [evidence/build-1/MT-07.png](evidence/build-1/MT-07.png) · After: [evidence/build-2/MT-07.png](evidence/build-2/MT-07.png) · Failing assertion on build 1: TC-17 `Expected: <= 638, Received: 1315` ([results/build-1-test-run.txt](results/build-1-test-run.txt)) |
| **Fix** | `overflow-wrap: anywhere; min-width: 0` on `.panel` (`public/styles.css`) |
| **Status** | Fixed in build-2 · regression test **TC-17** |

### D-02: On a phone-width screen (375 px) the cart table forces horizontal scrolling

| | |
|---|---|
| **Severity / priority** | Medium / P3 (Remove links and line totals are off-screen until you scroll sideways on a phone) |
| **Build** | build-1 · Chrome 153 · 375×740 |
| **Steps** | 1. Set the viewport to 375 px wide. 2. Open `/`. 3. Add Desk Plant and Linen Notebook. |
| **Expected** | The cart fits the screen width. All controls are reachable without horizontal scrolling. |
| **Actual** | The 5-column table is wider than the screen. Page `scrollWidth` **516 px** in a 375 px viewport (141 px overflow). The cart panel spills past the right edge. |
| **Evidence** | Before: [evidence/build-1/MT-08.png](evidence/build-1/MT-08.png) · After: [evidence/build-2/MT-08.png](evidence/build-2/MT-08.png) · Failing assertion on build 1: TC-18 `Expected: <= 0, Received: 141` |
| **Fix** | Below 560 px, each cart line is laid out as a two-row card: name and Remove, then quantity and line total (`public/styles.css`). |
| **Status** | Fixed in build-2 · regression test **TC-18** (also checks that checkout still works at 375 px) |

### D-03: "Add to cart" buttons look active while the order is processing but do nothing

| | |
|---|---|
| **Severity / priority** | Low / P3 (no wrong data: the cart is locked and the order is unaffected; the problem is misleading UI) |
| **Build** | build-1 · Chrome 153 · 1280×800 |
| **Steps** | 1. Add Desk Plant and enter a name. 2. Click **Place order**. 3. While "Placing order…" shows, click **Add to cart** for Linen Notebook. |
| **Expected** | Add to cart is visibly disabled during processing, like the rest of the form. |
| **Actual** | Add to cart stays fully styled and enabled. Clicking it silently does nothing. |
| **Evidence** | Before: [evidence/build-1/MT-03-processing.png](evidence/build-1/MT-03-processing.png) (buttons look active) · After: [evidence/build-2/MT-03-processing.png](evidence/build-2/MT-03-processing.png) · Failing assertion on build 1: TC-19 `Expected: disabled, Received: enabled` |
| **Fix** | The product buttons are disabled on submit and re-enabled by "Start a new order" (`public/checkout.js`). |
| **Status** | Fixed in build-2 · regression test **TC-19** |

## 4. Observations (not defects)

* **O-1: reloading during "Placing order…" discards the order** (MT-09). This is expected for a client-only demo with no backend or persistence: no order was placed, and no confirmation is shown. In a real store, the server would need an idempotency key so that a reload or retry can't create a second order. This is listed as a production risk, not a defect in this build.
* **O-2: there is no back navigation between checkout and confirmation.** It is a single page with no history entries. "Start a new order" is the intended route back.
* **O-3: the brief allows a plain interface.** Tax, shipping and currency selection are deliberately absent. Prices are fixed in USD.

## 5. Not tested

* **Firefox and WebKit.** The projects are configured (`--project=firefox`, `--project=webkit`), but the browser downloads were blocked in the environment used for this run.
* **Real screen readers** (NVDA, VoiceOver). Semantics were checked through roles and accessible names in the tests (TC-16), but not with assistive technology.
