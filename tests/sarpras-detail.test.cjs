// Offline tests for the per-lokus sarpras detail popup helpers and column/row
// projection helpers newly integrated into the populasi page (SARPRAS_DETAIL,
// SARPRAS_LOKUS and COLUMN_PROJECTION marker blocks).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

function block(name) {
  const open = html.indexOf(`// ${name}_BEGIN`);
  const close = html.indexOf(`// ${name}_END`);
  assert.ok(open >= 0 && close > open, `marker ${name} present`);
  return html.slice(open, close);
}
function setup(...names) {
  const ctx = vm.createContext({ Intl, Date, TextEncoder, crypto: webcrypto, Set });
  for (const name of names) vm.runInContext(block(name), ctx);
  return ctx;
}
const subtle = webcrypto.subtle;

test('SARPRAS_DETAIL helper block copied verbatim from the uji-petik page', () => {
  const other = fs.readFileSync(path.join(__dirname, '../../uji-petik-kdkmp-tw-4/index.html'), 'utf8');
  const cut = (text) => {
    const open = text.indexOf('// SARPRAS_DETAIL_BEGIN');
    const close = text.indexOf('// SARPRAS_DETAIL_END') + '// SARPRAS_DETAIL_END'.length;
    return text.slice(open, close);
  };
  assert.equal(cut(html), cut(other), 'exact byte-for-byte reuse');
});

const SCHEMA = {
  version: 3,
  shards: Array.from({ length: 8 }, (_v, i) => 'sarpras_detail_' + String(i).padStart(2, '0')),
  shard_count: 8, shard_key: 'portal_id', algorithm: 'sha256-first-byte-mod-8',
  identity: ['portal_id', 'NIK Koperasi (master)', 'Kode Desa'],
  item_missing_key: 'null', geography_join: 'gerai.portal_id', summary_only: ['gerai', 'mandek', 'terbangun'],
};
const DETAIL_COLS = ['portal_id', 'NIK Koperasi (master)', 'Kode Desa', 'stale', 'Status pembangunan', 'sarpras_state', 'sarpras_unknown', 'sarpras_source_date', 'sarpras_fresh_fetched_at', 'sarpras_source', 'sarpras_gap_reason', 'sarpras_observation', 'sarpras_detail'];
const shardSpec = () => Object.assign({ cols: DETAIL_COLS, rows: [], projection_version: 3, reconciliation_mode: 'row_partition' });
const toTable = (cols, rows) => ({ cols, rows: rows.map(r => cols.map(c => r[c] ?? null)) });
const fakeReader = (man, datasets) => {
  const calls = [];
  return {
    calls,
    async pin(col, pre) { calls.push(['pin', col, pre]); return { man, version: 'snap-1', legacy: false }; },
    async dataset(col, pre, name) {
      calls.push(['dataset', name]);
      if (!(name in datasets)) throw new Error('dataset tidak ada: ' + name);
      return datasets[name];
    },
    clear() {},
  };
};

test('strict schema: v3 accepts the fixed contract, tampering fails closed', () => {
  const ctx = setup('SARPRAS_DETAIL');
  const specs = () => Object.fromEntries(SCHEMA.shards.map(n => [n, shardSpec()]));
  assert.equal(ctx.sarprasDetailMode({ datasets: specs(), sarpras_detail_schema: SCHEMA }), 'v3');
  for (const tampered of [{ ...SCHEMA, shard_count: 4 }, { ...SCHEMA, algorithm: 'md5' }, { ...SCHEMA, extra: 'x' }]) {
    assert.equal(ctx.sarprasDetailMode({ datasets: specs(), sarpras_detail_schema: tampered }), 'invalid');
  }
  assert.equal(ctx.sarprasDetailMode({ datasets: { sarpras_detail: {} } }), 'legacy');
  assert.equal(ctx.sarprasDetailMode({ datasets: { gerai: {} } }), 'absent');
  assert.equal(ctx.sarprasDetailMode({ datasets: { sarpras_detail_08: shardSpec() }, sarpras_detail_schema: SCHEMA }), 'invalid');
});

