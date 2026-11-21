| Mutant | Injected bug | Result | Tests that caught it |
|---|---|---|---|
| M1 | Totals truncated from floating-point dollars instead of integer cents | Killed | TC-01, TC-03, TC-10, TC-11, TC-12, TC-16 |
| M2 | Order total ignores quantity (sums unit prices) | Killed | TC-02, TC-03, TC-11, TC-12, TC-16 |
| M3 | Typed quantity does not update totals until another action | Killed | TC-03, TC-11, TC-16 |
| M4 | No double-submit protection at all (no guard, button stays enabled) | Killed | TC-07, TC-08, TC-09, TC-10 |
| M5 | Double-submit protection relies only on disabling the button | Killed | TC-09 |
| M6 | Blank-name check does not trim whitespace | Killed | TC-06 |
| M7 | Required name not validated | Killed | TC-02, TC-05, TC-06 |
| M8 | Empty cart not blocked | Killed | TC-04, TC-05 |
| M9 | Name cleared when validation fails | Killed | TC-04, TC-06 |
| M10 | Cart can still be edited while the order is processing (confirmation total can drift) | Killed | TC-10, TC-15 |
