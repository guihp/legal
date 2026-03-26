import { Building2, Home, BarChart3, Settings, Users, TrendingUp, FileText, Calendar, Wifi, ChevronDown, ChevronRight, LogOut, UserCheck, Database, ShieldCheck, Bot, Send, MessageSquare, RefreshCw, Megaphone, Share2, Sun, Moon, LayoutDashboard, Globe, Layers } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { supabase } from '../integrations/supabase/client';
import { Button } from "./ui/button";
import { User } from '@supabase/supabase-js';
import { useUserProfile } from '@/hooks/useUserProfile';
import { usePermissions } from '@/hooks/usePermissions';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { usePreview } from '@/contexts/PreviewContext';
import { canAccessPermissionsModule } from '@/lib/permissions/rules';
import { useTheme } from '@/contexts/ThemeContext';

const menuItems = [
  {
    title: "Propriedades",
    url: "#",
    icon: Building2,
    view: "properties" as const,
    permissionKey: "menu_properties",
  },
  {
    title: "Agenda",
    url: "#",
    icon: Calendar,
    view: "agenda" as const,
    permissionKey: "menu_agenda",
  },
  {
    title: "Plantão",
    url: "#",
    icon: Calendar,
    view: "plantao" as const,
    permissionKey: "menu_plantao",
  },
  {
    title: "Pipeline Clientes",
    url: "#",
    icon: UserCheck,
    view: "clients" as const,
    permissionKey: "menu_clients",
  },
  {
    title: "CRM Clientes",
    url: "#",
    icon: Database,
    view: "clients-crm" as const,
    permissionKey: "menu_clients_crm",
  },

  {
    title: "Conexões",
    url: "#",
    icon: Wifi,
    view: "connections" as const,
    permissionKey: "menu_connections",
  },
  {
    title: "Usuários",
    url: "#",
    icon: Users,
    view: "users" as const,
    permissionKey: "menu_users",
  },
  // Removido do menu (não expor no sidebar)
  // {
  //   title: "Lei do Inquilinato",
  //   url: "#",
  //   icon: Bot,
  //   view: "inquilinato" as const,
  //   permissionKey: "menu_inquilinato",
  // },
  // {
  //   title: "Disparador",
  //   url: "#",
  //   icon: Send,
  //   view: "disparador" as const,
  //   permissionKey: "menu_disparador",
  // },
  {
    title: "Conversas",
    url: "#",
    icon: MessageSquare,
    view: "conversas" as const,
    permissionKey: "menu_conversas",
  },
  // Removido do menu (não expor no sidebar)
  // {
  //   title: "Rede de Parcerias",
  //   url: "#",
  //   icon: Share2,
  //   view: "partnerships" as const,
  //   permissionKey: "menu_partnerships",
  // },
];

/** Subitens do menu Presença digital (site vitrine + LPs) */
const digitalPresenceItems = [
  {
    title: 'Visão geral',
    view: 'marketing' as const,
    icon: LayoutDashboard,
    permissionKey: 'menu_marketing',
  },
  {
    title: 'Site vitrine',
    view: 'marketing-site' as const,
    icon: Globe,
    permissionKey: 'menu_marketing',
  },
  {
    title: 'Landing pages',
    view: 'marketing-lps' as const,
    icon: Layers,
    permissionKey: 'menu_marketing',
  },
];

const analyticsItems = [
  {
    title: "Painel",
    url: "#",
    icon: BarChart3,
    view: "dashboard" as const,
    permissionKey: "menu_dashboard",
  },
  {
    title: "Relatórios",
    url: "#",
    icon: TrendingUp,
    view: "reports" as const,
    permissionKey: "menu_reports",
  },
];

const secondaryItems = [
  {
    title: "Configurar Permissões",
    url: "#",
    icon: ShieldCheck,
    view: "permissions" as const,
    permissionKey: "menu_permissions",
  },
  {
    title: "Configurações",
    url: "#",
    icon: Settings,
    view: "configurations" as const,
    permissionKey: "menu_configurations",
  },
];

interface AppSidebarProps {
  currentView: string;
  onViewChange: (
    view:
      | 'dashboard'
      | 'properties'
      | 'agenda'
      | 'plantao'
      | 'reports'
      | 'clients'
      | 'clients-crm'
      | 'connections'
      | 'users'
      | 'permissions'
      | 'inquilinato'
      | 'disparador'
      | 'conversas'
      | 'configurations'
      | 'profile'
      | 'marketing'
      | 'marketing-site'
      | 'marketing-lps'
      | 'partnerships'
  ) => void;
}

