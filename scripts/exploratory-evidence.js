#!/usr/bin/env node
// Scripted replay of the manual exploratory session, used to capture evidence.
// Each step mirrors what a tester does by hand (real mouse/keyboard events in a
// real browser) and records what the customer would see plus a screenshot.
//
// Usage: node scripts/exploratory-evidence.js <outDir> [baseURL]
//   (start the site first: node server.js)
// Set PW_CHANNEL=chrome to use an installed Google Chrome.
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const outDir = path.resolve(process.argv[2] || 'evidence');
const baseURL = process.argv[3] || 'http://localhost:4173';
fs.mkdirSync(outDir, { recursive: true });

const rows = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); // observation time, as a human would wait

async function observe(page) {
  return page.evaluate(() => {
    const btn = document.getElementById('place-order');
    const summary = document.getElementById('error-summary');
    return {
      confirmations: document.querySelectorAll('[data-testid="confirmation"]').length,
      references: [...document.querySelectorAll('[data-testid="order-reference"]')].map((e) => e.textContent),
      button: btn.offsetParent ? `${btn.textContent}${btn.closest('fieldset').disabled ? ' (disabled)' : ''}` : '(hidden)',
      alert: summary.hidden ? '' : [...summary.querySelectorAll('li')].map((li) => li.textContent).join(' + '),
      name: document.getElementById('customer-name').value,
      total: document.getElementById('order-total').textContent,
      pageScrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
}

async function step(browser, id, title, actions, viewport = { width: 1280, height: 800 }) {
  const context = await browser.newContext({ viewport }); // clean state per scenario
  const page = await context.newPage();
  await page.goto(baseURL);
  const notes = (await actions(page)) || '';
  const shot = `${id}.png`;
  await page.screenshot({ path: path.join(outDir, shot), fullPage: true });
  const o = await observe(page);
  rows.push({ id, title, notes, shot, ...o });
  console.log(id, JSON.stringify(o));
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
  const place = (p) => p.getByRole('button', { name: 'Place order' });
  const add = (p, n) => p.getByRole('button', { name: `Add ${n} to cart` }).click();

  await step(browser, 'MT-01', 'Empty cart, blank name, click Place order', async (p) => {
    await place(p).click();
  });

  await step(browser, 'MT-02', 'Empty cart, name typed, click Place order', async (p) => {
    await p.getByLabel('Full name').fill('Asha Rao');
    await place(p).click();
  });

  await step(browser, 'MT-03', 'Real mouse double-click on Place order, then wait 3 s', async (p) => {
    await add(p, 'Desk Plant');
    await p.getByLabel('Full name').fill('Asha Rao');
    const box = await place(p).boundingBox();
    await p.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
    await p.screenshot({ path: path.join(outDir, 'MT-03-processing.png'), fullPage: true });
    await sleep(3000);
    return 'Mid-processing screenshot: MT-03-processing.png';
  });

  await step(browser, 'MT-04', 'Click, then click again 300 ms later while "Placing order…"', async (p) => {
    await add(p, 'Desk Plant');
    await p.getByLabel('Full name').fill('Asha Rao');
    const box = await place(p).boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await p.mouse.click(x, y);
    await sleep(300);
    await p.mouse.click(x, y);
    await sleep(3000);
  });

  await step(browser, 'MT-05', 'Triple-click (clickCount 3, no delay)', async (p) => {
    await add(p, 'Linen Notebook');
    await p.getByLabel('Full name').fill('Asha Rao');
    const box = await place(p).boundingBox();
    await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { clickCount: 3 });
    await sleep(3000);
  });

  await step(browser, 'MT-06', 'Press Enter 5 times quickly in the name field', async (p) => {
    await add(p, 'Desk Plant');
    const name = p.getByLabel('Full name');
    await name.fill('Asha Rao');
    await name.focus();
    for (let i = 0; i < 5; i++) await p.keyboard.press('Enter');
    await sleep(3000);
  });

  await step(browser, 'MT-07', 'Maximum-length (80 char) name without spaces', async (p) => {
    await add(p, 'Desk Plant');
    await p.getByLabel('Full name').fill('W'.repeat(80));
    await place(p).click();
    await p.getByRole('heading', { name: 'Order confirmed' }).waitFor();
  });

  await step(browser, 'MT-08', 'Phone-width viewport (375 px), two items in cart', async (p) => {
    await add(p, 'Desk Plant');
    await add(p, 'Linen Notebook');
  }, { width: 375, height: 740 });

  await step(browser, 'MT-09', 'Reload the page while "Placing order…"', async (p) => {
    await add(p, 'Desk Plant');
    await p.getByLabel('Full name').fill('Asha Rao');
    await place(p).click();
    await p.reload();
    await sleep(1500);
  });

  await browser.close();

  const md = ['| Step | Action | Confirmations | References | Button after | Validation message | Name field | Order total | Page width / viewport | Screenshot |',
    '|---|---|---|---|---|---|---|---|---|---|'];
  rows.forEach((r) => md.push(`| ${r.id} | ${r.title}${r.notes ? `<br>${r.notes}` : ''} | ${r.confirmations} | ${r.references.join(', ') || '—'} | ${r.button} | ${r.alert || '—'} | ${r.name ? (r.name.length > 20 ? r.name.slice(0, 12) + '… (' + r.name.length + ' chars)' : r.name) : '(empty)'} | ${r.total} | ${r.pageScrollWidth} / ${r.viewportWidth} | ${r.shot} |`));
  fs.writeFileSync(path.join(outDir, 'session-log.md'), md.join('\n') + '\n');
  console.log(`\nWrote ${rows.length} observations to ${path.join(outDir, 'session-log.md')}`);
})();
