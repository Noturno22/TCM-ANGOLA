'use client';

/**
 * Ecrã de administração (depósitos/levantamentos manuais).
 *
 * O acesso é decidido no servidor pela Edge Function `admin-manage`
 * (variável `ADMIN_EMAILS`). Aqui só usamos `NEXT_PUBLIC_ADMIN_EMAILS` para
 * mostrar/ocultar a entrada — nunca como fronteira de segurança.
 */
import { Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { useApp } from '@/store/app';
import { GameButton, GameCard } from '@/components/game/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReceiptsPanel } from '@/components/admin/ReceiptsPanel';
import { WithdrawalsPanel } from '@/components/admin/WithdrawalsPanel';

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function AdminScreen() {
  const navigate = useApp((s) => s.navigate);
  const email = useAuth((s) => s.user?.email?.toLowerCase() ?? null);
  const isAdmin = email !== null && ADMIN_EMAILS.includes(email);

  return (
    <div className="space-y-5 animate-slide-up pb-6">
      <div>
        <h1 className="font-display text-3xl tracking-wide">ADMIN</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aprovação de depósitos e levantamentos.
        </p>
      </div>

      {!isAdmin ? (
        <GameCard className="p-6 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-xl bg-p2/15 flex items-center justify-center">
            <Lock className="w-6 h-6 text-p2" />
          </div>
          <p className="text-sm text-muted-foreground">
            Sem acesso. Esta área é restrita a administradores.
          </p>
          <GameButton variant="outline" onClick={() => navigate('home')} className="mx-auto">
            Voltar
          </GameButton>
        </GameCard>
      ) : (
        <>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-gold" />
            <span>Sessão de administrador · {email}</span>
          </div>

          <Tabs defaultValue="receipts">
            <TabsList className="w-full">
              <TabsTrigger value="receipts" className="flex-1">
                Depósitos
              </TabsTrigger>
              <TabsTrigger value="withdrawals" className="flex-1">
                Levantamentos
              </TabsTrigger>
            </TabsList>
            <TabsContent value="receipts" className="mt-4">
              <ReceiptsPanel />
            </TabsContent>
            <TabsContent value="withdrawals" className="mt-4">
              <WithdrawalsPanel />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
