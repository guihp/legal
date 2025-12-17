import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePermissions } from '@/hooks/usePermissions';
import { PermissionConfirmDialog } from '@/components/PermissionConfirmDialog';
import { getManagedRoles } from '@/lib/permissions/rules';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Shield, CheckCircle, XCircle, Users, Settings, Key, Lock, Eye, RefreshCw, Crown, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { logAudit } from '@/lib/audit/logger';

// Componente para as partículas flutuantes
const FloatingParticle = ({ delay = 0, duration = 20, type = 'default' }) => {
  const particleVariants = {
    default: "w-2 h-2 bg-blue-400/20 rounded-full",
    star: "w-1 h-1 bg-yellow-400/30 rounded-full",
    spark: "w-0.5 h-4 bg-purple-400/40 rounded-full",
    glow: "w-3 h-3 bg-emerald-400/25 rounded-full blur-sm"
  };

  return (
    <motion.div
      className={`absolute ${particleVariants[type]}`}
      initial={{ 
        x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1200),
        y: (typeof window !== 'undefined' ? window.innerHeight : 800) + 20,
        opacity: 0,
        scale: 0
      }}
      animate={{
        y: -50,
        opacity: [0, 1, 0.8, 0],
        scale: [0, 1, 1.2, 0],
        rotate: 360
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    />
  );
};

// Componente para luzes pulsantes
const PulsingLights = () => (
  <div className="absolute inset-0 overflow-hidden">
    {Array.from({ length: 8 }).map((_, i) => (
      <motion.div
        key={i}
        className="absolute rounded-full"
        style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          width: `${20 + Math.random() * 40}px`,
          height: `${20 + Math.random() * 40}px`,
        }}
        animate={{
          opacity: [0, 0.3, 0],
          scale: [0.5, 1.5, 0.5],
          background: [
            "radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%)",
            "radial-gradient(circle, rgba(147, 51, 234, 0.2) 0%, transparent 70%)",
            "radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, transparent 70%)",
            "radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%)"
          ]
        }}
        transition={{
          duration: 4 + Math.random() * 4,
          delay: i * 0.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    ))}
  </div>
);

// Componente para o grid arquitetônico
const ArchitecturalGrid = () => (
  <div className="absolute inset-0 overflow-hidden">
    <svg className="absolute inset-0 w-full h-full">
      <defs>
        <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
          <motion.path
            d="M 80 0 L 0 0 0 80"
            fill="none"
            stroke="rgba(59, 130, 246, 0.08)"
            strokeWidth="1"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ 
              pathLength: [0, 1, 0],
              opacity: [0, 0.3, 0]
            }}
            transition={{ duration: 4, repeat: Infinity, repeatType: "loop" }}
          />
          <motion.circle
            cx="40"
            cy="40"
            r="2"
            fill="rgba(147, 51, 234, 0.1)"
            animate={{
              opacity: [0, 0.5, 0],
              r: [1, 3, 1]
            }}
            transition={{ duration: 3, repeat: Infinity, repeatType: "loop" }}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  </div>
);

