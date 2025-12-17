import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { supabase } from '@/integrations/supabase/client';

interface SessionRecoveryProps {
  onRecoverySuccess: () => void;
  onRecoveryFailed: () => void;
}

export const SessionRecovery: React.FC<SessionRecoveryProps> = ({
  onRecoverySuccess,
  onRecoveryFailed
}) => {
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  const maxAttempts = 3;

  const attemptRecovery = async () => {
    if (recoveryAttempts >= maxAttempts) {
      console.log('🔧 SessionRecovery: Máximo de tentativas atingido');
      onRecoveryFailed();
      return;
    }

    setIsRecovering(true);
    setLastError(null);
    
    try {
      console.log('🔧 SessionRecovery: Tentativa de recuperação', recoveryAttempts + 1);
      
      // Verificar se há uma sessão válida
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        throw new Error(`Erro ao verificar sessão: ${error.message}`);
      }

      if (session) {
        console.log('🔧 SessionRecovery: Sessão válida encontrada');
        onRecoverySuccess();
        return;
      }

      // Tentar refresh da sessão
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        throw new Error(`Erro ao renovar sessão: ${refreshError.message}`);
      }

      if (refreshData.session) {
        console.log('🔧 SessionRecovery: Sessão renovada com sucesso');
        onRecoverySuccess();
        return;
      }

      throw new Error('Não foi possível recuperar a sessão');

    } catch (error: any) {
      console.error('🔧 SessionRecovery: Erro na recuperação:', error);
      setLastError(error.message);
      setRecoveryAttempts(prev => prev + 1);
      
      if (recoveryAttempts + 1 >= maxAttempts) {
        onRecoveryFailed();
      }
    } finally {
      setIsRecovering(false);
    }
  };

  // Tentar recuperação automática na montagem
  useEffect(() => {
    const timer = setTimeout(() => {
      attemptRecovery();
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleManualRetry = () => {
    setRecoveryAttempts(0);
    attemptRecovery();
  };

  const handleForceReload = () => {
    console.log('🔧 SessionRecovery: Forçando recarregamento da página');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-gray-900/90 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6 text-center"
      >
        <div className="mb-6">
          {isRecovering ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="mx-auto w-12 h-12 text-blue-400"
            >
              <RefreshCw className="w-full h-full" />
            </motion.div>
          ) : recoveryAttempts >= maxAttempts ? (
            <AlertCircle className="mx-auto w-12 h-12 text-red-400" />
          ) : (
            <CheckCircle className="mx-auto w-12 h-12 text-yellow-400" />
          )}
        </div>

        <h2 className="text-xl font-semibold text-white mb-2">
          {isRecovering ? 'Recuperando Sessão...' : 
           recoveryAttempts >= maxAttempts ? 'Falha na Recuperação' : 
           'Sessão Perdida'}
        </h2>

        <p className="text-gray-400 mb-6">
          {isRecovering ? 'Aguarde enquanto tentamos restaurar sua sessão.' :
           recoveryAttempts >= maxAttempts ? 'Não foi possível recuperar sua sessão automaticamente.' :
           'Detectamos que sua sessão foi perdida. Tentando recuperar...'}
        </p>

        {lastError && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800/50 rounded-lg">
            <p className="text-red-400 text-sm">{lastError}</p>
          </div>
        )}

        <div className="space-y-3">
          {recoveryAttempts < maxAttempts && (
            <Button
              onClick={handleManualRetry}
              disabled={isRecovering}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isRecovering ? 'Recuperando...' : 'Tentar Novamente'}
            </Button>
          )}

          <Button
            onClick={handleForceReload}
            variant="outline"
            className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            Recarregar Página
          </Button>

          <Button
            onClick={onRecoveryFailed}
            variant="ghost"
            className="w-full text-gray-400 hover:text-white"
          >
            Ir para Login
          </Button>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          Tentativa {recoveryAttempts} de {maxAttempts}
        </div>
      </motion.div>
    </div>
  );
};