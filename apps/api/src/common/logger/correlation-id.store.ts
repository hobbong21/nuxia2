/**
 * v0.3 S1: 요청 단위 correlation-id 를 전파하는 AsyncLocalStorage.
 *
 * 인터셉터가 요청 진입 시 `x-correlation-id` 헤더(없으면 생성)를 store 에
 * 심고, 이후 서비스/레포지토리 계층이 로그에 자동 포함시킨다 (logger.config 가
 * customProps 로 꺼내 출력).
 */
import { AsyncLocalStorage } from 'node:async_hooks'

export interface CorrelationStore {
  correlationId: string
}

export const correlationIdStore = new AsyncLocalStorage<CorrelationStore>()

export function currentCorrelationId(): string | undefined {
  return correlationIdStore.getStore()?.correlationId
}
