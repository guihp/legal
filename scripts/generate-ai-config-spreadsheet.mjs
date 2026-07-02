/**
 * Gera planilha Excel para clientes preencherem a Configuração para IA.
 * Uso: node scripts/generate-ai-config-spreadsheet.mjs
 */
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const logoPath = path.join(root, 'public/IMOBI-LOGO-(1).png');
const outputPath = path.join(root, '@docs/planilha-configuracao-ia-imobi.xlsx');

const BRAND = {
  blue: 'FF2563EB',
  blueLight: 'FFDBEAFE',
  blueDark: 'FF1E40AF',
  slate900: 'FF0F172A',
  slate700: 'FF334155',
  slate500: 'FF64748B',
  slate100: 'FFF1F5F9',
  slate50: 'FFF8FAFC',
  white: 'FFFFFFFF',
  emerald: 'FF059669',
};

const FIELDS = [
  {
    section: 'Identidade e mensagens',
    label: 'Mensagem inicial',
    help: 'Primeira mensagem que a assistente envia no WhatsApp. Escreva o texto final, com o nome da sua empresa.',
    placeholder: 'Ex.: Olá! Sou a assistente da [Nome da Imobiliária]. Como posso ajudar você hoje?',
    rows: 4,
  },
  {
    label: 'Nome da IA',
    help: 'Nome usado para se apresentar (ex.: "Oi, sou a Marina…"). Humaniza o atendimento.',
    placeholder: 'Ex.: Marina, Assistente IMOBI...',
    rows: 1,
  },
  {
    label: 'Quando não tiver a resposta no cadastro',
    help: 'Texto quando o cliente pergunta algo que a IA não sabe (valor não consultado, detalhes do imóvel, etc.). Evita inventar informações.',
    placeholder:
      'Ex.: Ótima pergunta. No momento esse detalhe não está disponível no meu cadastro com segurança. Se você quiser, eu registro agora e um corretor da nossa equipe te retorna com a informação exata.',
    rows: 3,
  },
  {
    label: 'Missão da empresa',
    help: 'Frase ou parágrafo curto sobre o propósito da empresa. Alinha o discurso da assistente.',
    placeholder: 'Ex.: Construir histórias, não apenas casas.',
    rows: 2,
  },
  {
    label: 'Tom da IA',
    help: 'Como a assistente deve falar: formal ou informal, uso de emoji, breve ou detalhada.',
    placeholder:
      'Ex.: Comunicação consultiva, humana e objetiva. Linguagem simples, sem termos técnicos em excesso. Sempre educada e proativa.',
    rows: 4,
  },
  {
    label: 'Métodos de pagamento',
    help: 'O que a assistente pode citar: PIX, boleto, cartão, financiamento, FGTS, consórcio, permuta, etc.',
    placeholder: 'Ex.: PIX, boleto, cartão em até 12x, financiamento bancário, FGTS...',
    rows: 3,
  },
  {
    label: 'Política de visita',
    help: 'Como funcionam as visitas: agendamento, dias/horários, acompanhamento, documentos na portaria.',
    placeholder:
      'Ex.: Visitas somente com agendamento mínimo de 24h. Atendimento presencial de segunda a sexta, das 9h às 18h.',
    rows: 4,
  },
  {
    label: 'Público-alvo',
    help: 'Quem vocês mais atendem (primeira casa, investidor, alto padrão, famílias…).',
    placeholder:
      'Ex.: Famílias de classe média que buscam primeiro imóvel com financiamento; investidores que procuram apartamentos compactos para locação.',
    rows: 3,
  },
  {
    label: 'Regras da IA',
    help: 'Limites que a IA deve seguir: não prometer disponibilidade, não fechar desconto no chat, não inventar dados.',
    placeholder:
      'Ex.: Nunca inventar valor, metragem ou condição comercial. Sempre confirmar disponibilidade antes de prometer visita.',
    rows: 4,
  },
  {
    label: 'Informações adicionais',
    help: 'Diferenciais da empresa, regiões foco, políticas internas e observações para o time comercial.',
    placeholder:
      'Ex.: Diferenciais: aprovação de crédito com parceiros bancários, acompanhamento documental até a assinatura.',
    rows: 4,
  },
];

const DAYS = [
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

function styleHeaderRow(row, fill = BRAND.blue) {
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    cell.font = { bold: true, color: { argb: BRAND.white }, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder();
  });
  row.height = 28;
}

function thinBorder(color = 'FFE2E8F0') {
  return {
    top: { style: 'thin', color: { argb: color } },
    left: { style: 'thin', color: { argb: color } },
    bottom: { style: 'thin', color: { argb: color } },
    right: { style: 'thin', color: { argb: color } },
  };
}

