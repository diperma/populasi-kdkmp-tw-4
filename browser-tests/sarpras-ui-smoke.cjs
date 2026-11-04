// Local-only browser smoke for the populasi page sarpras detail + column picker
// integration. No Firebase and no production access; all gstatic imports are
// stubbed and every network route is blocked. Run:
//   node browser-tests/sarpras-ui-smoke.cjs
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const pwPath = process.env.PW_MODULE || '/tmp/opencode/kdkmp-browser-tools/node_modules/playwright-core';
const { chromium } = require(pwPath);

const root = path.join(__dirname, '..');
const errors = [];
const out = '/tmp/opencode/out';
const CHROME = process.env.KDKMP_CHROME || '/home/ubuntu/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';

// ---------- synthetic v3 snapshot (offline fixture) ----------
const PID = '019ac627-39c6-7bc6-bd84-bc0d53e36488';
const NIK = '7315021080001', KODE = '73.15.10.2002';
const SHARDS = Array.from({ length: 8 }, (_v, i) => 'sarpras_detail_' + String(i).padStart(2, '0'));
const SHARD_INDEX = (crypto.createHash('sha256').update(PID).digest()[0] & 255) % 8;
const SHARD = SHARDS[SHARD_INDEX];
const SCHEMA = {
  version: 3, shards: SHARDS, shard_count: 8, shard_key: 'portal_id',
  algorithm: 'sha256-first-byte-mod-8', identity: ['portal_id', 'NIK Koperasi (master)', 'Kode Desa'],
  item_missing_key: 'null', geography_join: 'gerai.portal_id', summary_only: ['gerai', 'mandek', 'terbangun'],
};
const DETAIL_COLS = ['portal_id', 'NIK Koperasi (master)', 'Kode Desa', 'stale', 'Status pembangunan', 'sarpras_state', 'sarpras_unknown', 'sarpras_source_date', 'sarpras_fresh_fetched_at', 'sarpras_source', 'sarpras_gap_reason', 'sarpras_observation', 'sarpras_detail'];
const DIGEST = 'a'.repeat(64);
const CATALOG = [{ id: 'SARPRAS-1', name: 'Meja paket', group: 'MMD', priority: 'Mandatory', order: 1, jumlah_unit_per_paket: 2 }, { id: 'SARPRAS-2', name: 'Kursi', group: 'MMD', priority: null, order: null, jumlah_unit_per_paket: 2 }];
const DETAIL = {
  sarpras_items: {
    'SARPRAS-1': { status: 'terpasang', vendor: 'PT Maju', jumlah_paket: 2, catatan: 'terpasang lengkap' },
    'SARPRAS-2': { status: 'shipment', vendor: null, jumlah_paket: null, catatan: 'dalam pengiriman' },
  },
  sarpras_catalog_sha256: DIGEST,
  sarpras_detail_provenance: { observation: 'cached', latest_report_at: '2026-10-01T04:00:00Z', last_reviewed_report: '2026-09-30', fetched_at_utc: '2026-10-02T01:00:00Z', uncertainty: { latest_report_at_unknown: true } },
  sarpras_status_semantics: { unverified_statuses: [] },
};

