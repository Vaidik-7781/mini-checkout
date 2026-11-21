// The three required automated checks (TC-01 .. TC-03).
//
// Clean state: Playwright gives every test a brand-new browser context (no cookies,
// no storage) and each test loads the page fresh; the app keeps no persistent state.
// No fixed waits: every assertion is a web-first `expect` that retries until the
// customer-visible condition holds (or times out).
const { test, expect } = require('@playwright/test');
const { CheckoutPage } = require('./checkout-page');

// Synthetic catalogue (prices fixed in public/checkout.js):
//   Desk Plant      $4.35
//   Linen Notebook  $12.99

test.describe('Required checks', () => {
  let checkout;

  test.beforeEach(async ({ page }) => {
    // Fake timers run in real time unless fast-forwarded with clock.runFor(); they
    // let a test flush *all* pending timers instead of sleeping for a fixed time.
    await page.clock.install();
    checkout = new CheckoutPage(page);
    await checkout.open();
  });

  test('TC-01 successful checkout shows exactly one confirmation with a reference', async () => {
    await checkout.add('Desk Plant');
    await checkout.add('Linen Notebook');
    await expect(checkout.orderTotal).toHaveText('$17.34'); // 4.35 + 12.99

    await checkout.nameInput.fill('Asha Rao');
    await checkout.placeOrderButton.click();

    // Confirmation is what the customer sees after the (simulated) processing delay.
    await expect(checkout.confirmations).toHaveCount(1);
    const confirmation = checkout.confirmations.first();
    await expect(confirmation.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
    await expect(confirmation).toContainText('Thank you, Asha Rao. Your order has been placed.');
    await expect(checkout.orderReference).toHaveText(/^ORD-[A-HJ-NP-Z2-9]{6}$/);
    await expect(checkout.confirmationTotal).toHaveText('$17.34');
    await expect(confirmation.getByRole('listitem')).toHaveText([
      '1 × Desk Plant — $4.35',
      '1 × Linen Notebook — $12.99',
    ]);

    // The checkout form is gone, so the order cannot be placed again from this screen.
    await expect(checkout.placeOrderButton).toBeHidden();
    await expect(checkout.errorSummary).toBeHidden();
  });

  test('TC-02 missing name blocks checkout, explains why, and keeps the cart', async ({ page }) => {
    await checkout.add('Linen Notebook');
    await checkout.increase('Linen Notebook');
    await expect(checkout.orderTotal).toHaveText('$25.98'); // 2 x 12.99

    await checkout.placeOrderButton.click(); // name left blank

    await expect(checkout.errorSummary).toBeVisible();
    await expect(checkout.errorSummary).toContainText('Your order could not be placed');
    await expect(checkout.errorSummary).toContainText('Enter your full name.');
    await expect(checkout.errorSummary).not.toContainText('cart is empty');
    await expect(checkout.nameError).toHaveText('Enter your full name.');
    await expect(checkout.nameInput).toHaveAttribute('aria-invalid', 'true');
    await expect(checkout.errorSummary).toBeFocused();

    // Nothing was submitted, even after any processing time would have elapsed.
    await page.clock.runFor(5_000);
    await expect(checkout.confirmations).toHaveCount(0);
    await expect(checkout.placeOrderButton).toBeEnabled();
    await expect(checkout.placeOrderButton).toHaveText('Place order');

    // What the customer entered is preserved.
    await expect(checkout.quantityInput('Linen Notebook')).toHaveValue('2');
    await expect(checkout.lineTotal('Linen Notebook')).toHaveText('$25.98');
    await expect(checkout.orderTotal).toHaveText('$25.98');

    // Fixing the field clears the message and the order then goes through.
    await checkout.nameInput.fill('Asha Rao');
    await expect(checkout.errorSummary).toBeHidden();
    await expect(checkout.nameInput).not.toHaveAttribute('aria-invalid');
    await checkout.placeOrderButton.click();
    await page.clock.runFor(5_000);
    await expect(checkout.confirmations).toHaveCount(1);
    await expect(checkout.confirmationTotal).toHaveText('$25.98');
  });

  test('TC-03 quantity changes update line totals and the exact order total', async () => {
    await checkout.add('Desk Plant');
    await checkout.add('Linen Notebook');
    await expect(checkout.orderTotal).toHaveText('$17.34');

    // Typed quantity. 4.35 * 3 is 13.049999999999999 in floating point;
    // the customer must see exactly $13.05.
    await checkout.setQuantity('Desk Plant', 3);
    await expect(checkout.quantityInput('Desk Plant')).toHaveValue('3');
    await expect(checkout.lineTotal('Desk Plant')).toHaveText('$13.05');
    await expect(checkout.orderTotal).toHaveText('$26.04'); // 13.05 + 12.99
    await expect(checkout.itemCount).toHaveText('4');

    // Stepper buttons.
    await checkout.increase('Linen Notebook');
    await expect(checkout.lineTotal('Linen Notebook')).toHaveText('$25.98');
    await expect(checkout.orderTotal).toHaveText('$39.03'); // 13.05 + 25.98
    await expect(checkout.itemCount).toHaveText('5');

    await checkout.decrease('Desk Plant');
    await expect(checkout.lineTotal('Desk Plant')).toHaveText('$8.70');
    await expect(checkout.orderTotal).toHaveText('$34.68'); // 8.70 + 25.98
    await expect(checkout.itemCount).toHaveText('4');

    // Upper bound: 10 x 12.99 = 129.90; "+" is disabled at the maximum.
    await checkout.setQuantity('Linen Notebook', 10);
    await expect(checkout.lineTotal('Linen Notebook')).toHaveText('$129.90');
    await expect(checkout.orderTotal).toHaveText('$138.60'); // 8.70 + 129.90
    await expect(checkout.page.getByRole('button', { name: 'Increase quantity of Linen Notebook' })).toBeDisabled();
  });
});
