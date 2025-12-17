import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, Users, Eye, EyeOff, Lock, Unlock, Crown, UserCheck, Zap, Loader2 } from "lucide-react";
import { CRITICAL_PERMISSIONS } from '@/lib/permissions/rules';
import { supabase } from '@/integrations/supabase/client';

interface PermissionConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  permission: {
    permission_name: string;
    permission_key: string;
    role: string;
    description?: string;
  } | null;
  isEnabling: boolean;
}

export function PermissionConfirmDialog({ 
  open, 
  onOpenChange, 
  onConfirm, 
  permission, 
  isEnabling 
}: PermissionConfirmDialogProps) {
  const [affectedUsers, setAffectedUsers] = useState<{total: number, active: number} | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);

  if (!permission) return null;

  const isCritical = CRITICAL_PERMISSIONS.includes(permission.permission_key as any);
  const action = isEnabling ? 'habilitar' : 'desabilitar';
  const actionColor = isEnabling ? 'text-green-500' : 'text-red-500';
  const actionBg = isEnabling ? 'bg-green-500/10' : 'bg-red-500/10';
  const actionBorder = isEnabling ? 'border-green-500/20' : 'border-red-500/20';

  // Buscar quantos usuários serão afetados
  useEffect(() => {
    if (!open || !permission) return;

    const fetchAffectedUsers = async () => {
      setLoadingUsers(true);
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id, is_active')
          .eq('role', permission.role);

        if (error) throw error;

        const total = data?.length || 0;
        const active = data?.filter(user => user.is_active).length || 0;
        
        setAffectedUsers({ total, active });
      } catch (error) {
        console.error('Erro ao buscar usuários afetados:', error);
        setAffectedUsers({ total: 0, active: 0 });
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchAffectedUsers();
  }, [open, permission]);

  // Mapear ícones para diferentes tipos de permissão
  const getPermissionIcon = () => {
    const key = permission.permission_key.toLowerCase();
    if (key.includes('menu_users') || key.includes('user')) return Users;
    if (key.includes('menu_permissions') || key.includes('permission')) return Shield;
    if (key.includes('admin') || key.includes('system')) return Crown;
    if (key.includes('manage') || key.includes('edit')) return UserCheck;
    if (isCritical) return AlertTriangle;
    return Eye;
  };

  const PermissionIcon = getPermissionIcon();

  // Mapear cores e labels para roles
  const getRoleData = (role: string) => {
    switch (role) {
      case 'admin':
        return {
          color: 'bg-red-500/15 text-red-400 border-red-500/30',
          icon: Crown,
          label: 'Administrador'
        };
      case 'gestor':
        return {
          color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
          icon: Shield,
          label: 'Gestor'
        };
      case 'corretor':
        return {
          color: 'bg-green-500/15 text-green-400 border-green-500/30',
          icon: UserCheck,
          label: 'Corretor'
        };
      default:
        return {
          color: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
          icon: Users,
          label: role
        };
    }
  };

  const roleData = getRoleData(permission.role);
  const RoleIcon = roleData.icon;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg sm:max-w-xl bg-gray-900 border-gray-700 text-white shadow-2xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          <AlertDialogHeader className="space-y-4">
            {/* Header with animated icon */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                className={`p-3 rounded-xl ${actionBg} ${actionBorder} border backdrop-blur-sm`}
              >
                {isEnabling ? (
                  <Unlock className={`h-6 w-6 ${actionColor}`} />
                ) : (
                  <Lock className={`h-6 w-6 ${actionColor}`} />
                )}
              </motion.div>
              
              <div className="flex-1">
                <AlertDialogTitle className="text-xl font-bold text-white">
                  {isEnabling ? 'Habilitar' : 'Desabilitar'} Permissão
                </AlertDialogTitle>
                <div className="text-sm text-gray-400 mt-1">
                  Confirme esta ação para continuar
                </div>
              </div>
            </div>
          </AlertDialogHeader>

          <AlertDialogDescription asChild>
            <div className="space-y-6">
              {/* Status visual */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-center py-4"
              >
                <div className="text-gray-300 text-sm mb-2">
                  Você está prestes a:
                </div>
                <div className={`text-lg font-semibold ${actionColor} flex items-center justify-center gap-2`}>
                  {isEnabling ? (
                    <>
                      <Eye className="h-5 w-5" />
                      Conceder acesso
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-5 w-5" />
                      Remover acesso
                    </>
                  )}
                </div>
              </motion.div>

              {/* Detalhes da permissão */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 space-y-4"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <PermissionIcon className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-white text-lg">
                      {permission.permission_name}
                    </div>
                    {permission.description && (
                      <div className="text-sm text-gray-400 mt-1">
                        {permission.description}
                      </div>
                    )}
                  </div>
                </div>

                {/* Role badge */}
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${roleData.color}`}>
                    <RoleIcon className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Role: {roleData.label}
                    </span>
                  </div>
                  
                  {isCritical && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.4, type: "spring" }}
                    >
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        Crítica
                      </Badge>
                    </motion.div>
                  )}
                </div>
              </motion.div>

              {/* Aviso crítico */}
              <AnimatePresence>
                {isCritical && !isEnabling && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ delay: 0.4 }}
                    className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0" />
                      <span className="font-semibold text-amber-300">
                        ⚠️ Permissão Crítica Detectada
                      </span>
                    </div>
                    <div className="text-sm text-amber-200 ml-8">
                      Desabilitar esta permissão pode impedir o acesso a funcionalidades essenciais 
                      e prejudicar a operação do sistema para usuários com este role.
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Impacto */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-blue-900/10 border border-blue-500/20 rounded-xl p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-300">
                    Impacto da Alteração
                  </span>
                </div>
                
                <div className="space-y-3 ml-6">
                  <div className="text-sm text-gray-400">
                    Esta ação afetará <strong className="text-white">todos os usuários</strong> com 
                    o role <strong className={roleData.color.split(' ')[1]}>{roleData.label}</strong> 
                    {isEnabling ? ', concedendo' : ', removendo'} acesso imediatamente.
                  </div>
                  
                  {/* Contador de usuários afetados */}
                  <div className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg border border-gray-700/50">
                    {loadingUsers ? (
                      <div className="flex items-center gap-2 text-gray-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Verificando usuários...</span>
                      </div>
                    ) : affectedUsers ? (
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-green-400"></div>
                          <span className="text-green-400 font-medium">
                            {affectedUsers.active} usuário{affectedUsers.active !== 1 ? 's' : ''} ativo{affectedUsers.active !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {affectedUsers.total > affectedUsers.active && (
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-gray-500"></div>
                            <span className="text-gray-400">
                              {affectedUsers.total - affectedUsers.active} inativo{affectedUsers.total - affectedUsers.active !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">
                        Não foi possível verificar usuários afetados
                      </span>
                    )}
                  </div>
                  
                  {affectedUsers && affectedUsers.active > 0 && (
                    <div className="text-xs text-amber-300 bg-amber-900/20 border border-amber-500/30 rounded-lg p-2">
                      ⚡ As alterações serão aplicadas instantaneamente via sistema de tempo real
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </AlertDialogDescription>
        </motion.div>
        
        <AlertDialogFooter className="flex gap-3 pt-6">
          <AlertDialogCancel className="bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className={`
              ${isEnabling 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'bg-red-600 hover:bg-red-700 text-white'
              } 
              transition-all duration-200 font-semibold px-6
            `}
          >
            <motion.div 
              className="flex items-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isEnabling ? (
                <>
                  <Unlock className="h-4 w-4" />
                  Confirmar Habilitação
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Confirmar Desabilitação
                </>
              )}
            </motion.div>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}