function addSheetHeader(sheet, title, subtitle) {
  sheet.mergeCells('A1:F1');
  sheet.getCell('A1').value = title;
  sheet.getCell('A1').font = { bold: true, size: 18, color: { argb: BRAND.slate900 } };
  sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };

  sheet.mergeCells('A2:F2');
  sheet.getCell('A2').value = subtitle;
  sheet.getCell('A2').font = { size: 11, color: { argb: BRAND.slate500 } };
  sheet.getCell('A2').alignment = { wrapText: true, vertical: 'top' };

  sheet.getRow(1).height = 32;
  sheet.getRow(2).height = 36;
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'IAFÉ IMOBI';
  workbook.created = new Date();

  // ── Aba 1: Capa + Identidade ─────────────────────────────────────────────
  const ws1 = workbook.addWorksheet('Configuração IA', {
    views: [{ showGridLines: false }],
    properties: { defaultRowHeight: 20 },
  });

  ws1.columns = [
    { width: 22 },
    { width: 38 },
    { width: 52 },
  ];

  if (fs.existsSync(logoPath)) {
    const imageId = workbook.addImage({
      filename: logoPath,
      extension: 'png',
    });
    ws1.addImage(imageId, {
      tl: { col: 0, row: 0 },
      ext: { width: 220, height: 56 },
    });
  }

  ws1.mergeCells('A1:C1');
  ws1.getRow(1).height = 48;

  ws1.mergeCells('A3:C3');
  ws1.getCell('A3').value = 'Formulário de Configuração para IA';
  ws1.getCell('A3').font = { bold: true, size: 20, color: { argb: BRAND.blueDark } };

  ws1.mergeCells('A4:C4');
  ws1.getCell('A4').value =
    'Preencha os campos abaixo com as informações da sua imobiliária. Nossa equipe usará este documento para configurar a assistente virtual no IAFÉ IMOBI.';
  ws1.getCell('A4').font = { size: 11, color: { argb: BRAND.slate700 } };
  ws1.getCell('A4').alignment = { wrapText: true, vertical: 'top' };
  ws1.getRow(4).height = 40;

  // Dados do cliente
  let row = 6;
  ws1.mergeCells(`A${row}:C${row}`);
  ws1.getCell(`A${row}`).value = 'Dados da imobiliária';
  ws1.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.slate900 } };
  ws1.getCell(`A${row}`).font = { bold: true, color: { argb: BRAND.white }, size: 12 };
  ws1.getCell(`A${row}`).alignment = { vertical: 'middle', indent: 1 };
  ws1.getRow(row).height = 26;
  row++;

  const clientFields = [
    ['Nome da imobiliária', ''],
    ['Responsável pelo preenchimento', ''],
    ['E-mail de contato', ''],
    ['WhatsApp', ''],
    ['Data do preenchimento', ''],
  ];

  for (const [label, hint] of clientFields) {
    ws1.getCell(`A${row}`).value = label;
    ws1.getCell(`A${row}`).font = { bold: true, color: { argb: BRAND.slate700 } };
    ws1.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.slate50 } };
    ws1.getCell(`A${row}`).border = thinBorder();
    ws1.mergeCells(`B${row}:C${row}`);
    ws1.getCell(`B${row}`).value = hint;
    ws1.getCell(`B${row}`).border = thinBorder();
    ws1.getCell(`B${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.white } };
    ws1.getRow(row).height = 24;
    row++;
  }

  row += 1;

  // Campos de IA
  ws1.mergeCells(`A${row}:C${row}`);
  ws1.getCell(`A${row}`).value = 'Identidade e mensagens da assistente';
  ws1.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.blue } };
  ws1.getCell(`A${row}`).font = { bold: true, color: { argb: BRAND.white }, size: 12 };
  ws1.getCell(`A${row}`).alignment = { vertical: 'middle', indent: 1 };
  ws1.getRow(row).height = 26;
  row++;

  const headerRow = ws1.getRow(row);
  headerRow.values = ['Campo', 'Instrução / Ajuda', 'Sua resposta'];
  styleHeaderRow(headerRow);
  row++;

  for (const field of FIELDS) {
    ws1.getCell(`A${row}`).value = field.label;
    ws1.getCell(`A${row}`).font = { bold: true, color: { argb: BRAND.slate900 } };
    ws1.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.blueLight } };
    ws1.getCell(`A${row}`).alignment = { vertical: 'top', wrapText: true };
    ws1.getCell(`A${row}`).border = thinBorder();

    ws1.getCell(`B${row}`).value = `${field.help}\n\nExemplo: ${field.placeholder}`;
    ws1.getCell(`B${row}`).font = { size: 10, color: { argb: BRAND.slate500 }, italic: true };
    ws1.getCell(`B${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.slate50 } };
    ws1.getCell(`B${row}`).alignment = { vertical: 'top', wrapText: true };
    ws1.getCell(`B${row}`).border = thinBorder();

    ws1.getCell(`C${row}`).value = '';
    ws1.getCell(`C${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.white } };
    ws1.getCell(`C${row}`).alignment = { vertical: 'top', wrapText: true };
    ws1.getCell(`C${row}`).border = thinBorder('FF2563EB');

    ws1.getRow(row).height = Math.max(60, (field.rows || 3) * 18);
    row++;
  }

  row += 1;
  ws1.mergeCells(`A${row}:C${row}`);
  ws1.getCell(`A${row}`).value =
    '💡 Dica: Quanto mais completo e específico for o preenchimento, melhor a assistente representará sua imobiliária. Valores exatos e negociações finais continuam com o corretor.';
  ws1.getCell(`A${row}`).font = { size: 10, color: { argb: BRAND.emerald } };
  ws1.getCell(`A${row}`).alignment = { wrapText: true };
  ws1.getRow(row).height = 36;

  // Footer
  row += 2;
  ws1.mergeCells(`A${row}:C${row}`);
  ws1.getCell(`A${row}`).value = 'IAFÉ TECNOLOGIA LTDA — comercial@iafeoficial.com — iafeoficial.com';
  ws1.getCell(`A${row}`).font = { size: 9, color: { argb: BRAND.slate500 } };
  ws1.getCell(`A${row}`).alignment = { horizontal: 'center' };

  // ── Aba 2: Horários ──────────────────────────────────────────────────────
  const ws2 = workbook.addWorksheet('Horário de funcionamento', {
    views: [{ showGridLines: false }],
  });

  ws2.columns = [
    { width: 18 },
    { width: 14 },
    { width: 14 },
    { width: 18 },
    { width: 18 },
    { width: 14 },
  ];

  if (fs.existsSync(logoPath)) {
    const imageId2 = workbook.addImage({
      filename: logoPath,
      extension: 'png',
    });
    ws2.addImage(imageId2, {
      tl: { col: 0, row: 0 },
      ext: { width: 180, height: 46 },
    });
  }

  addSheetHeader(
    ws2,
    'Horário de funcionamento detalhado',
    'Marque se a loja fecha em cada dia e, nos dias abertos, preencha os horários. A assistente usará essas informações para falar de disponibilidade e visitas.'
  );

  const hRow = 5;
  const hdr = ws2.getRow(hRow);
  hdr.values = ['Dia', 'Fechado?', 'Abre às', 'Fecha p/ almoço', 'Reabre após almoço', 'Fecha às'];
  styleHeaderRow(hdr);

  let dRow = hRow + 1;
  for (const day of DAYS) {
    ws2.getCell(`A${dRow}`).value = day.label;
    ws2.getCell(`A${dRow}`).font = { bold: true };
    ws2.getCell(`A${dRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.slate50 } };
    ['B', 'C', 'D', 'E', 'F'].forEach((col) => {
      const cell = ws2.getCell(`${col}${dRow}`);
      cell.border = thinBorder();
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (col === 'B') {
        cell.value = day.key === 'sunday' ? 'Sim' : 'Não';
        cell.font = { color: { argb: BRAND.slate500 }, italic: true, size: 10 };
      }
    });
    ws2.getRow(dRow).height = 24;
    dRow++;
  }

  dRow += 1;
  ws2.mergeCells(`A${dRow}:F${dRow}`);
  ws2.getCell(`A${dRow}`).value =
    'Formato sugerido: HH:MM (ex.: 08:00, 12:00, 13:00, 18:00). Deixe em branco os campos de almoço se não houver intervalo.';
  ws2.getCell(`A${dRow}`).font = { size: 10, color: { argb: BRAND.slate500 }, italic: true };
  ws2.getCell(`A${dRow}`).alignment = { wrapText: true };

  // ── Aba 3: Agendamento ─────────────────────────────────────────────────────
  const ws3 = workbook.addWorksheet('Agendamento de visitas', {
    views: [{ showGridLines: false }],
  });

  ws3.columns = [
    { width: 28 },
    { width: 50 },
    { width: 16 },
  ];

  if (fs.existsSync(logoPath)) {
    const imageId3 = workbook.addImage({
      filename: logoPath,
      extension: 'png',
    });
    ws3.addImage(imageId3, {
      tl: { col: 0, row: 0 },
      ext: { width: 180, height: 46 },
    });
  }

  addSheetHeader(
    ws3,
    'Agendamento de visitas (IA)',
    'Define como a assistente escolhe o corretor ao marcar uma visita. Marque (X) a opção desejada.'
  );

  let vRow = 5;
  ws3.mergeCells(`A${vRow}:C${vRow}`);
  ws3.getCell(`A${vRow}`).value = 'Como escolher o corretor da visita';
  ws3.getCell(`A${vRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.blue } };
  ws3.getCell(`A${vRow}`).font = { bold: true, color: { argb: BRAND.white }, size: 12 };
  ws3.getCell(`A${vRow}`).alignment = { indent: 1, vertical: 'middle' };
  ws3.getRow(vRow).height = 26;
  vRow++;

  const modes = [
    ['( ) Fila rotativa', 'Entre os corretores de plantão, a assistente distribui as visitas em rodízio — um de cada vez, na sequência.'],
    ['( ) Por prioridade', 'Entre quem está de plantão e com horário livre, escolhe conforme a prioridade definida abaixo.'],
    ['( ) Você escolhe o corretor', 'A assistente marca data e horário; depois você ou um gestor define qual corretor fará a visita.'],
  ];

  for (const [label, desc] of modes) {
    ws3.getCell(`A${vRow}`).value = label;
    ws3.getCell(`A${vRow}`).font = { bold: true, color: { argb: BRAND.slate900 } };
    ws3.getCell(`A${vRow}`).border = thinBorder();
    ws3.mergeCells(`B${vRow}:C${vRow}`);
    ws3.getCell(`B${vRow}`).value = desc;
    ws3.getCell(`B${vRow}`).font = { size: 10, color: { argb: BRAND.slate700 } };
    ws3.getCell(`B${vRow}`).alignment = { wrapText: true, vertical: 'top' };
    ws3.getCell(`B${vRow}`).border = thinBorder();
    ws3.getRow(vRow).height = 36;
    vRow++;
  }

  vRow += 1;
  ws3.mergeCells(`A${vRow}:C${vRow}`);
  ws3.getCell(`A${vRow}`).value = 'Regra de prioridade (se escolheu "Por prioridade")';
  ws3.getCell(`A${vRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.slate900 } };
  ws3.getCell(`A${vRow}`).font = { bold: true, color: { argb: BRAND.white }, size: 11 };
  ws3.getRow(vRow).height = 24;
  vRow++;

  const criteria = [
    ['( ) Prioridade por corretor (recomendado)', 'Defina Alta, Média ou Baixa para cada corretor. Quem está como Alta recebe primeiro.'],
    ['( ) Ordem na escala do Plantão', 'Usa a ordem dos corretores na escala do Plantão.'],
    ['( ) Menos visitas no mesmo dia', 'Prioriza quem tiver menos visitas marcadas naquele dia.'],
  ];

  for (const [label, desc] of criteria) {
    ws3.getCell(`A${vRow}`).value = label;
    ws3.getCell(`A${vRow}`).font = { bold: true };
    ws3.getCell(`A${vRow}`).border = thinBorder();
    ws3.mergeCells(`B${vRow}:C${vRow}`);
    ws3.getCell(`B${vRow}`).value = desc;
    ws3.getCell(`B${vRow}`).font = { size: 10, color: { argb: BRAND.slate500 }, italic: true };
    ws3.getCell(`B${vRow}`).alignment = { wrapText: true };
    ws3.getCell(`B${vRow}`).border = thinBorder();
    ws3.getRow(vRow).height = 32;
    vRow++;
  }

  vRow += 1;
  ws3.mergeCells(`A${vRow}:C${vRow}`);
  ws3.getCell(`A${vRow}`).value = 'Prioridade por corretor (Alta / Média / Baixa)';
  ws3.getCell(`A${vRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.blueLight } };
  ws3.getCell(`A${vRow}`).font = { bold: true, color: { argb: BRAND.blueDark } };
  ws3.getRow(vRow).height = 24;
  vRow++;

  const brokerHdr = ws3.getRow(vRow);
  brokerHdr.values = ['Nome do corretor', 'Função (Corretor/Gestor)', 'Prioridade (Alta/Média/Baixa)'];
  styleHeaderRow(brokerHdr, BRAND.blueDark);
  vRow++;

  for (let i = 0; i < 8; i++) {
    ['A', 'B', 'C'].forEach((col) => {
      ws3.getCell(`${col}${vRow}`).border = thinBorder('FF2563EB');
      ws3.getCell(`${col}${vRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.white } };
    });
    ws3.getRow(vRow).height = 24;
    vRow++;
  }

  await workbook.xlsx.writeFile(outputPath);
  console.log(`✅ Planilha gerada: ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
