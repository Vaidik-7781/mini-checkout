/*
 * Mini Checkout — client-side only. No backend, no persistence:
 * reloading the page always gives a clean state.
 *
 * Money is held as integer cents everywhere and only formatted for display,
 * so totals never pick up floating-point error (e.g. 4.35 * 3 = 13.049999…).
 */
(function () {
  'use strict';

  var PRODUCTS = [
    { id: 'desk-plant', name: 'Desk Plant', priceCents: 435 },
    { id: 'linen-notebook', name: 'Linen Notebook', priceCents: 1299 }
  ];
  var MIN_QTY = 1;
  var MAX_QTY = 10;
  var PROCESSING_MS = 800; // simulated order processing time

  var MSG = {
    emptyCart: 'Your cart is empty. Add at least one item before placing your order.',
    nameMissing: 'Enter your full name.',
    qtyInvalid: 'Quantity must be a whole number from ' + MIN_QTY + ' to ' + MAX_QTY + '.'
  };

  var money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  function formatCents(cents) { return money.format(cents / 100); }

  // ---- State -------------------------------------------------------------
  // status: 'editing' | 'submitting' | 'confirmed'
  var state = { cart: [], status: 'editing', lineErrors: {} };

  function productById(id) {
    for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) return PRODUCTS[i];
    return null;
  }
  function cartLine(id) {
    for (var i = 0; i < state.cart.length; i++) if (state.cart[i].id === id) return state.cart[i];
    return null;
  }
  function totals(cart) {
    var items = 0, cents = 0;
    cart.forEach(function (l) {
      items += l.qty;
      cents += productById(l.id).priceCents * l.qty;
    });
    return { items: items, cents: cents };
  }

  /** Parses a quantity string. Returns an integer in range, or null if invalid. */
  function parseQty(raw) {
    var s = String(raw).trim();
    if (!/^\d+$/.test(s)) return null;
    var n = parseInt(s, 10);
    return n >= MIN_QTY && n <= MAX_QTY ? n : null;
  }

  // ---- DOM refs ------------------------------------------------------------
  var $ = function (id) { return document.getElementById(id); };
  var el = {
    productList: $('product-list'),
    cartTable: $('cart-table'),
    cartRows: $('cart-rows'),
    emptyCart: $('empty-cart'),
    itemCount: $('item-count'),
    orderTotal: $('order-total'),
    form: $('checkout-form'),
    fieldset: $('checkout-fieldset'),
    name: $('customer-name'),
    nameError: $('name-error'),
    placeOrder: $('place-order'),
    errorSummary: $('error-summary'),
    errorList: $('error-list'),
    checkoutView: $('checkout-view'),
    confirmationView: $('confirmation-view'),
    confirmations: $('confirmations'),
    newOrder: $('new-order')
  };

  function make(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'className') n.className = attrs[k]; else n.setAttribute(k, attrs[k]);
    });
    if (text != null) n.textContent = text; // textContent only: never innerHTML with user data
    return n;
  }

  // ---- Rendering -----------------------------------------------------------
  function renderProducts() {
    PRODUCTS.forEach(function (p) {
      var li = make('li', { className: 'product' });
      li.appendChild(make('span', { className: 'product__name' }, p.name));
      li.appendChild(make('span', { className: 'product__price' }, formatCents(p.priceCents)));
      var btn = make('button', { type: 'button', className: 'btn', 'data-add': p.id,
                                 'aria-label': 'Add ' + p.name + ' to cart' }, 'Add to cart');
      li.appendChild(btn);
      el.productList.appendChild(li);
    });
  }

  /** @param {string} [focusSelector] element to re-focus after re-render (keyboard users keep their place) */
  function renderCart(focusSelector) {
    el.cartRows.textContent = '';
    state.cart.forEach(function (line) {
      var p = productById(line.id);
      var tr = make('tr', { 'data-line': p.id });
      var th = make('th', { scope: 'row' }, p.name);
      tr.appendChild(th);
      tr.appendChild(make('td', { className: 'num' }, formatCents(p.priceCents)));

      var qtyTd = make('td', { className: 'qty-col' });
      var wrap = make('div', { className: 'qty' });
      var dec = make('button', { type: 'button', className: 'btn btn-icon', 'data-dec': p.id,
                                 'aria-label': 'Decrease quantity of ' + p.name }, '−');
      if (line.qty <= MIN_QTY) dec.disabled = true;
      var errId = 'qty-error-' + p.id;
      var input = make('input', { type: 'text', inputmode: 'numeric', className: 'qty__input',
                                  'data-qty': p.id, 'aria-label': 'Quantity of ' + p.name,
                                  'aria-describedby': errId, autocomplete: 'off' });
      input.value = String(line.qty);
      var inc = make('button', { type: 'button', className: 'btn btn-icon', 'data-inc': p.id,
                                 'aria-label': 'Increase quantity of ' + p.name }, '+');
      if (line.qty >= MAX_QTY) inc.disabled = true;
      wrap.appendChild(dec); wrap.appendChild(input); wrap.appendChild(inc);
      qtyTd.appendChild(wrap);
      var err = make('p', { id: errId, className: 'field-error' }, state.lineErrors[p.id] || '');
      if (!state.lineErrors[p.id]) err.hidden = true;
      qtyTd.appendChild(err);
      tr.appendChild(qtyTd);

      tr.appendChild(make('td', { className: 'num', 'data-testid': 'line-total' },
                          formatCents(p.priceCents * line.qty)));
      var actions = make('td');
      actions.appendChild(make('button', { type: 'button', className: 'btn btn-link', 'data-remove': p.id,
                                           'aria-label': 'Remove ' + p.name + ' from cart' }, 'Remove'));
      tr.appendChild(actions);
      el.cartRows.appendChild(tr);
    });

    var empty = state.cart.length === 0;
    el.cartTable.hidden = empty;
    el.emptyCart.hidden = !empty;

    var t = totals(state.cart);
    el.itemCount.textContent = String(t.items);
    el.orderTotal.textContent = formatCents(t.cents);

    if (focusSelector) {
      var again = el.cartRows.querySelector(focusSelector);
      if (again && again.disabled) { // e.g. "−" just hit the minimum: move focus to the quantity box
        again = again.closest('tr').querySelector('[data-qty]');
      }
      if (again) again.focus();
    }
  }

  /**
   * Updates line totals, steppers, quantity boxes and messages without re-creating
   * the rows, so keyboard focus and caret position are never disturbed.
   * @param {string} [skipInputId] quantity box currently being typed in (leave its text alone)
   */
  function updateInPlace(skipInputId) {
    state.cart.forEach(function (line) {
      var row = el.cartRows.querySelector('[data-line="' + line.id + '"]');
      if (!row) return;
      row.querySelector('[data-testid="line-total"]').textContent =
        formatCents(productById(line.id).priceCents * line.qty);
      row.querySelector('[data-dec]').disabled = line.qty <= MIN_QTY;
      row.querySelector('[data-inc]').disabled = line.qty >= MAX_QTY;
      var input = row.querySelector('[data-qty]');
      if (line.id !== skipInputId) input.value = String(line.qty);
      var err = row.querySelector('.field-error');
      err.textContent = state.lineErrors[line.id] || '';
      err.hidden = !state.lineErrors[line.id];
    });
    var t = totals(state.cart);
    el.itemCount.textContent = String(t.items);
    el.orderTotal.textContent = formatCents(t.cents);
  }

  // ---- Validation ----------------------------------------------------------
  function setNameError(msg) {
    el.nameError.textContent = msg || '';
    el.nameError.hidden = !msg;
    if (msg) el.name.setAttribute('aria-invalid', 'true'); else el.name.removeAttribute('aria-invalid');
  }

  function showSummary(errors) {
    el.errorList.textContent = '';
    errors.forEach(function (e) {
      var li = make('li');
      var a = make('a', { href: '#' + e.target }, e.message);
      li.appendChild(a);
      el.errorList.appendChild(li);
    });
    el.errorSummary.hidden = errors.length === 0;
  }

  function validate() {
    var errors = [];
    if (state.cart.length === 0) errors.push({ message: MSG.emptyCart, target: 'products-heading' });
    if (el.name.value.trim() === '') errors.push({ message: MSG.nameMissing, target: 'customer-name' });
    return errors;
  }

  function refreshSummaryIfShown() {
    // Once the summary is visible, keep it in sync as the customer fixes things.
    if (el.errorSummary.hidden) return;
    var errors = validate();
    showSummary(errors);
    setNameError(el.name.value.trim() === '' ? MSG.nameMissing : '');
  }

  // ---- Cart actions --------------------------------------------------------
  function canEdit() { return state.status === 'editing'; }

  function addItem(id) {
    if (!canEdit()) return;
    var line = cartLine(id);
    if (line) {
      if (line.qty < MAX_QTY) line.qty += 1;
    } else {
      state.cart.push({ id: id, qty: 1 });
    }
    delete state.lineErrors[id];
    renderCart();
    refreshSummaryIfShown();
  }

  function removeItem(id) {
    if (!canEdit()) return;
    state.cart = state.cart.filter(function (l) { return l.id !== id; });
    delete state.lineErrors[id];
    renderCart();
    document.getElementById('cart-heading').focus(); // the clicked button no longer exists
    refreshSummaryIfShown();
  }

  function setQty(id, qty) {
    if (!canEdit()) return;
    var line = cartLine(id);
    if (!line) return;
    line.qty = Math.min(MAX_QTY, Math.max(MIN_QTY, qty));
    delete state.lineErrors[id];
  }

  // ---- Place order ---------------------------------------------------------
  function newReference() {
    var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid misreading
    var bytes = new Uint8Array(6);
    window.crypto.getRandomValues(bytes);
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += alphabet[bytes[i] % alphabet.length];
    return 'ORD-' + s;
  }

  function onSubmit(evt) {
    evt.preventDefault();
    // Idempotency guard: this check-and-set is synchronous, so a second click,
    // a double-click or repeated Enter cannot start a second order.
    if (state.status !== 'editing') return;

    // Commit any quantity still being typed (blur may not have fired yet).
    var active = document.activeElement;
    if (active && active.hasAttribute && active.hasAttribute('data-qty')) commitQtyInput(active);

    var errors = validate();
    setNameError(el.name.value.trim() === '' ? MSG.nameMissing : '');
    if (errors.length) {
      showSummary(errors);
      el.errorSummary.focus();
      return; // nothing the customer typed is cleared
    }
    showSummary([]);

    state.status = 'submitting';
    el.placeOrder.textContent = 'Placing order…';
    el.placeOrder.setAttribute('aria-busy', 'true');
    el.fieldset.disabled = true; // cart and name cannot change mid-submit

    var order = {
      reference: newReference(),
      name: el.name.value.trim(),
      lines: state.cart.map(function (l) { return { id: l.id, qty: l.qty }; }),
      totalCents: totals(state.cart).cents
    };

    window.setTimeout(function () { confirmOrder(order); }, PROCESSING_MS);
  }

  function confirmOrder(order) {
    state.status = 'confirmed';
    var sec = make('section', { className: 'panel confirmation', 'aria-labelledby': 'conf-title-' + order.reference });
    sec.setAttribute('role', 'region');
    sec.setAttribute('data-testid', 'confirmation');
    var h = make('h2', { id: 'conf-title-' + order.reference, tabindex: '-1' }, 'Order confirmed');
    sec.appendChild(h);
    sec.appendChild(make('p', null, 'Thank you, ' + order.name + '. Your order has been placed.'));
    var ref = make('p', { className: 'reference' });
    ref.appendChild(document.createTextNode('Order reference: '));
    ref.appendChild(make('strong', { 'data-testid': 'order-reference' }, order.reference));
    sec.appendChild(ref);

    var ul = make('ul', { className: 'conf-lines' });
    order.lines.forEach(function (l) {
      var p = productById(l.id);
      ul.appendChild(make('li', null, l.qty + ' × ' + p.name + ' — ' + formatCents(p.priceCents * l.qty)));
    });
    sec.appendChild(ul);
    var tot = make('p', { className: 'conf-total' });
    tot.appendChild(document.createTextNode('Total paid: '));
    tot.appendChild(make('strong', { 'data-testid': 'confirmation-total' }, formatCents(order.totalCents)));
    sec.appendChild(tot);

    el.confirmations.appendChild(sec);
    el.checkoutView.hidden = true;
    el.confirmationView.hidden = false;
    h.focus();
  }

  function resetForNewOrder() {
    state.cart = [];
    state.lineErrors = {};
    state.status = 'editing';
    el.confirmations.textContent = '';
    el.name.value = '';
    setNameError('');
    showSummary([]);
    el.fieldset.disabled = false;
    el.placeOrder.textContent = 'Place order';
    el.placeOrder.removeAttribute('aria-busy');
    renderCart();
    el.confirmationView.hidden = true;
    el.checkoutView.hidden = false;
    el.name.focus();
  }

  // ---- Quantity input handling --------------------------------------------
  function commitQtyInput(input) {
    var id = input.getAttribute('data-qty');
    var line = cartLine(id);
    if (!line) return;
    var n = parseQty(input.value);
    if (n === null) {
      // Live typing may already have applied a partial value (typing "35" applies
      // "3" first), so go back to the quantity the box had when it was focused.
      var prev = parseQty(input.getAttribute('data-prev') || '');
      if (prev !== null) line.qty = prev;
      // Revert to the last valid quantity and explain why (informational; the
      // cart is valid again, so it does not block checkout).
      state.lineErrors[id] = MSG.qtyInvalid + ' Reset to ' + line.qty + '.';
    } else {
      setQty(id, n);
    }
    updateInPlace();
    input.setAttribute('data-prev', String(line.qty));
    refreshSummaryIfShown();
  }

  // ---- Events --------------------------------------------------------------
  el.productList.addEventListener('click', function (e) {
    var b = e.target.closest('[data-add]');
    if (b) addItem(b.getAttribute('data-add'));
  });

  el.cartRows.addEventListener('click', function (e) {
    var t = e.target.closest('button');
    if (!t) return;
    var id, sel;
    if ((id = t.getAttribute('data-inc'))) { var a = cartLine(id); if (a) setQty(id, a.qty + 1); sel = '[data-inc="' + id + '"]'; }
    else if ((id = t.getAttribute('data-dec'))) { var b = cartLine(id); if (b) setQty(id, b.qty - 1); sel = '[data-dec="' + id + '"]'; }
    else if ((id = t.getAttribute('data-remove'))) { removeItem(id); return; }
    else return;
    renderCart(sel);
    refreshSummaryIfShown();
  });

  // Live update while typing a valid quantity; invalid text is resolved on commit.
  el.cartRows.addEventListener('input', function (e) {
    var input = e.target;
    if (!input.hasAttribute('data-qty') || !canEdit()) return;
    var id = input.getAttribute('data-qty');
    var n = parseQty(input.value);
    if (n !== null) { setQty(id, n); updateInPlace(id); }
  });

  el.cartRows.addEventListener('focusin', function (e) {
    var id = e.target.getAttribute && e.target.getAttribute('data-qty');
    var line = id && cartLine(id);
    if (line) e.target.setAttribute('data-prev', String(line.qty));
  });

  el.cartRows.addEventListener('change', function (e) {
    if (e.target.hasAttribute('data-qty')) commitQtyInput(e.target);
  });

  el.cartRows.addEventListener('keydown', function (e) {
    // Enter in a quantity box commits that quantity rather than placing the order.
    if (e.key === 'Enter' && e.target.hasAttribute('data-qty')) {
      e.preventDefault();
      commitQtyInput(e.target);
    }
  });

  el.name.addEventListener('input', refreshSummaryIfShown);
  el.form.addEventListener('submit', onSubmit);
  el.newOrder.addEventListener('click', resetForNewOrder);

  renderProducts();
  renderCart();
})();
