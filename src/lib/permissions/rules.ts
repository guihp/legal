// Regras de negócio para validação de permissões
export const CRITICAL_PERMISSIONS = [
  'menu_permissions', // Gestores não podem se remover acesso às permissões
  'menu_users',       // Gestores não podem se remover acesso aos usuários
] as const;

// Nova hierarquia: Admin gerencia Gestor+Corretor, Gestor gerencia apenas Corretor
export const ROLE_HIERARCHY = {
  admin: ['gestor', 'corretor'],    // Admin gerencia apenas gestor e corretor
  gestor: ['corretor'],             // Gestor gerencia apenas corretor  
  corretor: []                      // Corretor não gerencia ninguém
} as const;

// Roles que podem acessar o módulo de configurar permissões
export const PERMISSION_MANAGERS = ['admin', 'gestor'] as const;

export function validatePermissionChange(
  currentUserRole: string,
  targetRole: string,
  permissionKey: string,
  newValue: boolean
): { valid: boolean; message?: string } {
  
  // Verificar se pode acessar módulo de permissões
  if (!PERMISSION_MANAGERS.includes(currentUserRole as any)) {
    return {
      valid: false,
      message: 'Sem permissão para configurar permissões'
    };
  }
  
  // Gestor não pode remover suas próprias permissões críticas
  if (currentUserRole === 'gestor' && 
      targetRole === 'gestor' && 
      CRITICAL_PERMISSIONS.includes(permissionKey as any) && 
      !newValue) {
    return {
      valid: false,
      message: 'Gestores não podem remover suas próprias permissões críticas'
    };
  }

  // Usuário só pode gerenciar roles permitidos pela hierarquia
  const allowedRoles = ROLE_HIERARCHY[currentUserRole as keyof typeof ROLE_HIERARCHY] || [];
  if (!allowedRoles.includes(targetRole as any)) {
    return {
      valid: false,
      message: 'Sem permissão para alterar este nível de usuário'
    };
  }

  return { valid: true };
}

// Função para verificar se role pode acessar módulo de permissões
export function canAccessPermissionsModule(userRole: string): boolean {
  return PERMISSION_MANAGERS.includes(userRole as any);
}

// Função para obter roles que um usuário pode gerenciar
export function getManagedRoles(userRole: string): string[] {
  return ROLE_HIERARCHY[userRole as keyof typeof ROLE_HIERARCHY] || [];
}