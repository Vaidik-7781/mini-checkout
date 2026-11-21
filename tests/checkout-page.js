// Small page object: locators are based on what the customer sees
// (roles, accessible names, labels) wherever possible.
const { expect } = require('@playwright/test');

class CheckoutPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.nameInput = page.getByLabel('Full name');
    this.placeOrderButton = page.getByRole('button', { name: /place order|placing order/i });
    this.orderTotal = page.getByTestId('order-total');
    this.itemCount = page.getByTestId('item-count');
    this.emptyCartMessage = page.getByText('Your cart is empty.', { exact: true });
    this.errorSummary = page.getByRole('alert');
    this.nameError = page.locator('#name-error');
    this.confirmations = page.getByRole('region', { name: 'Order confirmed' });
    this.orderReference = page.getByTestId('order-reference');
    this.confirmationTotal = page.getByTestId('confirmation-total');
    this.newOrderButton = page.getByRole('button', { name: 'Start a new order' });
  }

  /** Every test starts here: a fresh browser context + fresh page load = clean state. */
  async open() {
    await this.page.goto('/');
    await expect(this.page.getByRole('heading', { name: 'Your cart' })).toBeVisible();
    await expect(this.emptyCartMessage).toBeVisible();
    await expect(this.orderTotal).toHaveText('$0.00');
  }

  async add(productName) {
    await this.page.getByRole('button', { name: `Add ${productName} to cart` }).click();
  }

  row(productName) {
    return this.page.getByRole('row', { name: new RegExp(productName) });
  }

  quantityInput(productName) {
    return this.page.getByRole('textbox', { name: `Quantity of ${productName}` });
  }

  lineTotal(productName) {
    return this.row(productName).getByTestId('line-total');
  }

  increase(productName) {
    return this.page.getByRole('button', { name: `Increase quantity of ${productName}` }).click();
  }

  decrease(productName) {
    return this.page.getByRole('button', { name: `Decrease quantity of ${productName}` }).click();
  }

  remove(productName) {
    return this.page.getByRole('button', { name: `Remove ${productName} from cart` }).click();
  }

  /** Types a quantity and commits it the way a customer would (Tab away). */
  async setQuantity(productName, value) {
    const input = this.quantityInput(productName);
    await input.fill(String(value));
    await input.press('Tab');
  }
}

module.exports = { CheckoutPage };
