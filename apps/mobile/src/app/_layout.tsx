/**
 * Layout raiz — Stack (expo-router) com tema escuro do casino.
 * Inicializa a sessão Supabase e o gate 18+ no arranque e limpa os stores
 * dependentes de sessão ao terminar sessão.
 *
 * Fontes: Inter + Bebas Neue + Geist Mono (mesmas da web). No expo web o
 * @font-face está em global.css; no nativo são carregadas aqui com expo-font
 * e a UI só monta depois de prontas (evita flash da fonte do sistema).
 */
import '../../global.css';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Font from 'expo-font';
import { colorScheme, vars } from 'nativewind';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAge } from '@/store/age';
import { useAuth } from '@/store/auth';
import { useMatch } from '@/store/match';
import { colors } from '@/theme';
import { darkVars } from '@/theme/tokens';

const FONT_ASSETS = {
  Inter: require('../../assets/fonts/Inter.ttf'),
  'Bebas Neue': require('../../assets/fonts/BebasNeue.ttf'),
  'Geist Mono': require('../../assets/fonts/GeistMono.ttf'),
} as const;

export default function RootLayout() {
  const userId = useAuth((s) => s.user?.id ?? null);
  const initialize = useAuth((s) => s.initialize);
  const themeVars = useMemo(() => vars(darkVars), []);
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    // Nativo (Font.loadAsync) e web (expo-font usa a FontFace API) — o
    // require resolve para um asset do Metro nos dois casos.
    Font.loadAsync(FONT_ASSETS)
      .catch(() => undefined)
      .finally(() => setFontsReady(true));
  }, []);

  useEffect(() => {
    colorScheme.set('dark');
  }, []);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (userId) {
      void useAge.getState().load();
    } else {
      useAge.getState().reset();
      useMatch.getState().leave();
    }
  }, [userId]);

  if (!fontsReady) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={DarkTheme}>
        <View style={themeVars} className="flex-1">
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: 'slide_from_right',
            }}
          />
        </View>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
