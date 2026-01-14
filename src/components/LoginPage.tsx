import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Alert, AlertDescription } from "./ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { 
  Building2, 
  Mail, 
  Lock, 
  Loader2, 
  CheckCircle, 
  Home,
  Building,
  MapPin,
  Key,
  Shield,
  ArrowRight,
  Star,
  Sparkles,
  Zap,
  HelpCircle,
  X
} from "lucide-react";
import { supabase } from '../integrations/supabase/client';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

// Componente para as partículas flutuantes melhoradas
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

// Componente para efeito de vidro quebrado
const GlassShards = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {Array.from({ length: 12 }).map((_, i) => (
      <motion.div
        key={i}
        className="absolute bg-gradient-to-br from-white/5 to-transparent backdrop-blur-sm"
        style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          width: `${30 + Math.random() * 60}px`,
          height: `${30 + Math.random() * 60}px`,
          clipPath: "polygon(30% 0%, 0% 50%, 30% 100%, 100% 70%, 70% 30%)",
          transform: `rotate(${Math.random() * 360}deg)`
        }}
        animate={{
          opacity: [0, 0.4, 0],
          rotate: [0, 180, 360],
          scale: [0.8, 1.2, 0.8]
        }}
        transition={{
          duration: 8 + Math.random() * 6,
          delay: i * 0.7,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    ))}
  </div>
);

// Componente para os ícones de construção flutuantes melhorados
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

