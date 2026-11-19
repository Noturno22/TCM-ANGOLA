/**
 * Depósitos e levantamentos de dinheiro real (fluxo manual com comprovativo).
 *
 * Port 1:1 de `src/components/screens/DepositScreen.tsx` para Expo/React Native.
 *
 * Adaptações mobile:
 *  - O comprovativo é indicado por URL/referência (TextInput). O upload direto
 *    de ficheiros exigiria `expo-document-picker`/`expo-image-picker`, que não
 *    estão instalados no projeto.
 *  - O depósito automático (AppyPay/BitPay) não tem lib equivalente no mobile;
 *    o cartão fica visível e desativado com uma explicação honesta.
 *  - Copiar valores usa `Alert.alert` (sem `expo-clipboard` instalado).
 *  - A chave-mestra `REAL_MONEY_ENABLED` vem de `EXPO_PUBLIC_REAL_MONEY_ENABLED`
 *    (default ligada), já que o mobile não tem `@/lib/config/flags`.
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextStyle,
} from 'react-native';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Clock,
  Copy,
  ImageUp,
  Landmark,
  Lock,
  RefreshCw,
  Send,
  Smartphone,
  Trash2,
  Wallet,
  Zap,
} from 'lucide-react-native';
import { GameButton, GameCard, SectionTitle } from '@/components/game/ui';
import { SegmentedControl, TiraScreen, alpha } from '@/components/tira';
import { createClient } from '@/lib/supabase/client';
import {
  MAX_DEPOSIT,
  MAX_WITHDRAWAL,
  MIN_DEPOSIT,
  MIN_WITHDRAWAL,
  PENDING_DEPOSIT_ERROR,
  formatMoney,
  hasPendingDeposit,
  methodsForCurrency,
  saveReceipt,
  submitWithdrawal,
  type ManualCurrency,
  type PaymentMethodId,
  type PaymentMethodInfo,
} from '@/lib/payments/manual';
import { useAuth } from '@/store/auth';
import { useWalletMovements, type WalletMovement } from '@/store/walletMovements';
import { colors, radii, spacing, typography } from '@/theme';

const BODY = typography.fontFamily.body;
const DISPLAY = typography.fontFamily.display;

const CURRENCIES: ManualCurrency[] = ['aoa', 'usd'];

/**
 * A web usa `NEXT_PUBLIC_REAL_MONEY_ENABLED` (default false). O mobile não tem
 * esse módulo de flags; mantemos a chave disponível por env Expo e ligada por
 * omissão para o port visual completo.
 */
const REAL_MONEY_ENABLED = process.env.EXPO_PUBLIC_REAL_MONEY_ENABLED !== 'false';

const METHOD_ICONS: Record<PaymentMethodId, ReactNode> = {
  binance: <Landmark size={20} color={colors.onColor} />,
  rodotpay: <Smartphone size={20} color={colors.onColor} />,
  express: <Smartphone size={20} color={colors.onColor} />,
};

const STATUS_LABEL: Record<WalletMovement['status'], string> = {
  pendente: 'Pendente',
  concluido: 'Concluído',
  recusado: 'Recusado',
};

const STATUS_STYLE: Record<
  WalletMovement['status'],
  { background: string; foreground: string; border: string }
> = {
  pendente: {
    background: alpha(colors.orange, 0.15),
    foreground: colors.orange,
    border: alpha(colors.orange, 0.3),
  },
  concluido: {
    background: alpha(colors.p1, 0.15),
    foreground: colors.p1,
    border: alpha(colors.p1, 0.3),
  },
  recusado: {
    background: alpha(colors.p2, 0.15),
    foreground: colors.p2,
    border: alpha(colors.p2, 0.3),
  },
};

const GOLD_BUTTON_TEXT: TextStyle = {
  color: colors.primaryForeground,
  fontSize: 15.75,
  fontWeight: typography.fontWeight.semibold,
  fontFamily: BODY,
};

const GHOST_BUTTON_TEXT: TextStyle = {
  color: colors.text,
  fontSize: 15.75,
  fontWeight: typography.fontWeight.semibold,
  fontFamily: BODY,
};

const INPUT_STYLE: TextStyle = {
  height: 48,
  borderRadius: radii.lg,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: alpha(colors.surface, 0.6),
  paddingHorizontal: spacing[3],
  paddingVertical: 0,
  color: colors.text,
  fontSize: 15.75,
  fontFamily: BODY,
  textAlignVertical: 'center',
};

function parseAmount(raw: string): number {
  const n = Number(String(raw).replace(',', '.').trim());
  return Number.isFinite(n) ? n : 0;
}

function notify(title: string, description?: string): void {
  Alert.alert(title, description);
}