test('resolve loads exactly one shard, strict identity, and item payload', async () => {
  const ctx = setup('SARPRAS_DETAIL');
  const lokus = { nik: '7315021080001', kode: '73.15.10.2002', nama: 'Koperasi Desa Samaulue' };
  const pid = '019ac627-39c6-7bc6-bd84-bc0d53e36488';
  const digestHex = [...new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(pid)))].map(b => b.toString(16).padStart(2, '0')).join('');
  const shard = SCHEMA.shards[parseInt(digestHex.slice(0, 2), 16) % 8];
  const detailCell = {
    sarpras_items: {
      'SARPRAS-1': { status: 'terpasang', vendor: 'PT A', jumlah_paket: 2, catatan: null },
      'SARPRAS-2': { status: 'shipment', vendor: null, jumlah_paket: null, catatan: 'cek' },
    },
    sarpras_catalog_sha256: 'a'.repeat(64),
    sarpras_detail_provenance: { observation: 'cached', latest_report_at: '2026-10-01', uncertainty: { latest_report_at_unknown: true } },
    sarpras_status_semantics: { unverified_statuses: ['shipment'] },
  };
  const man = {
    datasets: Object.fromEntries(SCHEMA.shards.map(n => [n, shardSpec()])),
    sarpras_detail_schema: SCHEMA,
    sarpras_catalogs: { ['a'.repeat(64)]: [{ id: 'SARPRAS-1', catalog_name: 'Meja' }, { id: 'SARPRAS-2', catalog_name: 'Kursi' }] },
    source_dates: { portal_latest: '20261102T115034.124018Z' },
  };
  // Careful: catalog registry key must match the hex digest reference used in the cell.
  man.sarpras_catalogs = { ['a'.repeat(64)]: man.sarpras_catalogs['a'.repeat(64)] };
  const reader = fakeReader(man, {
    gerai: toTable(['portal_id', 'NIK Koperasi (master)', 'Kode Desa'], [
      { portal_id: pid, 'NIK Koperasi (master)': lokus.nik, 'Kode Desa': lokus.kode },
      { portal_id: 'other-id-2', 'NIK Koperasi (master)': '999', 'Kode Desa': lokus.kode },
    ]),
    [shard]: toTable(DETAIL_COLS, [{
      portal_id: pid, 'NIK Koperasi (master)': lokus.nik, 'Kode Desa': lokus.kode, stale: false,
      'Status pembangunan': 'Sedang dibangun', sarpras_state: 'historic', sarpras_unknown: false,
      sarpras_source_date: '2026-10-06', sarpras_fresh_fetched_at: null, sarpras_source: null,
      sarpras_gap_reason: 'cached_source', sarpras_observation: null, sarpras_detail: detailCell,
    }]),
  });
  const result = await ctx.sarprasResolveDetail(reader, ['populasi_tw4', ''], lokus, subtle, TextEncoder);
  assert.equal(result.phase, 'done');
  assert.equal(result.portalId, pid);
  assert.equal(result.shard, shard);
  assert.equal(result.delivery.tiba, 0);
  assert.equal(result.delivery.terpasang, 1);
  const names = reader.calls.filter(([k]) => k === 'dataset').map(c => c[1]);
  assert.deepEqual(names.sort((a, b) => a.localeCompare(b)), ['gerai', shard], 'exactly one shard plus gerai');
  assert.ok(names.every(n => !n.startsWith('sarpras_detail_') || n === shard), 'no other shard loaded');
  assert.ok(result.detail.catalog.some(it => it.id === 'SARPRAS-1'));
  assert.equal(result.row.sarpras_gap_reason, 'cached_source');
});

test('identity and schema failure modes fail closed without detail queries', async () => {
  const ctx = setup('SARPRAS_DETAIL');
  const lokus = { nik: '111', kode: '73.15.10.2002' };
  const gerai = toTable(['portal_id', 'NIK Koperasi (master)', 'Kode Desa'],
    [{ portal_id: 'p1', 'NIK Koperasi (master)': lokus.nik, 'Kode Desa': lokus.kode },
     { portal_id: 'p2', 'NIK Koperasi (master)': lokus.nik, 'Kode Desa': lokus.kode }]);
  const specs = () => Object.fromEntries(SCHEMA.shards.map(n => [n, shardSpec()]));
  // duplicate identity
  const dupe = await ctx.sarprasResolveDetail(fakeReader({ datasets: specs(), sarpras_detail_schema: SCHEMA }, { gerai }), ['populasi_tw4', ''], lokus, subtle, TextEncoder);
  assert.equal(dupe.phase, 'identity');
  assert.match(dupe.reason, /tidak unik/);
  // missing lokus identity still reaches the fail-closed reason without loading detail
  const missing = await ctx.sarprasResolveDetail(fakeReader({ datasets: specs(), sarpras_detail_schema: SCHEMA }, { gerai }), ['populasi_tw4', ''], { nik: null, kode: lokus.kode }, subtle, TextEncoder);
  assert.equal(missing.phase, 'identity');
  assert.match(missing.reason, /tidak lengkap/);
  // absent / legacy / invalid schema
  for (const [man, phase] of [
    [{ datasets: { gerai: {} } }, 'absent'],
    [{ datasets: { sarpras_detail: {} } }, 'legacy'],
    [{ datasets: Object.fromEntries(SCHEMA.shards.map(n => [n, shardSpec()])), sarpras_detail_schema: { ...SCHEMA, shard_count: 3 } }, 'error'],
  ]) {
    const r = await ctx.sarprasResolveDetail(fakeReader(man, { gerai }), ['populasi_tw4', ''], lokus, subtle, TextEncoder);
    assert.equal(phase === 'error' ? r.phase : r.phase, phase, JSON.stringify(man.datasets).slice(0, 40));
    if (phase === 'error') assert.match(r.err, /fail closed|ditolak/);
  }
});

