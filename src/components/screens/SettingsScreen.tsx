'use client';

import {
  Moon,
  Sun,
  Volume2,
  Music,
  Eye,
  Triangle,
  Vibrate,
  Globe,
  HelpCircle,
  FileText,
  LogOut,
  RotateCcw,
  Info,
  Bell,
  Languages,
} from 'lucide-react';
import { useSettings } from '@/store/settings';
import { useProfile } from '@/store/profile';
import { GameCard, GameButton, SectionTitle } from '@/components/game/ui';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useApp } from '@/store/app';
import { toast } from 'sonner';

export function SettingsScreen() {
  const navigate = useApp((s) => s.navigate);
  const settings = useSettings();
  const resetProfile = useProfile((s) => s.resetProfile);

  return (
    <div className="space-y-5 animate-slide-up pb-4">
      {/* Conta */}
      <section>
        <SectionTitle title="Conta" />
        <GameCard className="divide-y divide-border/40">
          <Row icon={<Info className="w-4 h-4" />} label="Nome de utilizador" value="Jogador" />
          <Row icon={<Globe className="w-4 h-4" />} label="Elo" value={`${useProfile.getState().elo}`} />
          <Row icon={<Bell className="w-4 h-4" />} label="Notificações" defaultChecked />
        </GameCard>
      </section>

      {/* Aparência */}
      <section>
        <SectionTitle title="Apariência" />
        <GameCard className="divide-y divide-border/40">
          <ToggleRow
            icon={settings.theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            label="Modo escuro"
            description="Alternar entre tema escuro e claro"
            checked={settings.theme === 'dark'}
            onChange={(v) => settings.setTheme(v ? 'dark' : 'light')}
          />
          <ToggleRow
            icon={<Eye className="w-4 h-4" />}
            label="Modo daltonismo"
            description="Ajusta as cores para maior contraste"
            checked={settings.colorblindMode}
            onChange={(v) => settings.set('colorblindMode', v)}
          />
          <ToggleRow
            icon={<Triangle className="w-4 h-4" />}
            label="Símbolos nas peças"
            description="Mostra ▲ no P1 e ● no P2 (acessibilidade)"
            checked={settings.symbolsOnPieces}
            onChange={(v) => settings.set('symbolsOnPieces', v)}
          />
          <ToggleRow
            icon={<RotateCcw className="w-4 h-4" />}
            label="Reduzir animações"
            description="Desativa animações para maior clareza"
            checked={settings.reduceMotion}
            onChange={(v) => settings.set('reduceMotion', v)}
          />
        </GameCard>
      </section>

      {/* Som e háptico */}
      <section>
        <SectionTitle title="Som e Háptico" />
        <GameCard className="divide-y divide-border/40">
          <ToggleRow
            icon={<Volume2 className="w-4 h-4" />}
            label="Efeitos sonoros"
            description="Sons de seleção, movimento, vitória"
            checked={settings.soundEnabled}
            onChange={(v) => settings.set('soundEnabled', v)}
          />
          <ToggleRow
            icon={<Music className="w-4 h-4" />}
            label="Música de fundo"
            description="Música ambiente discreta"
            checked={settings.musicEnabled}
            onChange={(v) => settings.set('musicEnabled', v)}
          />
          <ToggleRow
            icon={<Vibrate className="w-4 h-4" />}
            label="Vibração"
            description="Feedback háptico no mobile"
            checked={settings.vibration}
            onChange={(v) => settings.set('vibration', v)}
          />
        </GameCard>
      </section>

      {/* IA */}
      <section>
        <SectionTitle title="Inteligência Artificial" />
        <GameCard className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-p1/15 text-p1 flex items-center justify-center">
              <Info className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Atraso de pensamento da IA</p>
              <p className="text-[11px] text-muted-foreground">Tempo que a IA "pensa" antes de jogar</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Slider
              value={[settings.aiThinkingDelay]}
              onValueChange={(v) => settings.set('aiThinkingDelay', v[0])}
              min={200}
              max={1200}
              step={100}
              className="flex-1"
            />
            <span className="font-display text-sm text-gold w-14 text-right">
              {(settings.aiThinkingDelay / 1000).toFixed(1)}s
            </span>
          </div>
        </GameCard>
      </section>

      {/* Idioma */}
      <section>
        <SectionTitle title="Idioma" />
        <GameCard className="p-4">
          <div className="flex items-center gap-3">
            <Languages className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm flex-1">Idioma da interface</span>
            <Select
              value={settings.language}
              onValueChange={(v) => settings.set('language', v as 'pt' | 'en')}
            >
              <SelectTrigger className="w-32 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pt">Português</SelectItem>
                <SelectItem value="en" disabled>Inglês (em breve)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </GameCard>
      </section>

      {/* Ajuda e informação */}
      <section>
        <SectionTitle title="Ajuda e Informação" />
        <GameCard className="divide-y divide-border/40">
          <LinkRow
            icon={<HelpCircle className="w-4 h-4" />}
            label="Como jogar"
            onClick={() => navigate('how-to-play')}
          />
          <LinkRow
            icon={<FileText className="w-4 h-4" />}
            label="Termos e Privacidade"
            onClick={() => toast('Documento em preparação.')}
          />
          <LinkRow
            icon={<Info className="w-4 h-4" />}
            label="Sobre o jogo"
            onClick={() => navigate('about')}
          />
        </GameCard>
      </section>

      {/* Ações de conta */}
      <section>
        <SectionTitle title="Conta" />
        <div className="space-y-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <GameButton variant="p2" className="w-full">
                <LogOut className="w-4 h-4 mr-2" />
                Sair da conta
              </GameButton>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sair da conta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Podes continuar a jogar como convidado. O teu progresso local será mantido.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => navigate('welcome')}>
                  Sair
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <GameButton variant="outline" className="w-full">
                <RotateCcw className="w-4 h-4 mr-2" />
                Reiniciar progresso
              </GameButton>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reiniciar todo o progresso?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isto apaga permanentemente o teu histórico, estatísticas, XP e conquistas.
                  A ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-p2 text-white hover:bg-p2/90"
                  onClick={() => {
                    resetProfile();
                    toast.success('Progresso reiniciado.');
                  }}
                >
                  Sim, reiniciar tudo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>

      <p className="text-center text-[10px] text-muted-foreground/60 pt-2">
        Tira o Cocó do Meio • Versão 1.0
      </p>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  defaultChecked,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-4">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm flex-1">{label}</span>
      {value && <span className="text-sm text-muted-foreground">{value}</span>}
      {defaultChecked !== undefined && (
        <Switch defaultChecked={defaultChecked} />
      )}
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-4">
      <span className="text-muted-foreground">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{label}</p>
        {description && (
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{description}</p>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

function LinkRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 p-4 w-full hover:bg-accent/30 transition-colors text-left"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm flex-1">{label}</span>
      <span className="text-muted-foreground">›</span>
    </button>
  );
}
