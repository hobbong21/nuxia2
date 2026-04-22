/**
 * v0.3 S1: 매 요청마다 `x-correlation-id` 를 확보/생성하고
 * AsyncLocalStorage 에 심어 모든 하위 로그에 전파한다.
 *
 * 우선순위:
 *   1. inbound `x-correlation-id` 헤더 (게이트웨이/프런트가 심은 값)
 *   2. 부재 시 `crypto.randomUUID()` 로 신규 생성
 *
 * 응답 헤더에도 동일 값을 돌려보내 클라이언트/로그가 서로 참조 가능하게 한다.
 */
import { randomUUID } from 'node:crypto'
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { correlationIdStore } from '../logger/correlation-id.store'

const HEADER = 'x-correlation-id'

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp()
    const req = http.getRequest<any>()
    const res = http.getResponse<any>()

    const incoming = (req?.headers?.[HEADER] as string | undefined) ?? ''
    const correlationId =
      incoming && incoming.trim().length > 0 ? incoming : randomUUID()

    // 응답 헤더 심기 (express 표준 setHeader).
    try {
      res?.setHeader?.(HEADER, correlationId)
    } catch {
      /* non-HTTP contexts (WS 등) 은 무시 */
    }

    // ALS 는 next.handle() 호출 시점 기준으로 전파된다. 반환된 Observable 은
    // 비동기 구독 시점에도 동일 store 를 보게 하기 위해 Observable 래퍼로 감싼다.
    return new Observable((subscriber) => {
      correlationIdStore.run({ correlationId }, () => {
        const sub = next.handle().subscribe({
          next: (v) => subscriber.next(v),
          error: (e) => subscriber.error(e),
          complete: () => subscriber.complete(),
        })
        return () => sub.unsubscribe()
      })
    })
  }
}
