import { useState, useCallback, useEffect, createContext, useContext, ReactNode, forwardRef } from 'react';
import { toast } from 'sonner';
import { Trophy, Star, Zap, Shield, Clock, TrendingUp, CheckCircle2, Award, Medal, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';

// Achievement types
export type AchievementId = 
  | 'first_approval'
  | 'speed_demon'
  | 'streak_5'
  | 'streak_10'
  | 'risk_master'
  | 'zero_alerts'
  | 'bulk_approver'
  | 'perfect_day'
  | 'early_bird'
  | 'night_owl';

export type AchievementRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface Achievement {
  id: AchievementId;
  title: string;
  description: string;
  icon: React.ElementType;
  points: number;
  rarity: AchievementRarity;
}

// All achievements definition
export const ACHIEVEMENTS: Record<AchievementId, Achievement> = {
  first_approval: {
    id: 'first_approval',
    title: 'Primeira Aprovação',
    description: 'Aprovou seu primeiro motorista',
    icon: CheckCircle2,
    points: 10,
    rarity: 'common',
  },
  speed_demon: {
    id: 'speed_demon',
    title: 'Velocidade Máxima',
    description: 'Aprovou em menos de 5 segundos',
    icon: Zap,
    points: 25,
    rarity: 'uncommon',
  },
  streak_5: {
    id: 'streak_5',
    title: 'Sequência de 5',
    description: 'Aprovou 5 motoristas seguidos',
    icon: TrendingUp,
    points: 50,
    rarity: 'uncommon',
  },
  streak_10: {
    id: 'streak_10',
    title: 'Imparável',
    description: 'Aprovou 10 motoristas seguidos',
    icon: Star,
    points: 100,
    rarity: 'rare',
  },
  risk_master: {
    id: 'risk_master',
    title: 'Mestre do Risco',
    description: 'Rejeitou corretamente um motorista alto risco',
    icon: Shield,
    points: 30,
    rarity: 'uncommon',
  },
  zero_alerts: {
    id: 'zero_alerts',
    title: 'Paz & Harmonia',
    description: 'Zerou todos os alertas ativos',
    icon: Clock,
    points: 75,
    rarity: 'rare',
  },
  bulk_approver: {
    id: 'bulk_approver',
    title: 'Aprovador em Massa',
    description: 'Processou 20 aprovações em um dia',
    icon: Award,
    points: 150,
    rarity: 'epic',
  },
  perfect_day: {
    id: 'perfect_day',
    title: 'Dia Perfeito',
    description: '100% de entregas no prazo',
    icon: Target,
    points: 200,
    rarity: 'epic',
  },
  early_bird: {
    id: 'early_bird',
    title: 'Madrugador',
    description: 'Aprovou antes das 7h',
    icon: Medal,
    points: 20,
    rarity: 'common',
  },
  night_owl: {
    id: 'night_owl',
    title: 'Coruja Noturna',
    description: 'Aprovou depois das 22h',
    icon: Trophy,
    points: 20,
    rarity: 'common',
  },
};

// Rarity colors
export const RARITY_COLORS: Record<AchievementRarity, { bg: string; border: string; text: string; glow: string }> = {
  common: { bg: 'bg-secondary', border: 'border-border', text: 'text-muted-foreground', glow: '' },
  uncommon: { bg: 'bg-success/20', border: 'border-success/50', text: 'text-success', glow: 'shadow-success/20' },
  rare: { bg: 'bg-info/20', border: 'border-info/50', text: 'text-info', glow: 'shadow-info/30' },
  epic: { bg: 'bg-accent/20', border: 'border-accent/50', text: 'text-accent', glow: 'shadow-accent/40' },
  legendary: { bg: 'bg-warning/20', border: 'border-warning/50', text: 'text-warning', glow: 'shadow-warning/50' },
};

// Context
interface AchievementsContextValue {
  unlockedAchievements: Set<AchievementId>;
  totalPoints: number;
  currentNotification: Achievement | null;
  unlockAchievement: (id: AchievementId) => void;
  dismissNotification: () => void;
  hasAchievement: (id: AchievementId) => boolean;
  approvalStreak: number;
  incrementStreak: () => void;
  resetStreak: () => void;
  triggerConfetti: () => void;
}

const AchievementsContext = createContext<AchievementsContextValue | null>(null);

// Confetti component
function ConfettiParticle({ index }: { index: number }) {
  const colors = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--info))'];
  const color = colors[index % colors.length];
  // eslint-disable-next-line react-hooks/purity
  const randomX = Math.random() * 100;
  // eslint-disable-next-line react-hooks/purity
  const randomDelay = Math.random() * 0.3;
  // eslint-disable-next-line react-hooks/purity
  const size = 6 + Math.random() * 8;
  // eslint-disable-next-line react-hooks/purity
  const rotation = Math.random() * 360;

  return (
    <motion.div
      className="fixed pointer-events-none z-[100]"
      style={{
        left: `${randomX}%`,
        top: '-20px',
        width: size,
        height: size,
        backgroundColor: color,
        // eslint-disable-next-line react-hooks/purity
        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
        transform: `rotate(${rotation}deg)`,
      }}
      initial={{ y: -20, opacity: 1, rotate: 0 }}
      animate={{
        y: window.innerHeight + 50,
        opacity: [1, 1, 0],
        rotate: rotation + 720,
        // eslint-disable-next-line react-hooks/purity
        x: [0, (Math.random() - 0.5) * 200],
      }}
      transition={{
        // eslint-disable-next-line react-hooks/purity
        duration: 2 + Math.random(),
        delay: randomDelay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    />
  );
}

const ConfettiExplosion = forwardRef<HTMLDivElement, { active: boolean }>(function ConfettiExplosion({ active }, ref) {
  if (!active) return null;
  
  return (
    <div ref={ref} className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {[...Array(50)].map((_, i) => (
        <ConfettiParticle key={i} index={i} />
      ))}
    </div>
  );
});

// Achievement notification toast
const AchievementNotification = forwardRef<
  HTMLDivElement,
  { achievement: Achievement; onDismiss: () => void }
>(function AchievementNotification({ achievement, onDismiss }, ref) {
  const colors = RARITY_COLORS[achievement.rarity];
  const Icon = achievement.icon;

  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ x: 400, opacity: 0, scale: 0.8 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ x: 400, opacity: 0, scale: 0.8 }}
      className={`fixed top-20 right-4 z-[99] max-w-sm w-full p-4 rounded-xl border-2 backdrop-blur-xl shadow-2xl ${colors.bg} ${colors.border} ${colors.glow}`}
    >
      <div className="flex items-start gap-4">
        <motion.div
          initial={{ rotate: -180, scale: 0 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 10, delay: 0.2 }}
          className={`p-3 rounded-xl ${colors.bg} border ${colors.border}`}
        >
          <Icon className={`w-6 h-6 ${colors.text}`} />
        </motion.div>
        <div className="flex-1">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-warning" />
              <span className="text-xs font-medium uppercase tracking-wider text-warning">
                Conquista Desbloqueada!
              </span>
            </div>
            <h3 className="font-bold text-foreground">{achievement.title}</h3>
            <p className="text-sm text-muted-foreground">{achievement.description}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-sm font-bold ${colors.text}`}>+{achievement.points} pts</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
                {achievement.rarity.toUpperCase()}
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
});

// Provider component
export function AchievementsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? 'anonymous';
  const achievementsKey = `achievements:${userId}`;
  const pointsKey = `achievement-points:${userId}`;

  const [unlockedAchievements, setUnlockedAchievements] = useState<Set<AchievementId>>(() => {
    try {
      const saved = localStorage.getItem(achievementsKey);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [totalPoints, setTotalPoints] = useState(() => {
    const saved = localStorage.getItem(pointsKey);
    return saved ? parseInt(saved, 10) : 0;
  });
  const [currentNotification, setCurrentNotification] = useState<Achievement | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [approvalStreak, setApprovalStreak] = useState(0);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(achievementsKey, JSON.stringify([...unlockedAchievements]));
    } catch {
      /* localStorage pode estar indisponível */
    }
  }, [unlockedAchievements, achievementsKey]);

  useEffect(() => {
    try {
      localStorage.setItem(pointsKey, totalPoints.toString());
    } catch {
      /* localStorage pode estar indisponível */
    }
  }, [totalPoints, pointsKey]);

  const triggerConfetti = useCallback(() => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
  }, []);

  const unlockAchievement = useCallback((id: AchievementId) => {
    if (unlockedAchievements.has(id)) return;

    const achievement = ACHIEVEMENTS[id];
    setUnlockedAchievements(prev => new Set([...prev, id]));
    setTotalPoints(prev => prev + achievement.points);
    setCurrentNotification(achievement);
    
    // Trigger confetti for rare+ achievements
    if (['rare', 'epic', 'legendary'].includes(achievement.rarity)) {
      triggerConfetti();
    }
  }, [unlockedAchievements, triggerConfetti]);

  const dismissNotification = useCallback(() => {
    setCurrentNotification(null);
  }, []);

  const hasAchievement = useCallback((id: AchievementId) => {
    return unlockedAchievements.has(id);
  }, [unlockedAchievements]);

  const incrementStreak = useCallback(() => {
    setApprovalStreak(prev => {
      const newStreak = prev + 1;
      // Check streak achievements
      if (newStreak === 5) unlockAchievement('streak_5');
      if (newStreak === 10) unlockAchievement('streak_10');
      return newStreak;
    });
  }, [unlockAchievement]);

  const resetStreak = useCallback(() => {
    setApprovalStreak(0);
  }, []);

  return (
    <AchievementsContext.Provider
      value={{
        unlockedAchievements,
        totalPoints,
        currentNotification,
        unlockAchievement,
        dismissNotification,
        hasAchievement,
        approvalStreak,
        incrementStreak,
        resetStreak,
        triggerConfetti,
      }}
    >
      {children}
      
      {/* Confetti effect */}
      <ConfettiExplosion active={showConfetti} />
      
      {/* Achievement notification */}
      <AnimatePresence>
        {currentNotification && (
          <AchievementNotification
            achievement={currentNotification}
            onDismiss={dismissNotification}
          />
        )}
      </AnimatePresence>
    </AchievementsContext.Provider>
  );
}

// Hook to use achievements
export function useAchievementsSystem() {
  const context = useContext(AchievementsContext);
  if (!context) {
    throw new Error('useAchievementsSystem must be used within AchievementsProvider');
  }
  return context;
}

// Helper hook for approval-related achievements
export function useApprovalAchievements() {
  const { 
    unlockAchievement, 
    hasAchievement, 
    incrementStreak, 
    resetStreak,
    triggerConfetti,
    approvalStreak 
  } = useAchievementsSystem();

  const onApprovalSuccess = useCallback((riskScore?: number, startTime?: number) => {
    // First approval
    if (!hasAchievement('first_approval')) {
      unlockAchievement('first_approval');
    }

    // Speed demon - approved in less than 5 seconds
    if (startTime && Date.now() - startTime < 5000) {
      unlockAchievement('speed_demon');
    }

    // Check time-based achievements
    const hour = new Date().getHours();
    if (hour < 7) unlockAchievement('early_bird');
    if (hour >= 22) unlockAchievement('night_owl');

    // Increment streak
    incrementStreak();

    // Trigger mini confetti for approvals
    triggerConfetti();
  }, [unlockAchievement, hasAchievement, incrementStreak, triggerConfetti]);

  const onRejectionSuccess = useCallback((riskScore?: number) => {
    // Reset approval streak on rejection
    resetStreak();

    // Risk master - correctly rejected high risk driver
    if (riskScore && riskScore >= 7) {
      unlockAchievement('risk_master');
    }
  }, [unlockAchievement, resetStreak]);

  return {
    onApprovalSuccess,
    onRejectionSuccess,
    approvalStreak,
  };
}

// Points display component
export function AchievementPoints({ className }: { className?: string }) {
  const { totalPoints, unlockedAchievements } = useAchievementsSystem();

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning/10 border border-warning/30 ${className}`}
    >
      <Trophy className="w-4 h-4 text-warning" />
      <span className="text-sm font-bold text-warning">{totalPoints} pts</span>
      <span className="text-xs text-muted-foreground">
        ({unlockedAchievements.size}/{Object.keys(ACHIEVEMENTS).length})
      </span>
    </motion.div>
  );
}
