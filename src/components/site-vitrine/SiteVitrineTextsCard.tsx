import { GripVertical, List } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type Props = {
  aboutKicker: string;
  aboutTitle: string;
  aboutParagraph: string;
  aboutBullet1: string;
  aboutBullet2: string;
  aboutBullet3: string;
  contactKicker: string;
  contactTitle: string;
  contactIntro: string;
  onChange: (patch: Record<string, string>) => void;
};

export function SiteVitrineTextsCard({
  aboutKicker,
  aboutTitle,
  aboutParagraph,
  aboutBullet1,
  aboutBullet2,
  aboutBullet3,
  contactKicker,
  contactTitle,
  contactIntro,
  onChange,
}: Props) {
  const bullets = [
    { key: 'about_bullet1', value: aboutBullet1, n: 1 },
    { key: 'about_bullet2', value: aboutBullet2, n: 2 },
    { key: 'about_bullet3', value: aboutBullet3, n: 3 },
  ] as const;

  return (
    <section
      id="sv-textos"
      className="scroll-mt-24 rounded-2xl border border-border/70 bg-card p-5 sm:p-6 shadow-sm space-y-5"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
          <List className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Textos da página pública</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Seções #sobre e #contato</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Selo da coluna sobre
          </label>
          <Input
            value={aboutKicker}
            onChange={(e) => onChange({ about_kicker: e.target.value })}
            className="rounded-xl border-border bg-background h-11"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Título sobre
          </label>
          <Input
            value={aboutTitle}
            onChange={(e) => onChange({ about_title: e.target.value })}
            placeholder="Ex.: Jastelo Empreendimentos"
            className="rounded-xl border-border bg-background h-11"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Parágrafo sobre
        </label>
        <Textarea
          value={aboutParagraph}
          onChange={(e) => onChange({ about_paragraph: e.target.value })}
          rows={4}
          className="rounded-xl border-border bg-background min-h-[96px] resize-y"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Destaques
        </label>
        <div className="space-y-2">
          {bullets.map(({ key, value, n }) => (
            <div
              key={key}
              className="flex items-center gap-2.5 rounded-xl border border-border/70 bg-background px-3 py-2.5"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                {n}
              </span>
              <Input
                value={value}
                onChange={(e) => onChange({ [key]: e.target.value })}
                className="border-0 shadow-none h-9 px-1 focus-visible:ring-0 bg-transparent"
              />
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
        <div className="space-y-2">
          <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Selo contato
          </label>
          <Input
            value={contactKicker}
            onChange={(e) => onChange({ contact_kicker: e.target.value })}
            className="rounded-xl border-border bg-background h-11"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Título contato
          </label>
          <Input
            value={contactTitle}
            onChange={(e) => onChange({ contact_title: e.target.value })}
            className="rounded-xl border-border bg-background h-11"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Intro contato
        </label>
        <Textarea
          value={contactIntro}
          onChange={(e) => onChange({ contact_intro: e.target.value })}
          rows={2}
          className="rounded-xl border-border bg-background min-h-[72px] resize-y"
        />
      </div>
    </section>
  );
}
