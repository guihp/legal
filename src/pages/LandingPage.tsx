import React, { useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Button } from "@/components/ui/button";
import {
    Bot,
    BarChart3,
    MessageSquare,
    ShieldCheck,
    Zap,
    ArrowRight,
    CheckCircle2,
    Globe,
    Smartphone,
    Building2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
    const navigate = useNavigate();
    const { scrollYProgress } = useScroll();
    const y = useTransform(scrollYProgress, [0, 1], [0, -50]);

    // Efeito de Parallax suave
    const springConfig = { stiffness: 100, damping: 30, restDelta: 0.001 };

    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-purple-500/30 selection:text-purple-200 overflow-x-hidden">

            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 opacity-30 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-600 blur-[120px] mix-blend-screen animate-pulse duration-10000" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-600 blur-[120px] mix-blend-screen animate-pulse duration-7000" />
                <div className="absolute top-[40%] left-[50%] transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-indigo-900/40 blur-[100px] mix-blend-screen" />
            </div>

            {/* Grid Pattern Overlay */}
            <div className="fixed inset-0 z-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-150 contrast-150 mix-blend-overlay pointer-events-none"></div>

            {/* Navigation */}
            <nav className="fixed top-0 w-full z-50 backdrop-blur-md bg-black/20 border-b border-white/5">
                <div className="container mx-auto px-6 py-4 flex items-center justify-between">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2"
                    >
                        <div className="relative w-8 h-8 flex items-center justify-center bg-gradient-to-tr from-blue-500 to-purple-600 rounded-lg">
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                            ImobiPro
                        </span>
                    </motion.div>

                    <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
                        <a href="#features" className="hover:text-white transition-colors">Funcionalidades</a>
                        <a href="#ai" className="hover:text-white transition-colors">Inteligência Artificial</a>
                        <a href="#testimonials" className="hover:text-white transition-colors">Depoimentos</a>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-4"
                    >
                        <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-white/5" onClick={() => navigate('/auth')}>
                            Login
                        </Button>
                        <Button
                            className="bg-white text-black hover:bg-gray-200 transition-all rounded-full px-6 font-semibold"
                            onClick={() => navigate('/auth?signup=true')}
                        >
                            Começar Agora
                        </Button>
                    </motion.div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-40 pb-20 lg:pt-52 lg:pb-32 z-10 container mx-auto px-6 flex flex-col items-center text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm md:text-base text-blue-300 mb-8 backdrop-blur-xl"
                >
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    Nova Era da Gestão Imobiliária
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-gray-400 max-w-5xl mx-auto leading-[1.1] md:leading-[1.1]"
                >
                    Venda mais com o poder da <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500">Inteligência Artificial</span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="text-lg md:text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed"
                >
                    Automatize o atendimento, centralize seus leads e feche contratos 10x mais rápido com a plataforma de CRM mais avançada do mercado.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.6 }}
                    className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
                >
                    <Button
                        size="lg"
                        className="w-full sm:w-auto h-14 px-8 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)] transition-all hover:scale-105"
                        onClick={() => navigate('/auth')}
                    >
                        Falar com Consultor <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                    <Button
                        size="lg"
                        variant="outline"
                        className="w-full sm:w-auto h-14 px-8 text-lg border-white/20 hover:bg-white/10 text-gray-200 rounded-full backdrop-blur-sm transition-all"
                        onClick={() => {
                            const demo = document.getElementById('demo-video');
                            demo?.scrollIntoView({ behavior: 'smooth' });
                        }}
                    >
                        Ver Demonstração
                    </Button>
                </motion.div>

                {/* Dashboard Preview / Hero Image */}
                <motion.div
                    style={{ y }}
                    initial={{ opacity: 0, scale: 0.95, rotateX: 20 }}
                    animate={{ opacity: 1, scale: 1, rotateX: 0 }}
                    transition={{ duration: 1, delay: 0.8, ease: "easeOut" }}
                    className="mt-20 relative w-full max-w-6xl mx-auto perspective-1000"
                >
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent z-10 pointer-events-none h-full w-full bottom-0"></div>
                    <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl p-2 shadow-2xl ring-1 ring-white/10 overflow-hidden transform-gpu">
                        <div className="rounded-lg bg-[#0f1115] overflow-hidden aspect-[16/9] border border-white/5 relative group">
                            {/* Abstract UI Representation */}
                            <div className="absolute top-0 left-0 w-64 h-full border-r border-white/5 bg-[#111] p-4 hidden md:block">
                                <div className="h-8 w-8 bg-blue-600/20 rounded mb-8"></div>
                                <div className="space-y-4">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <div key={i} className="h-4 bg-white/5 rounded w-full"></div>
                                    ))}
                                </div>
                            </div>
                            <div className="absolute top-0 right-0 w-full md:w-[calc(100%-16rem)] h-full p-8 flex flex-col">
                                <div className="h-10 w-full border-b border-white/5 mb-8 flex items-center justify-between">
                                    <div className="h-6 w-32 bg-white/10 rounded"></div>
                                    <div className="flex gap-2">
                                        <div className="h-8 w-8 rounded-full bg-green-500/20"></div>
                                    </div>
                                </div>
                                <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="h-32 rounded-lg bg-white/5 border border-white/5 p-4 relative overflow-hidden group-hover:border-purple-500/30 transition-colors">
                                            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-white/5 to-transparent rounded-bl-full"></div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-8 flex-1 bg-white/5 rounded-lg border border-white/5 p-6 flex flex-col justify-center items-center">
                                    <Zap className="w-12 h-12 text-yellow-400 mb-4 animate-pulse" />
                                    <div className="text-white/40 font-mono text-sm">AI Agent Processing...</div>
                                </div>
                            </div>

                            {/* Overlay Gradient */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-purple-500/10 mix-blend-overlay"></div>
                        </div>
                    </div>
                </motion.div>
            </section>

            {/* Stats/Companies Section */}
            <section className="py-10 border-y border-white/5 bg-white/[0.02]">
                <div className="container mx-auto px-6">
                    <p className="text-center text-sm text-gray-500 mb-8 uppercase tracking-widest font-semibold">
                        Confiança de corretores que movimentam o mercado
                    </p>
                    <div className="flex flex-wrap justify-center items-center gap-12 md:gap-20 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                        {/* Fake Company Logos for aesthetic */}
                        <div className="flex items-center gap-2 font-bold text-xl"><Globe className="w-6 h-6" /> GlobalState</div>
                        <div className="flex items-center gap-2 font-bold text-xl"><Building2 className="w-6 h-6" /> UrbanFlow</div>
                        <div className="flex items-center gap-2 font-bold text-xl"><ShieldCheck className="w-6 h-6" /> SafeKey</div>
                        <div className="flex items-center gap-2 font-bold text-xl"><BarChart3 className="w-6 h-6" /> DataProp</div>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="py-32 relative z-10">
                <div className="container mx-auto px-6">
                    <div className="text-center max-w-3xl mx-auto mb-20">
                        <h2 className="text-3xl md:text-5xl font-bold mb-6">Tudo o que você precisa. <br /><span className="text-gray-500">Em um único lugar.</span></h2>
                        <p className="text-gray-400 text-lg">Substitua dezenas de ferramentas desconexas por uma plataforma unificada e inteligente.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={<MessageSquare className="w-8 h-8 text-green-400" />}
                            title="Chatbot Humanizado"
                            description="Atenda seus leads 24/7 no WhatsApp com uma IA que entende contexto, agenda visitas e qualifica clientes automaticamente."
                            delay={0}
                        />
                        <FeatureCard
                            icon={<BarChart3 className="w-8 h-8 text-blue-400" />}
                            title="Dashboard em Tempo Real"
                            description="Acompanhe VGV, conversão de leads e performance do time com gráficos intuitivos e totalmente dinâmicos."
                            delay={0.1}
                        />
                        <FeatureCard
                            icon={<Zap className="w-8 h-8 text-yellow-400" />}
                            title="CRM Inteligente"
                            description="Pipeline Kanban automatizado que move cards baseados em gatilhos de conversa e engajamento."
                            delay={0.2}
                        />
                        <FeatureCard
                            icon={<Building2 className="w-8 h-8 text-purple-400" />}
                            title="Gestão de Imóveis"
                            description="Cadastre e gerencie seu portfólio completo com suporte a múltiplas mídias e integração com portais."
                            delay={0.3}
                        />
                        <FeatureCard
                            icon={<Smartphone className="w-8 h-8 text-pink-400" />}
                            title="Mobile First"
                            description="Acesse sua imobiliária de qualquer lugar com uma interface responsiva e otimizada para celulares."
                            delay={0.4}
                        />
                        <FeatureCard
                            icon={<ShieldCheck className="w-8 h-8 text-cyan-400" />}
                            title="Segurança Total"
                            description="Seus dados protegidos com criptografia de ponta a ponta e gestão granular de permissões de acesso."
                            delay={0.5}
                        />
                    </div>
                </div>
            </section>

            {/* AI Showcase Section */}
            <section id="ai" className="py-32 relative overflow-hidden">
                {/* Background Glow */}
                <div className="absolute right-0 top-0 w-1/2 h-full bg-gradient-to-l from-green-500/10 to-transparent pointer-events-none"></div>

                <div className="container mx-auto px-6 flex flex-col lg:flex-row items-center gap-16">
                    <div className="lg:w-1/2">
                        <motion.div
                            initial={{ opacity: 0, x: -50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8 }}
                        >
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm mb-6">
                                <Bot className="w-4 h-4" /> ImobiAI Agent
                            </div>
                            <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
                                Seu melhor corretor <br /> nunca dorme.
                            </h2>
                            <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                                Imagine um funcionário que conhece todo seu estoque, responde instantaneamente em qualquer horário e fala a língua do seu cliente. Nossa IA não apenas responde — ela vende.
                            </p>

                            <ul className="space-y-4 mb-10">
                                {['Qualificação automática de leads', 'Agendamento de visitas integrado', 'Envio de fotos e vídeos dos imóveis', 'Personalidade ajustável à sua marca'].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-gray-300">
                                        <CheckCircle2 className="w-5 h-5 text-green-500" /> {item}
                                    </li>
                                ))}
                            </ul>

                            <Button className="bg-white text-black hover:bg-gray-200 rounded-full h-12 px-8">
                                Ver o Agente em Ação
                            </Button>
                        </motion.div>
                    </div>

                    <div className="lg:w-1/2 relative">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8 }}
                            className="relative z-10"
                        >
                            {/* Chat Simulation Card */}
                            <div className="w-full max-w-md mx-auto bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                                <div className="bg-[#202c33] p-4 flex items-center gap-3 border-b border-white/5">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-green-500 to-emerald-600 flex items-center justify-center text-white">
                                        <Bot className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-white">ImobiPro Assistant</div>
                                        <div className="text-xs text-green-400">Online agora</div>
                                    </div>
                                </div>
                                <div className="p-4 space-y-4 min-h-[300px] bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat opacity-90">
                                    <div className="flex justify-start">
                                        <div className="bg-[#202c33] p-3 rounded-lg rounded-tl-none max-w-[80%] text-sm text-gray-200 shadow-md">
                                            Olá! Vi um apartamento no Centro e gostaria de mais informações.
                                        </div>
                                    </div>
                                    <div className="flex justify-end">
                                        <div className="bg-[#005c4b] p-3 rounded-lg rounded-tr-none max-w-[80%] text-sm text-white shadow-md">
                                            Olá! Claro, o apartamento no Centro é uma excelente escolha. Ele tem 3 dormitórios e vaga dupla. Gostaria de ver as fotos internas?
                                            <span className="block text-[10px] text-white/60 text-right mt-1">10:42 PM <span className="text-blue-300">✓✓</span></span>
                                        </div>
                                    </div>
                                    <div className="flex justify-start">
                                        <div className="bg-[#202c33] p-3 rounded-lg rounded-tl-none max-w-[80%] text-sm text-gray-200 shadow-md">
                                            Sim, por favor! E qual o valor do condomínio?
                                        </div>
                                    </div>
                                    <div className="flex justify-end">
                                        <div className="bg-[#005c4b] p-3 rounded-lg rounded-tr-none max-w-[80%] text-sm text-white shadow-md">
                                            <div className="flex gap-1 mb-2">
                                                <div className="h-16 w-full bg-gray-600 rounded animate-pulse"></div>
                                                <div className="h-16 w-full bg-gray-600 rounded animate-pulse"></div>
                                            </div>
                                            Aqui estão! O condomínio é R$ 850,00 e inclui portaria 24h. Posso agendar uma visita para amanhã?
                                            <span className="block text-[10px] text-white/60 text-right mt-1">10:43 PM <span className="text-blue-300">✓✓</span></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Decor Elements behind chat */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-green-500/20 blur-[100px] -z-10 rounded-full pointer-events-none"></div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-32 relative text-center">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-blue-900/20 pointer-events-none"></div>
                <div className="container mx-auto px-6 relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                        className="max-w-4xl mx-auto"
                    >
                        <h2 className="text-5xl md:text-6xl font-bold mb-8 tracking-tight">Pronto para revolucionar <br /> sua imobiliária?</h2>
                        <p className="text-xl text-gray-400 mb-12">Junte-se a centenas de imobiliárias que já estão usando o futuro a seu favor.</p>

                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <Button
                                size="lg"
                                className="h-16 px-10 text-xl font-bold bg-white text-black hover:bg-gray-100 rounded-full shadow-2xl hover:scale-105 transition-all"
                                onClick={() => navigate('/auth?signup=true')}
                            >
                                Começar Agora Gratuitamente
                            </Button>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/10 bg-[#020202] py-12">
                <div className="container mx-auto px-6">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 flex items-center justify-center bg-gray-800 rounded-lg">
                                <Bot className="w-5 h-5 text-gray-400" />
                            </div>
                            <span className="text-xl font-bold text-gray-300">ImobiPro</span>
                        </div>

                        <div className="flex gap-8 text-gray-500 text-sm">
                            <a href="#" className="hover:text-white transition-colors">Termos</a>
                            <a href="#" className="hover:text-white transition-colors">Privacidade</a>
                            <a href="#" className="hover:text-white transition-colors">Suporte</a>
                            <a href="#" className="hover:text-white transition-colors">LinkedIn</a>
                        </div>

                        <div className="text-gray-600 text-sm">
                            © 2024 ImobiPro. Todos os direitos reservados.
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function FeatureCard({ icon, title, description, delay }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay }}
            className="group p-8 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 transition-all duration-300 cursor-default"
        >
            <div className="mb-6 p-3 bg-white/5 rounded-xl inline-block group-hover:scale-110 transition-transform duration-300">
                {icon}
            </div>
            <h3 className="text-xl font-bold mb-3 text-gray-100 group-hover:text-blue-300 transition-colors">{title}</h3>
            <p className="text-gray-400 leading-relaxed group-hover:text-gray-300 transition-colors">
                {description}
            </p>
        </motion.div>
    )
}