function formatBalance(minor: number): string {
  return (minor / 100).toLocaleString('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Equivalente mobile de `fetchAccount` + `fetchBalanceMinor` de
 * `@/lib/payments/client` (que não existe no mobile). Lê diretamente as tabelas
 * `accounts`/`ledger_entries` sob RLS, como faz a web.
 */
async function fetchAccountBalanceMinor(currency: ManualCurrency): Promise<number> {
  const supabase = createClient();
  if (!supabase) return 0;

  const { data: account, error } = await supabase
    .from('accounts')
    .select('id')
    .eq('currency', currency === 'usd' ? 'USD' : 'AOA')
    .maybeSingle();
  if (error || !account) return 0;

  const { data, error: ledgerError } = await supabase
    .from('ledger_entries')
    .select('balance_after')
    .eq('account_id', (account as { id: string }).id)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ledgerError) return 0;
  return Number((data as { balance_after?: number } | null)?.balance_after ?? 0);
}

function FormLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontSize: 15.75,
        fontWeight: typography.fontWeight.medium,
        color: colors.text,
        fontFamily: BODY,
      }}
    >
      {children}
    </Text>
  );
}

function AmountField({
  value,
  onChangeText,
  currency,
  editable = true,
}: {
  value: string;
  onChangeText: (value: string) => void;
  currency: ManualCurrency;
  editable?: boolean;
}) {
  return (
    <View style={{ position: 'relative', justifyContent: 'center' }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        placeholder="0.00"
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
        style={{
          height: 48,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: alpha(colors.surface, 0.6),
          paddingLeft: spacing[3],
          paddingRight: 80,
          paddingVertical: 0,
          color: colors.text,
          fontSize: 20.25,
          letterSpacing: 0.405,
          fontFamily: DISPLAY,
          textAlignVertical: 'center',
        }}
      />
      <Text
        style={{
          position: 'absolute',
          right: spacing[3],
          color: colors.textMuted,
          fontSize: 15.75,
          fontWeight: typography.fontWeight.medium,
          fontFamily: BODY,
        }}
      >
        {currency.toUpperCase()}
      </Text>
    </View>
  );
}

function MethodOption({
  method,
  selected,
  disabled = false,
  onPress,
}: {
  method: PaymentMethodInfo;
  selected: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: selected ? alpha(colors.gold, 0.6) : colors.border,
        backgroundColor: selected ? alpha(colors.gold, 0.1) : alpha(colors.surface, 0.6),
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[3],
        minHeight: 48,
        opacity: disabled ? 0.6 : pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radii.lg,
          backgroundColor: method.color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {METHOD_ICONS[method.id]}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 15.75,
            fontWeight: typography.fontWeight.semibold,
            color: colors.text,
            fontFamily: BODY,
          }}
        >
          {method.label}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 13.5,
            color: colors.textMuted,
            fontFamily: BODY,
            marginTop: 1,
          }}
        >
          {method.details}
        </Text>
      </View>
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: radii.pill,
          borderWidth: 2,
          borderColor: selected ? colors.gold : alpha(colors.textMuted, 0.5),
          backgroundColor: selected ? colors.gold : colors.transparent,
        }}
      />
    </Pressable>
  );
}

/**
 * Cartão do depósito automático (AppyPay/BitPay). A web só o mostra quando há
 * providers configurados; no mobile não existe `@/lib/payments/auto`, por isso
 * mantemos o conteúdo visível mas desativado.
 */
