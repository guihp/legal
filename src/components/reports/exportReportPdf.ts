import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DashboardBundle } from '@/components/dashboard/fetchDashboardData';
import { formatMoneyMil } from '@/components/dashboard/helpers';
import { REPORT_DEFS, type ReportId } from './constants';
import type { ReportsExtras } from './helpers';
import { estimatePdfSizeKb } from './helpers';

export type ExportResult = {
  filename: string;
  sizeLabel: string;
  pages: number;
};

type ExportCtx = {
  reportId: ReportId;
  bundle: DashboardBundle;
  extras: ReportsExtras;
  companyName?: string | null;
  userName?: string | null;
};

type JsPdfDoc = {
  setFontSize: (n: number) => void;
  setTextColor: (a: number, b?: number, c?: number) => void;
  text: (t: string, x: number, y: number, opts?: { maxWidth?: number }) => void;
  save: (name: string) => void;
  getNumberOfPages: () => number;
  autoTable?: (opts: Record<string, unknown>) => void;
  lastAutoTable?: { finalY: number };
};

async function loadPdf(): Promise<new (opts?: object) => JsPdfDoc> {
  const jsPDF = (await import('jspdf')).default;
  await import('jspdf-autotable');
  return jsPDF as unknown as new (opts?: object) => JsPdfDoc;
}

function header(doc: JsPdfDoc, title: string, ctx: ExportCtx) {
  const range = `${format(ctx.bundle.range.from, 'dd/MM/yyyy')} – ${format(ctx.bundle.range.to, 'dd/MM/yyyy')}`;
  doc.setFontSize(16);
  doc.text(title, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(ctx.companyName || 'Imobiliária', 14, 26);
  doc.text(`Período: ${range}`, 14, 32);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, 38);
  if (ctx.userName) doc.text(`Por: ${ctx.userName}`, 14, 44);
  doc.setTextColor(0);
  return 52;
}

function saveDoc(doc: JsPdfDoc, reportId: ReportId): ExportResult {
  const def = REPORT_DEFS.find((d) => d.id === reportId)!;
  const date = format(new Date(), 'yyyy-MM-dd');
  const filename = `${def.fileSlug}_${date}.pdf`;
  const pages = Math.max(1, doc.getNumberOfPages());
  doc.save(filename);
  return {
    filename,
    pages,
    sizeLabel: estimatePdfSizeKb(pages, 40),
  };
}

function addSummary(doc: JsPdfDoc, startY: number, rows: Array<[string, string]>) {
  let y = startY;
  doc.setFontSize(12);
  doc.text('Resumo', 14, y);
  y += 8;
  doc.setFontSize(10);
  rows.forEach(([k, v]) => {
    doc.text(`${k}: ${v}`, 14, y);
    y += 6;
  });
  return y + 4;
}

function table(
  doc: JsPdfDoc,
  startY: number,
  head: string[],
  body: string[][],
  fontSize = 9,
) {
  doc.autoTable?.({
    startY,
    head: [head],
    body,
    styles: { fontSize },
  });
  return (doc.lastAutoTable?.finalY || startY) + 10;
}

