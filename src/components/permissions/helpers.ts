import type { RolePermission } from '@/hooks/usePermissions';
import { CRITICAL_PERMISSIONS } from '@/lib/permissions/rules';
import {
  PERMISSION_DISPLAY,
  SECTION_DEFS,
  type ColumnRole,
  type PermissionFilterId,
  type PermissionSectionId,
} from './constants';

export type MatrixRow = {
  permissionKey: string;
  title: string;
  description: string;
  sensitive: boolean;
  escrita: boolean;
  byRole: Partial<Record<ColumnRole, RolePermission>>;
};

export type MatrixSection = {
  id: PermissionSectionId;
  label: string;
  Icon: (typeof SECTION_DEFS)[number]['Icon'];
  iconTone: (typeof SECTION_DEFS)[number]['iconTone'];
  rows: MatrixRow[];
  enabledCount: number;
  totalCount: number;
};

export type RoleUserBucket = {
  role: 'admin' | 'gestor' | 'corretor';
  label: string;
  names: string[];
  count: number;
  tone: 'amber' | 'blue' | 'green';
};

export type RoleKpiCard = {
  role: 'admin' | 'gestor' | 'corretor';
  label: string;
  userCount: number;
  percent: number;
  footer: string;
  tone: 'amber' | 'blue' | 'green';
};

export type SoftChangeItem = {
  id: string;
  text: string;
  when: string;
  tone: 'red' | 'green' | 'amber';
};

export function displayFor(
  permissionKey: string,
  fallbackName?: string,
  fallbackDescription?: string,
) {
  const meta = PERMISSION_DISPLAY[permissionKey];
  const escrita =
    Boolean(meta?.escrita) ||
    permissionKey.endsWith('_write') ||
    permissionKey.includes('_write');
  return {
    title: meta?.title || fallbackName || permissionKey,
    description: meta?.description || fallbackDescription || '',
    sensitive: Boolean(meta?.sensitive),
    escrita,
  };
}

/** Group role_permissions into mockup matrix rows (one row per permission_key). */
export function buildMatrix(permissions: RolePermission[]): MatrixSection[] {
  const byKey = new Map<string, Partial<Record<ColumnRole, RolePermission>>>();

  for (const perm of permissions) {
    if (perm.role !== 'gestor' && perm.role !== 'corretor') continue;
    const slot = byKey.get(perm.permission_key) || {};
    slot[perm.role] = perm;
    byKey.set(perm.permission_key, slot);
  }

  const used = new Set<string>();
  const sections: MatrixSection[] = [];

  for (const def of SECTION_DEFS) {
    const rows: MatrixRow[] = [];
    for (const key of def.keys) {
      const byRole = byKey.get(key);
      if (!byRole || Object.keys(byRole).length === 0) continue;
      used.add(key);
      const sample = byRole.gestor || byRole.corretor!;
      const d = displayFor(key, sample.permission_name, sample.description);
      rows.push({
        permissionKey: key,
        title: d.title,
        description: d.description,
        sensitive: d.sensitive,
        escrita: d.escrita,
        byRole,
      });
    }
    if (rows.length === 0) continue;
    const totalCount = rows.length;
    const enabledCount = rows.filter((r) => r.byRole.gestor?.is_enabled).length;
    sections.push({
      id: def.id,
      label: def.label,
      Icon: def.Icon,
      iconTone: def.iconTone,
      rows,
      enabledCount,
      totalCount,
    });
  }

  // Any leftover keys (future permissions) → append under Leads e CRM
  const leftovers: MatrixRow[] = [];
  for (const [key, byRole] of byKey) {
    if (used.has(key)) continue;
    const sample = byRole.gestor || byRole.corretor!;
    const d = displayFor(key, sample.permission_name, sample.description);
    leftovers.push({
      permissionKey: key,
      title: d.title,
      description: d.description,
      sensitive: d.sensitive,
      escrita: d.escrita,
      byRole,
    });
  }
  if (leftovers.length > 0) {
    const existing = sections.find((s) => s.id === 'leads');
    if (existing) {
      existing.rows.push(...leftovers);
      existing.totalCount = existing.rows.length;
      existing.enabledCount = existing.rows.filter((r) => r.byRole.gestor?.is_enabled).length;
    } else {
      const def = SECTION_DEFS.find((s) => s.id === 'leads')!;
      sections.splice(1, 0, {
        id: 'leads',
        label: def.label,
        Icon: def.Icon,
        iconTone: def.iconTone,
        rows: leftovers,
        enabledCount: leftovers.filter((r) => r.byRole.gestor?.is_enabled).length,
        totalCount: leftovers.length,
      });
    }
  }

  return sections;
}

export function filterMatrix(
  sections: MatrixSection[],
  filter: PermissionFilterId,
  search: string,
): MatrixSection[] {
  const q = search.trim().toLowerCase();
  return sections
    .filter((s) => filter === 'all' || s.id === filter)
    .map((s) => {
      if (!q) return s;
      const rows = s.rows.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.permissionKey.toLowerCase().includes(q),
      );
      return {
        ...s,
        rows,
        totalCount: rows.length,
        enabledCount: rows.filter((r) => r.byRole.gestor?.is_enabled).length,
      };
    })
    .filter((s) => s.rows.length > 0);
}

