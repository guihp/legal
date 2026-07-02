/**
 * Reenvia fotos dos imóveis Erica Sousa usando a MAIOR versão disponível:
 * - URLs completas do site (N.jpg, nunca _380)
 * - Re-scrape da galeria ao vivo (caso tenha fotos novas)
 * - Compara remoto vs arquivo local e usa o maior
 *
 * Uso:
 *   IMPORT_EMAIL=... IMPORT_PASSWORD=... node scripts/reupload-erica-images-hq.mjs
 *
 * Opções:
 *   --json=/caminho/imoveis.json
 *   --listing-id=2          (só um imóvel)
 *   --limit=5                 (primeiros N do JSON)
 *   --dry-run
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const COMPANY_ID = 'f8e7fd92-f4d1-4e50-bd8e-5dbd29028a10';
const BUCKET = 'property-images';
const SITE = 'https://ericasousaimoveis.com.br';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

function parseArgs(argv) {
  const opts = {
    json: path.resolve(ROOT, '../Extrair_imagens/output/imoveis.json'),
    dryRun: false,
    listingId: null,
    limit: null,
  };
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
    if (arg.startsWith('--json=')) opts.json = path.resolve(arg.slice(7));
    if (arg.startsWith('--listing-id=')) opts.listingId = arg.slice(13);
    if (arg.startsWith('--limit=')) opts.limit = Number.parseInt(arg.slice(8), 10);
  }
  return opts;
}

function isFullSizeUrl(url) {
  return /\/\d+\.jpg(?:\?|$)/i.test(url) && !/_\d+\.jpg/i.test(url);
}

function normalizeRemoteUrls(urls, propertyId) {
  const nums = new Set();
  for (const raw of urls) {
    if (!raw || !isFullSizeUrl(raw)) continue;
    const m = raw.match(new RegExp(`/produtos/${propertyId}/(\\d+)\\.jpg`, 'i'));
    if (m) nums.add(Number.parseInt(m[1], 10));
  }
  return [...nums]
    .sort((a, b) => a - b)
    .map((n) => `${SITE}/images/produtos/${propertyId}/${n}.jpg`);
}

function extractLiveImageUrls(propertyId, html) {
  const pattern = new RegExp(`images/produtos/${propertyId}/(\\d+)\\.jpg`, 'gi');
  const nums = new Set();
  for (const m of html.matchAll(pattern)) {
    if (m[0].includes('_')) continue;
    nums.add(Number.parseInt(m[1], 10));
  }
  return [...nums]
    .sort((a, b) => a - b)
    .map((n) => `${SITE}/images/produtos/${propertyId}/${n}.jpg`);
}

async function fetchLiveImageUrls(propertyId) {
  const res = await fetch(`${SITE}/imovel/${propertyId}`, {
    headers: {
      'User-Agent': UA,
      'Accept-Encoding': 'identity',
      Accept: 'text/html',
    },
  });
  if (!res.ok) throw new Error(`página ${propertyId}: HTTP ${res.status}`);
  const html = await res.text();
  return extractLiveImageUrls(propertyId, html);
}

async function fetchBuffer(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Encoding': 'identity' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024) throw new Error('arquivo muito pequeno');
  return buf;
}

function localPathForIndex(baseDir, propertyId, index) {
  const dir = path.join(baseDir, 'imagens', String(propertyId));
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort((a, b) => {
      const na = Number.parseInt(a.match(/\d+/)?.[0] || '0', 10);
      const nb = Number.parseInt(b.match(/\d+/)?.[0] || '0', 10);
      return na - nb;
    });
  const file = files[index];
  return file ? path.join(dir, file) : null;
}

async function resolveBestBuffer(url, localFilePath) {
  let remote = null;
  let local = null;

  try {
    remote = await fetchBuffer(url);
  } catch {
    /* ignore */
  }

  if (localFilePath && fs.existsSync(localFilePath)) {
    local = fs.readFileSync(localFilePath);
  }

  if (remote && local) {
    return remote.length >= local.length
      ? { buffer: remote, source: 'remote' }
      : { buffer: local, source: 'local' };
  }
  if (remote) return { buffer: remote, source: 'remote' };
  if (local) return { buffer: local, source: 'local' };
  throw new Error(`sem imagem para ${url}`);
}

