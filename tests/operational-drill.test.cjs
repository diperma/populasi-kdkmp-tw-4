const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const context = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('// OPERATIONAL_DRILL_BEGIN'), html.indexOf('// OPERATIONAL_DRILL_END')), context);
const row = (code, name, extra = {}) => ({ 'Kode Desa': code, Kecamatan: name, 'Desa/Kelurahan': 'Desa', ...extra });
test('district and village totals count independent operating companies, never gerai flags', () => {
  const P = [row('11.01.01.2001', 'A')];
  const G = [row('11.01.01.2001', 'A', { '(4) Beroperasi': 999, 'Status pembangunan': 'Selesai' })];
  const O = [row('11.01.01.2001', 'A'), row(null, 'A'), row(null, 'RMS only', { 'Nama Koperasi (sumber)': 'rms_account' })];
  const groups = context.opDistrictGroups(P, G, O);
  assert.equal(groups.reduce((n, r) => n + r.m.k4, 0), 3);
  assert.equal(vm.runInContext("opDistrictCode('11.01.01.2001')", context), '11.01.01');
  for (const group of groups) {
    const { totals } = context.opDesaAssemble(P, G, O, group.code);
    for (const key of Object.keys(group.m)) assert.equal(totals[key], group.m[key]);
  }
  const { list } = context.opDesaAssemble(P, G, O, 'nama:RMS only');
  assert.equal(list.length, 1);
  assert.equal(list[0].p, null);
  assert.equal(list[0].g, null);
  assert.equal(context.opCoopName(list[0].ops[0]), 'rms_account');
});
test('ambiguous district names do not attach unresolved RMS rows to either code', () => {
  const P = [row('11.01.01.2001', 'Same'), row('11.01.02.2001', 'Same')];
  const groups = context.opDistrictGroups(P, [], [row(null, 'Same')]);
  assert.equal(groups.find(r => r.code === 'nama:Same').m.k4, 1);
  assert.equal(groups.filter(r => r.code !== 'nama:Same').reduce((n, r) => n + r.m.k4, 0), 0);
});