// Componente para os ícones flutuantes
const FloatingIcon = ({ Icon, delay = 0, x = 0, y = 0, color = "blue" }) => {
  const colorVariants = {
    blue: "text-blue-300/10",
    purple: "text-purple-300/10",
    emerald: "text-emerald-300/10",
    yellow: "text-yellow-300/10",
    pink: "text-pink-300/10"
  };

  return (
    <motion.div
      className={`absolute ${colorVariants[color]}`}
      style={{ left: `${x}%`, top: `${y}%` }}
      initial={{ opacity: 0, scale: 0, rotate: -180 }}
      animate={{ 
        opacity: [0, 0.4, 0],
        scale: [0, 1.2, 0],
        rotate: [0, 360, 720],
        y: [-30, 30, -30],
        x: [-10, 10, -10]
      }}
      transition={{
        duration: 10 + Math.random() * 5,
        delay,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      <Icon size={35 + Math.random() * 20} />
    </motion.div>
  );
};

export function PermissionsManagementView() {
  const { 
    permissions, 
    loading, 
    error, 
    updatePermission, 
    getPermissionsByRole,
    refreshPermissions 
  } = usePermissions();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    permission: any;
    isEnabling: boolean;
    onConfirm: () => void;
  }>({
    open: false,
    permission: null,
    isEnabling: false,
    onConfirm: () => {}
  });

  // Arrays para partículas
  const particles = Array.from({ length: 15 }, (_, i) => i);
  const particleTypes = ['default', 'star', 'spark', 'glow'];

  const handlePermissionToggle = async (permission: any, newValue: boolean) => {
    // Mostrar diálogo de confirmação
    setConfirmDialog({
      open: true,
      permission,
      isEnabling: newValue,
      onConfirm: async () => {
        try {
          setUpdatingId(permission.id);
          await updatePermission(permission.id, newValue);
          toast.success('✅ Permissão atualizada!');
          try { await logAudit({ action: 'permissions.updated', resource: 'permission', resourceId: permission.id, meta: { enabled: newValue } }); } catch {}
        } catch (error: any) {
          toast.error('❌ Erro: ' + error.message);
        } finally {
          setUpdatingId(null);
          setConfirmDialog(prev => ({ ...prev, open: false }));
        }
      }
    });
  };

  const getRoleData = (role: string) => {
    switch (role) {
      case 'admin': 
        return { 
          icon: Crown, 
          label: 'Administrador', 
          color: 'from-red-500 to-red-600',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30',
          textColor: 'text-red-400'
        };
      case 'gestor': 
        return { 
          icon: Shield, 
          label: 'Gestor', 
          color: 'from-blue-500 to-blue-600',
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-500/30',
          textColor: 'text-blue-400'
        };
      case 'corretor': 
        return { 
          icon: UserCheck, 
          label: 'Corretor', 
          color: 'from-green-500 to-green-600',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/30',
          textColor: 'text-green-400'
        };
      default: 
        return { 
          icon: Users, 
          label: role, 
          color: 'from-gray-500 to-gray-600',
          bgColor: 'bg-gray-500/10',
          borderColor: 'border-gray-500/30',
          textColor: 'text-gray-400'
        };
    }
  };

  // Obter roles que o usuário atual pode gerenciar
  const { profile } = useUserProfile();
  const managedRoles = profile ? getManagedRoles(profile.role) : [];
  const roles = managedRoles.length > 0 ? managedRoles : ['corretor'] as const;
  
  console.log('🔐 DEBUG PERMISSIONS VIEW: Profile:', profile);
  console.log('🔐 DEBUG PERMISSIONS VIEW: Managed roles:', managedRoles);
  console.log('🔐 DEBUG PERMISSIONS VIEW: Roles to show:', roles);
  console.log('🔐 DEBUG PERMISSIONS VIEW: All permissions loaded:', permissions);
  console.log('🔐 DEBUG PERMISSIONS VIEW: Corretor permissions:', getPermissionsByRole('corretor'));

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-8 bg-gray-700 rounded animate-pulse w-64 mb-2" />
                <div className="h-4 bg-gray-700 rounded animate-pulse w-96" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-gray-800/50 rounded-lg p-6 animate-pulse">
                  <div className="h-4 bg-gray-700 rounded w-20 mb-2" />
                  <div className="h-8 bg-gray-700 rounded w-16 mb-1" />
                  <div className="h-3 bg-gray-700 rounded w-24" />
                </div>
              ))}
            </div>
            
            <div className="text-center py-12">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="inline-block"
              >
                <RefreshCw className="h-8 w-8 text-blue-400 mx-auto mb-4" />
              </motion.div>
              <p className="text-gray-400">Carregando sistema de permissões...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md bg-gray-800/50 border-red-500/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <XCircle className="h-6 w-6 text-red-400" />
                <h3 className="text-lg font-semibold text-white">Erro ao Carregar</h3>
              </div>
              <p className="text-gray-400 mb-4">{error}</p>
              <Button onClick={refreshPermissions} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar Novamente
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Sistema de Permissões
            </h1>
            <p className="text-gray-400">
              Configure o acesso às funcionalidades por tipo de usuário
            </p>
          </div>
          
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button 
              onClick={refreshPermissions}
              variant="outline"
              className="border-gray-600 text-green-400 hover:border-green-500 hover:bg-green-500/10 hover:text-green-300"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </motion.div>
        </motion.div>

        {/* Stats Overview */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {roles.map((role, index) => {
            const roleData = getRoleData(role);
            const rolePermissions = getPermissionsByRole(role);
            const enabledCount = rolePermissions.filter(p => p.is_enabled).length;
            const totalCount = rolePermissions.length;
            const percentage = totalCount > 0 ? Math.round((enabledCount / totalCount) * 100) : 0;

            return (
              <motion.div
                key={role}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                whileHover={{ y: -2 }}
              >
                <Card className={`${roleData.bgColor} ${roleData.borderColor} border backdrop-blur-sm hover:scale-105 transition-all duration-200`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-gradient-to-r ${roleData.color}`}>
                          <roleData.icon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h3 className={`font-semibold ${roleData.textColor}`}>
                            {roleData.label}
                          </h3>
                          <p className="text-sm text-gray-400">
                            {enabledCount}/{totalCount} ativas
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${roleData.textColor}`}>
                          {percentage}%
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Tabs defaultValue="corretor" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 bg-gray-800/50 p-1">
              {roles.map((role) => {
                const roleData = getRoleData(role);
                const rolePermissions = getPermissionsByRole(role);
                const enabledCount = rolePermissions.filter(p => p.is_enabled).length;
                
                return (
                  <TabsTrigger 
                    key={role}
                    value={role} 
                    className="data-[state=active]:bg-white data-[state=active]:text-gray-900 flex items-center gap-2 py-3"
                  >
                    <roleData.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{roleData.label}</span>
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {enabledCount}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {roles.map(role => {
              const roleData = getRoleData(role);
              const rolePermissions = getPermissionsByRole(role);
              
              return (
                <TabsContent key={role} value={role} className="space-y-6">
                  <Card className="bg-gray-800/30 border-gray-700/50">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg bg-gradient-to-r ${roleData.color}`}>
                            <roleData.icon className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-white">
                              Permissões - {roleData.label}
                            </CardTitle>
                            <CardDescription>
                              Controle o acesso às funcionalidades do sistema
                            </CardDescription>
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-6">
                      {/* Agrupar por categoria */}
                      {Object.entries(
                        rolePermissions.reduce((acc, perm) => {
                          if (!acc[perm.category]) acc[perm.category] = [];
                          acc[perm.category].push(perm);
                          return acc;
                        }, {} as Record<string, typeof permissions>)
                      ).map(([category, categoryPerms]) => (
                        <div key={category} className="space-y-4">
                          <div className="flex items-center gap-2 mb-4">
                            <Settings className={`h-5 w-5 ${roleData.textColor}`} />
                            <h4 className="text-lg font-semibold text-white">
                              {category === 'menu' ? 'Menus de Navegação' : category}
                            </h4>
                            <Separator className="flex-1 bg-gray-700" />
                            <Badge variant="outline" className={`${roleData.borderColor} ${roleData.textColor}`}>
                              {categoryPerms.filter(p => p.is_enabled).length}/{categoryPerms.length}
                            </Badge>
                          </div>
                          
                          <div className="grid gap-3">
                            {categoryPerms.map((permission, index) => (
                              <motion.div
                                key={permission.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="group"
                              >
                                <div className="flex items-center justify-between p-4 bg-gray-800/40 hover:bg-gray-800/60 rounded-lg border border-gray-700/50 hover:border-gray-600/50 transition-all duration-200">
                                  <div className="flex items-center gap-4 flex-1">
                                    <div className="flex items-center gap-3">
                                      {permission.is_enabled ? (
                                        <CheckCircle className="h-5 w-5 text-green-400" />
                                      ) : (
                                        <XCircle className="h-5 w-5 text-red-400" />
                                      )}
                                      <div>
                                        <Label 
                                          htmlFor={permission.id}
                                          className="text-white font-medium cursor-pointer group-hover:text-blue-400 transition-colors"
                                        >
                                          {permission.permission_name}
                                        </Label>
                                        {permission.description && (
                                          <p className="text-sm text-gray-400 mt-1">
                                            {permission.description}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <motion.div 
                                    whileHover={{ scale: 1.05 }} 
                                    whileTap={{ scale: 0.95 }}
                                  >
                                    <Switch
                                      id={permission.id}
                                      checked={permission.is_enabled}
                                      disabled={updatingId === permission.id}
                                      onCheckedChange={(checked) => 
                                        handlePermissionToggle(permission, checked)
                                      }
                                      className="data-[state=checked]:bg-green-600"
                                    />
                                  </motion.div>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>
              );
            })}
          </Tabs>
        </motion.div>

        {/* Modal de Confirmação */}
        <PermissionConfirmDialog
          open={confirmDialog.open}
          onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
          onConfirm={confirmDialog.onConfirm}
          permission={confirmDialog.permission}
          isEnabling={confirmDialog.isEnabling}
        />
      </div>
    </div>
  );
}