function extFromBuffer(buffer, url) {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return '.png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return '.jpg';
  const fromUrl = path.extname(new URL(url).pathname).toLowerCase();
  return fromUrl || '.jpg';
}

async function uploadImagesHq(supabase, imovelId, imageUrls, baseDir, propertyId) {
  const baseTs = Date.now();
  const urls = [];
  const captions = [];
  let remoteCount = 0;
  let localCount = 0;

  for (let i = 0; i < Math.min(imageUrls.length, 50); i++) {
    const url = imageUrls[i];
    const localFilePath = localPathForIndex(baseDir, propertyId, i);
    const { buffer, source } = await resolveBestBuffer(url, localFilePath);
    if (source === 'remote') remoteCount++;
    else localCount++;

    const ext = extFromBuffer(buffer, url);
    const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';
    const storagePath = `imoveisvivareal/${imovelId}/${baseTs}_${i}${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType,
      upsert: false,
    });
    if (error) throw new Error(`upload #${i + 1}: ${error.message}`);

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    urls.push(pub.publicUrl);
    captions.push('');
  }

  return { urls, captions, remoteCount, localCount };
}

async function main() {
  loadEnvFile(path.join(ROOT, '.env'));
  const opts = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(opts.json)) {
    console.error('JSON não encontrado:', opts.json);
    process.exit(1);
  }

  let items = JSON.parse(fs.readFileSync(opts.json, 'utf8'));
  if (opts.listingId) items = items.filter((x) => String(x.id) === String(opts.listingId));
  if (opts.limit) items = items.slice(0, opts.limit);

  const baseDir = path.dirname(opts.json);
  console.log(`🖼️  Reupload HQ: ${items.length} imóvel(is)`);

  if (opts.dryRun) {
    const item = items[0];
    const jsonUrls = normalizeRemoteUrls(item.imagens || [], item.id);
    const liveUrls = await fetchLiveImageUrls(item.id);
    const merged = normalizeRemoteUrls([...jsonUrls, ...liveUrls], item.id);
    console.log(JSON.stringify({ id: item.id, json: jsonUrls.length, live: liveUrls.length, merged: merged.length, sample: merged.slice(0, 3) }, null, 2));
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnon = process.env.VITE_SUPABASE_ANON_KEY;
  const email = process.env.IMPORT_EMAIL;
  const password = process.env.IMPORT_PASSWORD;

  if (!supabaseUrl || !supabaseAnon || !email || !password) {
    console.error('Configure .env + IMPORT_EMAIL + IMPORT_PASSWORD');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseAnon);
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) {
    console.error('Falha no login:', authError.message);
    process.exit(1);
  }

  let ok = 0;
  let fail = 0;

  for (const item of items) {
    const listingId = String(item.id);
    process.stdout.write(`→ #${listingId} ... `);

    try {
      const { data: row, error: findError } = await supabase
        .from('imoveisvivareal')
        .select('id, imagens')
        .eq('company_id', COMPANY_ID)
        .eq('listing_id', listingId)
        .maybeSingle();

      if (findError) throw new Error(findError.message);
      if (!row) throw new Error('imóvel não encontrado no Supabase');

      let liveUrls = [];
      try {
        liveUrls = await fetchLiveImageUrls(listingId);
      } catch (err) {
        console.warn(`[live ${listingId}] ${err.message}`);
      }

      const imageUrls = normalizeRemoteUrls(
        [...(item.imagens || []), ...liveUrls],
        listingId,
      );

      if (imageUrls.length === 0) throw new Error('nenhuma URL full-size encontrada');

      const uploaded = await uploadImagesHq(supabase, row.id, imageUrls, baseDir, listingId);

      const { error: updateError } = await supabase
        .from('imoveisvivareal')
        .update({ imagens: uploaded.urls, imagens_legendas: uploaded.captions })
        .eq('id', row.id);

      if (updateError) throw new Error(updateError.message);

      console.log(
        `OK ${uploaded.urls.length} fotos (remoto:${uploaded.remoteCount} local:${uploaded.localCount})`,
      );
      ok++;
    } catch (err) {
      console.log(`ERRO: ${err.message}`);
      fail++;
    }
  }

  console.log(`\n✅ HQ reupload: ${ok} ok, ${fail} falhas`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
