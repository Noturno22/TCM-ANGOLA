/**
 * ConfirmSheet — diálogo de confirmação (nativo + web).
 *
 * Port do AlertDialog web. Usa `Modal` (mesmo padrão do AgeGateSheet) porque
 * RN `Alert.alert` é no-op no expo web (`react-native-web` não o implementa)
 * — os botões de confirmar tinham de funcionar nas duas plataformas.
 */
import { Modal, View } from 'react-native';
import { spacing } from '@/theme';
import { TiraButton } from './TiraButton';
import { TiraCard } from './TiraCard';
import { TiraHeading } from './TiraHeading';
import { TiraText } from './TiraText';

export interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  /** variante do botão de confirmar (default 'p2' = destrutivo, web AlertDialogAction bg-p2) */
  confirmVariant?: 'p1' | 'p2' | 'gold';
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmSheet({
  visible,
  title,
  description,
  cancelLabel,
  confirmLabel,
  confirmVariant = 'p2',
  onCancel,
  onConfirm,
}: ConfirmSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.7)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing[6],
        }}
      >
        <TiraCard style={{ width: '100%', maxWidth: 400 }}>
          <View style={{ gap: spacing[3] }}>
            <TiraHeading level="h3">{title}</TiraHeading>
            <TiraText size="xs" variant="muted">
              {description}
            </TiraText>
            <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[1] }}>
              <TiraButton variant="outline" style={{ flex: 1 }} onPress={onCancel}>
                {cancelLabel}
              </TiraButton>
              <TiraButton variant={confirmVariant} style={{ flex: 1 }} onPress={onConfirm}>
                {confirmLabel}
              </TiraButton>
            </View>
          </View>
        </TiraCard>
      </View>
    </Modal>
  );
}
