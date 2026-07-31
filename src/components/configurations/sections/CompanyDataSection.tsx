import { useRef, type ReactNode } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { formatBrazilianMobileInput } from '@/lib/normalizePhone';
import type { CompanyFormState } from '../constants';

type Props = {
  form: CompanyFormState;
  isManager: boolean;
  logoUrl?: string | null;
  logoUpdating?: boolean;
  onChange: (patch: Partial<CompanyFormState>) => void;
  onUploadLogo: (file: File) => void;
};

function FieldLabel({
  children,
  badge,
}: {
  children: ReactNode;
  badge?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 mb-1.5">
      <Label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {children}
      </Label>
      {badge ? (
        <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {badge}
        </span>
      ) : null}
    </div>
  );
}

const inputClass =
  'rounded-xl border-border bg-background h-10 shadow-none focus-visible:ring-emerald-700/30';

export function CompanyDataSection({
  form,
  isManager,
  logoUrl,
  logoUpdating,
  onChange,
  onUploadLogo,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-2xl border border-border/70 bg-white dark:bg-card p-4 sm:p-5 shadow-sm space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Dados da empresa</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Aparecem em contratos, propostas e no site vitrine
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-border/70 bg-muted/30 p-3 sm:p-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-card flex items-center justify-center">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo da empresa" className="h-full w-full object-contain" />
          ) : (
            <span className="text-xs text-muted-foreground">logo</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Logotipo da imobiliária</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            PNG ou SVG com fundo transparente · mín. 320×320 px
          </p>
        </div>
        <div className="shrink-0">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUploadLogo(file);
              e.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!isManager || logoUpdating}
            onClick={() => fileRef.current?.click()}
            className="rounded-xl h-9"
          >
            {logoUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Trocar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <FieldLabel>Nome da empresa</FieldLabel>
          <Input
            value={form.companyName}
            disabled={!isManager}
            onChange={(e) => onChange({ companyName: e.target.value })}
            className={inputClass}
            placeholder="Nome da imobiliária"
          />
        </div>
        <div>
          <FieldLabel>Responsável</FieldLabel>
          <Input
            value={form.contactName}
            disabled={!isManager}
            onChange={(e) => onChange({ contactName: e.target.value })}
            className={inputClass}
            placeholder="Nome do responsável"
          />
        </div>
        <div>
          <FieldLabel>E-mail</FieldLabel>
          <Input
            type="email"
            value={form.email}
            disabled={!isManager}
            onChange={(e) => onChange({ email: e.target.value })}
            className={inputClass}
            placeholder="contato@empresa.com"
          />
        </div>
        <div>
          <FieldLabel badge="obrigatório">CNPJ</FieldLabel>
          <Input
            value={form.cnpj}
            disabled={!isManager}
            onChange={(e) => onChange({ cnpj: e.target.value })}
            className={inputClass}
            placeholder="00.000.000/0000-00"
          />
        </div>
        <div>
          <FieldLabel>Telefone / WhatsApp</FieldLabel>
          <Input
            type="tel"
            inputMode="numeric"
            value={form.phone}
            disabled={!isManager}
            onChange={(e) => onChange({ phone: formatBrazilianMobileInput(e.target.value) })}
            className={inputClass}
            placeholder="(00) 9 0000-0000"
          />
        </div>
        <div>
          <FieldLabel>CRECI</FieldLabel>
          <Input
            value={form.creci}
            disabled={!isManager}
            onChange={(e) => onChange({ creci: e.target.value })}
            className={inputClass}
            placeholder="CRECI/UF 0.000-J"
          />
        </div>
      </div>

      {!isManager ? (
        <p className="text-xs text-muted-foreground italic">
          Apenas administradores e gestores podem editar os dados da empresa.
        </p>
      ) : null}
    </div>
  );
}
