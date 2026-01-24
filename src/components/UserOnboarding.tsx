import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Alert, AlertDescription } from "./ui/alert";
import { 
  Building2, 
  User, 
  Phone, 
  Mail, 
  Briefcase,
  MapPin,
  CheckCircle,
  ArrowRight,
  Loader2
} from "lucide-react";
import { useUserProfile } from '@/hooks/useUserProfile';
import { supabase } from '@/integrations/supabase/client';

interface UserOnboardingProps {
  onComplete: () => void;
}

export function UserOnboarding({ onComplete }: UserOnboardingProps) {
  const { user, createProfile } = useUserProfile();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    full_name: user?.user_metadata?.full_name || '',
    role: 'corretor' as 'corretor' | 'gestor' | 'admin',
    department: '',
    phone: '',
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleComplete = async () => {
    if (!formData.full_name.trim()) {
      setError('Nome completo é obrigatório');
      return;
    }
    if (!formData.role) {
      setError('Selecione seu cargo');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Criar o perfil do usuário (sem empresa)
      await createProfile({
        full_name: formData.full_name,
        role: formData.role,
        department: formData.department || undefined,
        phone: formData.phone || undefined,
      });

      onComplete();

    } catch (error: any) {
      console.error('Erro no onboarding:', error);
      setError(error.message || 'Erro ao completar configuração');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        <Card className="bg-gray-900/95 border-gray-700 backdrop-blur-sm">
          <CardHeader className="text-center">
            <motion.div 
              className="mx-auto mb-4 h-16 w-16 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center"
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Building2 className="h-8 w-8 text-white" />
            </motion.div>
            
            <CardTitle className="text-2xl font-bold text-white">
              Bem-vindo ao IAFÉ IMOBI!
            </CardTitle>
            <CardDescription className="text-gray-400">
              Configure suas informações pessoais para começar
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div className="text-center mb-6">
                <User className="h-12 w-12 text-blue-400 mx-auto mb-2" />
                <h3 className="text-lg font-semibold text-white">Informações Pessoais</h3>
                <p className="text-gray-400 text-sm">Conte-nos sobre você</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name" className="text-gray-300">Nome Completo *</Label>
                  <Input
                    id="full_name"
                    placeholder="Seu nome completo"
                    value={formData.full_name}
                    onChange={(e) => handleInputChange('full_name', e.target.value)}
                    className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role" className="text-gray-300">Cargo *</Label>
                  <Select value={formData.role} onValueChange={(value) => handleInputChange('role', value)}>
                    <SelectTrigger className="bg-gray-800/50 border-gray-600 text-white">
                      <SelectValue placeholder="Selecione seu cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corretor">Corretor</SelectItem>
                      <SelectItem value="gestor">Gestor</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department" className="text-gray-300">Departamento</Label>
                  <Input
                    id="department"
                    placeholder="Ex: Vendas, Locação, Comercial"
                    value={formData.department}
                    onChange={(e) => handleInputChange('department', e.target.value)}
                    className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-gray-300">Telefone</Label>
                  <Input
                    id="phone"
                    placeholder="(11) 99999-9999"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button 
                  onClick={handleComplete}
                  disabled={loading}
                  className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Configurando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Finalizar Configuração
                    </>
                  )}
                </Button>
              </div>
            </motion.div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Alert variant="destructive" className="bg-red-900/30 border-red-500/60">
                  <AlertDescription className="text-red-200">{error}</AlertDescription>
                </Alert>
              </motion.div>
            )}
          </CardContent>
        </Card>

        <motion.div 
          className="text-center mt-6 text-gray-400 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <p>Seus dados estão seguros e protegidos. 🔒</p>
        </motion.div>
      </motion.div>
    </div>
  );
} 