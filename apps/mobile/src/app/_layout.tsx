/**
 * Layout raiz — Stack (expo-router) com tema escuro do casino.
 * Inicializa a sessão Supabase e o gate 18+ no arranque e limpa os stores
 * dependentes de sessão ao terminar sessão.
 */
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAge } from '@/store/age';
import { useAuth } from '@/store/auth';
import { useMatch } from '@/store/match';
import { colors } from '@/theme';

export default function RootLayout() {
  const userId = useAuth((s) => s.user?.id ?? null);
  const initialize = useAuth((s) => s.initialize);

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

  return (
    <SafeAreaProvider>
      <ThemeProvider value={DarkTheme}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: 'slide_from_right',
          }}
        />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
