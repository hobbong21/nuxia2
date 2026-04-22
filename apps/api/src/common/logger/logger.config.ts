/**
 * v0.3 S1: 로그 관찰성 — pino 환경 분기 + correlation-id 전파.
 *
 *   - development: `pino-pretty` (색상 + 가독성). 의존성이 없으면 JSON fallback.
 *   - production : JSON 한 줄 로그. 수집 파이프라인(Fluentbit/Datadog)에서 파싱.
 *
 * `nestjs-pino` 의 `LoggerModule.forRoot()` 에 그대로 전달 가능한 options 를
 * 반환한다. main.ts 에서 `app.useLogger(app.get(Logger))` 로 주입한다.
 *
 * correlation-id 는 AsyncLocalStorage 저장 값을 `genReqId` → `reqId` 필드로
 * 자동 포함시킨다 (pino-http). `correlation-id.interceptor.ts` 가 매 요청마다
 * store 를 열고 `x-correlation-id` 헤더(없으면 생성) 를 심는다.
 */
import type { Params } from 'nestjs-pino'
import { correlationIdStore } from './correlation-id.store'

export function buildLoggerConfig(): Params {
  const isProd = process.env.NODE_ENV === 'production'
  const level = process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug')

  const base: Params['pinoHttp'] = {
    level,
    // 요청 id — 인터셉터에서 store 에 심어둔 값 우선.
    genReqId: (req) => {
      const existing = correlationIdStore.getStore()?.correlationId
      if (existing) return existing
      const hdr = (req.headers?.['x-correlation-id'] as string | undefined) ?? ''
      return hdr || fallbackId()
    },
    customProps: () => {
      const store = correlationIdStore.getStore()
      return store ? { correlationId: store.correlationId } : {}
    },
    // 헬스 체크/메트릭은 INFO 아래로 내려 노이즈 감소.
    customLogLevel: (_req, res, err) => {
      if (err || (res.statusCode ?? 0) >= 500) return 'error'
      if ((res.statusCode ?? 0) >= 400) return 'warn'
      return 'info'
    },
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        reqId: req.id,
      }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  }

  if (isProd) {
    return { pinoHttp: base }
  }

  // Dev: pino-pretty. 미설치 시 pino 가 기본 JSON 으로 떨어지므로 안전하게 try.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require.resolve('pino-pretty')
    return {
      pinoHttp: {
        ...base,
        transport: {
          target: 'pino-pretty',
          options: {
            singleLine: true,
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      },
    }
  } catch {
    return { pinoHttp: base }
  }
}

function fallbackId(): string {
  // Node 18+ 표준. 추가 의존성 없이 correlation id 를 생성.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { randomUUID } = require('node:crypto') as typeof import('node:crypto')
    return randomUUID()
  } catch {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
  }
}
