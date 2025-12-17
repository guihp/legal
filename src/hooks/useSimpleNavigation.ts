import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export type View = 
  | "dashboard" | "properties" | "contracts" | "agenda" | "plantao" 
  | "reports" | "clients" | "clients-crm" | "connections" | "users" 
  | "permissions" | "inquilinato" | "disparador" | "profile";

/**
 * Hook simplificado de navegação que evita loops infinitos
 * Usa uma abordagem minimalista com apenas uma fonte de verdade
 */
export const useSimpleNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Estados simples
  const [currentView, setCurrentView] = useState<View>(() => {
    const path = location.pathname.replace(/^\//, '') as View;
    return path || 'dashboard';
  });
  
  // Refs para controle interno
  const isNavigatingRef = useRef(false);
  const lastPathRef = useRef(location.pathname);
  
  // Função para mudança segura de view
  const changeView = useCallback((newView: View, reason: string = '') => {
    console.log(`📱 Tentativa de mudança: ${currentView} → ${newView} (${reason})`);
    
    // Evitar mudanças redundantes
    if (newView === currentView) {
      console.log(`🚫 Mudança ignorada: já estamos em ${newView}`);
      return;
    }
    
    // Evitar durante navegação programática
    if (isNavigatingRef.current) {
      console.log(`🚫 Mudança bloqueada: navegação em curso`);
      return;
    }
    
    console.log(`✅ Mudança autorizada: ${currentView} → ${newView}`);
    setCurrentView(newView);
  }, [currentView]);
  
  // Sincronização URL → State (apenas quando URL muda externamente)
  useEffect(() => {
    const currentPath = location.pathname.replace(/^\//, '') as View;
    const expectedPath = `/${currentView}`;
    
    // Se a URL mudou externamente (não por nossa navegação)
    if (location.pathname !== lastPathRef.current && !isNavigatingRef.current) {
      console.log(`🌐 URL mudou externamente: ${lastPathRef.current} → ${location.pathname}`);
      if (currentPath && currentPath !== currentView) {
        setCurrentView(currentPath);
      }
    }
    
    lastPathRef.current = location.pathname;
  }, [location.pathname, currentView]);
  
  // Sincronização State → URL (apenas quando state muda)
  useEffect(() => {
    const targetPath = `/${currentView}`;
    
    // Se o state mudou e a URL não está sincronizada
    if (location.pathname !== targetPath && !isNavigatingRef.current) {
      console.log(`📱 State mudou: navegando para ${targetPath}`);
      
      isNavigatingRef.current = true;
      navigate(targetPath, { replace: true });
      
      // Reset flag após navegação
      setTimeout(() => {
        isNavigatingRef.current = false;
        console.log(`🔓 Navegação concluída`);
      }, 100);
    }
  }, [currentView, navigate, location.pathname]);
  
  // Salvar no localStorage (simples)
  useEffect(() => {
    try {
      localStorage.setItem('current-view', currentView);
    } catch {}
  }, [currentView]);
  
  return {
    currentView,
    changeView
  };
};