function AutoDepositUnavailableCard() {
  return (
    <View
      style={{
        gap: spacing[3],
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: alpha(colors.gold, 0.3),
        backgroundColor: alpha(colors.gold, 0.06),
        padding: spacing[4],
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' }}>
        <Zap size={16} color={colors.gold} />
        <Text
          style={{
            fontSize: 15.75,
            fontWeight: typography.fontWeight.semibold,
            color: colors.text,
            fontFamily: BODY,
          }}
        >
          Depósito automático
        </Text>
        <View
          style={{
            borderWidth: 1,
            borderColor: alpha(colors.gold, 0.4),
            borderRadius: radii.sm,
            paddingHorizontal: 6,
            paddingVertical: 2,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              letterSpacing: 1,
              color: colors.gold,
              fontFamily: BODY,
              fontWeight: typography.fontWeight.semibold,
            }}
          >
            INDISPONÍVEL
          </Text>
        </View>
      </View>

      <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textMuted, fontFamily: BODY }}>
        AppyPay e BitPay ainda não estão disponíveis nesta versão mobile. Usa o depósito manual com
        comprovativo abaixo.
      </Text>

      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        <GameButton variant="gold" disabled style={{ flex: 1, paddingHorizontal: spacing[2] }}>
          <Smartphone size={16} color={colors.primaryForeground} />
          <Text numberOfLines={1} style={[GOLD_BUTTON_TEXT, { fontSize: 13.5, flexShrink: 1 }]}>
            Multicaixa Express
          </Text>
        </GameButton>
        <GameButton variant="ghost" disabled style={{ flex: 1, paddingHorizontal: spacing[2] }}>
          <Landmark size={16} color={colors.text} />
          <Text numberOfLines={1} style={[GHOST_BUTTON_TEXT, { fontSize: 13.5, flexShrink: 1 }]}>
            Referência
          </Text>
        </GameButton>
      </View>

      <View style={{ gap: 6 }}>
        <FormLabel>Telemóvel Multicaixa Express</FormLabel>
        <TextInput
          editable={false}
          placeholder="9XX XXX XXX"
          placeholderTextColor={colors.textMuted}
          style={[INPUT_STYLE, { color: colors.textMuted }]}
        />
        <Text style={{ fontSize: 13.5, color: colors.textMuted, fontFamily: BODY }}>
          Recebes o pedido na app do Multicaixa Express e confirmas lá.
        </Text>
      </View>

      <GameButton variant="gold" disabled style={{ width: '100%' }}>
        <Zap size={16} color={colors.primaryForeground} />
        <Text style={GOLD_BUTTON_TEXT}>Pagar agora</Text>
      </GameButton>

      <Text style={{ fontSize: 11, lineHeight: 16, color: colors.textMuted, fontFamily: BODY }}>
        Processado pela AppyPay / BitPay — o saldo entra na carteira assim que o pagamento for
        confirmado. Sem comprovativo nem espera por aprovação.
      </Text>
    </View>
  );
}

interface ProofModalProps {
  visible: boolean;
  onClose: () => void;
  method: PaymentMethodInfo;
  currency: ManualCurrency;
  amount: number;
  onSubmit: (proofUrl: string) => Promise<void>;
}

