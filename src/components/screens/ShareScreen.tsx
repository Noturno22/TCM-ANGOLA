'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Share2,
  Copy,
  Check,
  Download,
  Upload,
  AlertCircle,
  Play,
  ClipboardPaste,
  QrCode,
} from 'lucide-react';
import { useApp } from '@/store/app';
import { useProfile } from '@/store/profile';
import { encodeMatch, decodeMatch, describeSharedMatch, type SharedMatch } from '@/lib/share';
import { replayFrom, isGameOver, type Move } from '@/lib/engine';
import { GameButton, GameCard, SectionTitle } from '@/components/game/ui';
import { Board } from '@/components/game/Board';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Mode = 'export' | 'import';

export function ShareScreen() {
  const navigate = useApp((s) => s.navigate);
  const setShareCode = useApp((s) => s.setShareCode);
  const matches = useProfile((s) => s.matches);
  const replayMatchId = useApp((s) => s.replayMatchId);

  const [mode, setMode] = useState<Mode>('export');
  const [importCode, setImportCode] = useState('');
  const [copied, setCopied] = useState(false);

  // Partida selecionada para exportar (do histórico)
  const selectedMatch = useMemo(
    () => matches.find((m) => m.id === replayMatchId) ?? matches[0] ?? null,
    [matches, replayMatchId],
  );

  // Código gerado para a partida selecionada
  const exportCode = useMemo(() => {
    if (!selectedMatch) return '';
    const shared: SharedMatch = {
      version: 1,
      mode: selectedMatch.mode,
      difficulty: selectedMatch.difficulty,
      humanSide: selectedMatch.playerSide,
      moves: selectedMatch.moves as Move[],
    };
    return encodeMatch(shared);
  }, [selectedMatch]);

  // Preview da partida importada
  const importPreview = useMemo(() => {
    if (!importCode.trim()) return null;
    const decoded = decodeMatch(importCode);
    if (!decoded) return { error: 'Código inválido' };
    const states = replayFrom(decoded.moves);
    const final = states[states.length - 1];
    return {
      decoded,
      states,
      final,
      isOver: isGameOver(final),
      description: describeSharedMatch(decoded),
    };
  }, [importCode]);

  const handleCopy = async () => {
    if (!exportCode) return;
    try {
      await navigator.clipboard.writeText(exportCode);
      setCopied(true);
      toast.success('Código copiado para a área de transferência!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar. Copia manualmente.');
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setImportCode(text);
      toast.info('Código colado da área de transferência.');
    } catch {
      toast.error('Não foi possível ler a área de transferência.');
    }
  };

  const handleImportAndPlay = () => {
    if (!importPreview || 'error' in importPreview) return;
    setShareCode(importCode);
    navigate('replay');
  };

  return (
    <div className="space-y-5 animate-slide-up pb-4">
      <div>
        <h1 className="font-display text-3xl tracking-wide mb-1">PARTILHAR</h1>
        <p className="text-sm text-muted-foreground">
          Partilha uma partida com amigos ou importa uma recebida.
        </p>
      </div>

      {/* Toggle Exportar / Importar */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-surface/60 border border-border/40">
        <button
          type="button"
          onClick={() => setMode('export')}
          className={cn(
            'py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2',
            mode === 'export' ? 'bg-p1 text-background' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Upload className="w-4 h-4" />
          Exportar
        </button>
        <button
          type="button"
          onClick={() => setMode('import')}
          className={cn(
            'py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2',
            mode === 'import' ? 'bg-gold text-background' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Download className="w-4 h-4" />
          Importar
        </button>
      </div>

      {/* ============ EXPORTAR ============ */}
      {mode === 'export' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {selectedMatch ? (
            <>
              <GameCard className="p-4">
                <SectionTitle title="Partida selecionada" />
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0',
                    selectedMatch.result === 'P1' ? 'bg-p1/15' : selectedMatch.result === 'P2' ? 'bg-p2/15' : 'bg-muted',
                  )}>
                    {selectedMatch.result === 'DRAW' ? '🤝' : selectedMatch.result === 'P1' ? '🟢' : '🔴'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">vs {selectedMatch.opponent}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {selectedMatch.moveCount} jogadas • {selectedMatch.durationSec}s
                    </p>
                  </div>
                </div>
              </GameCard>

              <GameCard className="p-4">
                <SectionTitle title="Código de partilha" />
                <div className="bg-surface-2/60 rounded-xl p-3 border border-border/40 mb-3">
                  <p className="font-mono text-sm break-all text-gold leading-relaxed">
                    {exportCode}
                  </p>
                </div>
                <div className="flex gap-2">
                  <GameButton
                    variant="p1"
                    className="flex-1"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copiar código
                      </>
                    )}
                  </GameButton>
                  <GameButton
                    variant="outline"
                    onClick={() => {
                      setShareCode(exportCode);
                      navigate('replay');
                    }}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Ver replay
                  </GameButton>
                </div>
              </GameCard>

              {/* Selecionar outra partida */}
              {matches.length > 1 && (
                <GameCard className="p-4">
                  <SectionTitle title="Outras partidas" />
                  <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-custom">
                    {matches.slice(0, 20).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => useApp.getState().setReplayMatchId(m.id)}
                        className={cn(
                          'w-full p-2.5 rounded-lg flex items-center gap-3 text-left transition-colors',
                          m.id === selectedMatch.id
                            ? 'bg-gold/10 border border-gold/30'
                            : 'hover:bg-surface-2/40',
                        )}
                      >
                        <div className={cn(
                          'w-2 h-2 rounded-full shrink-0',
                          m.result === 'P1' ? 'bg-p1' : m.result === 'P2' ? 'bg-p2' : 'bg-muted-foreground',
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">vs {m.opponent}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {m.moveCount} jogadas • {new Date(m.date).toLocaleDateString('pt-PT')}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </GameCard>
              )}
            </>
          ) : (
            <GameCard className="p-8 text-center">
              <Share2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground mb-4">
                Ainda não tens partidas para partilhar.
              </p>
              <GameButton variant="p1" onClick={() => navigate('offline-select')}>
                Jogar agora
              </GameButton>
            </GameCard>
          )}
        </motion.div>
      )}

      {/* ============ IMPORTAR ============ */}
      {mode === 'import' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <GameCard className="p-4">
            <SectionTitle title="Cola o código recebido" />
            <div className="relative">
              <textarea
                value={importCode}
                onChange={(e) => setImportCode(e.target.value)}
                placeholder="1VM_02..."
                className="w-full h-24 p-3 pr-10 rounded-xl bg-surface-2/60 border border-border/40 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold/50 resize-none scrollbar-custom"
                aria-label="Código da partida"
              />
              <button
                type="button"
                onClick={handlePaste}
                className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-surface hover:bg-surface-2 flex items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label="Colar da área de transferência"
              >
                <ClipboardPaste className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              O código começa por "1" e contém letras e números.
            </p>
          </GameCard>

          {/* Preview */}
          {importCode.trim() && importPreview && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              {'error' in importPreview ? (
                <GameCard className="p-4 border-p2/30 bg-p2/5">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-p2 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-p2">Código inválido</p>
                      <p className="text-[11px] text-muted-foreground">
                        Verifica se copiaste o código completo.
                      </p>
                    </div>
                  </div>
                </GameCard>
              ) : (
                <GameCard className="p-4" glow="gold">
                  <SectionTitle title="Pré-visualização" />
                  <div className="flex items-center gap-3 mb-3">
                    <div className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0',
                      importPreview.isOver && importPreview.final.winner === 'P1' ? 'bg-p1/15' :
                      importPreview.isOver && importPreview.final.winner === 'P2' ? 'bg-p2/15' : 'bg-muted',
                    )}>
                      {importPreview.isOver && importPreview.final.winner === 'P1' ? '🟢' :
                       importPreview.isOver && importPreview.final.winner === 'P2' ? '🔴' : '🤝'}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{importPreview.description}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {importPreview.isOver
                          ? importPreview.final.winner
                            ? `Vencedor: ${importPreview.final.winner === 'P1' ? 'Jogador 1' : 'Jogador 2'}`
                            : 'Empate'
                          : 'Partida em curso'}
                      </p>
                    </div>
                  </div>

                  {/* Preview do tabuleiro final */}
                  <div className="flex justify-center mb-3">
                    <Board
                      board={importPreview.final.board}
                      selectedSquare={null}
                      validTargets={[]}
                      lastMove={importPreview.final.history.length > 0
                        ? importPreview.final.history[importPreview.final.history.length - 1]
                        : null}
                      winningLine={importPreview.final.winningLine}
                      threatSquares={[]}
                      onSquareClick={() => {}}
                      disabled
                      size="sm"
                    />
                  </div>

                  <GameButton variant="p1" className="w-full" onClick={handleImportAndPlay}>
                    <Play className="w-4 h-4 mr-2" />
                    Ver replay completo
                  </GameButton>
                </GameCard>
              )}
            </motion.div>
          )}

          {!importCode.trim() && (
            <GameCard className="p-8 text-center">
              <QrCode className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Cola um código de partida acima para pré-visualizar.
              </p>
            </GameCard>
          )}
        </motion.div>
      )}

      {/* Info */}
      <GameCard className="p-4 bg-gold/5 border-gold/30">
        <div className="flex gap-3">
          <Share2 className="w-5 h-5 text-gold shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold mb-1">Como funciona?</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Cada partida tem um código curto único. Copia-o e envia a um amigo por mensagem.
              Ele cola o código no separador "Importar" para ver o teu replay.
            </p>
          </div>
        </div>
      </GameCard>
    </div>
  );
}
