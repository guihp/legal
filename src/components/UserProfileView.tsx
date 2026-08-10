import { useState, useEffect, type ReactNode } from 'react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Camera, KeyRound, Loader2, Mail, User } from 'lucide-react';
import { toast } from 'sonner';
import { PersonalAppSettings } from '@/components/configurations/PersonalAppSettings';
import { AvatarCropDialog } from '@/components/AvatarCropDialog';

const inputClass =
  'rounded-xl border-border bg-background h-10 shadow-none focus-visible:ring-emerald-700/30';

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1.5">
      <Label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {children}
      </Label>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  description,
  children,
  className = '',
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-border/70 bg-white dark:bg-card p-4 sm:p-5 shadow-sm space-y-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function UserProfileView() {
  const { profile, updateProfile } = useUserProfile();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [email, setEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState('avatar.jpg');

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setAvatarUrl(profile.avatar_url || '');
      setEmail(profile.email || '');
    }
  }, [profile]);

  useEffect(() => {
    return () => {
      if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
    };
  }, [cropImageSrc]);

  const closeCropDialog = (open: boolean) => {
    setCropOpen(open);
    if (!open && cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc(null);
    }
  };

  const handlePickAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;

      const maxSize = 8 * 1024 * 1024; // allow larger source; export stays ≤2MB
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

      if (file.size > maxSize) {
        throw new Error('Arquivo muito grande. Máximo 8MB para edição.');
      }
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Formato não suportado. Use JPG, PNG, WebP ou GIF.');
      }

      if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
      const src = URL.createObjectURL(file);
      setCropFileName(file.name || 'avatar.jpg');
      setCropImageSrc(src);
      setCropOpen(true);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao selecionar imagem';
      setError(message);
      toast.error(message);
    }
  };

  const handleUploadCroppedAvatar = async (file: File) => {
    try {
      setUploading(true);
      setError(null);

      const fileExt = file.name.split('.').pop() || (file.type === 'image/png' ? 'png' : 'jpg');
      const filePath = `${profile?.id}/${Date.now()}.${fileExt}`;

      const { error: upErr } = await supabase.storage.from('avatars').upload(filePath, file, {
        upsert: true,
        contentType: file.type,
      });

      if (upErr) {
        if (upErr.message?.includes('Bucket not found')) {
          throw new Error(
            'Bucket de avatars não configurado. Entre em contato com o administrador.',
          );
        } else if (upErr.message?.includes('policy')) {
          throw new Error(
            'Sem permissão para upload. Verifique se você está logado corretamente.',
          );
        } else if (upErr.message?.includes('size')) {
          throw new Error('Arquivo muito grande. Máximo permitido: 2MB.');
        } else {
          throw new Error(`Erro no upload: ${upErr.message || 'Erro desconhecido'}`);
        }
      }

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(filePath);
      let url = pub?.publicUrl || '';
      if (url) url += `?t=${Date.now()}`;

      setAvatarUrl(url);
      await updateProfile({ avatar_url: url });
      toast.success('Avatar atualizado com sucesso!');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro ao enviar avatar';
      setError(message);
      toast.error(message);
      throw e instanceof Error ? e : new Error(message);
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    try {
      setSavingProfile(true);
      setError(null);
      await updateProfile({ full_name: fullName, phone, avatar_url: avatarUrl });
      toast.success('Perfil salvo com sucesso!');
    } catch (e: any) {
      const errorMsg = e.message || 'Erro ao salvar perfil';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSavingProfile(false);
    }
  };

  const changeEmail = async () => {
    try {
      setSavingEmail(true);
      setError(null);
      if (!newEmail) throw new Error('Informe o novo email');
      const { error: authError } = await supabase.auth.updateUser({ email: newEmail });
      if (authError) throw authError;
      setNewEmail('');
      toast.success('Email atualizado! Verifique sua caixa de entrada para confirmar.');
    } catch (e: any) {
      const errorMsg = e.message || 'Erro ao alterar email';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSavingEmail(false);
    }
  };

  const changePassword = async () => {
    try {
      setSavingPassword(true);
      setError(null);
      if (!newPassword || newPassword.length < 6) throw new Error('Senha mínima de 6 caracteres');
      if (newPassword !== confirmPassword) throw new Error('Confirmação de senha não confere');
      const { error: authError } = await supabase.auth.updateUser({ password: newPassword });
      if (authError) throw authError;
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Senha alterada com sucesso!');
    } catch (e: any) {
      const errorMsg = e.message || 'Erro ao alterar senha';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="w-full bg-[#F7F5F0] dark:bg-background text-foreground relative flex flex-col min-w-0">
      <div className="border-b border-border/70">
        <div className="px-3 py-2 sm:px-5 sm:py-3 md:py-4">
          <div className="rounded-xl sm:rounded-2xl border border-border bg-card shadow-sm px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-4">
            <h1 className="text-2xl lg:text-[1.75rem] font-semibold tracking-tight text-foreground">
              Meu Perfil
            </h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
              Dados pessoais, acesso à conta e preferências do aplicativo neste aparelho
            </p>
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-5 space-y-4 bg-[#F7F5F0] dark:bg-background max-w-5xl mx-auto w-full">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          <SectionCard
            className="lg:col-span-2"
            icon={<User className="h-4 w-4" />}
            title="Informações pessoais"
            description="Nome, telefone e foto que aparecem no sistema"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-border/70 bg-muted/30 p-3 sm:p-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-border bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg font-semibold">
                    {(fullName?.charAt(0) || 'U').toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">Foto de perfil</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  JPG, PNG, WebP ou GIF · ajuste o enquadramento antes de salvar · máx. 2MB
                </p>
                {avatarUrl && !uploading ? (
                  <a
                    href={avatarUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-1.5 text-xs font-medium text-emerald-800 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-200"
                  >
                    Ver imagem atual
                  </a>
                ) : null}
              </div>
              <div className="shrink-0">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePickAvatar}
                  disabled={uploading}
                  className="hidden"
                  id="avatar-upload"
                />
                <label htmlFor="avatar-upload">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    className="rounded-xl h-9 border-border cursor-pointer"
                    asChild
                  >
                    <span className="flex items-center gap-2">
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                      {uploading ? 'Enviando...' : 'Escolher foto'}
                    </span>
                  </Button>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Nome completo</FieldLabel>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputClass}
                  placeholder="Seu nome"
                />
              </div>
              <div>
                <FieldLabel>Telefone</FieldLabel>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputClass}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="button"
                onClick={() => void saveProfile()}
                disabled={savingProfile}
                className="btn-on-emerald rounded-xl h-9 bg-emerald-800 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 shadow-sm"
                style={{ color: '#ffffff' }}
              >
                {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {savingProfile ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </div>
          </SectionCard>

          <div className="space-y-4">
            <SectionCard
              icon={<Mail className="h-4 w-4" />}
              title="Email"
              description="Altere o email de acesso à conta"
            >
              <div>
                <FieldLabel>Email atual</FieldLabel>
                <p className="text-sm text-foreground break-all rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5">
                  {email || '—'}
                </p>
              </div>
              <div>
                <FieldLabel>Novo email</FieldLabel>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="novo@email.com"
                  className={inputClass}
                />
              </div>
              <Button
                type="button"
                onClick={() => void changeEmail()}
                disabled={savingEmail}
                variant="outline"
                className="w-full rounded-xl h-9 border-border"
              >
                {savingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {savingEmail ? 'Salvando...' : 'Alterar email'}
              </Button>
            </SectionCard>

            <SectionCard
              icon={<KeyRound className="h-4 w-4" />}
              title="Senha"
              description="Mínimo de 6 caracteres"
            >
              <div>
                <FieldLabel>Nova senha</FieldLabel>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nova senha"
                  className={inputClass}
                />
              </div>
              <div>
                <FieldLabel>Confirmar senha</FieldLabel>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmar senha"
                  className={inputClass}
                />
              </div>
              <Button
                type="button"
                onClick={() => void changePassword()}
                disabled={savingPassword}
                variant="outline"
                className="w-full rounded-xl h-9 border-border"
              >
                {savingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {savingPassword ? 'Salvando...' : 'Alterar senha'}
              </Button>
            </SectionCard>
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Aplicativo e notificações
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Instale o app e escolha quais alertas você recebe neste aparelho.
            </p>
          </div>
          <PersonalAppSettings compact />
        </div>
      </div>

      <AvatarCropDialog
        open={cropOpen}
        imageSrc={cropImageSrc}
        sourceFileName={cropFileName}
        onOpenChange={closeCropDialog}
        onApply={handleUploadCroppedAvatar}
      />
    </div>
  );
}
