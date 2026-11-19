/**
 * Stub de toast (API sonner) para React Native.
 *
 * Enquanto não há UI de toast no mobile, as chamadas ficam em log. As
 * mensagens de alto sinal continuam a ser geradas pelos stores (ver
 * `isToastWorthy` em `@/lib/online/notifications`).
 */
export function toast(message: string, options?: { description?: string }): void {
  console.log(`[toast] ${message}${options?.description ? ` — ${options.description}` : ''}`);
}
