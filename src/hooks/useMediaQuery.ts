import { useEffect, useState } from 'react';

/** SSR-safe matchMedia subscription. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Tailwind `xl` = 1280px — 3-col lead panel docks here. */
export function useIsXlUp() {
  return useMediaQuery('(min-width: 1280px)');
}
