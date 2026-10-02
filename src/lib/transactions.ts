/**
 * Store de transações — depósitos e levantamentos com comprovativo.
 * Segurança máxima: depósitos precisam de aprovação do admin (até 6h).
 *
 * Status flow:
 *   Depósito (Express/Binance/PIX): pending → approved (creditado) | rejected
 *   Depósito (VISA): instantâneo (approved imediatamente)
 *   Levantamento: pending → approved (debitado) | rejected
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PaymentMethod = 'binance' | 'pix' | 'express' | 'visa';
export type TransactionType = 'deposit' | 'withdraw';
export type TransactionStatus = 'pending' | 'approved' | 'rejected';

export interface DepositTransaction {
  id: string;
  type: TransactionType;
  method: PaymentMethod;
  amountUSD: number;
  amountKZ: number;
  status: TransactionStatus;
  createdAt: string;
  processedAt: string | null;
  hasComprovativo: boolean;
  comprovativoName: string | null;
  comprovativoData: string | null;
  adminNote: string | null;
}

interface TransactionStore {
  transactions: DepositTransaction[];

  createTransaction: (tx: Omit<DepositTransaction, 'id' | 'createdAt' | 'processedAt' | 'adminNote' | 'status'>) => string;
  approveTransaction: (id: string, note?: string) => void;
  rejectTransaction: (id: string, note?: string) => void;
  getPending: () => DepositTransaction[];
  reset: () => void;
}

export const useTransactions = create<TransactionStore>()(
  persist(
    (set, get) => ({
      transactions: [],

      createTransaction: (tx) => {
        const id = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        // VISA é instantâneo, outros precisam de aprovação
        const status: TransactionStatus = tx.method === 'visa' && tx.type === 'deposit' ? 'approved' : 'pending';
        const newTx: DepositTransaction = {
          ...tx,
          id,
          status,
          createdAt: new Date().toISOString(),
          processedAt: status === 'approved' ? new Date().toISOString() : null,
          adminNote: null,
        };
        set((s) => ({ transactions: [newTx, ...s.transactions] }));
        return id;
      },

      approveTransaction: (id, note) =>
        set((s) => ({
          transactions: s.transactions.map((t) =>
            t.id === id
              ? { ...t, status: 'approved' as const, processedAt: new Date().toISOString(), adminNote: note ?? null }
              : t
          ),
        })),

      rejectTransaction: (id, note) =>
        set((s) => ({
          transactions: s.transactions.map((t) =>
            t.id === id
              ? { ...t, status: 'rejected' as const, processedAt: new Date().toISOString(), adminNote: note ?? null }
              : t
          ),
        })),

      getPending: () => get().transactions.filter((t) => t.status === 'pending'),

      reset: () => set({ transactions: [] }),
    }),
    { name: 'tira-coco-transactions' },
  ),
);

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  binance: 'Binance',
  pix: 'PIX',
  express: 'Express Angola',
  visa: 'VISA',
};

export const METHOD_NEEDS_COMPROVATIVO: Record<PaymentMethod, boolean> = {
  binance: true,
  pix: true,
  express: true,
  visa: false,
};