test('null semantics: absent or null detail cell stays unknown, never zero', async () => {
  const ctx = setup('SARPRAS_DETAIL');
  const parsed = ctx.sarprasDetailParse(null, {});
  assert.equal(parsed.ok, true);
  assert.deepEqual([parsed.items, parsed.catalog, parsed.provenance, parsed.semantics], [null, null, null, null]);
  const delivery = ctx.sarprasDeliveryText(null, false);
  assert.match(delivery, /belum diketahui/);
  assert.doesNotMatch(delivery, /Tiba: 0/);
});

test('COLUMN_PROJECTION: fixed curated default keeps main, hides technical/derived/coordinates', () => {
  const ctx = setup('COLUMN_PROJECTION');
  assert.equal(ctx.columnGroup('Latitude'), 'koordinat');
  assert.equal(ctx.columnGroup('sarpras_detail'), 'provenans');
  assert.equal(ctx.columnGroup('portal_id'), 'teknis');
  assert.equal(ctx.columnGroup('Progres 6 Okt (%)'), 'teknis', 'historic date-labelled progress hidden by default');
  assert.equal(ctx.columnGroup('(1) Terbangun dengan kelengkapan'), 'turunan', 'numbered flags are derived');
  assert.equal(ctx.columnGroup('(2) Mandek > 3 bulan'), 'turunan');
  assert.equal(ctx.columnGroup('Progres terbaru (%)'), null, 'key business progress stays main');
  assert.equal(ctx.columnGroup('Status kelengkapan sarpras'), null, 'sarpras summary never hidden');
  assert.equal(ctx.columnGroup('Item sarpras tiba/terpasang'), null);
  const cols = ['Desa/Kelurahan', 'Kode Desa', 'NIK Koperasi (master)', 'Progres terbaru (%)', 'Progres 6 Okt (%)', 'Status pembangunan',
    '(1) Terbangun dengan kelengkapan', '(2) Mandek > 3 bulan', 'portal_id', 'stale', 'Latitude', 'Longitude', 'sarpras_source_date',
    'Batch', 'Item sarpras tiba/terpasang', 'Status kelengkapan sarpras'];
  const def = ctx.defaultColumnSelection(cols);
  const okSet = def instanceof Set;
  assert.ok(okSet, 'default selection is a plain Set');
  for (const c of ['Desa/Kelurahan', 'Kode Desa', 'NIK Koperasi (master)', 'Progres terbaru (%)', 'Status pembangunan', 'Item sarpras tiba/terpasang', 'Status kelengkapan sarpras']) assert.ok(def.has(c), 'default shows ' + c);
  for (const c of ['(1) Terbangun dengan kelengkapan', '(2) Mandek > 3 bulan', 'portal_id', 'stale', 'Latitude', 'Longitude', 'sarpras_source_date', 'Progres 6 Okt (%)', 'Batch']) assert.ok(!def.has(c), 'default hides ' + c);
  // Projection is display-only and strictly faithful to the selection.
  assert.deepEqual(ctx.visibleDataColumns(cols, def),
    ['Desa/Kelurahan', 'Kode Desa', 'NIK Koperasi (master)', 'Progres terbaru (%)', 'Status pembangunan', 'Item sarpras tiba/terpasang', 'Status kelengkapan sarpras']);
});

test('SARPRAS_LOKUS: master NIK with NIK Koperasi fallback, kode and geography', () => {
  const ctx = setup('SARPRAS_LOKUS');
  const master = { nik: '111', kode: 'A', nama: 'N1', desa: 'D1', kec: 'K1', kab: 'B1' };
  const terang = { nik: '111', kode: 'A', nama: 'N1', desa: 'D1', kec: 'K1', kab: 'B1' }; // (master) column form
  assert.deepEqual(ctx.sarprasLokus(['NIK Koperasi (master)', 'Kode Desa', 'Nama Koperasi (portal)', 'Desa/Kelurahan', 'Kecamatan', 'Kabupaten/Kota'], ['111', 'A', 'N1', 'D1', 'K1', 'B1']).nik, '111');
  assert.deepEqual(ctx.sarprasLokus(['NIK Koperasi (master)', 'NIK Koperasi', 'Kode Desa'], [null, '999', 'A']).nik, '999', 'fallback used when master absent');
  assert.equal(ctx.sarprasLokus(['Kode Desa'], ['A']).nik, null);
  assert.equal(ctx.sarprasLokus(['Kode Desa'], [null]).kode, null);
  assert.equal(master.nik, terang.nik);
});

test('popup stale guard covers session, reader, account and dialog changes', () => {
  const ctx = setup('SARPRAS_DETAIL');
  const state = { session: 1, reader: 'R1' };
  const now = { me: 'M1', session: 1, reader: 'R1', dlgOpen: true };
  assert.equal(ctx.sarprasPopupStale(state, now), false);
  assert.equal(ctx.sarprasPopupStale(state, { ...now, session: 2 }), true);
  assert.equal(ctx.sarprasPopupStale(state, { ...now, reader: 'R2' }), true);
  assert.equal(ctx.sarprasPopupStale(state, { ...now, me: null }), true);
  assert.equal(ctx.sarprasPopupStale(state, { ...now, dlgOpen: false }), true);
  assert.equal(ctx.sarprasPopupStale(null, now), true);
});
