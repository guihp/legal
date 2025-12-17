import { useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export type View = 
  | "dashboard" | "properties" | "contracts" | "agenda" | "plantao" 
  | "reports" | "clients" | "clients-crm" | "connections" | "users" 
  | "permissions" | "inquilinato" | "disparador" | "conversas" 
  | "configurations" | "profile";

/**
 * Hook ULTRA-SIMPLIFICADO de navegação
 * ZERO useEffects para evitar loops
 */
export const useBasicNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // State simples baseado na URL atual
  const getCurrentViewFromURL = (): View => {
    const path = location.pathname.replace(/^\//, '') as View;
    return path || 'dashboard';
  };
  
  const currentView = getCurrentViewFromURL();
  
  // Função para mudança - SEM useCallback para evitar dependências
  const changeView = (newView: View, reason: string = '') => {
    console.log(`📱 Mudança: ${currentView} → ${newView} (${reason})`);
    
    if (newView === currentView) {
      console.log(`🚫 Já estamos em ${newView}`);
      return;
    }
    
    console.log(`✅ Navegando para ${newView}`);
    navigate(`/${newView}`, { replace: true });
    
    // Salvar no localStorage sem complicações
    try {
      localStorage.setItem('current-view', newView);
    } catch {}
  };
  
  return {
    currentView,
    changeView
  };
};
