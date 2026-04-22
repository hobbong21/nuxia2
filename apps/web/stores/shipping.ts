'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ShippingAddress } from '@nuxia2/shared-types';

interface ShippingState {
  savedAddress: ShippingAddress | null;
  setAddress: (addr: ShippingAddress) => void;
  clear: () => void;
}

/**
 * 최근 입력한 배송지 캐시.
 * - localStorage persist (key: nuxia2-shipping).
 * - 추후 로그인 유저별 서버 저장 도입되면 hydrate 시 서버 값이 우선.
 */
export const useShippingStore = create<ShippingState>()(
  persist(
    (set) => ({
      savedAddress: null,
      setAddress: (addr) => set({ savedAddress: addr }),
      clear: () => set({ savedAddress: null }),
    }),
    {
      name: 'nuxia2-shipping',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : (undefined as unknown as Storage),
      ),
    },
  ),
);
