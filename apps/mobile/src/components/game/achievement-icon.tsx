/**
 * Ícone de conquista — aceita os nomes usados no web (`trophy`, `flame`, …)
 * e também os emojis antigos do mobile, para manter compatibilidade.
 */
import {
  Brain,
  Crown,
  Flame,
  Gem,
  Handshake,
  Medal,
  Shield,
  Swords,
  Target,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { colors } from '@/theme';

const MAP: Record<string, LucideIcon> = {
  trophy: Trophy,
  flame: Flame,
  target: Target,
  shield: Shield,
  zap: Zap,
  brain: Brain,
  gem: Gem,
  crown: Crown,
  swords: Swords,
  medal: Medal,
  handshake: Handshake,
  '🏆': Trophy,
  '🔥': Flame,
  '🎯': Target,
  '🛡️': Shield,
  '🛡': Shield,
  '⚡': Zap,
  '🧠': Brain,
  '💎': Gem,
  '👑': Crown,
  '⚔️': Swords,
  '⚔': Swords,
  '🏅': Medal,
  '🥇': Medal,
  '🤝': Handshake,
};

export function AchievementIcon({
  icon,
  size = 20,
  color = colors.gold,
}: {
  icon: string;
  size?: number;
  color?: string;
}) {
  const Icon = MAP[icon] ?? Trophy;
  return <Icon size={size} color={color} />;
}
