'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/store/app';
import { useSettings } from '@/store/settings';
import { useAuth } from '@/store/auth';
import { useNotifications } from '@/store/notifications';
import { useAge } from '@/store/age';
import { SplashScreen } from '@/components/screens/SplashScreen';
import { WelcomeScreen } from '@/components/screens/WelcomeScreen';
import { AuthScreen } from '@/components/screens/AuthScreen';
import { HomeScreen } from '@/components/screens/HomeScreen';
import { OfflineSelectScreen } from '@/components/screens/OfflineSelectScreen';
import { GameScreen } from '@/components/screens/GameScreen';
import { TutorialScreen } from '@/components/screens/TutorialScreen';
import { HowToPlayScreen } from '@/components/screens/HowToPlayScreen';
import { AboutScreen } from '@/components/screens/AboutScreen';
import { ProfileScreen } from '@/components/screens/ProfileScreen';
import { RankingsScreen } from '@/components/screens/RankingsScreen';
import { SettingsScreen } from '@/components/screens/SettingsScreen';
import { RoomsScreen } from '@/components/screens/RoomsScreen';
import { FriendsScreen } from '@/components/screens/FriendsScreen';
import { NotificationsScreen } from '@/components/screens/NotificationsScreen';
import { WalletScreen } from '@/components/screens/WalletScreen';
import { DepositScreen } from '@/components/screens/DepositScreen';
import { AdminScreen } from '@/components/screens/AdminScreen';
import { ShopScreen } from '@/components/screens/ShopScreen';
import { ReplayScreen } from '@/components/screens/ReplayScreen';
import { AchievementsScreen } from '@/components/screens/AchievementsScreen';
import { ChallengeScreen } from '@/components/screens/ChallengeScreen';
import { StatsScreen } from '@/components/screens/StatsScreen';
import { ShareScreen } from '@/components/screens/ShareScreen';
import { LightningChallengeScreen } from '@/components/screens/LightningChallengeScreen';
import { WatchScreen } from '@/components/screens/WatchScreen';
import { CampaignScreen } from '@/components/screens/CampaignScreen';
import { CampaignPlayScreen } from '@/components/screens/CampaignPlayScreen';
import { TournamentScreen } from '@/components/screens/TournamentScreen';
import { TournamentPlayScreen } from '@/components/screens/TournamentPlayScreen';
import { OnlineMatchScreen } from '@/components/screens/OnlineMatchScreen';
import { AppHeader } from '@/components/game/AppHeader';
import { TabBar } from '@/components/game/TabBar';
import { useMusicSync, useSound, startMusic, playSound, setMusicState, resumeMusicPresence } from '@/lib/sound';
import { useProgression } from '@/store/progression';
import { toast } from 'sonner';
import type { Difficulty } from '@tira/ai';

const DIFF_LABELS: Record<Difficulty, string> = {
  easy: 'Fácil',
  medium: 'Médio',
  hard: 'Difícil',
  perfect: 'Perfeito',
};

