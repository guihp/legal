import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { 
  FileText, 
  Clock,
  AlertCircle,
  Sparkles,
  Zap,
  Shield
} from "lucide-react";

// Componente para as partículas flutuantes
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
      animate={{
        y: [0, -100, 0],
        x: [0, Math.random() * 50 - 25, 0],
        opacity: [0, 1, 0],
        scale: [0, 1, 0]
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut"
      }}
      style={{
        left: `${Math.random() * 100}%`,
        bottom: '0%'
      }}
    />
  );
};

export function ContractsView() {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6 overflow-hidden">
      {/* Fundo com partículas animadas */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 15 }, (_, index) => (
          <FloatingParticle 
            key={index} 
            delay={index * 0.5} 
            duration={15 + Math.random() * 10}
            type={['default', 'star', 'spark', 'glow'][Math.floor(Math.random() * 4)]}
          />
        ))}
      </div>

      {/* Gradiente overlay sutil */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 max-w-4xl mx-auto"
      >
        {/* Header com gradiente e efeitos */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mb-8"
        >
          <Card className="bg-white/80 backdrop-blur-md border-0 shadow-xl shadow-blue-500/10">
            <CardHeader className="pb-6">
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <motion.div 
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className="mx-auto mb-6 p-4 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl shadow-lg w-20 h-20 flex items-center justify-center"
                  >
                    <FileText className="h-10 w-10 text-white" />
                  </motion.div>
                  <motion.h1 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="text-4xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent mb-4"
                  >
                    Contratos (MVP)
                  </motion.h1>
                  <motion.p 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="text-slate-600 text-lg"
                  >
                    Este módulo está sendo integrado e estará pronto na próxima versão.
                  </motion.p>
                </div>
              </div>
            </CardHeader>
          </Card>
        </motion.div>

        {/* Card principal com a mensagem */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <Card className="bg-white/70 backdrop-blur-md border-0 shadow-lg">
            <CardContent className="p-12 text-center">
              <motion.div
                animate={{ 
                  scale: [1, 1.05, 1],
                  rotate: [0, 2, -2, 0]
                }}
                transition={{ 
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center"
              >
                <Clock className="h-12 w-12 text-amber-600" />
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                className="space-y-6"
              >
                <h2 className="text-2xl font-bold text-slate-800 mb-4">
                  Módulo em Desenvolvimento
                </h2>
                
                <p className="text-slate-600 text-lg max-w-2xl mx-auto leading-relaxed">
                  O módulo de Contratos está sendo cuidadosamente desenvolvido para oferecer 
                  a melhor experiência possível na gestão de seus contratos imobiliários.
                </p>
                
                <div className="flex items-center justify-center gap-6 mt-8">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Sparkles className="h-5 w-5 text-blue-500" />
                    <span>Criação de contratos</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Zap className="h-5 w-5 text-purple-500" />
                    <span>Templates inteligentes</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Shield className="h-5 w-5 text-green-500" />
                    <span>Assinatura digital</span>
                  </div>
                </div>
                
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 1.2 }}
                  className="mt-8 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100"
                >
                  <div className="flex items-center justify-center gap-2 text-blue-700">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">
                      Aguarde as próximas atualizações do sistema
                    </span>
                  </div>
                </motion.div>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}