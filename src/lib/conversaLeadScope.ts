/** Mesma regra do CRM: corretor só vê conversas de leads com id_corretor_responsavel = ele. */
export function filterConversasByLeadAssignment<
  T extends { sessionId: string; leadId?: string | null },
>(
  items: T[],
  role: string | undefined,
  leadRows: Array<{ id: string }> | null | undefined,
): T[] {
  if (role !== 'corretor') return items;
  const allowed = new Set((leadRows || []).map((lr) => String(lr.id)));
  return items.filter((item) => {
    const key = item.leadId ? String(item.leadId) : String(item.sessionId);
    return allowed.has(key);
  });
}
