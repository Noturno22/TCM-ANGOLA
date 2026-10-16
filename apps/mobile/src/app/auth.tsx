/**
 * Auth — entrar/criar conta por email e palavra-passe (Supabase Auth).
 *
 * Fatia vertical mobile: sem OAuth/telefone (a web tem Google + OTP). Ao
 * autenticar, o layout raiz passa a reconhecer a sessão e o perfil sincroniza
 * os números do servidor. Sem backend configurado, mostramos um aviso.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { TiraButton, TiraCard, TiraHeading, TiraScreen, TiraText, alpha } from '@/components/tira';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import { colors, radii, spacing } from '@/theme';

type Mode = 'signin' | 'signup';

function goBack(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/');
  }
}

export default function AuthScreen() {
  const { user, pending, error, info, signInWithEmail, signUpWithEmail, clearError } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = async () => {
    if (!email.trim() || !password || pending) return;
    const ok =
      mode === 'signin'
        ? await signInWithEmail(email.trim(), password)
        : await signUpWithEmail(email.trim(), password);
    if (ok) {
      if (router.canGoBack()) router.back();
      else router.replace('/');
    }
  };

  const switchMode = () => {
    clearError();
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
  };

  if (user) {
    return (
      <TiraScreen title="Conta" showBack>
        <TiraCard glow="p1">
          <View style={{ alignItems: 'center', gap: spacing[3] }}>
            <TiraText style={{ fontSize: 44 }}>✅</TiraText>
            <TiraHeading level="h3">Sessão iniciada</TiraHeading>
            <TiraText size="xs" variant="muted" align="center">
              {user.email ?? user.phone ?? user.id}
            </TiraText>
            <TiraButton variant="outline" fullWidth onPress={() => void useAuth.getState().signOut()}>
              Terminar sessão
            </TiraButton>
          </View>
        </TiraCard>
      </TiraScreen>
    );
  }

  return (
    <TiraScreen title="Conta" subtitle="Jogar online" showBack>
      {!isSupabaseConfigured ? (
        <View
          style={{
            flexDirection: 'row',
            gap: spacing[3],
            padding: spacing[3],
            borderRadius: radii.xl,
            borderWidth: 1,
            borderColor: alpha(colors.orange, 0.3),
            backgroundColor: alpha(colors.orange, 0.1),
          }}
        >
          <TiraText size="sm" variant="orange">
            ℹ️
          </TiraText>
          <TiraText size="xs" variant="orange" style={{ flex: 1 }}>
            Backend não configurado. O modo online fica indisponível, mas podes continuar a jogar
            offline.
          </TiraText>
        </View>
      ) : null}

      <TiraCard>
        <View style={{ gap: spacing[4] }}>
          <View style={{ gap: 2 }}>
            <TiraHeading level="h3">{mode === 'signin' ? 'Entrar' : 'Criar conta'}</TiraHeading>
            <TiraText size="xs" variant="muted">
              {mode === 'signin'
                ? 'Usa o teu email e palavra-passe.'
                : 'Cria conta para jogar online e ganhar moedas virtuais (KZ).'}
            </TiraText>
          </View>

          <Field
            label="Email"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              clearError();
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="tu@exemplo.com"
          />
          <Field
            label="Palavra-passe"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              clearError();
            }}
            secureTextEntry
            autoCapitalize="none"
            placeholder="mínimo 6 caracteres"
          />

          {error ? (
            <TiraText size="xs" variant="p2">
              {`⚠️ ${error}`}
            </TiraText>
          ) : null}
          {info ? (
            <TiraText size="xs" variant="p1">
              {`✉️ ${info}`}
            </TiraText>
          ) : null}

          <TiraButton
            variant="gold"
            fullWidth
            disabled={!email.trim() || !password || pending || !isSupabaseConfigured}
            onPress={() => void submit()}
          >
            {pending ? 'A processar…' : mode === 'signin' ? 'Entrar' : 'Criar conta'}
          </TiraButton>

          <TiraButton variant="ghost" fullWidth onPress={switchMode}>
            {mode === 'signin' ? 'Não tens conta? Cria uma' : 'Já tens conta? Entra'}
          </TiraButton>
        </View>
      </TiraCard>

      <TiraButton variant="outline" fullWidth onPress={goBack}>
        Continuar offline
      </TiraButton>

      <TiraText size="xs" variant="muted" align="center">
        Moeda virtual (KZ) apenas para entretenimento — nunca dinheiro real.
      </TiraText>
    </TiraScreen>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoComplete,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences';
  autoComplete?: 'email' | 'password' | 'off';
}) {
  return (
    <View style={{ gap: spacing[2] }}>
      <TiraText
        size="xs"
        weight="semibold"
        variant="muted"
        style={{ textTransform: 'uppercase', letterSpacing: 1 }}
      >
        {label}
      </TiraText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={false}
        style={{
          height: 44,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: alpha(colors.surface, 0.6),
          paddingHorizontal: spacing[3],
          color: colors.text,
          fontSize: 15,
        }}
      />
    </View>
  );
}
