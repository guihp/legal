import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';

// Singleton para gerenciar autenticação de forma centralizada
class AuthManager {
  private static instance: AuthManager;
  private listeners: Set<(session: Session | null) => void> = new Set();
  private currentSession: Session | null = null;
  private subscription: any = null;
  private initialized = false;

  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  async initialize() {
    if (this.initialized) return;
    
    //
    
    // Obter sessão atual
    const { data: { session } } = await supabase.auth.getSession();
    this.currentSession = session;
    
    // Configurar listener único
    if (!this.subscription) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        //
        
        this.currentSession = session;
        
        // Notificar todos os listeners
        this.listeners.forEach(listener => {
          try {
            listener(session);
          } catch (error) {
            console.error('🔐 AuthManager: Erro em listener:', error);
          }
        });
      });
      
      this.subscription = subscription;
    }
    
    this.initialized = true;
  }

  subscribe(listener: (session: Session | null) => void): () => void {
    this.listeners.add(listener);
    
    // Chamar imediatamente com a sessão atual
    if (this.currentSession !== null) {
      listener(this.currentSession);
    }
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  getCurrentSession(): Session | null {
    return this.currentSession;
  }

  destroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    this.listeners.clear();
    this.initialized = false;
  }
}

export function useAuthManager() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const managerRef = useRef<AuthManager>();

  useEffect(() => {
    const manager = AuthManager.getInstance();
    managerRef.current = manager;

    const initializeAuth = async () => {
      await manager.initialize();
      
      const unsubscribe = manager.subscribe((newSession) => {
        setSession(newSession);
        setLoading(false);
      });

      // Definir sessão inicial
      const currentSession = manager.getCurrentSession();
      setSession(currentSession);
      setLoading(false);

      return unsubscribe;
    };

    let unsubscribe: (() => void) | undefined;
    
    initializeAuth().then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  return {
    session,
    loading,
    user: session?.user || null
  };
}