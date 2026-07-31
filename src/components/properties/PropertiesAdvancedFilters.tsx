import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import type { ImoveisFilters } from '@/hooks/useImoveisVivaReal';

type Props = {
  filters: ImoveisFilters;
  setFilters: Dispatch<SetStateAction<ImoveisFilters>>;
  setPage: (page: number) => void;
  citySuggestions: string[];
  neighborhoodSuggestions: string[];
  addressSuggestions: string[];
  onCityChange: (value: string) => void;
  onNeighborhoodChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onClearCitySuggestions: () => void;
  onClearNeighborhoodSuggestions: () => void;
  onClearAddressSuggestions: () => void;
  onClear: () => void;
  onApply: () => void;
};

const fieldClass =
  'w-full h-10 rounded-xl bg-background border-border text-foreground placeholder:text-muted-foreground';

export function PropertiesAdvancedFilters({
  filters,
  setFilters,
  setPage,
  citySuggestions,
  neighborhoodSuggestions,
  addressSuggestions,
  onCityChange,
  onNeighborhoodChange,
  onAddressChange,
  onClearCitySuggestions,
  onClearNeighborhoodSuggestions,
  onClearAddressSuggestions,
  onClear,
  onApply,
}: Props) {
  const toggleCategoria = (value: string, checked: boolean) => {
    setPage(1);
    setFilters((prev) => {
      const current = new Set(prev.tipoCategoria || []);
      if (checked) current.add(value);
      else current.delete(value);
      const arr = Array.from(current);
      return { ...prev, tipoCategoria: arr.length ? arr : undefined };
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      <Input
        placeholder="ID do imóvel"
        className={fieldClass}
        defaultValue={filters.listingId || ''}
        onBlur={(e) => {
          setPage(1);
          setFilters((prev) => ({ ...prev, listingId: e.target.value || undefined }));
        }}
      />

      <div className={cnBox}>
        <div className="text-xs text-muted-foreground mb-2">Categoria</div>
        <div className="flex gap-4 items-center">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={!!filters.tipoCategoria?.includes('Residential')}
              onCheckedChange={(checked) => toggleCategoria('Residential', !!checked)}
            />
            Residencial
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={!!filters.tipoCategoria?.includes('Commercial')}
              onCheckedChange={(checked) => toggleCategoria('Commercial', !!checked)}
            />
            Comercial
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          placeholder="Preço mín."
          className={fieldClass}
          onBlur={(e) =>
            setFilters((p) => ({
              ...p,
              preco: { ...(p.preco || {}), min: e.target.value ? Number(e.target.value) : undefined },
            }))
          }
        />
        <Input
          type="number"
          placeholder="Preço máx."
          className={fieldClass}
          onBlur={(e) =>
            setFilters((p) => ({
              ...p,
              preco: { ...(p.preco || {}), max: e.target.value ? Number(e.target.value) : undefined },
            }))
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          placeholder="Área mín. (m²)"
          className={fieldClass}
          onBlur={(e) =>
            setFilters((p) => ({
              ...p,
              tamanho: {
                ...(p.tamanho || {}),
                min: e.target.value ? Number(e.target.value) : undefined,
              },
            }))
          }
        />
        <Input
          type="number"
          placeholder="Área máx. (m²)"
          className={fieldClass}
          onBlur={(e) =>
            setFilters((p) => ({
              ...p,
              tamanho: {
                ...(p.tamanho || {}),
                max: e.target.value ? Number(e.target.value) : undefined,
              },
            }))
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          placeholder="Quartos mín."
          className={fieldClass}
          onBlur={(e) =>
            setFilters((p) => ({
              ...p,
              quartos: {
                ...(p.quartos || {}),
                min: e.target.value ? Number(e.target.value) : undefined,
              },
            }))
          }
        />
        <Input
          type="number"
          placeholder="Quartos máx."
          className={fieldClass}
          onBlur={(e) =>
            setFilters((p) => ({
              ...p,
              quartos: {
                ...(p.quartos || {}),
                max: e.target.value ? Number(e.target.value) : undefined,
              },
            }))
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          placeholder="Suítes mín."
          className={fieldClass}
          onBlur={(e) =>
            setFilters((p) => ({
              ...p,
              suite: { ...(p.suite || {}), min: e.target.value ? Number(e.target.value) : undefined },
            }))
          }
        />
        <Input
          type="number"
          placeholder="Garagens mín."
          className={fieldClass}
          onBlur={(e) =>
            setFilters((p) => ({
              ...p,
              garagem: {
                ...(p.garagem || {}),
                min: e.target.value ? Number(e.target.value) : undefined,
              },
            }))
          }
        />
      </div>

      <div className="relative">
        <Input
          placeholder="Cidade"
          className={fieldClass}
          defaultValue={filters.cidade || ''}
          onChange={(e) => onCityChange(e.target.value)}
        />
        {citySuggestions.length > 0 ? (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover max-h-56 overflow-auto shadow-xl">
            {citySuggestions.map((c) => (
              <button
                key={c}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60"
                onMouseDown={() => {
                  setFilters((prev) => ({ ...prev, cidade: c }));
                  onClearCitySuggestions();
                }}
              >
                {c}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="relative">
        <Input
          placeholder="Bairro"
          disabled={!filters.cidade}
          className={cnDisabled(fieldClass, !filters.cidade)}
          defaultValue={filters.bairro || ''}
          onChange={(e) => onNeighborhoodChange(e.target.value)}
        />
        {neighborhoodSuggestions.length > 0 ? (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover max-h-56 overflow-auto shadow-xl">
            {neighborhoodSuggestions.map((b) => (
              <button
                key={b}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60"
                onMouseDown={() => {
                  setFilters((prev) => ({ ...prev, bairro: b }));
                  onClearNeighborhoodSuggestions();
                }}
              >
                {b}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="relative">
        <Input
          placeholder="Endereço"
          className={fieldClass}
          defaultValue={filters.endereco || ''}
          onChange={(e) => onAddressChange(e.target.value)}
        />
        {addressSuggestions.length > 0 ? (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover max-h-56 overflow-auto shadow-xl">
            {addressSuggestions.map((a) => (
              <button
                key={a}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60"
                onMouseDown={() => {
                  setFilters((prev) => ({ ...prev, endereco: a }));
                  onClearAddressSuggestions();
                }}
              >
                {a}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <Input
        placeholder="CEP"
        className={fieldClass}
        defaultValue={filters.cep || ''}
        onBlur={(e) => {
          setPage(1);
          setFilters((prev) => ({ ...prev, cep: e.target.value || undefined }));
        }}
      />

      <div className="md:col-span-2 xl:col-span-3 flex items-center justify-end gap-2">
        <Button variant="ghost" className="rounded-xl" onClick={onClear}>
          Limpar
        </Button>
        <Button
          className="btn-on-emerald rounded-xl bg-emerald-800 text-white hover:bg-emerald-700"
          style={{ color: '#ffffff' }}
          onClick={onApply}
        >
          Aplicar filtros
        </Button>
      </div>
    </div>
  );
}

const cnBox =
  'w-full rounded-xl border border-border bg-background p-2.5 text-foreground';

function cnDisabled(base: string, disabled: boolean) {
  return disabled ? `${base} opacity-50 cursor-not-allowed` : base;
}
