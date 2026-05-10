/**
 * Efeitos decorativos do header da página Properties.
 *
 * Isolado em arquivo separado para garantir tree-shaking quando
 * ENABLE_DECORATIVE_FX=false em PropertyList. Sem isso, framer-motion
 * + helpers continuariam no bundle inicial mesmo desabilitados.
 *
 * Este componente NÃO é importado estaticamente por PropertyList.tsx —
 * usa React.lazy lá para garantir chunk separado.
 *
 * Para reativar: em PropertyList.tsx, mude ENABLE_DECORATIVE_FX para true.
 */
import { motion } from 'framer-motion';
import { Building2, Home, Key, Shield, Star, Sparkles } from 'lucide-react';

const FloatingParticle = ({ delay = 0, duration = 20, type = 'default' as 'default' | 'star' | 'spark' | 'glow' }) => {
  const particleVariants: Record<string, string> = {
    default: 'w-2 h-2 bg-blue-400/20 rounded-full',
    star: 'w-1 h-1 bg-yellow-400/30 rounded-full',
    spark: 'w-0.5 h-4 bg-purple-400/40 rounded-full',
    glow: 'w-3 h-3 bg-emerald-400/25 rounded-full blur-sm',
  };

  return (
    <motion.div
      className={`absolute ${particleVariants[type]}`}
      initial={{
        x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1200),
        y: (typeof window !== 'undefined' ? window.innerHeight : 800) + 20,
        opacity: 0,
        scale: 0,
      }}
      animate={{
        y: -50,
        opacity: [0, 1, 0.8, 0],
        scale: [0, 1, 1.2, 0],
        rotate: 360,
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
};

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
            'radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%)',
            'radial-gradient(circle, rgba(147, 51, 234, 0.2) 0%, transparent 70%)',
            'radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, transparent 70%)',
            'radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%)',
          ],
        }}
        transition={{
          duration: 4 + Math.random() * 4,
          delay: i * 0.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    ))}
  </div>
);

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
          clipPath: 'polygon(30% 0%, 0% 50%, 30% 100%, 100% 70%, 70% 30%)',
          transform: `rotate(${Math.random() * 360}deg)`,
        }}
        animate={{
          opacity: [0, 0.4, 0],
          rotate: [0, 180, 360],
          scale: [0.8, 1.2, 0.8],
        }}
        transition={{
          duration: 8 + Math.random() * 6,
          delay: i * 0.7,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    ))}
  </div>
);

interface FloatingIconProps {
  Icon: React.ElementType;
  delay?: number;
  x?: number;
  y?: number;
  color?: 'blue' | 'purple' | 'emerald' | 'yellow' | 'pink';
}

const FloatingIcon = ({ Icon, delay = 0, x = 0, y = 0, color = 'blue' }: FloatingIconProps) => {
  const colorVariants: Record<string, string> = {
    blue: 'text-blue-300/10',
    purple: 'text-purple-300/10',
    emerald: 'text-emerald-300/10',
    yellow: 'text-yellow-300/10',
    pink: 'text-pink-300/10',
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
        x: [-10, 10, -10],
      }}
      transition={{
        duration: 10 + Math.random() * 5,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <Icon size={35 + Math.random() * 20} />
    </motion.div>
  );
};

const ArchitecturalGrid = () => (
  <div className="absolute inset-0 overflow-hidden">
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
              opacity: [0, 0.3, 0],
            }}
            transition={{ duration: 4, repeat: Infinity, repeatType: 'loop' }}
          />
          <motion.circle
            cx="40"
            cy="40"
            r="2"
            fill="rgba(147, 51, 234, 0.1)"
            animate={{
              r: [1, 4, 1],
              opacity: [0.1, 0.4, 0.1],
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
              strokeWidth: [0.5, 2, 0.5],
            }}
            transition={{ duration: 6, repeat: Infinity }}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
      <rect width="100%" height="100%" fill="url(#hexGrid)" opacity="0.5" />
    </svg>
    <motion.div
      className="absolute top-20 left-10 border border-blue-400/20"
      style={{ width: '120px', height: '120px' }}
      initial={{ opacity: 0, scale: 0, rotate: 0 }}
      animate={{
        opacity: [0, 0.4, 0],
        scale: [0, 1.1, 0],
        rotate: [0, 180, 360],
        borderRadius: ['0%', '50%', '0%'],
      }}
      transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute bottom-20 right-10 border-2 border-emerald-400/20"
      style={{ width: '80px', height: '140px' }}
      initial={{ opacity: 0, y: 50, skewY: 0 }}
      animate={{
        opacity: [0, 0.5, 0],
        y: [50, -20, 50],
        skewY: [-5, 5, -5],
        borderColor: [
          'rgba(16, 185, 129, 0.2)',
          'rgba(59, 130, 246, 0.2)',
          'rgba(147, 51, 234, 0.2)',
          'rgba(16, 185, 129, 0.2)',
        ],
      }}
      transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
    />
  </div>
);

interface DecorationsProps {
  particles: string[];
  particleTypes: Array<'default' | 'star' | 'spark' | 'glow'>;
}

/**
 * Renderiza todos os efeitos decorativos do header. Use via React.lazy
 * pra garantir chunk separado.
 */
const PropertyListDecorations = ({ particles, particleTypes }: DecorationsProps) => (
  <>
    <ArchitecturalGrid />
    <PulsingLights />
    <GlassShards />
    {particles.map((particle, index) => (
      <FloatingParticle
        key={particle}
        delay={index * 0.5}
        duration={15 + Math.random() * 10}
        type={particleTypes[index % particleTypes.length]}
      />
    ))}
    <FloatingIcon Icon={Building2} delay={0} x={10} y={20} color="blue" />
    <FloatingIcon Icon={Home} delay={2} x={85} y={15} color="emerald" />
    <FloatingIcon Icon={Key} delay={4} x={15} y={70} color="purple" />
    <FloatingIcon Icon={Shield} delay={6} x={80} y={75} color="yellow" />
    <FloatingIcon Icon={Star} delay={8} x={50} y={85} color="pink" />
    <FloatingIcon Icon={Sparkles} delay={10} x={75} y={40} color="blue" />
  </>
);

export default PropertyListDecorations;
