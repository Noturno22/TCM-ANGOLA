import { useState } from 'react';
import { router } from 'expo-router';
import {
  Bell,
  ChevronDown,
  Eye,
  FileText,
  Globe,
  HelpCircle,
  Info,
  Languages,
  LogOut,
  Minus,
  Music,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sun,
  Triangle,
  Vibrate,
  Volume2,
  type LucideIcon,
} from 'lucide-react-native';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { GameButton, GameCard, SectionTitle } from '@/components/game/ui';
import { TiraScreen, alpha } from '@/components/tira';
import { LANGUAGES } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { useAuth } from '@/store/auth';
import { useProfile } from '@/store/profile';
import { useSettings } from '@/store/settings';
import { colors, radii, spacing, typography } from '@/theme';

const ADMIN_EMAILS = (process.env.EXPO_PUBLIC_ADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const APPEARANCE_TOGGLES: {
  key: 'colorblindMode' | 'symbolsOnPieces' | 'reduceMotion';
  icon: LucideIcon;
  label: string;
  description: string;
}[] = [
  {
    key: 'colorblindMode',
    icon: Eye,
    label: 'Modo daltonismo',
    description: 'Ajusta as cores para maior contraste',
  },
  {
    key: 'symbolsOnPieces',
    icon: Triangle,
    label: 'Símbolos nas peças',
    description: 'Mostra triângulos no P1 e círculos no P2 (acessibilidade)',
  },
  {
    key: 'reduceMotion',
    icon: RotateCcw,
    label: 'Reduzir animações',
    description: 'Desativa animações para maior clareza',
  },
];

const SOUND_TOGGLES: {
  key: 'soundEnabled' | 'musicEnabled' | 'vibration';
  icon: LucideIcon;
  label: string;
  description: string;
}[] = [
  {
    key: 'soundEnabled',
    icon: Volume2,
    label: 'Efeitos sonoros',
    description: 'Sons de seleção, movimento, vitória',
  },
  {
    key: 'musicEnabled',
    icon: Music,
    label: 'Música de fundo',
    description: 'Música ambiente discreta',
  },
  {
    key: 'vibration',
    icon: Vibrate,
    label: 'Vibração',
    description: 'Feedback háptico no mobile',
  },
];

export default function SettingsScreen() {
  const settings = useSettings();
  const resetProfile = useProfile((s) => s.resetProfile);
  const elo = useProfile((s) => s.elo);
  const email = useAuth((s) => s.user?.email?.toLowerCase() ?? null);
  const [languageOpen, setLanguageOpen] = useState(false);

  const isAdmin = email !== null && ADMIN_EMAILS.includes(email);

  const confirmLogout = () => {
    Alert.alert(
      'Sair da conta?',
      'Podes continuar a jogar como convidado. O teu progresso local será mantido.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: () => {
            void useAuth.getState().signOut();
            router.replace('/auth');
          },
        },
      ],
    );
  };

  const confirmReset = () => {
    Alert.alert(
      'Reiniciar todo o progresso?',
      'Isto apaga permanentemente o teu histórico, estatísticas, XP e conquistas. A ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sim, reiniciar tudo',
          style: 'destructive',
          onPress: () => {
            resetProfile();
            toast('Progresso reiniciado.');
          },
        },
      ],
    );
  };

  return (
    <TiraScreen>
      <View style={{ gap: spacing[5] }}>
        <View>
          <SectionTitle title="Conta" />
          <GameCard>
            <Row icon={Info} label="Nome de utilizador" value="Jogador" />
            <Row icon={Globe} label="Elo" value={`${elo}`} divider />
            <Row icon={Bell} label="Notificações" defaultChecked divider />
          </GameCard>
        </View>

        <View>
          <SectionTitle title="Apariência" />
          <GameCard>
            {APPEARANCE_TOGGLES.map((item, index) => (
              <ToggleRow
                key={item.key}
                icon={item.icon}
                label={item.label}
                description={item.description}
                checked={settings[item.key]}
                onChange={(v) => settings.set(item.key, v)}
                divider={index > 0}
              />
            ))}
            <ToggleRow
              icon={Sun}
              label="Modo claro"
              description="Interface clara em vez do tema escuro"
              checked={settings.theme === 'light'}
              onChange={(v) => settings.set('theme', v ? 'light' : 'dark')}
              divider
            />
          </GameCard>
        </View>

        <View>
          <SectionTitle title="Som e Háptico" />
          <GameCard>
            {SOUND_TOGGLES.map((item, index) => (
              <ToggleRow
                key={item.key}
                icon={item.icon}
                label={item.label}
                description={item.description}
                checked={settings[item.key]}
                onChange={(v) => settings.set(item.key, v)}
                divider={index > 0}
              />
            ))}
          </GameCard>
        </View>

        <View>
          <SectionTitle title="Inteligência Artificial" />
          <GameCard style={{ padding: spacing[4] }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[3],
                marginBottom: spacing[3],
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: radii.lg,
                  backgroundColor: alpha(colors.p1, 0.15),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Info size={16} color={colors.p1} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: 15.75,
                    fontWeight: typography.fontWeight.medium,
                    color: colors.text,
                    fontFamily: typography.fontFamily.body,
                  }}
                >
                  Atraso de pensamento da IA
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.textMuted,
                    fontFamily: typography.fontFamily.body,
                  }}
                >
                  {'Tempo que a IA "pensa" antes de jogar'}
                </Text>
              </View>
            </View>
            <AiDelayControl
              value={settings.aiThinkingDelay}
              onChange={(v) => settings.set('aiThinkingDelay', v)}
            />
          </GameCard>
        </View>

        <View>
          <SectionTitle title="Idioma" />
          <GameCard style={{ padding: spacing[4] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
              <Languages size={16} color={colors.textMuted} />
              <Text
                style={{
                  flex: 1,
                  fontSize: 15.75,
                  color: colors.text,
                  fontFamily: typography.fontFamily.body,
                }}
              >
                Idioma da interface
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Idioma da interface"
                onPress={() => setLanguageOpen(true)}
                style={({ pressed }) => ({
                  width: 144,
                  height: spacing[12],
                  borderRadius: radii.xl,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.surface : colors.surfaceAlt,
                  paddingHorizontal: spacing[3],
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                })}
              >
                <Text
                  style={{
                    fontSize: 15.75,
                    color: colors.text,
                    fontFamily: typography.fontFamily.body,
                  }}
                >
                  {LANGUAGES.find((l) => l.id === settings.language)?.label ?? settings.language}
                </Text>
                <ChevronDown size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          </GameCard>
        </View>

        {isAdmin ? (
          <View>
            <SectionTitle title="Administração" />
            <GameCard>
              <LinkRow
                icon={ShieldCheck}
                label="Depósitos e levantamentos"
                onPress={() => router.push('/admin')}
              />
            </GameCard>
          </View>
        ) : null}

        <View>
          <SectionTitle title="Ajuda e Informação" />
          <GameCard>
            <LinkRow
              icon={HelpCircle}
              label="Como jogar"
              onPress={() => router.push('/how-to-play')}
            />
            <LinkRow
              icon={FileText}
              label="Termos e Privacidade"
              onPress={() => toast('Documento em preparação.')}
              divider
            />
            <LinkRow
              icon={Info}
              label="Sobre o jogo"
              onPress={() => router.push('/about')}
              divider
            />
          </GameCard>
        </View>

        <View>
          <SectionTitle title="Conta" />
          <View style={{ gap: spacing[2] }}>
            <GameButton variant="p2" onPress={confirmLogout} style={{ width: '100%' }}>
              <LogOut size={16} color={colors.white} />
              <Text
                style={{
                  fontSize: 15.75,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.white,
                  fontFamily: typography.fontFamily.body,
                }}
              >
                Sair da conta
              </Text>
            </GameButton>

            <GameButton variant="outline" onPress={confirmReset} style={{ width: '100%' }}>
              <RotateCcw size={16} color={colors.text} />
              <Text
                style={{
                  fontSize: 15.75,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.text,
                  fontFamily: typography.fontFamily.body,
                }}
              >
                Reiniciar progresso
              </Text>
            </GameButton>
          </View>
        </View>

        <Text
          style={{
            textAlign: 'center',
            fontSize: 10,
            color: colors.textMuted,
            paddingTop: spacing[2],
            fontFamily: typography.fontFamily.body,
          }}
        >
          Tira o Cocó do Meio • Versão 1.0
        </Text>
      </View>

      <Modal
        transparent
        visible={languageOpen}
        animationType="fade"
        onRequestClose={() => setLanguageOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: alpha(colors.black, 0.6),
            justifyContent: 'center',
            padding: spacing[6],
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            onPress={() => setLanguageOpen(false)}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: radii.cardLg,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}
          >
            <ScrollView style={{ maxHeight: 420 }}>
              {LANGUAGES.map((option, index) => {
                const active = settings.language === option.id;
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      settings.set('language', option.id);
                      setLanguageOpen(false);
                    }}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: spacing[4],
                      paddingVertical: spacing[3],
                      borderTopWidth: index === 0 ? 0 : 1,
                      borderTopColor: colors.border,
                      backgroundColor: active
                        ? alpha(colors.gold, 0.1)
                        : pressed
                          ? colors.surfaceAlt
                          : colors.transparent,
                    })}
                  >
                    <Text
                      style={{
                        fontSize: 15.75,
                        fontWeight: active
                          ? typography.fontWeight.semibold
                          : typography.fontWeight.medium,
                        color: active ? colors.gold : colors.text,
                        fontFamily: typography.fontFamily.body,
                      }}
                    >
                      {option.flag} {option.label}
                    </Text>
                    {active ? (
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: radii.pill,
                          backgroundColor: colors.gold,
                        }}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </TiraScreen>
  );
}

function AiDelayControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const min = 200;
  const max = 1200;
  const step = 100;
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Diminuir atraso da IA"
        accessibilityState={{ disabled: atMin }}
        disabled={atMin}
        onPress={() => onChange(Math.max(min, value - step))}
        style={({ pressed }) => ({
          width: 32,
          height: 32,
          borderRadius: radii.pill,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: atMin ? 0.4 : pressed ? 0.7 : 1,
        })}
      >
        <Minus size={14} color={colors.text} />
      </Pressable>

      <View
        style={{
          flex: 1,
          height: 6,
          borderRadius: radii.pill,
          backgroundColor: colors.surfaceAlt,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: radii.pill,
            backgroundColor: colors.gold,
          }}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Aumentar atraso da IA"
        accessibilityState={{ disabled: atMax }}
        disabled={atMax}
        onPress={() => onChange(Math.min(max, value + step))}
        style={({ pressed }) => ({
          width: 32,
          height: 32,
          borderRadius: radii.pill,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: atMax ? 0.4 : pressed ? 0.7 : 1,
        })}
      >
        <Plus size={14} color={colors.text} />
      </Pressable>

      <Text
        style={{
          width: 56,
          textAlign: 'right',
          fontSize: 15.75,
          letterSpacing: 0.315,
          color: colors.gold,
          fontFamily: typography.fontFamily.display,
        }}
      >
        {(value / 1000).toFixed(1)}s
      </Text>
    </View>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  defaultChecked,
  divider = false,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
  defaultChecked?: boolean;
  divider?: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked ?? false);

  return (
    <View style={[rowStyle, dividerStyle(divider)]}>
      <Icon size={16} color={colors.textMuted} />
      <Text
        style={{
          flex: 1,
          fontSize: 15.75,
          color: colors.text,
          fontFamily: typography.fontFamily.body,
        }}
      >
        {label}
      </Text>
      {value !== undefined ? (
        <Text
          style={{
            fontSize: 15.75,
            color: colors.textMuted,
            fontFamily: typography.fontFamily.body,
          }}
        >
          {value}
        </Text>
      ) : null}
      {defaultChecked !== undefined ? (
        <Switch
          value={checked}
          onValueChange={setChecked}
          accessibilityLabel={label}
          trackColor={{ false: colors.surfaceAlt, true: colors.gold }}
          thumbColor={colors.white}
          ios_backgroundColor={colors.surfaceAlt}
        />
      ) : null}
    </View>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
  divider = false,
}: {
  icon: LucideIcon;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  divider?: boolean;
}) {
  return (
    <View style={[rowStyle, dividerStyle(divider)]}>
      <Icon size={16} color={colors.textMuted} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: 15.75,
            fontWeight: typography.fontWeight.medium,
            lineHeight: 18,
            color: colors.text,
            fontFamily: typography.fontFamily.body,
          }}
        >
          {label}
        </Text>
        {description ? (
          <Text
            style={{
              marginTop: 2,
              fontSize: 11,
              lineHeight: 14,
              color: colors.textMuted,
              fontFamily: typography.fontFamily.body,
            }}
          >
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={checked}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ false: colors.surfaceAlt, true: colors.gold }}
        thumbColor={colors.white}
        ios_backgroundColor={colors.surfaceAlt}
      />
    </View>
  );
}

function LinkRow({
  icon: Icon,
  label,
  onPress,
  divider = false,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  divider?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        rowStyle,
        dividerStyle(divider),
        { backgroundColor: pressed ? alpha(colors.surfaceAlt, 0.3) : colors.transparent },
      ]}
    >
      <Icon size={16} color={colors.textMuted} />
      <Text
        style={{
          flex: 1,
          fontSize: 15.75,
          color: colors.text,
          fontFamily: typography.fontFamily.body,
        }}
      >
        {label}
      </Text>
      <Text style={{ fontSize: 18, lineHeight: 18, color: colors.textMuted }}>›</Text>
    </Pressable>
  );
}

const rowStyle: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: spacing[3],
  padding: spacing[4],
};

function dividerStyle(divider: boolean): ViewStyle | null {
  return divider ? { borderTopWidth: 1, borderTopColor: colors.border } : null;
}
