/**
 * AgeGateSheet — diálogo de verificação de idade (18+) para salas com aposta.
 *
 * Port do AgeGateDialog web. Só recolhe a data de nascimento e envia-a ao
 * servidor (`set_birthdate`); a elegibilidade é sempre decidida no servidor.
 * Nunca mostramos a data a terceiros.
 */
import { useState } from 'react';
import { Modal, TextInput, View } from 'react-native';
import { TiraButton, TiraCard, TiraHeading, TiraText, alpha } from '@/components/tira';
import { isAdultBirthdate, maxBirthdateForAdult } from '@/lib/online/age';
import { useAge } from '@/store/age';
import { colors, radii, spacing } from '@/theme';

interface AgeGateSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Chamado quando o utilizador passa a ser adulto (18+). */
  onVerified?: () => void;
}

export function AgeGateSheet({ visible, onClose, onVerified }: AgeGateSheetProps) {
  const save = useAge((s) => s.save);
  const [birthdate, setBirthdate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const max = maxBirthdateForAdult();
  const tooYoung = 'Tens de ter pelo menos 18 anos para apostar moeda virtual.';

  const submit = async () => {
    if (!birthdate || busy) return;
    const wellFormed = /^\d{4}-\d{2}-\d{2}$/.test(birthdate);
    if (!wellFormed || !isAdultBirthdate(birthdate)) {
      setError(tooYoung);
      return;
    }
    setBusy(true);
    setError(null);
    const isAdult = await save(birthdate);
    setBusy(false);
    if (isAdult) {
      setBirthdate('');
      onClose();
      onVerified?.();
    } else {
      setError(tooYoung);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: alpha(colors.bg, 0.85),
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing[6],
        }}
      >
        <TiraCard style={{ width: '100%', maxWidth: 400 }}>
          <View style={{ gap: spacing[4] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radii.lg,
                  backgroundColor: alpha(colors.gold, 0.15),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TiraText style={{ fontSize: 22 }}>🛡️</TiraText>
              </View>
              <View style={{ flex: 1 }}>
                <TiraHeading level="h3">Verificação de idade</TiraHeading>
                <TiraText size="xs" variant="muted">
                  Salas com aposta são só para maiores de 18 anos.
                </TiraText>
              </View>
            </View>

            <TiraText size="xs" variant="muted">
              Indicamos apenas a tua data de nascimento para confirmar que tens 18 anos ou mais. A
              aposta é em <TiraText size="xs" weight="semibold">moeda virtual (KZ)</TiraText> — nunca
              dinheiro real.
            </TiraText>

            <View style={{ gap: spacing[2] }}>
              <TiraText
                size="xs"
                weight="semibold"
                variant="muted"
                style={{ textTransform: 'uppercase', letterSpacing: 1 }}
              >
                Data de nascimento
              </TiraText>
              <TextInput
                value={birthdate}
                onChangeText={(v) => {
                  setBirthdate(v);
                  setError(null);
                }}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                maxLength={10}
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
              <TiraText size="xs" variant="muted">
                {`Formato AAAA-MM-DD (ex.: 1995-06-20). Máx. para adulto: ${max}.`}
              </TiraText>
            </View>

            {error ? (
              <TiraText size="xs" variant="p2">
                {`⚠️ ${error}`}
              </TiraText>
            ) : null}

            <View style={{ flexDirection: 'row', gap: spacing[2] }}>
              <TiraButton variant="outline" style={{ flex: 1 }} onPress={onClose} disabled={busy}>
                Cancelar
              </TiraButton>
              <TiraButton
                variant="gold"
                style={{ flex: 1 }}
                onPress={() => void submit()}
                disabled={!birthdate || busy}
              >
                {busy ? 'A confirmar…' : 'Confirmar'}
              </TiraButton>
            </View>
          </View>
        </TiraCard>
      </View>
    </Modal>
  );
}
