import { useEffect, useMemo, useState } from 'react';
import { UserCheck, Loader2, RefreshCw, CalendarClock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePendingVisitAssignments } from '@/hooks/usePendingVisitAssignments';
import { useCompanyUsers } from '@/hooks/useCompanyUsers';
import { useUserProfile } from '@/hooks/useUserProfile';
import { assignVisitBroker } from '@/services/assignVisitBroker';
import { toast } from 'sonner';

function displayLeadName(name: string | null, instagram: string | null): string {
  if (name?.trim()) return name.trim();
  if (instagram?.trim()) return instagram.trim();
  return 'Cliente sem nome';
}

function extractVisitHint(notes: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/Visita agendada para (.+?)(?:\.| no imóvel)/i);
  return match?.[1]?.trim() || null;
}

export function PendingVisitBrokerAssignments() {
  const { profile, isManager } = useUserProfile();
  const { items, loading, error, refresh } = usePendingVisitAssignments();
  const { users, loading: loadingUsers, loadUsers } = useCompanyUsers();
  const [selectedBrokerByLead, setSelectedBrokerByLead] = useState<Record<string, string>>({});
  const [assigningLeadId, setAssigningLeadId] = useState<string | null>(null);

  const brokers = useMemo(
    () =>
      users.filter((u) => u.isActive && (u.role === 'corretor' || u.role === 'gestor')),
    [users]
  );

  useEffect(() => {
    if (isManager) void loadUsers(undefined, ['corretor', 'gestor'], false);
  }, [isManager, loadUsers]);

  if (!isManager) return null;

  const handleAssign = async (leadId: string) => {
    const brokerId = selectedBrokerByLead[leadId];
    if (!brokerId || !profile?.company_id) {
      toast.error('Selecione um corretor');
      return;
    }

    setAssigningLeadId(leadId);
    try {
      const result = await assignVisitBroker({
        companyId: profile.company_id,
        leadId,
        brokerId,
      });
      if (!result.success) {
        toast.error(result.error || 'Erro ao atribuir corretor');
        return;
      }
      toast.success(
        result.brokerName
          ? `Visita atribuída a ${result.brokerName}`
          : 'Corretor atribuído com sucesso'
      );
      setSelectedBrokerByLead((prev) => {
        const next = { ...prev };
        delete next[leadId];
        return next;
      });
      await refresh();
    } finally {
      setAssigningLeadId(null);
    }
  };

  if (!loading && items.length === 0) return null;

  return (
    <Card className="bg-card border-border shadow-sm dark:bg-gray-800/50 dark:border-gray-700">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <UserCheck className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <CardTitle className="text-foreground">Visitas aguardando corretor</CardTitle>
              <CardDescription className="text-muted-foreground mt-1">
                Visitas marcadas pela assistente no modo manual. Escolha quem fará cada visita.
              </CardDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={loading}
            className="shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando visitas...
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((lead) => {
              const visitHint = extractVisitHint(lead.notes);
              const updatedLabel = lead.updatedAt
                ? new Date(lead.updatedAt).toLocaleString('pt-BR', {
                    timeZone: 'America/Sao_Paulo',
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })
                : null;

              return (
                <li
                  key={lead.id}
                  className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 dark:border-gray-700 dark:bg-gray-900/40"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {displayLeadName(lead.name, lead.nomeInstagram)}
                    </p>
                    {visitHint && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                        <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                        {visitHint}
                      </p>
                    )}
                    {updatedLabel && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Atualizado em {updatedLabel}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <Label className="text-xs text-muted-foreground">Corretor da visita</Label>
                      <Select
                        value={selectedBrokerByLead[lead.id] || ''}
                        onValueChange={(v) =>
                          setSelectedBrokerByLead((prev) => ({ ...prev, [lead.id]: v }))
                        }
                        disabled={assigningLeadId === lead.id || loadingUsers}
                      >
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue placeholder="Selecione o corretor" />
                        </SelectTrigger>
                        <SelectContent>
                          {brokers.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      className="bg-blue-600 hover:bg-blue-700 shrink-0"
                      disabled={!selectedBrokerByLead[lead.id] || assigningLeadId === lead.id}
                      onClick={() => void handleAssign(lead.id)}
                    >
                      {assigningLeadId === lead.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Atribuindo...
                        </>
                      ) : (
                        'Confirmar corretor'
                      )}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
