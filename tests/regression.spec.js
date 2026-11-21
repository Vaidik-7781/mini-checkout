// Additional regression checks beyond the three required ones. They automate the
// manual exploratory findings (empty cart, rapid double-click, edge inputs) so the
// behaviour stays fixed.
const { test, expect } = require('@playwright/test');
const { CheckoutPage } = require('./checkout-page');

test.describe('Regression checks', () => {
  let checkout;

  test.beforeEach(async ({ page }) => {
    await page.clock.install();
    checkout = new CheckoutPage(page);
    await checkout.open();
  });

  test('TC-04 empty cart blocks checkout and keeps the name typed', async ({ page }) => {
    await checkout.nameInput.fill('Asha Rao');
    await checkout.placeOrderButton.click();

    await expect(checkout.errorSummary).toBeVisible();
    await expect(checkout.errorSummary).toContainText(
      'Your cart is empty. Add at least one item before placing your order.');
    await expect(checkout.errorSummary).not.toContainText('Enter your full name.');
    await expect(checkout.nameInput).toHaveValue('Asha Rao');
    await page.clock.runFor(5_000);
    await expect(checkout.confirmations).toHaveCount(0);

    // Adding an item resolves the error without re-typing anything.
    await checkout.add('Desk Plant');
    await expect(checkout.errorSummary).toBeHidden();
    await checkout.placeOrderButton.click();
    await expect(checkout.confirmations).toHaveCount(1);
  });

  test('TC-05 empty cart and blank name are reported together', async () => {
    await checkout.placeOrderButton.click();
    await expect(checkout.errorSummary.getByRole('listitem')).toHaveText([
      'Your cart is empty. Add at least one item before placing your order.',
      'Enter your full name.',
    ]);
  });

  test('TC-06 whitespace-only name is treated as blank', async () => {
    await checkout.add('Desk Plant');
    await checkout.nameInput.fill('    ');
    await checkout.placeOrderButton.click();
    await expect(checkout.errorSummary).toContainText('Enter your full name.');
    await expect(checkout.nameInput).toHaveValue('    ');
    await expect(checkout.confirmations).toHaveCount(0);
  });

  test('TC-07 double-clicking Place order produces one confirmation', async ({ page }) => {
    await page.clock.pauseAt(Date.now() + 1_000_000); // hold the order in "processing"
    await checkout.add('Desk Plant');
    await checkout.nameInput.fill('Asha Rao');
    await checkout.placeOrderButton.dblclick();

    await expect(checkout.placeOrderButton).toHaveText('Placing order…');
    await expect(checkout.placeOrderButton).toBeDisabled();
    await page.clock.runFor(10_000); // flush every pending timer: a duplicate would render now
    await expect(checkout.confirmations).toHaveCount(1);
    await expect(checkout.orderReference).toHaveCount(1);
  });

  test('TC-08 five rapid clicks and repeated Enter still produce one confirmation', async ({ page }) => {
    await page.clock.pauseAt(Date.now() + 1_000_000);
    await checkout.add('Linen Notebook');
    await checkout.nameInput.fill('Asha Rao');
    await checkout.placeOrderButton.click({ clickCount: 5, delay: 0 });
    for (let i = 0; i < 3; i++) await checkout.page.keyboard.press('Enter');
    await page.clock.runFor(10_000);
    await expect(checkout.confirmations).toHaveCount(1);
  });

  test('TC-09 duplicate submit events in the same tick are ignored (guard does not rely on the disabled button)', async ({ page }) => {
    await checkout.add('Desk Plant');
    await checkout.nameInput.fill('Asha Rao');
    // requestSubmit() bypasses the disabled-button protection entirely, so only the
    // JavaScript idempotency guard can stop the second order.
    await page.locator('#checkout-form').evaluate((form) => {
      form.requestSubmit();
      form.requestSubmit();
      form.requestSubmit();
    });
    await page.clock.runFor(10_000);
    await expect(checkout.confirmations).toHaveCount(1);
  });

  test('TC-10 cart and name cannot change while the order is processing', async ({ page }) => {
    await page.clock.pauseAt(Date.now() + 1_000_000); // freeze time mid-submit
    await checkout.add('Desk Plant');
    await checkout.nameInput.fill('Asha Rao');
    await checkout.placeOrderButton.click();
    await expect(checkout.placeOrderButton).toHaveText('Placing order…');
    await expect(checkout.nameInput).toBeDisabled();
    await expect(checkout.quantityInput('Desk Plant')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Remove Desk Plant from cart' })).toBeDisabled();
    await page.clock.runFor(10_000);
    await expect(checkout.confirmationTotal).toHaveText('$4.35');
  });

  test('TC-11 invalid typed quantities are rejected and the previous quantity restored', async () => {
    await checkout.add('Desk Plant');
    await checkout.setQuantity('Desk Plant', 2);
    await expect(checkout.orderTotal).toHaveText('$8.70');

    for (const bad of ['0', '-1', '2.5', 'abc', '', '11', '35', '1e1']) {
      await checkout.setQuantity('Desk Plant', bad);
      await expect(checkout.quantityInput('Desk Plant'), `input "${bad}"`).toHaveValue('2');
      await expect(checkout.orderTotal, `input "${bad}"`).toHaveText('$8.70');
      await expect(checkout.row('Desk Plant')).toContainText(
        'Quantity must be a whole number from 1 to 10. Reset to 2.');
    }

    // A valid value clears the message.
    await checkout.setQuantity('Desk Plant', 4);
    await expect(checkout.orderTotal).toHaveText('$17.40');
    await expect(checkout.row('Desk Plant')).not.toContainText('Quantity must be');
  });

  test('TC-12 adding the same product again increments its quantity', async () => {
    await checkout.add('Desk Plant');
    await checkout.add('Desk Plant');
    await expect(checkout.page.getByRole('row')).toHaveCount(2); // header + one line
    await expect(checkout.quantityInput('Desk Plant')).toHaveValue('2');
    await expect(checkout.orderTotal).toHaveText('$8.70');
  });

  test('TC-13 removing items updates the total and returns to the empty state', async () => {
    await checkout.add('Desk Plant');
    await checkout.add('Linen Notebook');
    await checkout.remove('Desk Plant');
    await expect(checkout.row('Desk Plant')).toHaveCount(0);
    await expect(checkout.orderTotal).toHaveText('$12.99');
    await checkout.remove('Linen Notebook');
    await expect(checkout.emptyCartMessage).toBeVisible();
    await expect(checkout.orderTotal).toHaveText('$0.00');
    await expect(checkout.itemCount).toHaveText('0');
  });

  test('TC-14 HTML in the name is shown as text, not executed', async ({ page }) => {
    let dialog = false;
    page.on('dialog', async (d) => { dialog = true; await d.dismiss(); });
    const name = '<img src=x onerror=alert(1)>';
    await checkout.add('Desk Plant');
    await checkout.nameInput.fill(name);
    await checkout.placeOrderButton.click();
    await expect(checkout.confirmations.first()).toContainText(`Thank you, ${name}.`);
    await expect(page.locator('#confirmations img')).toHaveCount(0);
    expect(dialog).toBe(false);
  });

  test('TC-15 "Start a new order" returns to a clean checkout', async () => {
    await checkout.add('Desk Plant');
    await checkout.nameInput.fill('Asha Rao');
    await checkout.placeOrderButton.click();
    await expect(checkout.confirmations).toHaveCount(1);

    await checkout.newOrderButton.click();
    await expect(checkout.emptyCartMessage).toBeVisible();
    await expect(checkout.orderTotal).toHaveText('$0.00');
    await expect(checkout.nameInput).toHaveValue('');
    await expect(checkout.confirmations).toHaveCount(0);
    await expect(checkout.placeOrderButton).toHaveText('Place order');
    await expect(checkout.placeOrderButton).toBeEnabled();
  });

  test('TC-16 keyboard-only checkout works', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Desk Plant to cart' }).focus();
    await page.keyboard.press('Enter');
    await checkout.quantityInput('Desk Plant').focus();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('3');
    await page.keyboard.press('Enter'); // commits quantity, must NOT place the order
    await expect(checkout.orderTotal).toHaveText('$13.05');
    await expect(checkout.errorSummary).toBeHidden();
    await page.keyboard.press('Tab'); // focus moves to "+" and stays there after commit
    await expect(page.getByRole('button', { name: 'Increase quantity of Desk Plant' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(checkout.orderTotal).toHaveText('$17.40');
    await expect(page.getByRole('button', { name: 'Increase quantity of Desk Plant' })).toBeFocused();

    await checkout.nameInput.focus();
    await page.keyboard.type('Asha Rao');
    await page.keyboard.press('Enter');
    await expect(checkout.confirmations).toHaveCount(1);
    await expect(checkout.confirmations.getByRole('heading', { name: 'Order confirmed' })).toBeFocused();
  });

  // ---- Regression tests for defects found in exploratory testing (see RESULTS.md) ----

  test('TC-17 [D-01] a maximum-length name without spaces wraps inside the confirmation', async ({ page }) => {
    await checkout.add('Desk Plant');
    await checkout.nameInput.fill('W'.repeat(80));
    await checkout.placeOrderButton.click();
    await expect(checkout.confirmations).toHaveCount(1);
    const panel = await checkout.confirmations.first().evaluate((e) => ({ scroll: e.scrollWidth, client: e.clientWidth }));
    expect(panel.scroll).toBeLessThanOrEqual(panel.client);
    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(pageWidth, 'page must not scroll horizontally').toBeLessThanOrEqual(0);
  });

  test('TC-18 [D-02] at phone width (375 px) the cart fits without horizontal scrolling and still works', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await checkout.add('Desk Plant');
    await checkout.add('Linen Notebook');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'page must not scroll horizontally').toBeLessThanOrEqual(0);
    await expect(checkout.page.getByRole('button', { name: 'Remove Linen Notebook from cart' })).toBeInViewport();

    await checkout.increase('Desk Plant');
    await expect(checkout.orderTotal).toHaveText('$21.69'); // 8.70 + 12.99
    await checkout.nameInput.fill('Asha Rao');
    await checkout.placeOrderButton.click();
    await expect(checkout.confirmationTotal).toHaveText('$21.69');
  });

  test('TC-19 [D-03] "Add to cart" buttons are disabled while the order is processing', async ({ page }) => {
    await page.clock.pauseAt(Date.now() + 1_000_000);
    await checkout.add('Desk Plant');
    await checkout.nameInput.fill('Asha Rao');
    await checkout.placeOrderButton.click();
    await expect(page.getByRole('button', { name: 'Add Linen Notebook to cart' })).toBeDisabled();
    await page.clock.runFor(10_000);
    await checkout.newOrderButton.click();
    await expect(page.getByRole('button', { name: 'Add Linen Notebook to cart' })).toBeEnabled();
  });
});
