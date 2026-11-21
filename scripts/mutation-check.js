#!/usr/bin/env node
// Mutation check: proves the tests can fail. Each mutant is a copy of public/
// with one realistic checkout bug injected. The suite is run against each copy;
// a mutant is "killed" if at least one test fails. Usage: node scripts/mutation-check.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'public', 'checkout.js'), 'utf8');

const mutants = [
  { id: 'M1', bug: 'Totals truncated from floating-point dollars instead of integer cents',
    find: 'cents += productById(l.id).priceCents * l.qty;',
    replace: 'cents += Math.floor((productById(l.id).priceCents / 100) * l.qty * 100);' },
  { id: 'M2', bug: 'Order total ignores quantity (sums unit prices)',
    find: 'cents += productById(l.id).priceCents * l.qty;',
    replace: 'cents += productById(l.id).priceCents;' },
  { id: 'M3', bug: 'Typed quantity does not update totals until another action',
    find: "if (n !== null) { setQty(id, n); updateInPlace(id); }",
    replace: "if (n !== null) { var _l = cartLine(id); _l.pendingQty = n; }" ,
    also: [{ find: "      setQty(id, n);\n    }\n    updateInPlace();", replace: "      cartLine(id).pendingQty = n;\n    }\n    updateInPlace();" }] },
  { id: 'M4', bug: 'No double-submit protection at all (no guard, button stays enabled)',
    find: "if (state.status !== 'editing') return;", replace: '',
    also: [{ find: 'el.fieldset.disabled = true;', replace: '' }] },
  { id: 'M5', bug: 'Double-submit protection relies only on disabling the button',
    find: "if (state.status !== 'editing') return;", replace: '' },
  { id: 'M6', bug: 'Blank-name check does not trim whitespace',
    find: "if (el.name.value.trim() === '') errors.push", replace: "if (el.name.value === '') errors.push" },
  { id: 'M7', bug: 'Required name not validated',
    find: "if (el.name.value.trim() === '') errors.push({ message: MSG.nameMissing, target: 'customer-name' });", replace: '' },
  { id: 'M8', bug: 'Empty cart not blocked',
    find: "if (state.cart.length === 0) errors.push({ message: MSG.emptyCart, target: 'products-heading' });", replace: '' },
  { id: 'M9', bug: 'Name cleared when validation fails',
    find: "      el.errorSummary.focus();\n      return;", replace: "      el.errorSummary.focus();\n      el.name.value = '';\n      return;" },
  { id: 'M10', bug: 'Cart can still be edited while the order is processing (confirmation total can drift)',
    find: 'el.fieldset.disabled = true;', replace: "el.placeOrder.disabled = true;",
    also: [{ find: "function canEdit() { return state.status === 'editing'; }", replace: 'function canEdit() { return true; }' }] },
];

const results = [];
let port = 4300;
for (const m of mutants) {
  let code = src;
  for (const r of [{ find: m.find, replace: m.replace }, ...(m.also || [])]) {
    if (!code.includes(r.find)) throw new Error(`${m.id}: pattern not found: ${r.find}`);
    code = code.replace(r.find, r.replace);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `mutant-${m.id}-`));
  for (const f of ['index.html', 'styles.css']) fs.copyFileSync(path.join(root, 'public', f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, 'checkout.js'), code);

  const project = process.env.PW_PROJECT || 'chromium'; // PW_PROJECT=chrome to use installed Chrome
  const run = spawnSync('npx', ['playwright', 'test', `--project=${project}`, '--reporter=json'], {
    cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === 'win32', // npx is npx.cmd on Windows
    env: { ...process.env, PUBLIC_DIR: dir, PORT: String(port++), CI: '1' },
  });
  const report = JSON.parse(run.stdout);
  const failed = [];
  const walk = (suite) => {
    (suite.specs || []).forEach((s) => s.tests.forEach((t) => {
      if (t.results.some((r) => r.status !== 'passed')) failed.push(s.title.split(' ')[0]);
    }));
    (suite.suites || []).forEach(walk);
  };
  report.suites.forEach(walk);
  results.push({ ...m, failed });
  console.log(`${m.id} ${failed.length ? 'KILLED' : 'SURVIVED'}  ${m.bug}  ->  failing: ${failed.join(', ') || 'none'}`);
}

const lines = ['| Mutant | Injected bug | Result | Tests that caught it |', '|---|---|---|---|'];
results.forEach((r) => lines.push(`| ${r.id} | ${r.bug} | ${r.failed.length ? 'Killed' : '**Survived**'} | ${r.failed.join(', ') || '—'} |`));
fs.mkdirSync(path.join(root, 'results'), { recursive: true });
fs.writeFileSync(path.join(root, 'results', 'mutation-results.md'), lines.join('\n') + '\n');
const survived = results.filter((r) => !r.failed.length).length;
console.log(`\n${results.length - survived}/${results.length} mutants killed`);
process.exit(survived ? 1 : 0);
