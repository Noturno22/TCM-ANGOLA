'use client';

import { useEffect } from 'react';
import { useApp } from '@/store/app';
import { useSettings } from '@/store/settings';
import { SplashScreen } from '@/components/screens/SplashScreen';
import { WelcomeScreen } from '@/components/screens/WelcomeScreen';
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
import { WalletScreen } from '@/components/screens/WalletScreen';
import { ReplayScreen } from '@/components/screens/ReplayScreen';
import { AchievementsScreen } from '@/components/screens/AchievementsScreen';
import { AppHeader } from '@/components/game/AppHeader';
import { TabBar } from '@/components/game/TabBar';

export default function Home() {
  const screen = useApp((s) => s.screen);
  const theme = useSettings((s) => s.theme);
  const reduceMotion = useSettings((s) => s.reduceMotion);
  const colorblind = useSettings((s) => s.colorblindMode);

  // Aplicar tema (dark/light) na raiz <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(theme);
  }, [theme]);

  // Aplicar classes de acessibilidade no body
  useEffect(() => {
    const body = document.body;
    body.classList.toggle('reduce-motion', reduceMotion);
    body.classList.toggle('colorblind', colorblind);
  }, [reduceMotion, colorblind]);

  // Ecrãs sem header/tabbar (ecrãs full-screen)
  const isFullScreen =
    screen === 'splash' || screen === 'welcome' || screen === 'game';

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
        {screen === 'splash' && <SplashScreen />}
        {screen === 'welcome' && <WelcomeScreen />}
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
        {screen === 'wallet' && <WalletScreen />}
        {screen === 'replay' && <ReplayScreen />}
        {screen === 'achievements' && <AchievementsScreen />}
      </main>

      {showTabBar && <TabBar active={screen} />}
    </div>
  );
}
