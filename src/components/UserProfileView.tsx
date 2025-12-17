import { useState, useEffect } from 'react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { KeyRound, Mail, Upload, Camera } from 'lucide-react';
import { toast } from 'sonner';

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

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setAvatarUrl(profile.avatar_url || '');
      setEmail(profile.email || '');
    }
  }, [profile]);

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file) {
        console.log('Nenhum arquivo selecionado');
        return;
      }
      
      console.log('Iniciando upload do arquivo:', file.name);
      setUploading(true);
      setError(null);

      // Validações do arquivo
      const maxSize = 2 * 1024 * 1024; // 2MB
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

      if (file.size > maxSize) {
        throw new Error('Arquivo muito grande. Máximo 2MB.');
      }

      if (!allowedTypes.includes(file.type)) {
        throw new Error('Formato não suportado. Use JPG, PNG, WebP ou GIF.');
      }

      // Verificar se o bucket existe (apenas verificação, não criação)
      console.log('🔍 Verificando bucket avatars...');
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      if (bucketsError) {
        console.warn('⚠️ Não foi possível verificar buckets:', bucketsError);
        // Continuar mesmo assim, pois o bucket pode existir
      } else {
        const avatarsBucket = buckets.find(bucket => bucket.name === 'avatars');
        if (avatarsBucket) {
          console.log('✅ Bucket avatars encontrado');
        } else {
          console.warn('⚠️ Bucket avatars não encontrado na listagem, mas tentando upload mesmo assim');
        }
      }
      
      const fileExt = file.name.split('.').pop();
      const filePath = `${profile?.id}/${Date.now()}.${fileExt}`;
      console.log('Caminho do arquivo:', filePath);

      console.log('📤 Iniciando upload para bucket avatars...');
      const { error: upErr } = await supabase.storage.from('avatars').upload(filePath, file, {
        upsert: true,
        contentType: file.type,
      });
      
      if (upErr) {
        console.error('❌ Erro no upload:', upErr);
        
        // Mensagens de erro mais específicas
        if (upErr.message?.includes('Bucket not found')) {
          throw new Error('Bucket de avatars não configurado. Entre em contato com o administrador.');
        } else if (upErr.message?.includes('policy')) {
          throw new Error('Sem permissão para upload. Verifique se você está logado corretamente.');
        } else if (upErr.message?.includes('size')) {
          throw new Error('Arquivo muito grande. Máximo permitido: 2MB.');
        } else {
          throw new Error(`Erro no upload: ${upErr.message || 'Erro desconhecido'}`);
        }
      }

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(filePath);
      let url = pub?.publicUrl || '';
      
      // Adicionar timestamp para evitar cache do browser
      if (url) {
        url += `?t=${Date.now()}`;
      }
      
      console.log('URL pública gerada:', url);
      
      setAvatarUrl(url);
      
      const updatedProfile = await updateProfile({ avatar_url: url });
      console.log('✅ Perfil atualizado com nova URL:', updatedProfile);
      
      toast.success('Avatar atualizado com sucesso!');
    } catch (e: any) {
      console.error('Erro completo:', e);
      setError(e.message || 'Erro ao enviar avatar');
      toast.error(e.message || 'Erro ao enviar avatar');
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    try {
      setSavingProfile(true);
      setError(null);
      await updateProfile({ full_name: fullName, phone, avatar_url: avatarUrl });
      toast.success('✅ Perfil salvo com sucesso!');
    } catch (e: any) {
      const errorMsg = e.message || 'Erro ao salvar perfil';
      setError(errorMsg);
      toast.error(`❌ ${errorMsg}`);
    } finally {
      setSavingProfile(false);
    }
  };

  const changeEmail = async () => {
    try {
      setSavingEmail(true);
      setError(null);
      if (!newEmail) throw new Error('Informe o novo email');
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      setNewEmail('');
      toast.success('📧 Email atualizado! Verifique sua caixa de entrada para confirmar.');
    } catch (e: any) {
      const errorMsg = e.message || 'Erro ao alterar email';
      setError(errorMsg);
      toast.error(`❌ ${errorMsg}`);
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
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      toast.success('🔒 Senha alterada com sucesso!');
    } catch (e: any) {
      const errorMsg = e.message || 'Erro ao alterar senha';
      setError(errorMsg);
      toast.error(`❌ ${errorMsg}`);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Meu Perfil</h1>

      {error && (
        <div className="text-sm text-red-400">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Perfil Básico */}
        <Card className="bg-gray-800/50 border-gray-700 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-white">Informações Pessoais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Nome Completo</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="bg-gray-900/50 border-gray-700 text-white" />
              </div>
              <div>
                <Label className="text-gray-300">Telefone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-gray-900/50 border-gray-700 text-white" />
              </div>
            </div>
            <div>
              <Label className="text-white">Avatar (upload)</Label>
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center overflow-hidden">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white font-semibold">{(fullName?.charAt(0) || 'U').toUpperCase()}</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleUploadAvatar} 
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
                      className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 cursor-pointer"
                      asChild
                    >
                      <span className="flex items-center gap-2">
                        <Camera className="h-4 w-4" />
                        {uploading ? 'Enviando...' : 'Escolher foto'}
                      </span>
                    </Button>
                  </label>
                  {avatarUrl && !uploading && (
                    <a href={avatarUrl} target="_blank" className="text-blue-400 text-sm hover:text-blue-300">
                      Ver imagem atual
                    </a>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={saveProfile} disabled={savingProfile} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                {savingProfile ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Email e Senha */}
        <div className="space-y-6">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Mail className="h-4 w-4" /> Email</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-gray-400">Email atual</Label>
                <div className="text-white text-sm break-all">{email}</div>
              </div>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="novo@email"
                className="bg-gray-900/50 border-gray-700 text-white" />
              <Button onClick={changeEmail} disabled={savingEmail} className="w-full bg-gray-700 hover:bg-gray-600">
                {savingEmail ? 'Salvando...' : 'Alterar Email'}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><KeyRound className="h-4 w-4" /> Senha</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nova senha"
                className="bg-gray-900/50 border-gray-700 text-white" />
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirmar senha"
                className="bg-gray-900/50 border-gray-700 text-white" />
              <Button onClick={changePassword} disabled={savingPassword} className="w-full bg-gray-700 hover:bg-gray-600">
                {savingPassword ? 'Salvando...' : 'Alterar Senha'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