export function sectionCounts(sections: MatrixSection[]): Record<PermissionFilterId, number> {
  const counts: Record<PermissionFilterId, number> = {
    all: 0,
    imoveis: 0,
    leads: 0,
    menus: 0,
    admin: 0,
  };
  for (const s of sections) {
    counts[s.id] = s.rows.length;
    counts.all += s.rows.length;
  }
  return counts;
}

export function canToggleRole(
  currentUserRole: string | undefined,
  targetRole: ColumnRole,
  managedRoles: string[],
  permissionKey: string,
): boolean {
  if (!managedRoles.includes(targetRole)) return false;
  if (
    currentUserRole === 'gestor' &&
    targetRole === 'gestor' &&
    CRITICAL_PERMISSIONS.includes(permissionKey as (typeof CRITICAL_PERMISSIONS)[number])
  ) {
    return false;
  }
  return true;
}

/** Per-role bulk hint for a section: all on → desmarcar; else marcar. */
export function bulkActionForRole(
  rows: MatrixRow[],
  role: ColumnRole,
): { enable: boolean; label: string } {
  const applicable = rows.filter((r) => r.byRole[role]);
  const allOn =
    applicable.length > 0 && applicable.every((r) => r.byRole[role]?.is_enabled);
  return allOn
    ? { enable: false, label: 'desmarcar todos' }
    : { enable: true, label: 'marcar todos' };
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const day = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}

export function bucketUsersByRole(
  users: Array<{ fullName: string; role: string; isActive?: boolean }>,
): RoleUserBucket[] {
  const active = users.filter((u) => u.isActive !== false);
  const defs: Array<Omit<RoleUserBucket, 'names' | 'count'> & { role: RoleUserBucket['role'] }> = [
    { role: 'admin', label: 'Administrador', tone: 'amber' },
    { role: 'gestor', label: 'Gestor', tone: 'blue' },
    { role: 'corretor', label: 'Corretor', tone: 'green' },
  ];
  return defs.map((d) => {
    const names = active
      .filter((u) => u.role === d.role)
      .map((u) => (u.fullName || '').split(' ')[0] || u.fullName)
      .filter(Boolean);
    return { ...d, names, count: names.length };
  });
}

export function buildRoleKpis(
  permissions: RolePermission[],
  buckets: RoleUserBucket[],
): RoleKpiCard[] {
  const keys = new Set(
    permissions
      .filter((p) => p.role === 'gestor' || p.role === 'corretor')
      .map((p) => p.permission_key),
  );
  const total = keys.size || 1;

  const countEnabled = (role: 'gestor' | 'corretor') => {
    let n = 0;
    for (const key of keys) {
      const p = permissions.find((x) => x.role === role && x.permission_key === key);
      if (p?.is_enabled) n += 1;
    }
    return n;
  };

  const gestorOn = countEnabled('gestor');
  const corretorOn = countEnabled('corretor');
  const adminBucket = buckets.find((b) => b.role === 'admin');
  const gestorBucket = buckets.find((b) => b.role === 'gestor');
  const corretorBucket = buckets.find((b) => b.role === 'corretor');

  return [
    {
      role: 'admin',
      label: 'Administrador',
      userCount: adminBucket?.count ?? 0,
      percent: 100,
      footer: 'acesso irrestrito, não editável',
      tone: 'amber',
    },
    {
      role: 'gestor',
      label: 'Gestor',
      userCount: gestorBucket?.count ?? 0,
      percent: Math.round((gestorOn / total) * 100),
      footer: `${gestorOn} de ${total} permissões ativas`,
      tone: 'blue',
    },
    {
      role: 'corretor',
      label: 'Corretor',
      userCount: corretorBucket?.count ?? 0,
      percent: Math.round((corretorOn / total) * 100),
      footer: `${corretorOn} de ${total} permissões ativas`,
      tone: 'green',
    },
  ];
}

/** Soft activity from recent permission updates when audit feed is thin. */
export function softPermissionChanges(permissions: RolePermission[]): SoftChangeItem[] {
  const recent = [...permissions]
    .filter((p) => p.role === 'gestor' || p.role === 'corretor')
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 8);

  const items: SoftChangeItem[] = [];
  const seen = new Set<string>();

  for (const p of recent) {
    const key = `${p.permission_key}:${p.role}:${p.is_enabled}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const d = displayFor(p.permission_key, p.permission_name);
    const roleLabel = p.role === 'gestor' ? 'Gestores' : 'Corretores';
    if (p.is_enabled) {
      items.push({
        id: p.id,
        text: `${roleLabel.replace(/s$/, '')} recebeu permissão de ${d.title}`,
        when: formatWhen(p.updated_at),
        tone: 'green',
      });
    } else {
      items.push({
        id: p.id,
        text: `${roleLabel} perderam acesso a ${d.title}`,
        when: formatWhen(p.updated_at),
        tone: 'red',
      });
    }
    if (items.length >= 3) break;
  }

  if (items.length === 0) {
    return [
      {
        id: 'soft-default',
        text: 'Permissões restauradas ao padrão pelo administrador.',
        when: '—',
        tone: 'amber',
      },
    ];
  }

  if (items.length < 3) {
    items.push({
      id: 'soft-restore',
      text: 'Permissões restauradas ao padrão pelo administrador.',
      when: '—',
      tone: 'amber',
    });
  }

  return items.slice(0, 3);
}

export function countDisplayedRows(sections: MatrixSection[]): number {
  return sections.reduce((n, s) => n + s.rows.length, 0);
}

export function moduleCount(sections: MatrixSection[]): number {
  return sections.length;
}
