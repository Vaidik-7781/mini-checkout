| Step | Action | Confirmations | References | Button after | Validation message | Name field | Order total | Page width / viewport | Screenshot |
|---|---|---|---|---|---|---|---|---|---|
| MT-01 | Empty cart, blank name, click Place order | 0 | — | Place order | Your cart is empty. Add at least one item before placing your order. + Enter your full name. | (empty) | $0.00 | 1280 / 1280 | MT-01.png |
| MT-02 | Empty cart, name typed, click Place order | 0 | — | Place order | Your cart is empty. Add at least one item before placing your order. | Asha Rao | $0.00 | 1280 / 1280 | MT-02.png |
| MT-03 | Real mouse double-click on Place order, then wait 3 s<br>Mid-processing screenshot: MT-03-processing.png | 1 | ORD-NAFNR8 | (hidden) | — | Asha Rao | $4.35 | 1280 / 1280 | MT-03.png |
| MT-04 | Click, then click again 300 ms later while "Placing order…" | 1 | ORD-5HPYZ6 | (hidden) | — | Asha Rao | $4.35 | 1280 / 1280 | MT-04.png |
| MT-05 | Triple-click (clickCount 3, no delay) | 1 | ORD-ZVVBZD | (hidden) | — | Asha Rao | $12.99 | 1280 / 1280 | MT-05.png |
| MT-06 | Press Enter 5 times quickly in the name field | 1 | ORD-6HM2ZV | (hidden) | — | Asha Rao | $4.35 | 1280 / 1280 | MT-06.png |
| MT-07 | Maximum-length (80 char) name without spaces | 1 | ORD-T3XRH6 | (hidden) | — | WWWWWWWWWWWW… (80 chars) | $4.35 | 1280 / 1280 | MT-07.png |
| MT-08 | Phone-width viewport (375 px), two items in cart | 0 | — | Place order | — | (empty) | $17.34 | 375 / 375 | MT-08.png |
| MT-09 | Reload the page while "Placing order…" | 0 | — | Place order | — | (empty) | $0.00 | 1280 / 1280 | MT-09.png |
