import React from 'react';
import { ThemeProvider } from '@mui/material/styles';

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

/**
 * Wrapper do ThemeProvider que filtra props não suportadas
 * Evita warnings no console causados por extensões do browser
 */
export const SafeThemeProvider: React.FC<React.ComponentProps<typeof ThemeProvider>> = (props) => {
  // Filtrar props problemáticas
  const filteredProps = { ...props };
  
  FILTERED_PROPS.forEach(prop => {
    if (prop in filteredProps) {
      delete (filteredProps as any)[prop];
    }
  });

  return <ThemeProvider {...filteredProps} />;
};