function buildDocs() {
  const geraiCols = ['Provinsi', 'Kabupaten/Kota', 'Kecamatan', 'Desa/Kelurahan', 'Kode Desa', 'NIK Koperasi (master)', 'Nama Koperasi (portal)', 'Progres terbaru (%)', 'Progres 6 Okt (%)', 'Status pembangunan', 'Hari sejak dibuat', 'Hari lewat target', 'Kategori keterlambatan', '(1) Terbangun dengan kelengkapan', '(2) Mandek > 3 bulan', '(4) Beroperasi', '(5) Sedang progres', 'portal_id', 'stale', 'Latitude', 'Longitude', 'sarpras_source_date', 'sarpras_unknown', 'sarpras_item_detail_unknown', 'Batch', 'Item sarpras tiba/terpasang'];
  const g1 = { 'Provinsi': 'ACEH', 'Kabupaten/Kota': 'KAB TEST', 'Kecamatan': 'KEC TEST', 'Desa/Kelurahan': 'DESA SAMAR', 'Kode Desa': KODE, 'NIK Koperasi (master)': NIK, 'Nama Koperasi (portal)': 'Koperasi Samaulue', 'Progres terbaru (%)': 100, 'Progres 6 Okt (%)': 73, 'Status pembangunan': 'Selesai', 'Hari sejak dibuat': 101, 'Hari lewat target': 0, 'Kategori keterlambatan': '–', '(1) Terbangun dengan kelengkapan': 1, '(2) Mandek > 3 bulan': 0, '(4) Beroperasi': 0, '(5) Sedang progres': 0, 'portal_id': PID, 'stale': false, 'Latitude': 5.54, 'Longitude': 95.32, 'sarpras_source_date': '2026-10-06', 'sarpras_unknown': false, 'sarpras_item_detail_unknown': false, 'Batch': 'B-002', 'Item sarpras tiba/terpasang': 1 };
  const g2 = { 'Provinsi': 'ACEH', 'Kabupaten/Kota': 'KAB TEST', 'Kecamatan': 'KEC TEST', 'Desa/Kelurahan': 'DESA TANPA-ID', 'Kode Desa': null, 'NIK Koperasi (master)': null, 'Nama Koperasi (portal)': 'Koperasi Tanpa', 'Progres terbaru (%)': 70, 'Progres 6 Okt (%)': 73, 'Status pembangunan': 'Sedang dibangun', 'Hari sejak dibuat': 101, 'Hari lewat target': 95, 'Kategori keterlambatan': '> 3 bulan', '(1) Terbangun dengan kelengkapan': null, '(2) Mandek > 3 bulan': 1, '(4) Beroperasi': 0, '(5) Sedang progres': 1, 'portal_id': '019bffff-0000-0000-0000-000000000009', 'stale': true, 'Latitude': null, 'Longitude': null, 'sarpras_source_date': null, 'sarpras_unknown': true, 'sarpras_item_detail_unknown': true, 'Batch': null, 'Item sarpras tiba/terpasang': null };
  const data = {
    gerai: { cols: geraiCols, filters: ['Provinsi'], rows: [g1, g2] },
    mandek: { cols: geraiCols, filters: ['Provinsi'], rows: [] },
    terbangun: { cols: geraiCols, filters: ['Provinsi'], rows: [] },
    beroperasi: { cols: ['Kode Desa'], filters: [], rows: [] },
    belum_lahan: { cols: ['Kode Desa', 'Nama Koperasi'], filters: [], rows: [] },
    populasi: { cols: ['Provinsi', 'Kabupaten/Kota', 'Kecamatan', 'Desa/Kelurahan', 'Kode Desa', 'NIK Koperasi', 'Nama Koperasi', 'Status lahan gerai', 'Status pembangunan gerai terkini', 'Progres gerai terkini (%)', 'gerai_record_count'], filters: [], rows: [g1, g2] },
    rekap_prov: { cols: ['Provinsi', 'Populasi', '(1)', '(2)', '(3)', '(4)', '(5)', 'Lahan terpetakan', 'Gedung terbangun', 'Belum melapor'], filters: [], rows: [['ACEH', 2, 0, 1, 0, 0, 0, 2, 1, 0]] },
    rekap_kab: { cols: ['Provinsi', 'Kabupaten/Kota', 'Populasi', '(1)', '(2)', '(3)', '(4)', '(5)', 'Lahan terpetakan', 'Gedung terbangun', 'Belum melapor'], filters: [], rows: [['ACEH', 'KAB TEST', 2, 0, 1, 0, 0, 0, 2, 1, 0]] },
  };
  const shardRows = [{
    portal_id: PID, 'NIK Koperasi (master)': NIK, 'Kode Desa': KODE, stale: false,
    'Status pembangunan': 'Selesai', sarpras_state: 'historic', sarpras_unknown: false,
    sarpras_source_date: '2026-10-06', sarpras_fresh_fetched_at: null, sarpras_source: null,
    sarpras_gap_reason: 'cached_source', sarpras_observation: null, sarpras_detail: DETAIL,
  }];
  for (const name of SHARDS) {
    const rows = name === SHARD ? shardRows : [];
    const payload = JSON.stringify({ cols: DETAIL_COLS, rows });
    const d = zlib.gzipSync(payload).toString('base64');
    data[name] = { cols: DETAIL_COLS, filters: [], rows, chunks: 1, chunk_sha256: [crypto.createHash('sha256').update(d).digest('hex')], projection_version: 3, reconciliation_mode: 'row_partition' };
  }
  const man = {
    schema_version: 2, snapshot_id: 'sarpras_synthetic_v3', sumber: 'OFFLINE SYNTHETIC FIXTURE — NOT REAL DATA',
    source_dates: { portal_latest: '20261102T115034.124018Z' },
    kpi: { populasi: 2, lahan: 2, terbangun: 1, k1: 0, k2: 1, k3: 0, k4: 0, k5: 1, belum_lapor: 0 },
    sarpras_detail_schema: SCHEMA, sarpras_catalogs: { [DIGEST]: CATALOG }, datasets: {},
  };
  const docs = {};
  const put = (name, payload, rows, extra) => {
    const d = zlib.gzipSync(payload).toString('base64');
    man.datasets[name] = Object.assign({ chunks: 1, rows, cols: JSON.parse(payload).cols.length, chunk_sha256: [crypto.createHash('sha256').update(d).digest('hex')] }, extra || {});
    docs['v_' + man.snapshot_id + '_' + name + '_0'] = { d };
  };
  for (const [name, ds] of Object.entries(data)) {
    if (name === '__docs__') continue;
    const spec = {};
    for (const k of ['projection_version', 'reconciliation_mode']) if (ds[k] !== undefined) spec[k] = ds[k];
    put(name, JSON.stringify({ cols: ds.cols, rows: ds.rows.map((r) => Array.isArray(r) ? r : ds.cols.map((c) => r[c] ?? null)), filters: ds.filters }), ds.rows.length, spec);
  }
  docs['active'] = { schema_version: 2, snapshot_id: man.snapshot_id };
  docs['v_' + man.snapshot_id + '_manifest'] = { json: JSON.stringify(man) };
  return docs;
}
const DOCS = buildDocs();

