import type { ReactNode } from 'react';

type IPhone17ProMaxFrameProps = {
  children: ReactNode;
  className?: string;
};

/** Moldura iPhone 17 Pro Max — titânio escuro, Dynamic Island, botões laterais. */
export function IPhone17ProMaxFrame({ children, className = '' }: IPhone17ProMaxFrameProps) {
  return (
    <div className={`relative mx-auto w-full ${className}`}>
      {/* Glow ambiente */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[8%] h-[70%] w-[85%] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[80px]"
      />

      <div className="relative mx-auto w-full max-w-[430px] sm:max-w-[500px] md:max-w-[540px] lg:max-w-[580px] xl:max-w-[620px]">
        {/* Botão Action (lateral esquerda) */}
        <div
          aria-hidden
          className="absolute -left-[2px] top-[22%] z-10 h-7 w-[3px] rounded-l-sm bg-gradient-to-b from-zinc-500 via-zinc-300 to-zinc-600 shadow-sm"
        />
        {/* Volume + */}
        <div
          aria-hidden
          className="absolute -left-[2px] top-[30%] z-10 h-11 w-[3px] rounded-l-sm bg-gradient-to-b from-zinc-500 via-zinc-300 to-zinc-600 shadow-sm"
        />
        {/* Volume - */}
        <div
          aria-hidden
          className="absolute -left-[2px] top-[38%] z-10 h-11 w-[3px] rounded-l-sm bg-gradient-to-b from-zinc-500 via-zinc-300 to-zinc-600 shadow-sm"
        />
        {/* Power */}
        <div
          aria-hidden
          className="absolute -right-[2px] top-[32%] z-10 h-16 w-[3px] rounded-r-sm bg-gradient-to-b from-zinc-500 via-zinc-300 to-zinc-600 shadow-sm"
        />

        {/* Chassis */}
        <div
          className="relative rounded-[3rem] p-[3px] shadow-[0_25px_80px_-12px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.06)_inset] md:rounded-[3.25rem] lg:rounded-[3.5rem]"
          style={{
            background:
              'linear-gradient(145deg, #4a4a4e 0%, #1c1c1e 18%, #3a3a3c 42%, #0a0a0b 58%, #2c2c2e 78%, #525255 100%)',
          }}
        >
          <div className="relative overflow-hidden rounded-[2.85rem] bg-black ring-1 ring-white/[0.08] md:rounded-[3rem] lg:rounded-[3.25rem]">
            {/* Dynamic Island */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-[11px] z-30 h-[30px] w-[108px] -translate-x-1/2 rounded-full bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),0_2px_8px_rgba(0,0,0,0.6)] md:h-[34px] md:w-[124px] lg:top-[13px]"
            >
              <div className="absolute right-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[#1a1a1c] ring-1 ring-white/5" />
            </div>

            {/* Tela */}
            <div className="relative flex min-h-[min(780px,calc(100dvh-10rem))] flex-col bg-black md:min-h-[min(820px,calc(100dvh-9rem))]">
              {children}
            </div>

            {/* Home indicator */}
            <div
              aria-hidden
              className="pointer-events-none absolute bottom-[6px] left-1/2 z-30 h-[4px] w-[120px] -translate-x-1/2 rounded-full bg-white/30"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

type IOSStatusBarProps = {
  time?: string;
};

export function IOSStatusBar({ time = '9:41' }: IOSStatusBarProps) {
  return (
    <div className="relative z-20 flex h-[44px] shrink-0 items-end justify-between px-7 pb-1 pt-2 text-[12px] font-semibold tracking-tight text-white md:h-[50px] md:text-[13px] lg:px-8">
      <span className="w-14 tabular-nums">{time}</span>
      <div className="flex items-center gap-1.5">
        {/* Signal */}
        <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor" aria-hidden>
          <rect x="0" y="7" width="3" height="4" rx="0.5" opacity="0.35" />
          <rect x="4.5" y="5" width="3" height="6" rx="0.5" opacity="0.55" />
          <rect x="9" y="2.5" width="3" height="8.5" rx="0.5" opacity="0.75" />
          <rect x="13.5" y="0" width="3" height="11" rx="0.5" />
        </svg>
        {/* WiFi */}
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none" aria-hidden>
          <path
            d="M7.5 9.2a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Z"
            fill="currentColor"
          />
          <path
            d="M4.2 6.4a4.1 4.1 0 0 1 6.6 0"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <path
            d="M1.4 3.6a7.8 7.8 0 0 1 12.2 0"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
        {/* Battery */}
        <svg width="25" height="12" viewBox="0 0 25 12" fill="none" aria-hidden>
          <rect x="0.5" y="0.5" width="21" height="11" rx="2.5" stroke="currentColor" strokeOpacity="0.35" />
          <rect x="2" y="2" width="17" height="8" rx="1.5" fill="currentColor" />
          <path
            d="M23 4.2v3.6c.9-.5.9-3.1 0-3.6Z"
            fill="currentColor"
            fillOpacity="0.4"
          />
        </svg>
      </div>
    </div>
  );
}
