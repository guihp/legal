import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PublicFooterCompany = {
  /** Nome oficial (cadastro empresa) */
  legalName: string;
  /** Nome de exibição / marca no site */
  displayName: string;
  logoUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  cnpj?: string | null;
  vitrineSlug?: string | null;
};

type Props = {
  company: PublicFooterCompany;
  accentColor: string;
  variant?: 'dark' | 'light';
  className?: string;
};

function formatCnpj(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length !== 14) return raw;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export function PublicImobiliariaFooter({ company, accentColor, variant = 'dark', className }: Props) {
  const year = new Date().getFullYear();
  const isDark = variant === 'dark';

  return (
    <footer
      className={cn(
        'border-t',
        isDark ? 'border-white/10 bg-[#070605] text-stone-400' : 'border-stone-200 bg-white text-stone-600',
        className
      )}
    >
      <div className="mx-auto max-w-7xl px-4 py-14 md:px-8 md:py-16">
        <div className="grid gap-12 md:grid-cols-12 md:gap-10">
          <div className="md:col-span-5">
            <div className="flex items-start gap-4">
              {company.logoUrl ? (
                <img
                  src={company.logoUrl}
                  alt=""
                  className="h-12 w-auto max-w-[160px] object-contain md:h-14"
                />
              ) : (
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-[#070605] shadow-inner"
                  style={{ backgroundColor: accentColor }}
                >
                  {company.displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <p
                  className={cn(
                    'font-serif text-xl font-semibold tracking-tight md:text-2xl',
                    isDark ? 'text-stone-100' : 'text-stone-900'
                  )}
                >
                  {company.displayName}
                </p>
                {company.legalName !== company.displayName && (
                  <p className="mt-1 text-xs text-stone-500">{company.legalName}</p>
                )}
              </div>
            </div>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-stone-500">
              Informações para divulgação. Valores, condições e disponibilidade sujeitos a confirmação com a
              equipe.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 md:col-span-7 md:grid-cols-2">
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">Contato</p>
              <ul className="space-y-3 text-sm">
                {company.phone && (
                  <li className="flex gap-3">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 opacity-70" style={{ color: accentColor }} />
                    <a
                      href={`tel:${company.phone.replace(/\D/g, '')}`}
                      className={cn('transition hover:underline', isDark ? 'text-stone-300' : 'text-stone-800')}
                    >
                      {company.phone}
                    </a>
                  </li>
                )}
                {company.email && (
                  <li className="flex gap-3">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 opacity-70" style={{ color: accentColor }} />
                    <a
                      href={`mailto:${company.email}`}
                      className={cn('break-all transition hover:underline', isDark ? 'text-stone-300' : 'text-stone-800')}
                    >
                      {company.email}
                    </a>
                  </li>
                )}
                {company.address && (
                  <li className="flex gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 opacity-70" style={{ color: accentColor }} />
                    <span className="leading-relaxed">{company.address}</span>
                  </li>
                )}
                {!company.phone && !company.email && !company.address && (
                  <li className="text-stone-500">Dados de contato disponíveis pelo WhatsApp nesta página.</li>
                )}
              </ul>
            </div>

            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">Institucional</p>
              <ul className="space-y-3 text-sm">
                {company.vitrineSlug && (
                  <li>
                    <Link
                      to={`/s/${company.vitrineSlug}`}
                      className={cn(
                        'inline-flex items-center gap-2 font-medium transition hover:underline',
                        isDark ? 'text-stone-200' : 'text-stone-900'
                      )}
                      style={{ color: isDark ? undefined : accentColor }}
                    >
                      <Building2 className="h-4 w-4 opacity-80" />
                      Ver todos os imóveis
                    </Link>
                  </li>
                )}
                {company.cnpj && (
                  <li className="text-xs text-stone-500">
                    CNPJ {formatCnpj(company.cnpj)}
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>

        <div
          className={cn(
            'mt-12 flex flex-col gap-3 border-t pt-8 text-xs md:flex-row md:items-center md:justify-between',
            isDark ? 'border-white/10 text-stone-600' : 'border-stone-200 text-stone-500'
          )}
        >
          <p>
            © {year} {company.displayName}. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
