import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Checkbox } from './ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Loader2,
  CheckCircle,
  Key,
  Mail,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../integrations/supabase/client';
import { cn } from '@/lib/utils';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

const REMEMBER_EMAIL_KEY = 'iafe-login-remember-email';

const STATS = [
  { value: '128', label: 'IMÓVEIS GERIDOS' },
  { value: '338', label: 'LEADS NO MÊS' },
  { value: '24 h', label: 'ATENDIMENTO IA' },
] as const;

const FEATURES = [
  'Atendimento por IA 24 h no WhatsApp',
  'Agenda e plantão sincronizados com a equipe',
  'Relatórios de VGV e funil prontos para exportar',
] as const;

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordError, setForgotPasswordError] = useState<string | null>(null);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_EMAIL_KEY);
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const handleEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      if (data.user) {
        try {
          if (rememberMe) {
            localStorage.setItem(REMEMBER_EMAIL_KEY, email);
          } else {
            localStorage.removeItem(REMEMBER_EMAIL_KEY);
          }
        } catch {
          /* ignore */
        }

        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('is_active, role, company_id')
          .eq('id', data.user.id)
          .single();

        if (profileError || !profile || profile.is_active === false) {
          await supabase.auth.signOut();
          setError('Seu acesso está desativado. Entre em contato com o administrador.');
          return;
        }

        if (profile.role === 'super_admin') {
          onLoginSuccess();
          return;
        }

        const { data: accessData, error: accessError } = await supabase.rpc(
          'check_current_user_access'
        );

        if (accessError) {
          console.error('Erro ao verificar acesso da empresa:', accessError);
          onLoginSuccess();
          return;
        }

        if (accessData && accessData.length > 0) {
          const accessStatus = accessData[0];

          if (!accessStatus.can_access) {
            await supabase.auth.signOut();
            setError(accessStatus.message || 'Acesso bloqueado. Entre em contato com o suporte.');
            return;
          }

          if (accessStatus.is_grace_period) {
            setMessage(`⚠️ ${accessStatus.message}`);
          }
        }

        onLoginSuccess();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar solicitação';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordLoading(true);
    setForgotPasswordError(null);
    setForgotPasswordSuccess(false);

    try {
      if (!forgotPasswordEmail || !forgotPasswordEmail.includes('@')) {
        setForgotPasswordError('Por favor, insira um email válido');
        return;
      }

      const redirectUrl = `${window.location.origin}/reset-password`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        forgotPasswordEmail,
        { redirectTo: redirectUrl }
      );

      if (resetError) throw resetError;

      setForgotPasswordSuccess(true);
      setForgotPasswordEmail('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar email de recuperação';
      setForgotPasswordError(msg);
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F7F5F0]">
      {/* Left — marketing (desktop) */}
      <aside
        className="relative hidden lg:flex lg:w-1/2 flex-col justify-between overflow-hidden px-10 xl:px-14 py-10 text-white"
        style={{ backgroundColor: '#0C2919' }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          aria-hidden
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 15% 10%, rgba(52, 211, 153, 0.18), transparent 55%)',
          }}
        />

        <div className="relative z-10">
          <div className="flex items-center">
            <img
              src="/IMOBI-LOGO-(1).png"
              alt="IAFÉ IMOBI"
              className="h-16 max-h-16 w-auto max-w-[min(100%,280px)] object-contain"
            />
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mt-14 max-w-md text-[2rem] xl:text-[2.35rem] font-semibold leading-[1.15] tracking-tight"
            style={{ color: '#ffffff' }}
          >
            A operação inteira da sua imobiliária em um só lugar.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mt-4 max-w-md text-[15px] leading-relaxed text-emerald-100/65"
          >
            Portfólio, agenda, pipeline e o atendimento por IA no WhatsApp — com relatórios
            prontos para a diretoria.
          </motion.p>

          <div className="mt-10 grid grid-cols-3 gap-3 max-w-lg">
            {STATS.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-white/10 bg-black/25 px-3 py-3.5 backdrop-blur-sm"
              >
                <div className="text-xl font-semibold tabular-nums" style={{ color: '#111827' }}>
                  {stat.value}
                </div>
                <div className="mt-1 text-[9px] font-medium uppercase tracking-wider text-emerald-800">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          <ul className="mt-8 space-y-3">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm text-emerald-50/85">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                  <Check className="h-3 w-3 text-emerald-400" strokeWidth={3} />
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <footer className="relative z-10 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-emerald-100/40">
          <span>v1.0.0</span>
          <span aria-hidden>·</span>
          <span>© 2026 IAFÉ IMOBI</span>
          <span aria-hidden>·</span>
          <a href="#" className="hover:text-emerald-100/70 transition-colors">
            Termos
          </a>
          <span aria-hidden>·</span>
          <a href="#" className="hover:text-emerald-100/70 transition-colors">
            Privacidade
          </a>
        </footer>
      </aside>

      {/* Right — form */}
      <main className="relative flex flex-1 lg:w-1/2 flex-col items-center justify-center px-4 py-8 sm:px-8 bg-[#F7F5F0]">
        {/* Mobile brand */}
        <div className="mb-6 flex w-full max-w-[420px] items-center justify-center mx-auto lg:hidden">
          <img
            src="/IMOBI-LOGO-2.png"
            alt="IAFÉ IMOBI"
            className="h-20 max-h-20 w-auto max-w-[min(100%,280px)] object-contain"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-[420px]"
        >
          <div className="rounded-2xl border border-stone-200/80 bg-white p-6 sm:p-8 shadow-[0_8px_30px_rgba(28,40,30,0.06)]">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              Entrar na plataforma
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Use o e-mail corporativo cadastrado pela sua imobiliária.
            </p>

            <form onSubmit={handleEmailPassword} className="mt-6 space-y-5">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500"
                >
                  E-mail corporativo
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu.email@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="h-11 rounded-xl border-stone-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-emerald-700/30 focus-visible:border-emerald-800"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label
                    htmlFor="password"
                    className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500"
                  >
                    Senha
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(true);
                      setForgotPasswordEmail(email);
                    }}
                    className="text-xs font-medium text-emerald-800 hover:text-emerald-950 transition-colors"
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="h-11 rounded-xl border-stone-200 bg-white pr-20 text-slate-900 placeholder:text-slate-400 focus-visible:ring-emerald-700/30 focus-visible:border-emerald-800"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox
                    checked={rememberMe}
                    onCheckedChange={(v) => setRememberMe(v === true)}
                    id="remember"
                    className="border-stone-300 data-[state=checked]:bg-emerald-700 data-[state=checked]:border-emerald-700"
                  />
                  <span className="text-sm text-slate-700">Manter conectado</span>
                </label>
                <span className="text-xs text-slate-400">30 dias</span>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    <Alert variant="destructive" className="rounded-xl bg-red-50 border-red-200">
                      <AlertDescription className="text-red-800">{error}</AlertDescription>
                    </Alert>
                  </motion.div>
                )}
                {message && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    <Alert className="rounded-xl bg-emerald-50 border-emerald-200">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      <AlertDescription className="text-emerald-900">{message}</AlertDescription>
                    </Alert>
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                type="submit"
                disabled={loading}
                className="btn-on-emerald w-full h-11 rounded-xl bg-emerald-900 hover:bg-emerald-800 font-medium shadow-sm"
                style={{ color: '#ffffff', backgroundColor: '#0C2919' }}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Acessar plataforma'
                )}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            Não tem acesso?{' '}
            <button
              type="button"
              className="font-semibold text-emerald-900 hover:text-emerald-950 transition-colors"
              onClick={() =>
                toast.info('Peça ao administrador da sua imobiliária para liberar o acesso.')
              }
            >
              Fale com o administrador
            </button>
          </p>

          <p className="mt-4 text-center text-[11px] text-slate-400 lg:hidden">
            v1.0.0 · © 2026 IAFÉ IMOBI
          </p>
        </motion.div>
      </main>

      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="max-w-md bg-white border-stone-200 text-slate-900">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold flex items-center gap-2 text-slate-900">
              <Key className="w-5 h-5 text-emerald-800" />
              Recuperar Senha
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              Digite seu email e enviaremos um link para redefinir sua senha
            </DialogDescription>
          </DialogHeader>

          {forgotPasswordSuccess ? (
            <div className="space-y-4">
              <Alert className="bg-emerald-50 border-emerald-200">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <AlertDescription className="text-emerald-900">
                  <strong>Email enviado com sucesso!</strong>
                  <br />
                  Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
                  <br />
                  <span className="text-sm mt-2 block text-emerald-800">
                    O link expira em 1 hora.
                  </span>
                </AlertDescription>
              </Alert>
              <Button
                onClick={() => {
                  setShowForgotPassword(false);
                  setForgotPasswordSuccess(false);
                }}
                className="btn-on-emerald w-full bg-emerald-900 hover:bg-emerald-800"
                style={{ color: '#ffffff', backgroundColor: '#0C2919' }}
              >
                Fechar
              </Button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email" className="text-slate-700">
                  Email
                </Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="seu.email@empresa.com"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  className="bg-white border-stone-200 text-slate-900 placeholder:text-slate-400 focus-visible:border-emerald-800"
                  required
                  disabled={forgotPasswordLoading}
                />
              </div>

              {forgotPasswordError && (
                <Alert variant="destructive" className="bg-red-50 border-red-200">
                  <AlertDescription className="text-red-800">
                    {forgotPasswordError}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotPasswordError(null);
                    setForgotPasswordEmail('');
                  }}
                  className="flex-1 border-stone-300 text-slate-700 hover:bg-stone-50"
                  disabled={forgotPasswordLoading}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="btn-on-emerald flex-1 bg-emerald-900 hover:bg-emerald-800"
                  style={{ color: '#ffffff', backgroundColor: '#0C2919' }}
                  disabled={forgotPasswordLoading}
                >
                  {forgotPasswordLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Enviar Link
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
