import { Building2, BarChart3, Settings, Users, TrendingUp, Calendar, Wifi, LogOut, UserCheck, Database, ShieldCheck, Bot, MessageSquare, Globe, Layers, KeyRound, Sun, Moon, Smartphone } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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
import { useOwnCompany } from '@/hooks/useOwnCompany';

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
  {
    title: 'Visitas ao site',
    view: 'marketing-visitas' as const,
    icon: TrendingUp,
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
  {
    title: "Configuração para IA",
    url: "#",
    icon: Bot,
    view: "ai-configuration" as const,
    permissionKey: "menu_configurations",
  },
  {
    title: "Testar IA",
    url: "#",
    icon: Smartphone,
    view: "ai-test" as const,
    permissionKey: "menu_configurations",
  },
  {
    title: "API Leads n8n",
    url: "#",
    icon: KeyRound,
    view: "n8n-leads-api" as const,
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
      | 'ai-configuration'
      | 'ai-test'
      | 'profile'
      | 'marketing'
      | 'marketing-site'
      | 'marketing-lps'
      | 'marketing-visitas'
      | 'partnerships'
      | 'n8n-leads-api'
  ) => void;
}

export function AppSidebar({ currentView, onViewChange }: AppSidebarProps) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const { profile, isAdmin } = useUserProfile();
  const { hasPermission, forceRefreshPermissions } = usePermissions();
  const { settings } = useCompanySettings();
  const { theme, toggleTheme } = useTheme();
  const { company } = useOwnCompany();
  const companyPlanRaw = String(company?.plan || 'essential').toLowerCase();
  const normalizePlan = (plan: string): 'essential' | 'growth' | 'professional' => {
    // Compatibilidade com legado: "basic" e "enterprise" convergem para os planos atuais
    if (plan === 'basic' || plan === 'basico' || plan === 'essentials') return 'essential';
    if (plan === 'pro' || plan === 'enterprise' || plan === 'profissional') return 'professional';
    if (plan === 'growth') return 'growth';
    if (plan === 'professional') return 'professional';
    return 'essential';
  };
  const companyPlan = normalizePlan(companyPlanRaw);
  const planTier: Record<typeof companyPlan, number> = {
    essential: 1,
    growth: 2,
    professional: 3,
  };
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
      ? Math.max(rawLogoSize, 112)
      : 120;

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

    // Restrições por plano
    // "Usuários" — só Growth e Professional
    if (item.view === 'users' && planTier[companyPlan] < 2) return false;

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
    // Relatórios — só Growth e Professional
    if (item.view === 'reports' && planTier[companyPlan] < 2) return false;
    return hasAccess;
  });

  const filteredDigitalItems = digitalPresenceItems.filter((item) => {
    if (!profile) return false;
    // Presença Digital (site, marketing, LPs) — Professional ou superior
    if (planTier[companyPlan] < 3) return false;
    return hasPermission(item.permissionKey);
  });

  const filteredSecondaryItems = secondaryItems.filter(item => {
    if (!('permissionKey' in item) || !item.permissionKey) return true;
    if (!profile) return false;

    // Verificação especial para o módulo de permissões
    if (item.permissionKey === 'menu_permissions') {
      // Permissões — só Growth ou superior
      if (planTier[companyPlan] < 2) return false;
      return canAccessPermissionsModule(profile.role);
    }

    return hasPermission(item.permissionKey);
  });

  const navButtonClass = (active: boolean) =>
    [
      'rounded-lg text-[13px] font-medium transition-colors duration-150',
      'text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent',
      'dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-white/[0.06]',
      active
        ? [
            'bg-emerald-100 text-emerald-900 hover:bg-emerald-100 hover:text-emerald-900',
            'data-[active=true]:bg-emerald-100 data-[active=true]:text-emerald-900',
            'dark:bg-emerald-950/80 dark:text-emerald-50 dark:hover:bg-emerald-950/90 dark:hover:text-emerald-50',
            'dark:data-[active=true]:bg-emerald-950/80 dark:data-[active=true]:text-emerald-50',
            'dark:shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]',
          ].join(' ')
        : 'data-[active=true]:bg-transparent data-[active=true]:text-sidebar-foreground/65 dark:data-[active=true]:text-zinc-400',
    ].join(' ');

  const sectionLabelClass =
    'text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/45 dark:text-zinc-500 px-3 py-2 font-semibold';

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <SidebarHeader className="px-4 py-6 border-b border-sidebar-border bg-sidebar min-h-[132px] flex flex-col justify-center">
        <div className="flex flex-col items-center gap-3 w-full">
          {settings?.logo_url ? (
            <img
              src={settings.logo_url}
              alt="Logo da empresa"
              style={{
                height: `${sidebarLogoHeightPx}px`,
                width: 'auto',
                maxHeight: '152px',
              }}
              className="rounded-xl object-contain"
            />
          ) : (
            <div className="flex w-full items-center justify-center gap-3 px-1">
              <img
                src="/brand-mark.png"
                alt=""
                className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14"
                aria-hidden
              />
              <div className="min-w-0 text-left">
                <p
                  className="truncate text-base font-semibold leading-tight tracking-tight text-sidebar-foreground sm:text-lg"
                  style={{
                    fontFamily: nameFont || undefined,
                    fontSize: nameSize ? `${Math.max(nameSize, 18)}px` : undefined,
                    color: nameColor || undefined,
                    fontWeight: nameBold ? 700 : 600,
                  }}
                >
                  {companyDisplayName || 'IAFÉ IMOBI'}
                </p>
                {(companyDisplaySubtitle || 'Gestão Imobiliária') && (
                  <p
                    className="mt-0.5 truncate text-xs text-sidebar-foreground/55"
                    style={{
                      fontFamily: subtitleFont || undefined,
                      fontSize: subtitleSize ? `${subtitleSize}px` : undefined,
                      color: subtitleColor || undefined,
                      fontWeight: subtitleBold ? 600 : 400,
                    }}
                  >
                    {companyDisplaySubtitle || 'Gestão Imobiliária'}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2.5 bg-sidebar">
        <SidebarGroup>
          <SidebarGroupLabel className={sectionLabelClass}>Operação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {filteredMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={currentView === item.view}
                    className={navButtonClass(currentView === item.view)}
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
                                company_name: settings.display_name,
                              }),
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
                          'n8n-leads-api': () => import('@/components/N8nLeadsApiView'),
                        };
                        map[item.view]?.();
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2"
                    >
                      <item.icon className="h-4 w-4 shrink-0 opacity-90" />
                      <span className="truncate">{item.title}</span>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {filteredDigitalItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className={`${sectionLabelClass} flex items-center gap-2`}>
              Presença digital
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {filteredDigitalItems.map((item) => (
                  <SidebarMenuItem key={item.view}>
                    <SidebarMenuButton
                      asChild
                      isActive={currentView === item.view}
                      className={navButtonClass(currentView === item.view)}
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
                        className="flex items-center gap-3 w-full px-3 py-2"
                      >
                        <item.icon className="h-4 w-4 shrink-0 opacity-90" />
                        <span className="truncate">{item.title}</span>
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className={sectionLabelClass}>Analytics</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {filteredAnalyticsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={currentView === item.view}
                    className={navButtonClass(currentView === item.view)}
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
                      <item.icon className="h-4 w-4 shrink-0 opacity-90" />
                      <span className="truncate">{item.title}</span>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className={sectionLabelClass}>Sistema</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {filteredSecondaryItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={'view' in item && currentView === item.view}
                    className={navButtonClass('view' in item && currentView === item.view)}
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
                      <item.icon className="h-4 w-4 shrink-0 opacity-90" />
                      <span className="truncate">{item.title}</span>
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border bg-sidebar">
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/60 dark:bg-zinc-900/90 dark:border-zinc-800 px-3 py-2.5">
            <div className="h-9 w-9 rounded-full bg-emerald-800 flex items-center justify-center overflow-hidden shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-semibold text-emerald-50">{avatarLetter}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{displayName}</p>
              {profile?.role && (
                <p
                  className="text-[10px] uppercase tracking-wide text-sidebar-foreground/50 dark:text-zinc-500 truncate"
                  title={roleLabelMap[profile.role]}
                >
                  {roleLabelMap[profile.role]}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              onClick={toggleTheme}
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 border-sidebar-border bg-background/50 text-sidebar-foreground hover:bg-sidebar-accent dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
                  <span className="truncate">Tema claro</span>
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">Tema escuro</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
              }}
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 border-sidebar-border bg-background/50 text-destructive hover:bg-destructive/10 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-red-400/90 dark:hover:bg-red-950/40 dark:hover:text-red-300 dark:hover:border-red-900/50"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Sair</span>
            </Button>
          </div>

          <div className="px-1 text-[10px] text-sidebar-foreground/40 dark:text-zinc-600 text-center" title="Versão da aplicação">
            v1.0.0
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}