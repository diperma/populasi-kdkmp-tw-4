const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(html.slice(html.indexOf('// PW codes are exactly P01'), html.indexOf('const sarprasObj =')), ctx);
test('national viewer uses same national population and detail scope as D302', () => {
  for (const role of ['D302', 'NATIONAL_VIEWER']) assert.equal(vm.runInContext(`JSON.stringify(sarprasScope({role:'${role}',pw:'P01'}))`,ctx), '["populasi_tw4",""]');
  assert.equal(vm.runInContext(`JSON.stringify(sarprasScope({role:'PW',pw:'P01'}))`,ctx), '["populasi_pw","P01_"]');
});
test('unknown role and invalid PW fail closed even with a matching-looking pw', () => {
  for (const account of [{role:'OTHER',pw:'P01'},{role:'PW',pw:'ALL'},{role:'PW',pw:'P37'},null]) assert.equal(vm.runInContext(`sarprasScope(${JSON.stringify(account)})`,ctx),null);
  assert.ok(html.indexOf('if (!scope) { ME = null;') < html.indexOf('const pinned = await READER.pin(BASE.col'));
  assert.match(html,/BASE = \{ col: scope\[0\], pre: scope\[1\] \}/);
  assert.match(html,/Nasional · baca-saja/);
  assert.doesNotMatch(html,/\b(?:addDoc|updateDoc|deleteDoc|setDoc)\s*\(/);
});