export async function exportReportPdf(ctx: ExportCtx): Promise<ExportResult> {
  const JsPDF = await loadPdf();
  const doc = new JsPDF();
  const def = REPORT_DEFS.find((d) => d.id === ctx.reportId);
  if (!def) throw new Error('Relatório desconhecido');

  const y0 = header(doc, def.title, ctx);
  const { bundle, extras } = ctx;

  switch (ctx.reportId) {
    case 'portfolio': {
      const avail = bundle.portfolio.slices.find((s) => s.key === 'disp')?.count ?? 0;
      let y = addSummary(doc, y0, [
        ['Total de imóveis', String(bundle.portfolio.total)],
        ['Disponíveis', String(avail)],
        ['VGV do estoque', extras.portfolioVgv > 0 ? formatMoneyMil(extras.portfolioVgv) : '—'],
      ]);
      doc.setFontSize(12);
      doc.text('Situação do portfólio', 14, y);
      y += 6;
      y = table(
        doc,
        y,
        ['Situação', 'Qtd', '%'],
        bundle.portfolio.slices.map((s) => [s.label, String(s.count), `${s.pct}%`]),
      );
      doc.setFontSize(12);
      doc.text('Tipos', 14, y);
      y += 6;
      table(
        doc,
        y,
        ['Tipo', 'Qtd'],
        bundle.portfolio.types.map((t) => [t.label, String(t.count)]),
      );
      break;
    }
    case 'funnel': {
      const y = addSummary(doc, y0, [
        ['Leads no período', String(bundle.kpis.leads)],
        ['Conversão', `${bundle.funnel.conversionTotalPct}%`],
        ['Ciclo médio (dias)', bundle.funnel.cycleDays != null ? String(bundle.funnel.cycleDays) : '—'],
        ['Sem corretor', String(bundle.funnel.unassigned)],
      ]);
      table(
        doc,
        y,
        ['Etapa', 'Leads', 'Conv. etapa'],
        bundle.funnel.stages.map((s) => [
          s.label,
          String(s.count),
          s.conversionPct != null ? `${s.conversionPct}%` : '—',
        ]),
      );
      break;
    }
    case 'brokers': {
      const y = addSummary(doc, y0, [
        ['Corretores', String(bundle.brokers.length)],
        ['Visitas', String(bundle.brokers.reduce((a, b) => a + b.visitas, 0))],
        ['Vendas', String(bundle.brokers.reduce((a, b) => a + b.fechamentos, 0))],
      ]);
      table(
        doc,
        y,
        ['Corretor', 'Leads', 'Visitas', 'Vendas', 'Conv.%', 'VGV'],
        bundle.brokers.map((b) => [
          b.name,
          String(b.leads),
          String(b.visitas),
          String(b.fechamentos),
          String(b.conversionPct),
          b.vgvLabel,
        ]),
        8,
      );
      break;
    }
    case 'market': {
      const y = addSummary(doc, y0, [
        ['Leads', String(bundle.kpis.leads)],
        ['Canais ativos', String(bundle.channels.rows.length)],
        ['Top canal', bundle.channels.rows[0]?.label || '—'],
      ]);
      table(
        doc,
        y,
        ['Canal', 'Leads', '%', 'Δ vs ant.'],
        bundle.channels.rows.map((r) => [
          r.label,
          String(r.count),
          `${r.pct}%`,
          r.deltaPct != null ? `${r.deltaPct}%` : '—',
        ]),
      );
      break;
    }
    case 'digital': {
      addSummary(doc, y0, [
        ['Visitas ao site', String(extras.digital.visits)],
        ['Landing pages', String(extras.digital.lps)],
        ['Leads digitais', String(extras.digital.leads)],
        ['Página mais vista', extras.digital.topPath || '—'],
      ]);
      break;
    }
    case 'attendance': {
      addSummary(doc, y0, [
        ['Conversas', String(extras.attendance.conversas)],
        [
          'Participação IA (aprox.)',
          extras.attendance.aiPct != null ? `${extras.attendance.aiPct}%` : '—',
        ],
        ['Tempo de resposta', extras.attendance.responseSoft],
      ]);
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(
        'Nota: % IA aproximado por mensagens type=IA ou origem WhatsApp/IA dos leads; tempo de resposta sem campo no schema.',
        14,
        80,
        { maxWidth: 180 },
      );
      doc.setTextColor(0);
      break;
    }
    case 'agenda': {
      addSummary(doc, y0, [
        ['Eventos / visitas', String(extras.agenda.events)],
        ['Confirmados', String(extras.agenda.confirmed)],
        ['Cobertura plantão (h/semana)', String(Math.round(extras.agenda.coverageHours))],
      ]);
      if (bundle.appointments.length > 0) {
        table(
          doc,
          78,
          ['Quando', 'Título', 'Status'],
          bundle.appointments.slice(0, 30).map((a) => [
            `${a.dayLabel} ${a.timeLabel}`,
            a.title,
            a.statusLabel,
          ]),
          8,
        );
      }
      break;
    }
    case 'audit': {
      addSummary(doc, y0, [
        ['Eventos de auditoria', String(extras.audit.events)],
        ['Usuários envolvidos', String(extras.audit.users)],
        ['Alertas sensíveis', String(extras.audit.alerts)],
      ]);
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(
        'Detalhamento linha a linha disponível no módulo de permissões / audit_logs.',
        14,
        78,
        { maxWidth: 180 },
      );
      doc.setTextColor(0);
      break;
    }
    default:
      addSummary(doc, y0, [['Status', 'Exportação básica']]);
  }

  return saveDoc(doc, ctx.reportId);
}