export function AppSidebar({ currentView, onViewChange }: AppSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const { profile, isAdmin } = useUserProfile();
  const { hasPermission, forceRefreshPermissions } = usePermissions();
  const { settings } = useCompanySettings();
  const { theme, toggleTheme } = useTheme();
  const {
    isPreviewMode,
    previewName,
    previewSubtitle,
    previewNameFont,
    previewNameSize,
    previewNameColor,
    previewNameBold,
    previewSubtitleFont,
    previewSubtitleSize,
    previewSubtitleColor,
    previewSubtitleBold,
    previewLogoSize,
  } = usePreview();

  // Usar valores de preview quando estiver no modo preview, senão usar configurações salvas
  const companyDisplayName = isPreviewMode ? previewName : settings?.display_name;
  const companyDisplaySubtitle = isPreviewMode ? previewSubtitle : settings?.display_subtitle;
  const nameFont = isPreviewMode ? previewNameFont : settings?.company_name_font_family;
  const nameSize = isPreviewMode ? previewNameSize : settings?.company_name_font_size;
  const nameColor = isPreviewMode ? previewNameColor : settings?.company_name_color;
  const nameBold = isPreviewMode ? previewNameBold : settings?.company_name_bold;
  const subtitleFont = isPreviewMode ? previewSubtitleFont : settings?.company_subtitle_font_family;
  const subtitleSize = isPreviewMode ? previewSubtitleSize : settings?.company_subtitle_font_size;
  const subtitleColor = isPreviewMode ? previewSubtitleColor : settings?.company_subtitle_color;
  const subtitleBold = isPreviewMode ? previewSubtitleBold : settings?.company_subtitle_bold;
  /** Tamanho vindo do banco (ex.: 40) não deve encolher a logo após o fetch — mínimo visual estável */
  const rawLogoSize = isPreviewMode ? previewLogoSize : settings?.logo_size;
  const sidebarLogoHeightPx =
    rawLogoSize != null && rawLogoSize > 0
      ? Math.max(rawLogoSize, 88)
      : 104;

  useEffect(() => {
    // Buscar usuário atual
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const toggleExpanded = (title: string) => {
    setExpandedItems(prev =>
      prev.includes(title)
        ? prev.filter(item => item !== title)
        : [...prev, title]
    );
  };

  const isExpanded = (title: string) => expandedItems.includes(title);

  // Nome e role do usuário (prioriza perfil do banco)
  const displayName =
    (profile?.full_name && profile.full_name.trim())
      ? profile.full_name
      : (user?.user_metadata?.name || user?.email || 'Usuário');

  const roleLabelMap: Record<'admin' | 'gestor' | 'corretor' | 'super_admin', string> = {
    super_admin: 'Super Admin',
    admin: 'Administrador',
    gestor: 'Gestor',
    corretor: 'Corretor',
  };

  const roleClassMap: Record<'admin' | 'gestor' | 'corretor' | 'super_admin', string> = {
    super_admin: 'bg-orange-500/15 text-orange-300 border border-orange-500/30',
    admin: 'bg-red-500/15 text-red-300 border border-red-500/30',
    gestor: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    corretor: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  };

  // Letra do avatar (primeira letra do nome ou email)
  const avatarLetter = (displayName?.charAt(0) || user?.email?.charAt(0) || 'U').toUpperCase();

  // Filtrar menus baseado nas permissões
  const filteredMenuItems = menuItems.filter(item => {
    if (!item.permissionKey) return true; // Se não tem permissão definida, mostrar para todos
    if (!profile) {
      console.log('⚠️ DEBUG: Profile não disponível no filtro de menus');
      return false; // Se não tem perfil, não mostrar menus
    }

    // Verificação especial para o módulo de permissões
    if (item.permissionKey === 'menu_permissions') {
      const canAccess = canAccessPermissionsModule(profile.role);
      console.log(`🔍 DEBUG: ${item.title} (permissions) - Role: ${profile.role}, CanAccess: ${canAccess}`);
      return canAccess;
    }

    const hasAccess = hasPermission(item.permissionKey);
    console.log(`🔍 DEBUG: ${item.title} (${item.permissionKey}) - Role: ${profile.role}, HasAccess: ${hasAccess}`);
    return hasAccess;
  });
  const filteredAnalyticsItems = analyticsItems.filter(item => {
    if (!('permissionKey' in item) || !item.permissionKey) return true;
    if (!profile) {
      console.log('⚠️ DEBUG: Profile não disponível no filtro analytics');
      return false;
    }
    const hasAccess = hasPermission(item.permissionKey);
    console.log(`🔍 DEBUG ANALYTICS: ${item.title} (${item.permissionKey}) - Role: ${profile.role}, HasAccess: ${hasAccess}`);
    return hasAccess;
  });

  const filteredDigitalItems = digitalPresenceItems.filter((item) => {
    if (!profile) return false;
    return hasPermission(item.permissionKey);
  });

  const filteredSecondaryItems = secondaryItems.filter(item => {
    if (!('permissionKey' in item) || !item.permissionKey) return true;
    if (!profile) return false;

    // Verificação especial para o módulo de permissões
    if (item.permissionKey === 'menu_permissions') {
      return canAccessPermissionsModule(profile.role);
    }

    return hasPermission(item.permissionKey);
  });

  return (
    <Sidebar className="border-r border-theme-primary bg-theme-secondary text-theme-primary">
      <SidebarHeader className="px-4 py-7 border-b border-theme-primary bg-theme-secondary min-h-[132px] flex flex-col justify-center">
        <div className="flex flex-col items-center gap-3 w-full">
          {settings?.logo_url ? (
            <img
              src={settings.logo_url}
              alt="Logo da empresa"
              style={{
                height: `${sidebarLogoHeightPx}px`,
                width: 'auto',
                maxHeight: '140px',
              }}
              className="rounded-xl object-contain"
            />
          ) : (
            <div
              style={{
                height: `${sidebarLogoHeightPx}px`,
                maxHeight: '140px',
                width: '100%',
                background: 'transparent'
              }}
              className="flex items-center justify-center py-2"
            >
              <img
                src={theme === 'dark' ? '/IMOBI-LOGO-(1).png' : '/IMOBI-LOGO-2.png'}
                alt="IAFÉ IMOBI"
                className="h-full w-auto object-contain max-w-[min(100%,280px)]"
              />
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 bg-theme-secondary">
        <SidebarGroup>
          <SidebarGroupLabel className="text-theme-muted text-xs uppercase tracking-wider px-3 py-2 font-semibold">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={currentView === item.view}
                    className={`
                      text-theme-secondary hover:text-theme-primary transition-all duration-200
                      ${theme === 'dark' ? 'hover:bg-gray-800/70' : 'hover:bg-gray-100'}
                      ${currentView === item.view
                        ? theme === 'dark'
                          ? 'bg-gradient-to-r from-blue-600/20 to-blue-700/20 text-white border-l-2 border-blue-500'
                          : 'bg-gradient-to-r from-gray-900/5 to-gray-900/0 text-gray-900 border-l-2 border-gray-900/60 font-semibold'
                        : ''
                      }
                    `}
                  >
                    <button
                      onClick={async () => {
                        // Se for Conversas, chamar o webhook coletar-mensagens
                        if (item.view === 'conversas' && profile?.company_id && settings?.display_name) {
                          try {
                            console.log('🔄 Chamando webhook coletar-mensagens ao clicar em Conversas...');
                            await fetch('https://n8n-sgo8ksokg404ocg8sgc4sooc.vemprajogo.com/webhook/coletar-mensagens', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                company_id: profile.company_id,
                                company_name: settings.display_name
                              })
                            });
                            console.log('✅ Webhook coletar-mensagens chamado com sucesso.');
                          } catch (error) {
                            console.error('❌ Erro ao chamar webhook coletar-mensagens:', error);
                          }
                        }
                        onViewChange(item.view);
                        navigate(`/${item.view}`);
                      }}
                      onMouseEnter={() => {
                        // Prefetch sob hover
                        const map: Record<string, () => Promise<any>> = {
                          properties: () => import('@/components/PropertyList'),
                          agenda: () => import('@/components/AgendaView'),
                          clients: () => import('@/components/ClientsView'),
                          'clients-crm': () => import('@/components/ClientsCRMView'),
                          connections: () => import('@/components/ConnectionsViewSimplified'),
                          users: () => import('@/components/UserManagementView'),
                          permissions: () => import('@/components/PermissionsManagementView'),
                          inquilinato: () => import('@/components/InquilinatoView'),
                          disparador: () => import('@/components/DisparadorView'),
                          conversas: () => import('@/components/ConversasView'),
                          profile: () => import('@/components/UserProfileView'),
                          dashboard: () => import('@/components/DashboardContent'),
                          plantao: () => import('@/components/PlantaoView'),
                          reports: () => import('@/components/ReportsView'),
                        };
                        map[item.view]?.();
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {filteredDigitalItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-theme-muted text-xs uppercase tracking-wider px-3 py-2 font-semibold flex items-center gap-2">
              <Megaphone className="h-3.5 w-3.5 opacity-80" />
              Presença digital
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredDigitalItems.map((item) => (
                  <SidebarMenuItem key={item.view}>
                    <SidebarMenuButton
                      asChild
                      isActive={currentView === item.view}
                      className={`
                      text-theme-secondary hover:text-theme-primary transition-all duration-200
                      ${theme === 'dark' ? 'hover:bg-gray-800/70' : 'hover:bg-gray-100'}
                      ${
                        currentView === item.view
                          ? theme === 'dark'
                            ? 'bg-gradient-to-r from-blue-600/20 to-blue-700/20 text-white border-l-2 border-blue-500'
                            : 'bg-gradient-to-r from-gray-900/5 to-gray-900/0 text-gray-900 border-l-2 border-gray-900/60 font-semibold'
                          : ''
                      }
                    `}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onViewChange(item.view);
                          navigate(`/${item.view}`);
                        }}
                        onMouseEnter={() => {
                          import('@/components/MarketingView');
                          import('@/components/MarketingLandingPagesView');
                        }}
                        className="flex items-center gap-3 w-full px-3 py-2 pl-4"
                      >
                        <item.icon className="h-4 w-4 shrink-0 opacity-90" />
                        <span>{item.title}</span>
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="text-theme-muted text-xs uppercase tracking-wider px-3 py-2 font-semibold">
            Analytics
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredAnalyticsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={currentView === item.view}
                    className={`
                      text-theme-secondary hover:text-theme-primary transition-all duration-200
                      ${theme === 'dark' ? 'hover:bg-gray-800/70' : 'hover:bg-gray-100'}
                      ${currentView === item.view
                        ? theme === 'dark'
                          ? 'bg-gradient-to-r from-blue-600/20 to-blue-700/20 text-white border-l-2 border-blue-500'
                          : 'bg-gradient-to-r from-gray-900/5 to-gray-900/0 text-gray-900 border-l-2 border-gray-900/60 font-semibold'
                        : ''
                      }
                    `}
                  >
                    <button
                      onClick={() => {
                        onViewChange(item.view);
                        navigate(`/${item.view}`);
                      }}
                      onMouseEnter={() => {
                        const map: Record<string, () => Promise<any>> = {
                          reports: () => import('@/components/ReportsView'),
                          dashboard: () => import('@/components/DashboardContent'),
                        };
                        map[item.view]?.();
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-theme-muted text-xs uppercase tracking-wider px-3 py-2 font-semibold">
            Outros
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredSecondaryItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={('view' in item) && currentView === item.view}
                    className={`
                      text-theme-secondary hover:text-theme-primary transition-all duration-200
                      ${theme === 'dark' ? 'hover:bg-gray-800/70' : 'hover:bg-gray-100'}
                      ${('view' in item) && currentView === item.view
                        ? theme === 'dark'
                          ? 'bg-gradient-to-r from-blue-600/20 to-blue-700/20 text-white border-l-2 border-blue-500'
                          : 'bg-gradient-to-r from-gray-900/5 to-gray-900/0 text-gray-900 border-l-2 border-gray-900/60 font-semibold'
                        : ''
                      }
                    `}
                  >
                    <button
                      onClick={() => {
                        if ('view' in item) {
                          onViewChange(item.view);
                          navigate(`/${item.view}`);
                        }
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-theme-primary bg-theme-secondary">
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-theme-tertiary hover:opacity-90 transition-colors">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-medium text-white">{avatarLetter}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-theme-primary truncate">{displayName}</p>
              <div className="mt-0.5 flex items-center gap-2">
                <p className="text-xs text-theme-muted truncate max-w-[12rem]">{user?.email}</p>
                {profile?.role && (
                  <span
                    className={`text-[10px] leading-4 px-2 py-0.5 rounded-full whitespace-nowrap ${roleClassMap[profile.role]}`}
                    title={roleLabelMap[profile.role]}
                  >
                    {roleLabelMap[profile.role]}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="px-1 text-[10px] text-theme-muted text-center" title="Versão da aplicação">
              Versão 1.0.0
            </div>

            <Button
              onClick={toggleTheme}
              variant="outline"
              className="w-full border-theme-primary text-theme-secondary hover:bg-theme-tertiary transition-all"
            >
              {theme === 'dark' ? (
                <><Sun className="mr-2 h-4 w-4 text-yellow-400" /> Modo Claro</>
              ) : (
                <><Moon className="mr-2 h-4 w-4 text-blue-400" /> Modo Escuro</>
              )}
            </Button>

            <Button
              onClick={async () => {
                await supabase.auth.signOut();
              }}
              variant="outline"
              className="w-full border-theme-primary text-red-400 hover:text-red-300 hover:bg-theme-tertiary"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}