import {
  LS_EXPORT_COUNTS,
  LS_EXPORT_HISTORY,
  LS_SCHEDULED,
  DEFAULT_SCHEDULES,
  type ReportId,
} from './constants';
import type { ExportHistoryItem, ScheduledSend } from './helpers';
import { monthKey } from './helpers';

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadExportHistory(companyId: string): ExportHistoryItem[] {
  const all = safeParse<Record<string, ExportHistoryItem[]>>(
    localStorage.getItem(LS_EXPORT_HISTORY),
    {},
  );
  return Array.isArray(all[companyId]) ? all[companyId] : [];
}

export function saveExportHistory(companyId: string, items: ExportHistoryItem[]) {
  const all = safeParse<Record<string, ExportHistoryItem[]>>(
    localStorage.getItem(LS_EXPORT_HISTORY),
    {},
  );
  all[companyId] = items.slice(0, 40);
  localStorage.setItem(LS_EXPORT_HISTORY, JSON.stringify(all));
}

export function clearExportHistory(companyId: string) {
  saveExportHistory(companyId, []);
}

export function pushExportHistory(
  companyId: string,
  item: Omit<ExportHistoryItem, 'id'> & { id?: string },
): ExportHistoryItem[] {
  const next: ExportHistoryItem = {
    id: item.id || `exp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    reportId: item.reportId,
    filename: item.filename,
    generatedAt: item.generatedAt,
    by: item.by,
    sizeLabel: item.sizeLabel,
  };
  const list = [next, ...loadExportHistory(companyId)];
  saveExportHistory(companyId, list);
  bumpExportCount(companyId, item.reportId);
  return list;
}

type CountsStore = Record<string, Record<string, number>>;

function loadCounts(): CountsStore {
  return safeParse<CountsStore>(localStorage.getItem(LS_EXPORT_COUNTS), {});
}

export function bumpExportCount(companyId: string, _reportId: ReportId) {
  const store = loadCounts();
  const key = `${companyId}:${monthKey()}`;
  store[key] = store[key] || {};
  store[key].total = (store[key].total || 0) + 1;
  localStorage.setItem(LS_EXPORT_COUNTS, JSON.stringify(store));
}

export function getExportCountForMonth(companyId: string, mk: string): number {
  const store = loadCounts();
  return store[`${companyId}:${mk}`]?.total || 0;
}

export function loadScheduled(companyId: string): ScheduledSend[] {
  const all = safeParse<Record<string, ScheduledSend[]>>(
    localStorage.getItem(LS_SCHEDULED),
    {},
  );
  if (Array.isArray(all[companyId]) && all[companyId].length > 0) return all[companyId];
  return DEFAULT_SCHEDULES.map((s) => ({ ...s }));
}

export function saveScheduled(companyId: string, items: ScheduledSend[]) {
  const all = safeParse<Record<string, ScheduledSend[]>>(
    localStorage.getItem(LS_SCHEDULED),
    {},
  );
  all[companyId] = items;
  localStorage.setItem(LS_SCHEDULED, JSON.stringify(all));
}

export function toggleScheduled(companyId: string, id: string, enabled: boolean): ScheduledSend[] {
  const list = loadScheduled(companyId).map((s) =>
    s.id === id ? { ...s, enabled } : s,
  );
  saveScheduled(companyId, list);
  return list;
}
