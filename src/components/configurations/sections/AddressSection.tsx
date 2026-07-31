import { useState, type ReactNode } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { CompanyFormState } from '../constants';
import { formatCepInput, lookupCep } from '../helpers';

type Props = {
  form: CompanyFormState;
  isManager: boolean;
  onChange: (patch: Partial<CompanyFormState>) => void;
};

const inputClass =
  'rounded-xl border-border bg-background h-10 shadow-none focus-visible:ring-emerald-700/30';

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <Label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </Label>
  );
}

export function AddressSection({ form, isManager, onChange }: Props) {
  const [lookingUp, setLookingUp] = useState(false);

  const handleCepLookup = async () => {
    if (!isManager) return;
    setLookingUp(true);
    try {
      const result = await lookupCep(form.addressZipCode);
      if (!result) {
        toast.error('CEP não encontrado. Preencha o endereço manualmente.');
        return;
      }
      onChange({
        address: result.logradouro || form.address,
        addressNeighborhood: result.bairro || form.addressNeighborhood,
        addressCity: result.localidade || form.addressCity,
        addressState: result.uf || form.addressState,
        addressZipCode: formatCepInput(form.addressZipCode),
      });
      toast.success('Endereço preenchido pelo CEP');
    } catch {
      toast.error('Falha ao buscar CEP. Tente novamente.');
    } finally {
      setLookingUp(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-white dark:bg-card p-4 sm:p-5 shadow-sm space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
            <MapPin className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">Endereço</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Usado no rodapé do site e nos documentos
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!isManager || lookingUp}
          onClick={() => void handleCepLookup()}
          className="shrink-0 text-emerald-800 hover:text-emerald-900 hover:bg-emerald-50 dark:text-emerald-300"
        >
          {lookingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Buscar pelo CEP
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="max-w-[11rem]">
          <FieldLabel>CEP</FieldLabel>
          <Input
            value={form.addressZipCode}
            disabled={!isManager}
            onChange={(e) => onChange({ addressZipCode: formatCepInput(e.target.value) })}
            className={inputClass}
            placeholder="00000-000"
          />
        </div>

        <div>
          <FieldLabel>Logradouro</FieldLabel>
          <Input
            value={form.address}
            disabled={!isManager}
            onChange={(e) => onChange({ address: e.target.value })}
            className={inputClass}
            placeholder="Rua, avenida, etc."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel>Número</FieldLabel>
            <Input
              value={form.addressNumber}
              disabled={!isManager}
              onChange={(e) => onChange({ addressNumber: e.target.value })}
              className={inputClass}
              placeholder="123"
            />
          </div>
          <div>
            <FieldLabel>Complemento</FieldLabel>
            <Input
              value={form.addressComplement}
              disabled={!isManager}
              onChange={(e) => onChange({ addressComplement: e.target.value })}
              className={inputClass}
              placeholder="Sala, andar..."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel>Bairro</FieldLabel>
            <Input
              value={form.addressNeighborhood}
              disabled={!isManager}
              onChange={(e) => onChange({ addressNeighborhood: e.target.value })}
              className={inputClass}
              placeholder="Bairro"
            />
          </div>
          <div>
            <FieldLabel>Cidade</FieldLabel>
            <Input
              value={form.addressCity}
              disabled={!isManager}
              onChange={(e) => onChange({ addressCity: e.target.value })}
              className={inputClass}
              placeholder="Cidade"
            />
          </div>
        </div>

        <div className="max-w-[7rem]">
          <FieldLabel>Estado</FieldLabel>
          <Input
            value={form.addressState}
            disabled={!isManager}
            maxLength={2}
            onChange={(e) => onChange({ addressState: e.target.value.toUpperCase() })}
            className={inputClass}
            placeholder="UF"
          />
        </div>
      </div>
    </div>
  );
}
