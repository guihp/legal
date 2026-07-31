import { SidebarTrigger } from "@/components/ui/sidebar";
import { Bell, Settings, LogOut, User as UserIcon, Image as ImageIcon, Mail, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input as TextInput } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

function notificationRoute(n: Notification): string | null {
  const meta = n.meta || n.data || {};
  const route = typeof meta.route === "string" ? meta.route : null;
  if (route) return route;
  if (n.type === "appointment") return "/agenda";
  if (n.type === "lead_stage_changed") return "/clients";
  if (n.type.startsWith("connection_")) return "/connections";
  return null;
}

export function DashboardHeader() {
  const navigate = useNavigate();
  const { profile, updateProfile } = useUserProfile();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const [openProfile, setOpenProfile] = useState(false);
  const [openEmail, setOpenEmail] = useState(false);
  const [openPassword, setOpenPassword] = useState(false);
  const [openNotifications, setOpenNotifications] = useState(false);

  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
      setAvatarUrl(profile.avatar_url || "");
    }
  }, [profile]);

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const saveProfile = async () => {
    await updateProfile({ full_name: fullName, phone, avatar_url: avatarUrl });
    setOpenProfile(false);
  };

  const changeEmail = async () => {
    if (!newEmail) return;
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (!error) setOpenEmail(false);
  };

  const changePassword = async () => {
    if (!newPassword || newPassword.length < 6) return;
    if (newPassword !== confirmPassword) return;
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) setOpenPassword(false);
  };

  const handleNavigateToProfile = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate("/profile");
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    const route = notificationRoute(notification);
    setOpenNotifications(false);
    if (route) navigate(route);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm sm:px-6 sm:py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <SidebarTrigger className="text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => navigate("/configurations")}
            title="Configurações"
          >
            <Settings className="h-5 w-5" />
          </Button>

          <Popover open={openNotifications} onOpenChange={setOpenNotifications}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Notificações"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[min(100vw-2rem,22rem)] border-border bg-popover p-0 text-popover-foreground shadow-lg"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                <div className="flex items-center gap-2 font-medium">
                  <Bell className="h-4 w-4" />
                  Notificações
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-emerald-800 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {unreadCount}
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void markAllAsRead()}
                    className="h-7 px-2 text-xs text-emerald-800 hover:text-emerald-900 dark:text-emerald-400"
                  >
                    Marcar todas
                  </Button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-3 py-10 text-center text-sm text-muted-foreground">
                    <Bell className="mx-auto mb-2 h-10 w-10 opacity-30" />
                    Nenhuma notificação
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      className={cn(
                        "w-full border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/60",
                        !notification.is_read && "bg-emerald-50/80 dark:bg-emerald-950/30",
                      )}
                      onClick={() => void handleNotificationClick(notification)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {notification.title}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                            {notification.body || notification.message}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground/80">
                            {new Date(notification.created_at).toLocaleString("pt-BR")}
                          </p>
                        </div>
                        {!notification.is_read && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-600" />
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-emerald-800 ring-2 ring-emerald-800/20"
                aria-label="Menu do usuário"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserIcon className="h-4 w-4 text-emerald-50" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-border bg-popover text-popover-foreground">
              <DropdownMenuItem asChild>
                <button onClick={handleNavigateToProfile} className="flex w-full items-center text-left">
                  <UserIcon className="mr-2 h-4 w-4" /> Editar Perfil
                </button>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setOpenEmail(true)}>
                <Mail className="mr-2 h-4 w-4" /> Alterar Email
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setOpenPassword(true)}>
                <KeyRound className="mr-2 h-4 w-4" /> Alterar Senha
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  await supabase.auth.signOut();
                }}
              >
                <LogOut className="mr-2 h-4 w-4" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={openProfile} onOpenChange={setOpenProfile}>
        <DialogContent className="max-w-md border-border bg-background">
          <DialogHeader>
            <DialogTitle>Meu Perfil</DialogTitle>
            <DialogDescription>Atualize suas informações pessoais.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <TextInput
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nome completo"
            />
            <TextInput
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Telefone"
            />
            <div className="flex gap-2">
              <ImageIcon className="mt-2 h-4 w-4 text-muted-foreground" />
              <TextInput
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="URL da foto de perfil (opcional)"
                className="flex-1"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={saveProfile} className="bg-emerald-800 text-white hover:bg-emerald-900">
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openEmail} onOpenChange={setOpenEmail}>
        <DialogContent className="max-w-md border-border bg-background">
          <DialogHeader>
            <DialogTitle>Alterar Email</DialogTitle>
            <DialogDescription>Defina um novo email para sua conta.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <TextInput
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="novo@email.com"
            />
            <div className="flex justify-end">
              <Button onClick={changeEmail} className="bg-emerald-800 text-white hover:bg-emerald-900">
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openPassword} onOpenChange={setOpenPassword}>
        <DialogContent className="max-w-md border-border bg-background">
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
            <DialogDescription>Defina uma nova senha para sua conta.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <TextInput
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nova senha (mínimo 6 caracteres)"
            />
            <TextInput
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmar nova senha"
            />
            <div className="flex justify-end">
              <Button onClick={changePassword} className="bg-emerald-800 text-white hover:bg-emerald-900">
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