export default function Home() {
  const screen = useApp((s) => s.screen);
  const reduceMotion = useSettings((s) => s.reduceMotion);
  const colorblind = useSettings((s) => s.colorblindMode);

  // Sincronizar sons + música com as settings
  useSound();
  useMusicSync();

  // Inicializar a sessão de autenticação (Supabase)
  const initializeAuth = useAuth((s) => s.initialize);
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Notificações em tempo real (globais, enquanto houver sessão)
  const userId = useAuth((s) => s.user?.id ?? null);
  const loadNotifications = useNotifications((s) => s.load);
  const subscribeNotifications = useNotifications((s) => s.subscribe);
  const unsubscribeNotifications = useNotifications((s) => s.unsubscribe);
  const resetNotifications = useNotifications((s) => s.reset);
  useEffect(() => {
    if (!userId) return;
    void loadNotifications();
    subscribeNotifications();
    return () => {
      unsubscribeNotifications();
      resetNotifications();
    };
  }, [
    userId,
    loadNotifications,
    subscribeNotifications,
    unsubscribeNotifications,
    resetNotifications,
  ]);

  // Gate 18+ (limpo ao terminar sessão)
  const resetAge = useAge((s) => s.reset);
  useEffect(() => {
    if (userId) return;
    resetAge();
  }, [userId, resetAge]);

  // Notificações de desbloqueio de dificuldades
  const newlyUnlocked = useProgression((s) => s.newlyUnlocked);
  const clearNewlyUnlocked = useProgression((s) => s.clearNewlyUnlocked);
  useEffect(() => {
    if (newlyUnlocked.length === 0) return;
    for (const diff of newlyUnlocked) {
      toast.success(`Dificuldade ${DIFF_LABELS[diff]} desbloqueada!`, {
        description: 'Agora podes desafiar a IA neste nível.',
        duration: 5000,
      });
    }
    playSound('achievementRare');
    clearNewlyUnlocked();
  }, [newlyUnlocked, clearNewlyUnlocked]);

  // Desbloquear áudio na primeira interação (política de autoplay dos browsers)
  useEffect(() => {
    const unlock = () => {
      startMusic();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  // Presença do jogador: música adaptativa (ausente vs. presente)
  useEffect(() => {
    const INACTIVITY_MS = 90_000;
    let inactivityTimer: ReturnType<typeof setTimeout> | null = null;

    const markAbsent = () => setMusicState('absent');
    const markPresent = () => {
      resumeMusicPresence();
    };
    const resetInactivity = () => {
      markPresent();
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(markAbsent, INACTIVITY_MS);
    };

    const onVisibility = () => {
      if (document.hidden) markAbsent();
      else markPresent();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pointerdown', resetInactivity, { passive: true });
    window.addEventListener('keydown', resetInactivity);
    resetInactivity();

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointerdown', resetInactivity);
      window.removeEventListener('keydown', resetInactivity);
      if (inactivityTimer) clearTimeout(inactivityTimer);
    };
  }, []);

  // Aplicar classes de acessibilidade no body
  useEffect(() => {
    const body = document.body;
    body.classList.toggle('reduce-motion', reduceMotion);
    body.classList.toggle('colorblind', colorblind);
  }, [reduceMotion, colorblind]);

  // Ecrãs sem header/tabbar (ecrãs full-screen)
  const isFullScreen =
    screen === 'splash' ||
    screen === 'welcome' ||
    screen === 'auth' ||
    screen === 'game';

  // Ecrãs que mostram tab bar
  const showTabBar =
    screen === 'home' ||
    screen === 'rooms' ||
    screen === 'rankings' ||
    screen === 'profile';

  // Ecrãs que mostram header (com botão back)
  const showHeader =
    !isFullScreen &&
    screen !== 'home';

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Padrão angolano de fundo (subtil) */}
      <div className="pointer-events-none fixed inset-0 angolan-pattern" aria-hidden />

      {showHeader && <AppHeader />}

      <main className="flex-1 relative z-10 w-full max-w-2xl mx-auto px-4 pb-24 pt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={screen}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {screen === 'splash' && <SplashScreen />}
            {screen === 'welcome' && <WelcomeScreen />}
            {screen === 'auth' && <AuthScreen />}
            {screen === 'home' && <HomeScreen />}
            {screen === 'offline-select' && <OfflineSelectScreen />}
            {screen === 'game' && <GameScreen />}
            {screen === 'tutorial' && <TutorialScreen />}
            {screen === 'how-to-play' && <HowToPlayScreen />}
            {screen === 'about' && <AboutScreen />}
            {screen === 'profile' && <ProfileScreen />}
            {screen === 'rankings' && <RankingsScreen />}
            {screen === 'settings' && <SettingsScreen />}
            {screen === 'rooms' && <RoomsScreen />}
            {screen === 'friends' && <FriendsScreen />}
            {screen === 'notifications' && <NotificationsScreen />}
            {screen === 'wallet' && <WalletScreen />}
            {screen === 'deposit' && <DepositScreen />}
            {screen === 'admin' && <AdminScreen />}
            {screen === 'shop' && <ShopScreen />}
            {screen === 'replay' && <ReplayScreen />}
            {screen === 'achievements' && <AchievementsScreen />}
            {screen === 'challenge' && <ChallengeScreen />}
            {screen === 'stats' && <StatsScreen />}
            {screen === 'share' && <ShareScreen />}
            {screen === 'import-match' && <ShareScreen />}
            {screen === 'lightning' && <LightningChallengeScreen />}
            {screen === 'watch' && <WatchScreen />}
            {screen === 'campaign' && <CampaignScreen />}
            {screen === 'campaign-play' && <CampaignPlayScreen key={useApp.getState().campaignLevelId ?? 'none'} />}
            {screen === 'tournament' && <TournamentScreen />}
            {screen === 'tournament-play' && <TournamentPlayScreen key={useApp.getState().tournamentMatchId ?? 'none'} />}
            {screen === 'match' && <OnlineMatchScreen />}
          </motion.div>
        </AnimatePresence>
      </main>

      {showTabBar && <TabBar active={screen} />}
    </div>
  );
}
