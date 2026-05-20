/** Mesma regra do CRM: corretor só vê conversas de leads com id_corretor_responsavel = ele. */
export function filterConversasByLeadAssignment<T extends { sessionId: string }>(
  items: T[],
  role: string | undefined,
  leadRows: Array<{ id: string }> | null | undefined,
): T[] {
  if (role !== 'corretor') return items;
  const allowed = new Set((leadRows || []).map((lr) => String(lr.id)));
  return items.filter((item) => allowed.has(item.sessionId));
}