// ---------- firebase module stubs, mirrors kdkmp-portal-worker smoke harness ----------
const mock = `
const mockAuth={currentUser:null}; let authCallback;
const initializeApp=()=>({}),getAuth=()=>mockAuth,getFirestore=()=>({});
class GoogleAuthProvider {setCustomParameters(){} static credential(){return {};}}
const doc=(db,col,id)=>({col,id});
const getDoc=async ref=>{const data=await window.__readDoc(ref.col,ref.id);return {exists:()=>data!==null,data:()=>data};};
const onAuthStateChanged=(a,fn)=>{authCallback=fn;queueMicrotask(()=>fn(null));};
const signInWithPopup=async()=>{mockAuth.currentUser={email:'synthetic-smoke@bpkp.go.id',emailVerified:true};await authCallback(mockAuth.currentUser);};
const signOut=async()=>{mockAuth.currentUser=null;await authCallback(null);};
const signInWithRedirect=signInWithPopup,signInWithCredential=signInWithPopup;
const connectAuthEmulator=()=>{},connectFirestoreEmulator=()=>{};
`;

(async () => {
  fs.mkdirSync(out, { recursive: true, mode: 0o700 });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-background-networking'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (process.env.DEBUG) console.error('CONSOLE', m.type(), m.text()); if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.exposeFunction('__readDoc', async (col, id) => { if (process.env.DEBUG) console.error('READDOC', col, id); return col === 'akses' ? { role: 'D302', pw: 'P01', nama: 'Synthetic Smoke', unit: 'Local test' } : (DOCS[id] ?? null); });
    let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    html = html.replace(/^import .* from "https:\/\/www\.gstatic\.com\/firebasejs\/[^\n]+;\r?$/gm, '');
    html = html.replace('<script type="module">', '<script type="module">\n' + mock);
    html = html.replace(/<link[^>]+https:\/\/fonts\.[^>]+>/g, '');
    await context.route('**/*', (route) => route.request().url() === 'http://127.0.0.1:8791/populasi' ? route.fulfill({ contentType: 'text/html', body: html }) : route.abort('blockedbyclient'));
    await page.goto('http://127.0.0.1:8791/populasi');
    await page.locator('#loginBtn').click();
    await page.locator('#app').waitFor({ state: 'visible' });

    // gerai tab: curated columns hidden by default
    await page.click('[data-t="gerai"]');
    await page.locator('#tbl tbody tr').first().waitFor();
    const ths = (await page.locator('#tbl thead th').allInnerTexts());
    for (const c of ['portal_id', 'stale', 'Latitude', 'Longitude', 'sarpras_source_date', 'Batch', 'sarpras_unknown',
      '(1) Terbangun dengan kelengkapan', '(2) Mandek > 3 bulan', '(5) Sedang progres', 'Progres 6 Okt (%)', 'Hari sejak dibuat', 'Peta']) assert.ok(!ths.includes(c), 'fixed projection hides ' + c + ' (got: ' + ths.join('|') + ')');
    assert.ok(ths.includes('Kode Desa') && ths.includes('Progres terbaru (%)'), 'key business columns stay visible');
    assert.ok(ths.includes('Detail sarpras'), 'detail action column present');
    assert.match(await page.locator('#csv').innerText(), /Unduh CSV lengkap/);
    assert.equal(await page.locator('#view p.note').filter({ hasText: 'CSV memuat semua kolom' }).count(), 1, 'completeness note shown');
    assert.equal(await page.locator('details.pickcols, #pcols').count(), 0, 'column picker UI removed');
    await page.screenshot({ path: path.join(out, 'populasi-gerai-default.png'), fullPage: true });

    // search still covers full data
    await page.fill('#q', 'DESA TANPA-ID');
    await page.waitForFunction(() => document.querySelectorAll('#tbl tbody tr').length === 1);
    await page.locator('#tbl tbody tr').first().locator('button[data-d]').click();
    await page.locator('#dlg[open]').waitFor();
    await page.waitForFunction(() => {
      const b = document.getElementById('dlgBody');
      return b && b.innerText.includes('Identitas lokus tidak lengkap');
    });
    await page.click('#spTutup');
    assert.equal(await page.locator('#dlg[open]').count(), 0, 'dialog closes');

    // healthy row: happy-path detail popup with catalog item, status pill, provenance
    await page.fill('#q', '');
    await page.waitForFunction(() => document.querySelectorAll('#tbl tbody tr').length === 2);
    await page.locator('#tbl tbody tr').first().locator('button[data-d]').click();
    await page.locator('#dlg[open]').waitFor();
    try {
      await page.waitForFunction(() => {
        const b = document.getElementById('dlgBody');
        return b && b.innerText.includes('Meja paket') && b.innerText.includes('Cara perolehan detail')
      });
    } catch (e) {
      console.error('DLG-DEBUG:', JSON.stringify(await page.locator('#dlgBody').innerText()).slice(0, 900));
      throw e;
    }
    const healthy = await page.locator('#dlgBody').innerText();
    const body = await page.locator('#dlgBody').innerText();
    assert.ok(body.includes('Meja paket'), 'named catalog item rendered');
    assert.ok(body.includes('terpasang'), 'raw status rendered');
    assert.ok(body.includes('PT Maju'), 'vendor rendered');
    assert.ok(body.includes('terpasang lengkap'), 'notes rendered');
    assert.ok(body.includes('Tiba: 0'), 'honest counting text');
    assert.ok(body.includes('belum terverifikasi'), 'unverified warning visible');
    assert.ok(body.includes('dalam pengiriman'), 'raw note of unverified item visible');
    assert.ok(body.includes('2026-10-01T04:00:00Z'), 'vendor report date shown');
    assert.ok(body.includes('cache historis'), 'historical observation honestly labeled');
    await page.screenshot({ path: path.join(out, 'populasi-sarpras-popup.png') });
    await page.click('#spTutup');

    // logout resets and closes the dialog (modal closes itself, then logout)
    await page.locator('#tbl tbody tr').first().locator('button[data-d]').click();
    await page.locator('#dlg[open]').waitFor();
    await page.click('#spTutup');
    assert.equal(await page.locator('#dlg[open]').count(), 0, 'dialog closes manually');
    await page.click('#logout');
    await page.locator('#login').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#dlg[open]').count(), 0, 'dialog closed by logout');

    // village drilldown: derived flags and IDs out of default view, toggled on demand
    await page.locator('#loginBtn').click();
    await page.locator('#app').waitFor({ state: 'visible' });
    await page.click('[data-t="ringkasan"]');
    try {
      await page.locator('#dview tr.click').first().waitFor({ timeout: 8000 });
    } catch (e) {
      console.error('DRILL-DEBUG:', JSON.stringify(await page.locator('#view').innerText()).slice(0, 500));
      throw e;
    }
    await page.locator('#dview tr.click').first().click();
    await page.locator('#dview tr.click').first().waitFor();
    await page.locator('#dview tr.click').first().click();
    await page.locator('#dview tr.click').first().waitFor();
    await page.locator('#dview tr.click').first().click();
    await page.locator('#dview table tbody tr').first().waitFor();
    const vths = await page.locator('#dview table thead th').allInnerTexts();
    for (const c of ['Kode Desa', 'NIK Koperasi', '(1) Lengkap', '(2) Mandek', '(4) Beroperasi', '(5) Progres']) assert.ok(!vths.includes(c), 'village simplified default hides ' + c);
    assert.ok((await page.locator('#dview table tbody tr').count()) >= 1);
    assert.ok(vths.includes('Desa/Kelurahan') && vths.includes('Status pembangunan'), 'village keeps business columns');
    assert.equal(await page.locator('#dview #vExtra').count(), 0, 'village toggle removed');
    await page.screenshot({ path: path.join(out, 'populasi-village-default.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });

    await context.close();    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, checks: ['fixed curated projection (no picker UI, no toggle)', 'key business columns visible', 'detail action + fail-closed identity', 'happy popup', 'logout dialog reset', 'village simplified default', 'zero console/page errors'], screenshots: ['populasi-sarpras-popup.png'] }, null, 2));
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); console.error('captured errors:', errors); process.exitCode = 1; });
