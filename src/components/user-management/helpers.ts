export type UserRole = 'corretor' | 'gestor' | 'admin';

export type CompanyUser = {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  avatar_url?: string | null;
  chat_instance?: string | null;
  user_id?: string;
  profile_id?: string;
  auth_user_id?: string;
};

export function getRoleBadgeClass(role: string): string {
  switch (role) {
    case 'admin':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300';
    case 'gestor':
      return 'border-violet-500/30 bg-violet-500/10 text-violet-800 dark:text-violet-300';
    case 'corretor':
      return 'border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300';
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
}

export function translateRole(role: string): string {
  switch (role) {
    case 'admin':
      return 'Administrador';
    case 'gestor':
      return 'Gestor';
    case 'corretor':
      return 'Corretor';
    default:
      return role;
  }
}

export function getInitials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function countByRole(users: CompanyUser[], role: string): number {
  return users.filter((u) => u.role === role).length;
}

export function formatCreatedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function formatPhone(phone?: string | null): string {
  const raw = (phone || '').trim();
  return raw || '—';
}
