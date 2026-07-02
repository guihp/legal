/**
 * Importa imóveis do JSON extraído do site Erica Sousa → imoveisvivareal + Storage.
 *
 * Uso:
 *   IMPORT_EMAIL=gestor@email.com IMPORT_PASSWORD=senha node scripts/bulk-import-erica-imoveis.mjs
 *
 * Opções:
 *   --json=/caminho/imoveis.json   (default: ../Extrair_imagens/output/imoveis.json)
 *   --dry-run                      (só mapeia, não grava)
 *   --skip-images                  (só insert no banco, usa URLs externas)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const COMPANY_ID = 'f8e7fd92-f4d1-4e50-bd8e-5dbd29028a10';
const USER_ID = '926a137b-46a4-4bf6-962c-9efaec02af17';
const BUCKET = 'property-images';

const TIPO_MAP = {
  Apartamento: 'Apartment',
  Casa: 'Home',
  Lote: 'Land Lot',
  'Sala comercial': 'Loja',
};

const MODALIDADE_MAP = {
  Venda: 'For Sale',
  Reserva: 'For Sale',
  'Locação Anual': 'Rent',
};

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
    skipImages: false,
  };
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
    if (arg === '--skip-images') opts.skipImages = true;
    if (arg.startsWith('--json=')) opts.json = path.resolve(arg.slice(7));
  }
  return opts;
}

function parseArea(value) {
  if (!value) return null;
  const match = String(value).match(/([\d.,]+)/);
  if (!match) return null;
  const normalized = match[1].includes(',') && !match[1].includes('.')
    ? match[1].replace(/\./g, '').replace(',', '.')
    : match[1].replace(/,/g, '');
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

function parseIntField(value) {
  if (value == null || value === '') return null;
  const n = Number.parseInt(String(value).replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

function parsePrice(item) {
  if (item.preco != null && item.preco !== '') {
    const n = Number.parseFloat(String(item.preco));
    if (Number.isFinite(n)) return n;
  }
  const valor = item.detalhes?.Valor;
  if (!valor || /consulte/i.test(String(valor))) return null;
  const digits = String(valor).replace(/[^\d,]/g, '');
  if (!digits) return null;
  const normalized = digits.includes(',')
    ? digits.replace(/\./g, '').replace(',', '.')
    : digits;
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

function buildDescricao(item) {
  const titulo = (item.titulo || '').trim();
  const descricao = (item.descricao || '').trim();
  if (!titulo && !descricao) return null;
  if (!descricao || descricao === titulo) return titulo || descricao;
  if (descricao.startsWith(titulo)) return descricao;
  return `${titulo}\n${descricao}`;
}

function mapRecord(item) {
  const det = item.detalhes || {};
  const categoria = det.Categoria || '';
  const finalidade = det.Finalidade || item.categoria?.split('-').pop()?.trim() || 'Venda';

  return {
    listing_id: String(item.id || det['Código'] || ''),
    descricao: buildDescricao(item),
    tipo_categoria: categoria === 'Sala comercial' ? 'Commercial' : 'Residential',
    tipo_imovel: TIPO_MAP[categoria] || 'Apartment',
    modalidade: MODALIDADE_MAP[finalidade] || 'For Sale',
    preco: parsePrice(item),
    tamanho_m2: parseArea(det['Área privativa'] || det['Área total']),
    quartos: parseIntField(det['Quartos totais']),
    banheiros: parseIntField(det.Banheiros),
    suite: parseIntField(det['Sendo suíte']),
    garagem: parseIntField(det.Garagem),
    cidade: det.Cidade || null,
    bairro: det.Bairro || null,
    endereco: null,
    numero: null,
    complemento: null,
    cep: null,
    features: null,
    disponibilidade: 'disponivel',
    company_id: COMPANY_ID,
    user_id: USER_ID,
    imagens: null,
    imagens_legendas: null,
  };
}

function listLocalImages(baseDir, propertyId) {
  const dir = path.join(baseDir, 'imagens', String(propertyId));
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort((a, b) => {
      const na = Number.parseInt(a.match(/\d+/)?.[0] || '0', 10);
      const nb = Number.parseInt(b.match(/\d+/)?.[0] || '0', 10);
      return na - nb;
    });
}

async function uploadImages(supabase, imovelId, files, localDir) {
  const baseTs = Date.now();
  const urls = [];
  const captions = [];

  for (let i = 0; i < files.length; i++) {
    const fileName = files[i];
    const filePath = path.join(localDir, fileName);
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(fileName).toLowerCase();
    const contentType =
      ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    const storagePath = `imoveisvivareal/${imovelId}/${baseTs}_${i}${ext === '.png' ? '.png' : '.jpg'}`;

    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType,
      upsert: false,
    });
    if (error) throw new Error(`upload ${fileName}: ${error.message}`);

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    urls.push(pub.publicUrl);
    captions.push('');
  }

  return { urls, captions };
}

async function main() {
  loadEnvFile(path.join(ROOT, '.env'));
  const opts = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnon = process.env.VITE_SUPABASE_ANON_KEY;
  const email = process.env.IMPORT_EMAIL;
  const password = process.env.IMPORT_PASSWORD;

  if (!fs.existsSync(opts.json)) {
    console.error('JSON não encontrado:', opts.json);
    process.exit(1);
  }

  const items = JSON.parse(fs.readFileSync(opts.json, 'utf8'));
  const baseDir = path.dirname(opts.json);
  console.log(`📦 ${items.length} imóveis em ${opts.json}`);

  if (opts.dryRun) {
    items.slice(0, 3).forEach((item) => {
      const mapped = mapRecord(item);
      const imgs = listLocalImages(baseDir, item.id);
      console.log(JSON.stringify({ id: item.id, mapped, localImages: imgs.length }, null, 2));
    });
    console.log('✅ dry-run ok');
    return;
  }

  if (!supabaseUrl || !supabaseAnon) {
    console.error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env');
    process.exit(1);
  }
  if (!email || !password) {
    console.error('Defina IMPORT_EMAIL e IMPORT_PASSWORD para autenticar o gestor.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseAnon);
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) {
    console.error('Falha no login:', authError.message);
    process.exit(1);
  }
  console.log('🔐 Autenticado como', email);

  let ok = 0;
  let fail = 0;

  for (const item of items) {
    const listingId = String(item.id);
    process.stdout.write(`→ #${listingId} ${item.titulo?.slice(0, 40) || ''} ... `);

    try {
      const payload = mapRecord(item);
      const { data: created, error: insertError } = await supabase
        .from('imoveisvivareal')
        .insert([payload])
        .select('id')
        .single();

      if (insertError) throw new Error(insertError.message);

      let imagens = (item.imagens || []).slice(0, 50);
      let imagens_legendas = imagens.map(() => '');

      if (!opts.skipImages) {
        const files = listLocalImages(baseDir, item.id);
        if (files.length > 0) {
          const localDir = path.join(baseDir, 'imagens', String(item.id));
          const uploaded = await uploadImages(supabase, created.id, files.slice(0, 50), localDir);
          imagens = uploaded.urls;
          imagens_legendas = uploaded.captions;
        }
      }

      if (imagens.length > 0) {
        const { error: updateError } = await supabase
          .from('imoveisvivareal')
          .update({ imagens, imagens_legendas })
          .eq('id', created.id);
        if (updateError) throw new Error(updateError.message);
      }

      console.log(`OK (${imagens.length} fotos)`);
      ok++;
    } catch (err) {
      console.log('ERRO:', err.message);
      fail++;
    }
  }

  console.log(`\n✅ Concluído: ${ok} importados, ${fail} falhas`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
