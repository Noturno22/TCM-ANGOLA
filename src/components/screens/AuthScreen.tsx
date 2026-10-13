'use client';

import { useEffect, useState } from 'react';
import { Phone, ArrowLeft, Loader2, Info, ShieldCheck } from 'lucide-react';
import { useApp } from '@/store/app';
import { useAuth } from '@/store/auth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { GameButton, GameCard, GameLogo } from '@/components/game/ui';

/** Indicativo de Angola (DDI) por defeito. */
const DEFAULT_DDI = '+244';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export function AuthScreen() {
  const navigate = useApp((s) => s.navigate);
  const back = useApp((s) => s.back);

  const user = useAuth((s) => s.user);
  const pending = useAuth((s) => s.pending);
  const error = useAuth((s) => s.error);
  const signInWithGoogle = useAuth((s) => s.signInWithGoogle);
  const sendPhoneOtp = useAuth((s) => s.sendPhoneOtp);
  const verifyPhoneOtp = useAuth((s) => s.verifyPhoneOtp);
  const clearError = useAuth((s) => s.clearError);

  const [step, setStep] = useState<'choose' | 'otp'>('choose');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  // Com sessão ativa, volta para casa.
  useEffect(() => {
    if (user) navigate('home');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const digits = phone.replace(/\D/g, '');
  const fullPhone = `${DEFAULT_DDI}${digits}`;
  const phoneValid = digits.length >= 9;

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    if (!phoneValid) return;
    const ok = await sendPhoneOtp(fullPhone);
    if (ok) {
      setStep('otp');
      setOtp('');
      setNotice(`Enviámos um código para ${fullPhone}.`);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    const token = otp.replace(/\D/g, '');
    if (token.length < 6) return;
    await verifyPhoneOtp(fullPhone, token);
  }

  return (
    <div className="space-y-5 animate-slide-up pb-4">
      <button
        type="button"
        onClick={back}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>

      <GameCard className="p-6" glow="gold">
        <div className="flex flex-col items-center text-center gap-2 mb-5">
          <GameLogo size="md" />
          <h1 className="font-display text-2xl tracking-wide mt-2">ENTRAR</h1>
          <p className="text-xs text-muted-foreground max-w-xs">
            Entra ou cria conta com a tua conta Google ou o teu número de WhatsApp.
          </p>
        </div>

        {!isSupabaseConfigured && (
          <div className="flex items-start gap-2 rounded-lg bg-orange/10 border border-orange/30 p-3 mb-4 text-[11px] text-orange">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Backend não configurado. Define <code>NEXT_PUBLIC_SUPABASE_URL</code> e a chave no
              <code> .env</code> para ativar o login.
            </span>
          </div>
        )}

        {step === 'choose' && (
          <>
            <GameButton
              variant="outline"
              className="w-full h-12 text-base"
              disabled={pending}
              onClick={() => {
                clearError();
                signInWithGoogle();
              }}
            >
              <GoogleIcon className="w-5 h-5 mr-2" />
              Continuar com Google
            </GameButton>

            <div className="flex items-center gap-3 my-4">
              <span className="h-px flex-1 bg-border/50" />
              <span className="text-[10px] text-muted-foreground">ou por telefone</span>
              <span className="h-px flex-1 bg-border/50" />
            </div>

            <form onSubmit={handleSendOtp} className="space-y-3">
              <label className="block">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Número de WhatsApp
                </span>
                <div className="mt-1 flex items-center gap-2 rounded-lg bg-surface-2 border border-border px-3 focus-within:border-gold/50">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{DEFAULT_DDI}</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="923 000 000"
                    className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground/50"
                    disabled={pending}
                  />
                </div>
              </label>

              <GameButton
                type="submit"
                variant="gold"
                className="w-full h-12 text-base"
                disabled={!phoneValid || pending}
              >
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar código'}
              </GameButton>
            </form>
          </>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerify} className="space-y-3">
            <label className="block">
              <span className="text-[11px] font-medium text-muted-foreground">
                Código recebido ({fullPhone})
              </span>
              <div className="mt-1 flex items-center gap-2 rounded-lg bg-surface-2 border border-border px-3 focus-within:border-gold/50">
                <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="flex-1 bg-transparent py-2.5 text-sm tracking-[0.3em] outline-none placeholder:text-muted-foreground/50"
                  disabled={pending}
                  autoFocus
                />
              </div>
            </label>

            <GameButton
              type="submit"
              variant="gold"
              className="w-full h-12 text-base"
              disabled={otp.length < 6 || pending}
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verificar e entrar'}
            </GameButton>

            <button
              type="button"
              onClick={() => {
                setStep('choose');
                clearError();
                setNotice(null);
              }}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground underline py-1"
            >
              Alterar número / reenviar
            </button>
          </form>
        )}

        {error && (
          <p className="text-xs text-p2 bg-p2/10 border border-p2/30 rounded-lg px-3 py-2 mt-3">
            {error}
          </p>
        )}
        {notice && (
          <p className="text-xs text-p1 bg-p1/10 border border-p1/30 rounded-lg px-3 py-2 mt-3">
            {notice}
          </p>
        )}
      </GameCard>

      <button
        type="button"
        onClick={() => navigate('home')}
        className="w-full text-center text-[11px] text-muted-foreground/70 hover:text-foreground underline py-2"
      >
        Continuar como convidado
      </button>
    </div>
  );
}