function ProofModal({ visible, onClose, method, currency, amount, onSubmit }: ProofModalProps) {
  const [proofUrl, setProofUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const handleCopy = () => {
    Alert.alert('Copiar manualmente', method.copyValue);
  };

  const handleSubmit = async () => {
    const value = proofUrl.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      await onSubmit(value);
      setProofUrl('');
      onClose();
    } catch (err) {
      notify(
        'Falha ao enviar o comprovativo.',
        err instanceof Error ? err.message : 'Tenta novamente.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing[5],
        }}
        onPress={onClose}
      >
        <Pressable
          onPress={() => undefined}
          style={{
            width: '100%',
            maxWidth: 420,
            maxHeight: '90%',
            backgroundColor: colors.card,
            borderRadius: radii.cardLg,
            borderWidth: 1,
            borderColor: alpha(colors.gold, 0.3),
            padding: spacing[5],
          }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[4] }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radii.xl,
                  backgroundColor: method.color,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Wallet size={20} color={colors.onColor} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 20.25,
                    letterSpacing: 0.506,
                    color: colors.text,
                    fontFamily: DISPLAY,
                  }}
                >
                  {method.label}
                </Text>
                <Text style={{ fontSize: 13.5, color: colors.textMuted, fontFamily: BODY }}>
                  {`${formatMoney(amount, currency)} · ${currency.toUpperCase()}`}
                </Text>
              </View>
            </View>

            <View
              style={{
                borderRadius: radii.xl,
                borderWidth: 1,
                borderColor: alpha(colors.surface, 0.5),
                backgroundColor: alpha(colors.surface, 0.6),
                padding: spacing[3],
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  color: colors.textMuted,
                  fontFamily: BODY,
                  marginBottom: 6,
                }}
              >
                Valor a transferir
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 20.25,
                    letterSpacing: 0.405,
                    color: colors.gold,
                    fontFamily: DISPLAY,
                  }}
                >
                  {method.copyValue}
                </Text>
                <GameButton
                  variant="outline"
                  onPress={handleCopy}
                  accessibilityLabel={`Copiar ${method.copyValue}`}
                  style={{ height: 48, paddingHorizontal: spacing[3] }}
                >
                  <Copy size={14} color={colors.text} />
                  <Text style={GHOST_BUTTON_TEXT}>Copiar</Text>
                </GameButton>
              </View>
              <Text style={{ fontSize: 13.5, color: colors.textMuted, fontFamily: BODY, marginTop: 8 }}>
                {method.details}
              </Text>
            </View>

            <View style={{ gap: 4 }}>
              {[
                'Transfere o valor indicado para a conta acima.',
                'Faz uma captura de ecrã do comprovativo.',
                'Anexa a imagem e submete para revisão.',
              ].map((line, index) => (
                <View key={line} style={{ flexDirection: 'row', gap: 6 }}>
                  <Text style={{ fontSize: 13.5, color: colors.textMuted, fontFamily: BODY }}>
                    {`${index + 1}.`}
                  </Text>
                  <Text
                    style={{ flex: 1, fontSize: 13.5, color: colors.textMuted, fontFamily: BODY }}
                  >
                    {line}
                  </Text>
                </View>
              ))}
            </View>

            <View style={{ gap: spacing[2] }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  borderRadius: radii.xl,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: alpha(colors.gold, 0.4),
                  backgroundColor: alpha(colors.surface, 0.6),
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[3],
                }}
              >
                <ImageUp size={20} color={colors.gold} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 15.75,
                      fontWeight: typography.fontWeight.medium,
                      color: colors.text,
                      fontFamily: BODY,
                    }}
                  >
                    {proofUrl.trim() ? 'Comprovativo indicado' : 'Escolher comprovativo'}
                  </Text>
                  <Text style={{ fontSize: 13.5, color: colors.textMuted, fontFamily: BODY }}>
                    {proofUrl.trim() ? 'Link introduzido — pronto a submeter' : 'PNG ou JPG'}
                  </Text>
                </View>
              </View>

              <TextInput
                value={proofUrl}
                onChangeText={setProofUrl}
                editable={!busy}
                placeholder="Cola aqui o link do comprovativo (upload de ficheiros indisponível no mobile)"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={INPUT_STYLE}
              />
              <Text
                style={{ fontSize: 13.5, lineHeight: 16, color: colors.textMuted, fontFamily: BODY }}
              >
                O envio direto de imagens requer expo-image-picker (não instalado). Cola o URL
                público da imagem.
              </Text>
            </View>

            <GameButton
              variant="gold"
              disabled={!proofUrl.trim() || busy}
              onPress={() => void handleSubmit()}
              accessibilityLabel="Submeter comprovativo"
              style={{ width: '100%' }}
            >
              {busy ? (
                <>
                  <ActivityIndicator color={colors.primaryForeground} />
                  <Text style={GOLD_BUTTON_TEXT}>A enviar…</Text>
                </>
              ) : (
                <Text style={GOLD_BUTTON_TEXT}>Submeter comprovativo</Text>
              )}
            </GameButton>

            {!proofUrl.trim() && !busy ? (
              <View style={{ flexDirection: 'row', gap: 6, marginTop: -2 }}>
                <View style={{ marginTop: 2 }}>
                  <AlertCircle size={14} color={colors.textMuted} />
                </View>
                <Text
                  style={{ flex: 1, fontSize: 13.5, color: colors.textMuted, fontFamily: BODY }}
                >
                  Precisas de anexar o comprovativo para continuar.
                </Text>
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface SuccessModalProps {
  visible: boolean;
  onClose: () => void;
  amount: number;
  currency: ManualCurrency;
}

function SuccessModal({ visible, onClose, amount, currency }: SuccessModalProps) {
  const formatted = formatMoney(amount, currency);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing[5],
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 420,
            backgroundColor: colors.card,
            borderRadius: radii.cardLg,
            borderWidth: 1,
            borderColor: alpha(colors.gold, 0.3),
            padding: spacing[5],
            gap: spacing[4],
          }}
        >
          <View style={{ alignItems: 'center', gap: spacing[2] }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: radii.pill,
                backgroundColor: alpha(colors.p1, 0.15),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={36} color={colors.p1} />
            </View>
            <Text
              style={{
                fontSize: 22.5,
                letterSpacing: 0.5625,
                textAlign: 'center',
                color: colors.text,
                fontFamily: DISPLAY,
              }}
            >
              Comprovativo enviado!
            </Text>
            <Text
              style={{
                fontSize: 15.75,
                textAlign: 'center',
                color: colors.textMuted,
                fontFamily: BODY,
              }}
            >
              {'O teu comprovativo de '}
              <Text style={{ fontWeight: typography.fontWeight.bold, color: colors.text }}>
                {formatted}
              </Text>
              {' foi registado.'}
            </Text>
          </View>

          <View
            style={{
              flexDirection: 'row',
              gap: 10,
              padding: spacing[3],
              borderRadius: radii.xl,
              backgroundColor: alpha(colors.surface, 0.6),
              borderWidth: 1,
              borderColor: alpha(colors.surface, 0.4),
            }}
          >
            <View style={{ marginTop: 2 }}>
              <Clock size={16} color={colors.gold} />
            </View>
            <Text
              style={{ flex: 1, fontSize: 13.5, lineHeight: 18, color: colors.textMuted, fontFamily: BODY }}
            >
              {'Está '}
              <Text style={{ fontWeight: typography.fontWeight.semibold, color: colors.text }}>
                pendente de revisão
              </Text>
              {'. Assim que um administrador aprovar, o valor entra no teu saldo real e verás o movimento concluído no histórico.'}
            </Text>
          </View>

          <GameButton variant="gold" onPress={onClose} style={{ width: '100%' }}>
            <Text style={GOLD_BUTTON_TEXT}>Entendi</Text>
          </GameButton>
        </View>
      </View>
    </Modal>
  );
}