// Componente para o grid arquitetônico melhorado
const ArchitecturalGrid = () => (
  <div className="absolute inset-0 overflow-hidden">
    {/* Grid lines animadas mais complexas */}
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
              r: [1, 4, 1],
              opacity: [0.1, 0.4, 0.1]
            }}
            transition={{ duration: 3, repeat: Infinity }}
          />
        </pattern>
        
        <pattern id="hexGrid" width="100" height="87" patternUnits="userSpaceOnUse">
          <motion.polygon
            points="50,0 93.3,25 93.3,62 50,87 6.7,62 6.7,25"
            fill="none"
            stroke="rgba(16, 185, 129, 0.06)"
            strokeWidth="1"
            animate={{
              opacity: [0, 0.2, 0],
              strokeWidth: [0.5, 2, 0.5]
            }}
            transition={{ duration: 6, repeat: Infinity }}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
      <rect width="100%" height="100%" fill="url(#hexGrid)" opacity="0.5" />
    </svg>

    {/* Formas geométricas arquitetônicas mais elaboradas */}
    <motion.div
      className="absolute top-20 left-10 border border-blue-400/20"
      style={{ width: "120px", height: "120px" }}
      initial={{ opacity: 0, scale: 0, rotate: 0 }}
      animate={{ 
        opacity: [0, 0.4, 0],
        scale: [0, 1.1, 0],
        rotate: [0, 180, 360],
        borderRadius: ["0%", "50%", "0%"]
      }}
      transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
    />
    
    <motion.div
      className="absolute bottom-20 right-10 border-2 border-emerald-400/20"
      style={{ width: "80px", height: "140px" }}
      initial={{ opacity: 0, y: 50, skewY: 0 }}
      animate={{ 
        opacity: [0, 0.5, 0],
        y: [50, -20, 50],
        skewY: [-5, 5, -5],
        borderColor: [
          "rgba(16, 185, 129, 0.2)",
          "rgba(59, 130, 246, 0.2)",
          "rgba(147, 51, 234, 0.2)",
          "rgba(16, 185, 129, 0.2)"
        ]
      }}
      transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
    />

    {/* Triângulos decorativos */}
    <motion.div
      className="absolute top-1/2 left-1/4 w-0 h-0"
      style={{
        borderLeft: "40px solid transparent",
        borderRight: "40px solid transparent",
        borderBottom: "60px solid rgba(147, 51, 234, 0.1)"
      }}
      animate={{ 
        rotate: [0, 120, 240, 360],
        scale: [0.8, 1.3, 0.8],
        opacity: [0.1, 0.4, 0.1]
      }}
      transition={{ duration: 10, repeat: Infinity }}
    />

    {/* Círculos decorativos melhorados */}
    <motion.div
      className="absolute top-1/3 right-1/4 rounded-full border-2"
      style={{ width: "60px", height: "60px" }}
      animate={{ 
        scale: [1, 1.4, 1],
        opacity: [0.2, 0.6, 0.2],
        borderColor: [
          "rgba(59, 130, 246, 0.3)",
          "rgba(16, 185, 129, 0.3)",
          "rgba(147, 51, 234, 0.3)",
          "rgba(59, 130, 246, 0.3)"
        ],
        rotate: 360
      }}
      transition={{ duration: 8, repeat: Infinity }}
    />
  </div>
);

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [particles, setParticles] = useState<number[]>([]);
  
  // Estados para "Esqueci minha senha"
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordError, setForgotPasswordError] = useState<string | null>(null);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);

  // Gerar partículas variadas
  useEffect(() => {
    const particleArray = Array.from({ length: 25 }, (_, i) => i);
    setParticles(particleArray);
  }, []);

  const handleEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Verificar se o usuário está ativo no perfil antes de prosseguir
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('is_active, role, company_id')
          .eq('id', data.user.id)
          .single();

        // Se não existir perfil ou estiver inativo, impedir acesso
        if (profileError || !profile || profile.is_active === false) {
          await supabase.auth.signOut();
          setError('Seu acesso está desativado. Entre em contato com o administrador.');
          return;
        }

        // Super admin sempre pode acessar
        if (profile.role === 'super_admin') {
          onLoginSuccess();
          return;
        }

        // Verificar status da empresa usando a função RPC
        const { data: accessData, error: accessError } = await supabase
          .rpc('check_current_user_access');

        if (accessError) {
          console.error('Erro ao verificar acesso da empresa:', accessError);
          // Permitir acesso em caso de erro na verificação (para não bloquear por falha técnica)
          onLoginSuccess();
          return;
        }

        // Verificar resultado da verificação
        if (accessData && accessData.length > 0) {
          const accessStatus = accessData[0];
          
          if (!accessStatus.can_access) {
            await supabase.auth.signOut();
            setError(accessStatus.message || 'Acesso bloqueado. Entre em contato com o suporte.');
            return;
          }

          // Se está em período de carência, mostrar aviso mas permitir acesso
          if (accessStatus.is_grace_period) {
            setMessage(`⚠️ ${accessStatus.message}`);
          }
        }

        onLoginSuccess();
      }
    } catch (error: any) {
      setError(error.message || 'Erro ao processar solicitação');
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

      // Configurar URL de redirecionamento após reset
      const redirectUrl = `${window.location.origin}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail, {
        redirectTo: redirectUrl,
      });

      if (error) throw error;

      setForgotPasswordSuccess(true);
      setForgotPasswordEmail('');
    } catch (error: any) {
      setForgotPasswordError(error.message || 'Erro ao enviar email de recuperação');
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const particleTypes = ['default', 'star', 'spark', 'glow'];

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950/90 via-purple-950/80 to-slate-950">
      {/* Background arquitetônico animado */}
      <ArchitecturalGrid />
      
      {/* Luzes pulsantes */}
      <PulsingLights />
      
      {/* Efeito de vidro */}
      <GlassShards />
      
      {/* Partículas flutuantes variadas */}
      {particles.map((particle, index) => (
        <FloatingParticle 
          key={particle} 
          delay={index * 1.5} 
          duration={12 + Math.random() * 8}
          type={particleTypes[index % particleTypes.length]}
        />
      ))}

      {/* Ícones flutuantes com cores variadas */}
      <FloatingIcon Icon={Building2} delay={0} x={8} y={15} color="blue" />
      <FloatingIcon Icon={Home} delay={2} x={88} y={12} color="emerald" />
      <FloatingIcon Icon={Building} delay={4} x={12} y={75} color="purple" />
      <FloatingIcon Icon={MapPin} delay={6} x={85} y={78} color="yellow" />
      <FloatingIcon Icon={Key} delay={8} x={50} y={8} color="pink" />
      <FloatingIcon Icon={Star} delay={3} x={25} y={45} color="blue" />
      <FloatingIcon Icon={Sparkles} delay={7} x={75} y={40} color="purple" />
      <FloatingIcon Icon={Zap} delay={5} x={60} y={85} color="emerald" />

      {/* Overlay gradiente melhorado */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent via-purple-900/10 to-black/40" />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-900/5 to-transparent" />

      {/* Conteúdo principal */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.85, rotateX: 15 }}
          animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
          transition={{ 
            duration: 1.2, 
            ease: "easeOut",
            type: "spring",
            stiffness: 80
          }}
          className="w-full max-w-md"
        >
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-emerald-500/10 rounded-3xl blur-xl"
            animate={{
              opacity: [0.3, 0.6, 0.3],
              scale: [0.95, 1.05, 0.95]
            }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          
          <Card className="relative bg-gray-900/85 backdrop-blur-2xl border border-gray-700/60 shadow-2xl rounded-3xl overflow-hidden">
            {/* Borda animada */}
            <motion.div
              className="absolute inset-0 rounded-3xl"
              style={{
                background: "linear-gradient(45deg, transparent, rgba(59, 130, 246, 0.2), transparent, rgba(147, 51, 234, 0.2), transparent)",
                backgroundSize: "300% 300%"
              }}
              animate={{
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"]
              }}
              transition={{ duration: 6, repeat: Infinity }}
            />
            
            <div className="relative bg-gray-900/90 backdrop-blur-2xl m-0.5 rounded-3xl">
              <CardHeader className="text-center relative pt-8">
                <motion.div 
                  className="flex justify-center items-center mb-6"
                  whileHover={{ scale: 1.15, rotate: 10 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <motion.div 
                    className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-600 via-purple-600 to-emerald-600 shadow-2xl overflow-hidden"
                    animate={{ 
                      boxShadow: [
                        "0 0 30px rgba(59, 130, 246, 0.4), 0 0 60px rgba(147, 51, 234, 0.2)",
                        "0 0 60px rgba(147, 51, 234, 0.4), 0 0 90px rgba(59, 130, 246, 0.2)",
                        "0 0 30px rgba(59, 130, 246, 0.4), 0 0 60px rgba(147, 51, 234, 0.2)"
                      ]
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    {/* Efeito de brilho interno */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-transparent"
                      animate={{
                        opacity: [0.2, 0.5, 0.2],
                        rotate: [0, 180, 360]
                      }}
                      transition={{ duration: 4, repeat: Infinity }}
                    />
                    
                    <motion.div
                      className="relative flex items-center justify-center z-10"
                      animate={{ 
                        rotate: 360,
                        scale: [1, 1.1, 1]
                      }}
                      transition={{ 
                        rotate: { duration: 25, repeat: Infinity, ease: "linear" },
                        scale: { duration: 2, repeat: Infinity }
                      }}
                    >
                      <Building2 className="h-10 w-10 text-white drop-shadow-lg" />
                    </motion.div>
                  </motion.div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.8 }}
                >
                  <CardTitle className="text-4xl font-bold bg-gradient-to-r from-white via-blue-200 via-purple-200 to-white bg-clip-text text-transparent mb-2">
                    <motion.span
                      animate={{
                        backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"]
                      }}
                      transition={{ duration: 5, repeat: Infinity }}
                      className="bg-gradient-to-r from-white via-blue-200 via-purple-200 to-emerald-200 bg-clip-text text-transparent"
                      style={{ backgroundSize: "200% 200%" }}
                    >
                      ImobiPro Elite
                    </motion.span>
                  </CardTitle>
                  <CardDescription className="text-gray-300 text-lg">
                    <motion.span
                      animate={{ 
                        opacity: [0.6, 1, 0.6],
                        textShadow: [
                          "0 0 5px rgba(59, 130, 246, 0.3)",
                          "0 0 10px rgba(147, 51, 234, 0.3)",
                          "0 0 5px rgba(59, 130, 246, 0.3)"
                        ]
                      }}
                      transition={{ duration: 3, repeat: Infinity }}
                    >
                      ✨ Plataforma Premium de Gestão Imobiliária ✨
                    </motion.span>
                  </CardDescription>
                </motion.div>
              </CardHeader>

              <CardContent className="relative px-8 pb-8">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <motion.form 
                    onSubmit={handleEmailPassword} 
                    className="space-y-8"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                  >
                    <motion.div 
                      className="space-y-3"
                      whileHover={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <Label htmlFor="email" className="text-gray-200 flex items-center gap-2 text-sm font-medium">
                        <Mail className="w-4 h-4 text-blue-400" />
                        Email Corporativo
                      </Label>
                      <div className="relative group">
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-emerald-500/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm"
                          layoutId="input-glow"
                        />
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300"
                        />
                        <Input
                          id="email"
                          type="email"
                          placeholder="seu.email@empresa.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="relative bg-gray-800/60 backdrop-blur-sm border-gray-600/60 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all duration-500 rounded-xl h-12 text-lg"
                          required
                        />
                      </div>
                    </motion.div>

                    <motion.div 
                      className="space-y-3"
                      whileHover={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <Label htmlFor="password" className="text-gray-200 flex items-center gap-2 text-sm font-medium">
                        <Shield className="w-4 h-4 text-purple-400" />
                        Senha Segura
                      </Label>
                      <div className="relative group">
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-blue-500/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm"
                          layoutId="password-glow"
                        />
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300"
                        />
                        <Input
                          id="password"
                          type="password"
                          placeholder="••••••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="relative bg-gray-800/60 backdrop-blur-sm border-gray-600/60 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 transition-all duration-500 rounded-xl h-12 text-lg"
                          required
                        />
                      </div>
                    </motion.div>

                    {/* Link "Esqueci minha senha" */}
                    <motion.div
                      className="flex justify-end"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.8 }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotPassword(true);
                          setForgotPasswordEmail(email); // Preencher com email do formulário
                        }}
                        className="text-sm text-blue-400 hover:text-blue-300 transition-colors duration-300 flex items-center gap-1 group"
                      >
                        <HelpCircle className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        <span>Esqueci minha senha</span>
                      </button>
                    </motion.div>

                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -20, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -20, scale: 0.9 }}
                          transition={{ duration: 0.4, type: "spring" }}
                        >
                          <Alert variant="destructive" className="bg-red-900/30 border-red-500/60 backdrop-blur-sm rounded-xl">
                            <AlertDescription className="text-red-200">{error}</AlertDescription>
                          </Alert>
                        </motion.div>
                      )}

                      {message && (
                        <motion.div
                          initial={{ opacity: 0, y: -20, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -20, scale: 0.9 }}
                          transition={{ duration: 0.4, type: "spring" }}
                        >
                          <Alert className="bg-emerald-900/30 border-emerald-500/60 backdrop-blur-sm rounded-xl">
                            <CheckCircle className="h-4 w-4 text-emerald-400" />
                            <AlertDescription className="text-emerald-200">{message}</AlertDescription>
                          </Alert>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <motion.div
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.97, y: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 10 }}
                    >
                      <Button
                        type="submit"
                        className="relative w-full bg-gradient-to-r from-blue-600 via-purple-600 to-emerald-600 hover:from-blue-700 hover:via-purple-700 hover:to-emerald-700 text-white font-bold py-4 shadow-2xl hover:shadow-3xl transition-all duration-500 group rounded-xl text-lg overflow-hidden"
                        disabled={loading}
                      >
                        {/* Efeito de brilho no botão */}
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                          animate={{
                            x: ["-100%", "100%"]
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            repeatDelay: 3
                          }}
                        />
                        
                        {loading ? (
                          <motion.div
                            className="flex items-center justify-center"
                            animate={{ opacity: [0.7, 1, 0.7] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          >
                            <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                            <span className="text-lg">Processando...</span>
                          </motion.div>
                        ) : (
                          <span className="relative flex items-center justify-center">
                            <Lock className="mr-3 h-5 w-5" />
                            <span className="text-lg">Acessar Plataforma</span>
                            <ArrowRight className="ml-3 h-5 w-5 group-hover:translate-x-2 transition-transform duration-300" />
                          </span>
                        )}
                      </Button>
                    </motion.div>
                  </motion.form>
                </motion.div>
              </CardContent>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Modal "Esqueci minha senha" */}
      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="bg-gray-900/95 backdrop-blur-xl border-gray-700/60 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-2">
              <Key className="w-6 h-6 text-blue-400" />
              Recuperar Senha
            </DialogTitle>
            <DialogDescription className="text-gray-300">
              Digite seu email e enviaremos um link para redefinir sua senha
            </DialogDescription>
          </DialogHeader>

          {forgotPasswordSuccess ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <Alert className="bg-emerald-900/30 border-emerald-500/60">
                <CheckCircle className="h-5 w-5 text-emerald-400" />
                <AlertDescription className="text-emerald-200">
                  <strong>Email enviado com sucesso!</strong>
                  <br />
                  Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
                  <br />
                  <span className="text-sm text-emerald-300/80 mt-2 block">
                    O link expira em 1 hora.
                  </span>
                </AlertDescription>
              </Alert>
              <Button
                onClick={() => {
                  setShowForgotPassword(false);
                  setForgotPasswordSuccess(false);
                }}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                Fechar
              </Button>
            </motion.div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email" className="text-gray-200">
                  Email
                </Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="seu.email@empresa.com"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  className="bg-gray-800/60 border-gray-600/60 text-white placeholder-gray-400 focus:border-blue-500"
                  required
                  disabled={forgotPasswordLoading}
                />
              </div>

              {forgotPasswordError && (
                <Alert variant="destructive" className="bg-red-900/30 border-red-500/60">
                  <AlertDescription className="text-red-200">
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
                  className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
                  disabled={forgotPasswordLoading}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
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