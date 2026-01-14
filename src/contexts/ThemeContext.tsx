import React, { createContext, useContext, useEffect } from 'react';

interface ThemeContextType {
  theme: 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme deve ser usado dentro de ThemeProvider');
  }
  return context;
}

// Props que devem ser filtradas (vindas de extensões do browser)
const FILTERED_PROPS = [
  'data-lov-id',
  'data-lov-name', 
  'data-component-path',
  'data-component-line',
  'data-component-file',
  'data-component-name',
  'data-component-content'
];

interface ThemeProviderProps {
  children: React.ReactNode;
  [key: string]: any; // Permitir outras props que podem vir de extensões
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // Filtrar props problemáticas vindas de extensões do browser
  const filteredProps = { ...props };
  FILTERED_PROPS.forEach(prop => {
    if (prop in filteredProps) {
      delete (filteredProps as any)[prop];
    }
  });

  // Aplicar tema dark fixo no documento
  useEffect(() => {
    const root = document.documentElement;
    
    // Manter apenas tema dark
    root.classList.remove('light');
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
    
  }, []);

  const value: ThemeContextType = {
    theme: 'dark',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}