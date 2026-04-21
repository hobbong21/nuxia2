'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface CartLine {
  productId: string;
  name: string;
  imageUrl: string;
  /** BigIntString — 단가 */
  unitPriceKrw: string;
  quantity: number;
  optionSummary?: string;
  selected: boolean;
}

interface CartState {
  lines: CartLine[];
  addLine: (line: Omit<CartLine, 'selected'>) => void;
  setQuantity: (productId: string, qty: number) => void;
  toggleSelected: (productId: string) => void;
  toggleSelectAll: (selected: boolean) => void;
  removeLine: (productId: string) => void;
  removeSelected: () => void;
  clear: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      addLine: (line) =>
        set((state) => {
          const existing = state.lines.find((l) => l.productId === line.productId);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.productId === line.productId
                  ? { ...l, quantity: l.quantity + line.quantity }
                  : l,
              ),
            };
          }
          return { lines: [...state.lines, { ...line, selected: true }] };
        }),
      setQuantity: (productId, qty) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            l.productId === productId ? { ...l, quantity: Math.max(1, qty) } : l,
          ),
        })),
      toggleSelected: (productId) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            l.productId === productId ? { ...l, selected: !l.selected } : l,
          ),
        })),
      toggleSelectAll: (selected) =>
        set((state) => ({
          lines: state.lines.map((l) => ({ ...l, selected })),
        })),
      removeLine: (productId) =>
        set((state) => ({
          lines: state.lines.filter((l) => l.productId !== productId),
        })),
      removeSelected: () =>
        set((state) => ({ lines: state.lines.filter((l) => !l.selected) })),
      clear: () => set({ lines: [] }),
    }),
    {
      name: 'nuxia2-cart',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : (undefined as unknown as Storage),
      ),
    },
  ),
);

/** 선택된 라인 합계 (BigIntString 반환) */
export function cartSubtotal(lines: CartLine[]): string {
  return lines
    .filter((l) => l.selected)
    .reduce((acc, l) => acc + BigInt(l.unitPriceKrw) * BigInt(l.quantity), 0n)
    .toString();
}
