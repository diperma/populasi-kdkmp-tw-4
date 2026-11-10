const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const code = html.slice(html.indexOf('function snapshotUpdatedText('), html.indexOf('// Latest progress'));
const context = vm.createContext({ Intl, Date });
vm.runInContext(code, context);
test('portal retrieval timestamp is displayed in WIB, not snapshot build or page time', () => {
  const actual = context.snapshotUpdatedText({ source_dates: { portal_latest: '20261102T115034.124018Z', as_of: '2026-11-03' } });
  assert.match(actual, /2 November 2026/);
  assert.match(actual, /18[.:]50 WIB/);
});
test('ISO timestamps and WIB day rollover are supported', () => {
  assert.match(context.snapshotUpdatedText({ source_dates: { portal_latest: '2026-11-02T23:05:00Z' } }), /3 November 2026, 06[.:]05 WIB/);
});
test('missing or invalid retrieval never falls back to unrelated historical dates', () => {
  for (const value of [undefined, {}, { source_dates: { portal_baseline: '2026-10-06' } }, { source_dates: { portal_latest: 'bad' } }, { source_dates: { portal_latest: '2026-11-02' } }]) {
    assert.equal(context.snapshotUpdatedText(value), 'Terakhir diperbarui: belum tersedia');
  }
});
test('MonRMS source is separate from portal date and preserves operating name', () => {
  const man = { source_dates: { portal_latest: '2026-11-09T23:00:00Z' }, operational_rms: {
    definition: 'positive-cumulative-general-sales', period_start: '2026-03-16',
    period_end: '2026-11-10', fetched_at_utc: '2026-11-10T05:20:03Z'
  } };
  const text = context.operationalSourceText(man);
  assert.match(text, /KDKMP yang beroperasi/);
  assert.match(text, /2026-03-16 sampai 2026-11-10/);
  assert.match(text, /10 November 2026, 12[.:]20 WIB/);
  assert.doesNotMatch(context.operationalSourceText({}), /undefined|Invalid/);
});
test('technical warnings remain out of visible source copy', () => {
  const text = context.snapshotSourceText({ warnings: ['REVIEW ONLY', 'OFFLINE ITERATIVE REVIEW ONLY'], source_dates: {} });
  assert.doesNotMatch(text, /REVIEW|OFFLINE|stale|as_of/);
  assert.match(text, /historis\/parsial/);
});
