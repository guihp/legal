import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Alert, AlertDescription } from "./ui/alert";
import { Lock, CheckCircle, Loader2, Shield, ArrowRight } from "lucide-react";
import { supabase } from '../integrations/supabase/client';

export function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    // Verificar se há um hash de recuperação na URL
    const hash = window.location.hash;
    if (hash.includes('access_token') && hash.includes('type=recovery')) {
      // O Supabase já processou o token, podemos prosseguir
      console.log('Token de recuperação detectado');
    }
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validações
      if (!newPassword || newPassword.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres');
        setLoading(false);
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('As senhas não coincidem');
        setLoading(false);
        return;
      }

      // Atualizar senha usando o Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      setSuccess(true);
      
      // Redirecionar para login após 2 segundos
      setTimeout(() => {
        navigate('/');
      }, 2000);

    } catch (error: any) {
      setError(error.message || 'Erro ao redefinir senha. O link pode ter expirado.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950/90 to-slate-950 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Card className="bg-gray-900/85 backdrop-blur-2xl border-gray-700/60">
            <CardContent className="pt-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="flex flex-col items-center text-center space-y-4"
              >
                <div className="rounded-full bg-emerald-500/20 p-4">
                  <CheckCircle className="h-12 w-12 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    Senha Redefinida!
                  </h2>
                  <p className="text-gray-300">
                    Sua senha foi alterada com sucesso. Redirecionando para o login...
                  </p>
                </div>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950/90 to-slate-950 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card className="bg-gray-900/85 backdrop-blur-2xl border-gray-700/60">
          <CardHeader className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="flex justify-center mb-4"
            >
              <div className="rounded-full bg-gradient-to-br from-blue-600 to-purple-600 p-4">
                <Lock className="h-8 w-8 text-white" />
              </div>
            </motion.div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Redefinir Senha
            </CardTitle>
            <CardDescription className="text-gray-300">
              Digite sua nova senha abaixo
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-gray-200 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  Nova Senha
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-gray-800/60 border-gray-600/60 text-white placeholder-gray-400 focus:border-blue-500"
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-gray-200 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-purple-400" />
                  Confirmar Senha
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Digite a senha novamente"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-gray-800/60 border-gray-600/60 text-white placeholder-gray-400 focus:border-purple-500"
                  required
                  disabled={loading}
                />
              </div>

              {error && (
                <Alert variant="destructive" className="bg-red-900/30 border-red-500/60">
                  <AlertDescription className="text-red-200">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Redefinindo...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Redefinir Senha
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate('/')}
                className="w-full text-gray-400 hover:text-white"
              >
                Voltar para o login
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}