export default function DepositScreen() {
  const user = useAuth((s) => s.user);
  const initialize = useAuth((s) => s.initialize);

  const movements = useWalletMovements((s) => s.movements);
  const movementsLoading = useWalletMovements((s) => s.loading);
  const loadMovements = useWalletMovements((s) => s.load);
  const addMovement = useWalletMovements((s) => s.addMovement);
  const deleteMovement = useWalletMovements((s) => s.deleteMovement);

  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [currency, setCurrency] = useState<ManualCurrency>('aoa');
  const [amountStr, setAmountStr] = useState('');
  const [method, setMethod] = useState<PaymentMethodId>('rodotpay');
  const [details, setDetails] = useState('');

  const [proofOpen, setProofOpen] = useState(false);
  const [success, setSuccess] = useState<{ amount: number; currency: ManualCurrency } | null>(null);

  const [balanceMinor, setBalanceMinor] = useState(0);
  const [pendingDeposit, setPendingDeposit] = useState(false);
  const [busy, setBusy] = useState(false);

  const amount = parseAmount(amountStr);
  const methods = useMemo(() => methodsForCurrency(currency), [currency]);
  const activeMethod = methods.find((m) => m.id === method) ?? methods[0];
  const formBlocked = pendingDeposit;

  const refreshBalance = useCallback(
    async (c: ManualCurrency = currency) => {
      try {
        setBalanceMinor(await fetchAccountBalanceMinor(c));
      } catch {
        setBalanceMinor(0);
      }
    },
    [currency],
  );

  const refreshPending = useCallback(async () => {
    if (!user) {
      setPendingDeposit(false);
      return;
    }
    try {
      setPendingDeposit(await hasPendingDeposit(user.id));
    } catch {
      setPendingDeposit(false);
    }
  }, [user]);

  useEffect(() => {
    if (!REAL_MONEY_ENABLED || !user) return;
    void loadMovements(user.id);
    void refreshBalance();
    void refreshPending();
  }, [user, loadMovements, refreshBalance, refreshPending]);

  useEffect(() => {
    if (!methods.some((m) => m.id === method) && methods[0]) setMethod(methods[0].id);
    if (!REAL_MONEY_ENABLED || !user) return;
    void refreshBalance();
  }, [currency, methods, method, user, refreshBalance]);

  const depositError = useMemo(() => {
    if (!amountStr) return null;
    if (amount <= 0) return 'Indica um valor válido.';
    if (amount < MIN_DEPOSIT[currency])
      return `Depósito mínimo: ${formatMoney(MIN_DEPOSIT[currency], currency)}.`;
    if (amount > MAX_DEPOSIT[currency])
      return `Depósito máximo: ${formatMoney(MAX_DEPOSIT[currency], currency)}.`;
    return null;
  }, [amountStr, amount, currency]);

  const withdrawError = useMemo(() => {
    if (!amountStr) return null;
    if (amount <= 0) return 'Indica um valor válido.';
    if (amount < MIN_WITHDRAWAL[currency])
      return `Levantamento mínimo: ${formatMoney(MIN_WITHDRAWAL[currency], currency)}.`;
    if (amount > MAX_WITHDRAWAL[currency])
      return `Levantamento máximo: ${formatMoney(MAX_WITHDRAWAL[currency], currency)}.`;
    const balance = balanceMinor / 100;
    if (amount > balance)
      return `Saldo insuficiente (${formatMoney(balance, currency)} disponíveis).`;
    return null;
  }, [amountStr, amount, currency, balanceMinor]);

  const handleProofSubmit = async (proofUrl: string) => {
    if (!user) throw new Error('Sessão expirada. Volta a entrar.');
    if (!activeMethod) throw new Error('Escolhe um método de pagamento.');

    try {
      const receiptId = await saveReceipt({
        userId: user.id,
        userEmail: user.email ?? '',
        proofUrl,
        method: activeMethod.id,
        amount,
        currency,
        plan: 'wallet',
      });

      await addMovement(user.id, {
        type: 'deposit',
        method: activeMethod.id,
        amount,
        currency,
        plan: 'wallet',
        status: 'pendente',
        receiptId,
      });

      await refreshPending();
      setSuccess({ amount, currency });
      setAmountStr('');
    } catch (err) {
      if (err instanceof Error && err.message === PENDING_DEPOSIT_ERROR) {
        setPendingDeposit(true);
      }
      throw err;
    }
  };

  const handleWithdraw = async () => {
    if (!user) return;
    if (withdrawError) {
      notify(withdrawError);
      return;
    }
    if (!details.trim()) {
      notify(
        'Indica os dados de destino.',
        'Ex.: NIF, telefone ou IBAN conforme o método escolhido.',
      );
      return;
    }
    if (!activeMethod) {
      notify('Escolhe um método de pagamento.');
      return;
    }
    setBusy(true);
    try {
      const requestId = await submitWithdrawal({
        userId: user.id,
        method: activeMethod.id,
        amount,
        currency,
        details: details.trim(),
      });
      await addMovement(user.id, {
        type: 'withdrawal',
        method: activeMethod.id,
        amount,
        currency,
        status: 'pendente',
        requestId,
      });
      await refreshBalance();
      notify('Pedido de levantamento enviado!', 'Vais ser notificado quando for processado.');
      setAmountStr('');
      setDetails('');
    } catch (err) {
      notify(
        'Falha ao pedir o levantamento.',
        err instanceof Error ? err.message : 'Tenta novamente.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (m: WalletMovement) => {
    if (!user) return;
    await deleteMovement(user.id, m.id);
    await refreshPending();
    notify('Movimento removido.');
  };

  // --------------------------------- Gates ---------------------------------

  if (!REAL_MONEY_ENABLED) {
    return (
      <TiraScreen>
        <View>
          <SectionTitle title="Depósitos e levantamentos" />
          <GameCard style={{ padding: spacing[5], alignItems: 'center', gap: spacing[3] }}>
            <Banknote size={32} color={colors.textMuted} />
            <Text
              style={{
                fontSize: 15.75,
                textAlign: 'center',
                color: colors.textMuted,
                fontFamily: BODY,
              }}
            >
              Em breve. O Tira o Cocó do Meio ainda não movimenta dinheiro real.
            </Text>
          </GameCard>
        </View>
      </TiraScreen>
    );
  }

  if (!user) {
    return (
      <TiraScreen>
        <View>
          <SectionTitle title="Depósitos e levantamentos" />
          <GameCard style={{ padding: spacing[5], alignItems: 'center', gap: spacing[3] }}>
            <Lock size={32} color={colors.gold} />
            <Text
              style={{
                fontSize: 15.75,
                textAlign: 'center',
                color: colors.textMuted,
                fontFamily: BODY,
              }}
            >
              Inicia sessão para depositar ou levantar dinheiro real.
            </Text>
            <GameButton
              variant="gold"
              onPress={() => {
                void initialize();
                router.push('/auth');
              }}
            >
              Iniciar sessão
            </GameButton>
          </GameCard>
        </View>
      </TiraScreen>
    );
  }

  const pendingCount = movements.filter((m) => m.status === 'pendente').length;

  return (
    <TiraScreen>
      {/* Saldo real */}
      <GameCard glow="gold" style={{ padding: spacing[5] }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: spacing[3],
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Banknote size={14} color={colors.gold} />
              <Text
                style={{
                  fontSize: 11,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  color: colors.gold,
                  fontFamily: BODY,
                  fontWeight: typography.fontWeight.semibold,
                }}
              >
                Saldo real disponível
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                gap: spacing[2],
                marginTop: spacing[1],
              }}
            >
              <Text
                style={{
                  fontSize: 40.5,
                  letterSpacing: 1.0125,
                  color: colors.gold,
                  fontFamily: DISPLAY,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatBalance(balanceMinor)}
              </Text>
              <Text style={{ fontSize: 20.25, letterSpacing: 0.405, color: colors.gold, fontFamily: DISPLAY }}>
                {currency.toUpperCase()}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Atualizar saldo"
            onPress={() => {
              void refreshBalance();
              void loadMovements(user.id);
              void refreshPending();
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <RefreshCw size={12} color={colors.textMuted} />
            <Text style={{ fontSize: 13.5, color: colors.textMuted, fontFamily: BODY }}>
              Atualizar
            </Text>
          </Pressable>
        </View>
        <Text style={{ fontSize: 13.5, color: colors.textMuted, fontFamily: BODY, marginTop: spacing[2] }}>
          Depósitos automáticos ou manuais com comprovativo; levantamentos manuais.
        </Text>
      </GameCard>

      {/* Aviso de depósito pendente */}
      {pendingDeposit ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 10,
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[3],
            borderRadius: radii.xl,
            backgroundColor: alpha(colors.orange, 0.1),
            borderWidth: 1,
            borderColor: alpha(colors.orange, 0.3),
          }}
        >
          <View style={{ marginTop: 2 }}>
            <Clock size={16} color={colors.orange} />
          </View>
          <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 18, color: colors.orange, fontFamily: BODY }}>
            {'Tens um comprovativo '}
            <Text style={{ fontWeight: typography.fontWeight.bold }}>pendente de revisão</Text>
            {'. Podes enviar outro depois de aprovado ou recusado.'}
          </Text>
        </View>
      ) : null}

      {/* Tabs */}
      <View style={{ gap: spacing[4] }}>
        <SegmentedControl<'deposit' | 'withdraw'>
          options={[
            { value: 'deposit', label: 'Depositar' },
            { value: 'withdraw', label: 'Levantar' },
          ]}
          value={tab}
          onChange={setTab}
          testID="deposit-tabs"
        />

        {tab === 'deposit' ? (
          <View style={{ gap: spacing[4] }}>
            {/* Moeda */}
            <View style={{ gap: 6 }}>
              <FormLabel>Moeda</FormLabel>
              <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                {CURRENCIES.map((c) => (
                  <GameButton
                    key={c}
                    variant={currency === c ? 'gold' : 'ghost'}
                    style={{ flex: 1, height: 48 }}
                    onPress={() => setCurrency(c)}
                  >
                    {c.toUpperCase()}
                  </GameButton>
                ))}
              </View>
            </View>

            {/* Valor */}
            <View style={{ gap: 6 }}>
              <FormLabel>Valor a depositar</FormLabel>
              <AmountField
                value={amountStr}
                onChangeText={setAmountStr}
                currency={currency}
                editable={!formBlocked}
              />
              <Text style={{ fontSize: 13.5, color: colors.textMuted, fontFamily: BODY }}>
                {`Mínimo ${formatMoney(MIN_DEPOSIT[currency], currency)} · Máximo ${formatMoney(
                  MAX_DEPOSIT[currency],
                  currency,
                )}`}
              </Text>
              {depositError ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={14} color={colors.p2} />
                  <Text style={{ fontSize: 13.5, color: colors.p2, fontFamily: BODY }}>
                    {depositError}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Depósito automático (indisponível no mobile) */}
            {currency === 'aoa' && !pendingDeposit ? <AutoDepositUnavailableCard /> : null}

            {/* Método (manual com comprovativo) */}
            <View style={{ gap: 6 }}>
              <FormLabel>Método de pagamento</FormLabel>
              <View style={{ gap: spacing[2] }}>
                {methods.map((m) => (
                  <MethodOption
                    key={m.id}
                    method={m}
                    selected={method === m.id}
                    disabled={formBlocked}
                    onPress={() => setMethod(m.id)}
                  />
                ))}
              </View>
            </View>

            <GameButton
              variant="gold"
              disabled={!amount || !!depositError || formBlocked || !activeMethod}
              onPress={() => setProofOpen(true)}
              accessibilityLabel="Continuar para envio de comprovativo"
              style={{ width: '100%' }}
            >
              <Send size={16} color={colors.primaryForeground} />
              <Text style={GOLD_BUTTON_TEXT}>
                {pendingDeposit ? 'Já tens um depósito pendente' : 'Continuar'}
              </Text>
            </GameButton>
          </View>
        ) : (
          <View style={{ gap: spacing[4] }}>
            <View style={{ gap: 6 }}>
              <FormLabel>Moeda</FormLabel>
              <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                {CURRENCIES.map((c) => (
                  <GameButton
                    key={c}
                    variant={currency === c ? 'gold' : 'ghost'}
                    style={{ flex: 1, height: 48 }}
                    onPress={() => setCurrency(c)}
                  >
                    {c.toUpperCase()}
                  </GameButton>
                ))}
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <FormLabel>Valor a levantar</FormLabel>
              <AmountField value={amountStr} onChangeText={setAmountStr} currency={currency} />
              <Text style={{ fontSize: 13.5, color: colors.textMuted, fontFamily: BODY }}>
                {`Disponível: ${formatMoney(balanceMinor / 100, currency)} · Mínimo ${formatMoney(
                  MIN_WITHDRAWAL[currency],
                  currency,
                )}`}
              </Text>
              {withdrawError ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={14} color={colors.p2} />
                  <Text style={{ fontSize: 13.5, color: colors.p2, fontFamily: BODY }}>
                    {withdrawError}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={{ gap: 6 }}>
              <FormLabel>Método de recebimento</FormLabel>
              <View style={{ gap: spacing[2] }}>
                {methods.map((m) => (
                  <MethodOption
                    key={m.id}
                    method={m}
                    selected={method === m.id}
                    onPress={() => setMethod(m.id)}
                  />
                ))}
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <FormLabel>Dados de destino</FormLabel>
              <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder="NIF, telefone ou IBAN conforme o método escolhido"
                placeholderTextColor={colors.textMuted}
                multiline
                textAlignVertical="top"
                style={{
                  minHeight: 80,
                  borderRadius: radii.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: alpha(colors.surface, 0.6),
                  padding: spacing[3],
                  color: colors.text,
                  fontSize: 15.75,
                  fontFamily: BODY,
                }}
              />
            </View>

            <GameButton
              variant="gold"
              disabled={!amount || !!withdrawError || busy}
              onPress={() => void handleWithdraw()}
              accessibilityLabel="Pedir levantamento"
              style={{ width: '100%' }}
            >
              {busy ? (
                <>
                  <ActivityIndicator color={colors.primaryForeground} />
                  <Text style={GOLD_BUTTON_TEXT}>A enviar…</Text>
                </>
              ) : (
                <>
                  <ArrowUpRight size={16} color={colors.primaryForeground} />
                  <Text style={GOLD_BUTTON_TEXT}>Pedir levantamento</Text>
                </>
              )}
            </GameButton>
          </View>
        )}
      </View>

      {/* Histórico */}
      <View>
        <SectionTitle
          title="Histórico"
          action={
            <Text style={{ fontSize: 13.5, color: colors.textMuted, fontFamily: BODY }}>
              {pendingCount > 0
                ? `${pendingCount} pendente${pendingCount > 1 ? 's' : ''}`
                : `${movements.length} movimentos`}
            </Text>
          }
        />
        <GameCard>
          {movementsLoading && movements.length === 0 ? (
            <View style={{ padding: spacing[6], alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={colors.textMuted} />
            </View>
          ) : movements.length === 0 ? (
            <Text
              style={{
                padding: spacing[6],
                textAlign: 'center',
                fontSize: 15.75,
                color: colors.textMuted,
                fontFamily: BODY,
              }}
            >
              Ainda não tens movimentos.
            </Text>
          ) : (
            movements.map((m, index) => {
              const status = STATUS_STYLE[m.status];
              return (
                <View
                  key={m.id}
                  style={{
                    padding: spacing[3],
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing[3],
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: alpha(colors.white, 0.06),
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: radii.lg,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor:
                        m.type === 'deposit' ? alpha(colors.p1, 0.15) : alpha(colors.p2, 0.15),
                    }}
                  >
                    {m.type === 'deposit' ? (
                      <ArrowDownLeft size={16} color={colors.p1} />
                    ) : (
                      <ArrowUpRight size={16} color={colors.p2} />
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                      <Text
                        style={{
                          fontSize: 15.75,
                          fontWeight: typography.fontWeight.medium,
                          color: colors.text,
                          fontFamily: BODY,
                        }}
                      >
                        {m.type === 'deposit' ? 'Depósito' : 'Levantamento'}
                        {' · '}
                      </Text>
                      <Text
                        style={{
                          fontSize: 15.75,
                          fontWeight: typography.fontWeight.medium,
                          color: colors.textMuted,
                          fontFamily: BODY,
                          textTransform: 'capitalize',
                        }}
                      >
                        {m.method}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13.5, color: colors.textMuted, fontFamily: BODY }}>
                      {new Date(m.createdAt).toLocaleString('pt-PT')}
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing[2],
                      flexShrink: 0,
                    }}
                  >
                    <View
                      style={{
                        paddingHorizontal: spacing[2],
                        paddingVertical: 2,
                        borderRadius: radii.md,
                        borderWidth: 1,
                        borderColor: status.border,
                        backgroundColor: status.background,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: typography.fontWeight.semibold,
                          color: status.foreground,
                          fontFamily: BODY,
                        }}
                      >
                        {STATUS_LABEL[m.status]}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 15.75,
                        letterSpacing: 0.315,
                        color: m.type === 'deposit' ? colors.p1 : colors.p2,
                        fontFamily: DISPLAY,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {`${m.type === 'deposit' ? '+' : '−'}${formatMoney(m.amount, m.currency)}`}
                    </Text>
                    {m.status === 'pendente' ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Remover movimento pendente"
                        onPress={() => void handleDelete(m)}
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: radii.md,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Trash2 size={14} color={colors.textMuted} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </GameCard>
      </View>

      {/* Modal de pagamento */}
      {activeMethod ? (
        <ProofModal
          visible={proofOpen}
          onClose={() => setProofOpen(false)}
          method={activeMethod}
          currency={currency}
          amount={amount}
          onSubmit={handleProofSubmit}
        />
      ) : null}

      {/* Confirmação */}
      <SuccessModal
        visible={success !== null && !proofOpen}
        onClose={() => setSuccess(null)}
        amount={success?.amount ?? 0}
        currency={success?.currency ?? 'aoa'}
      />
    </TiraScreen>
  );
}
