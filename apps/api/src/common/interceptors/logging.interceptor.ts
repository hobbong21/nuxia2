import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP')

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp()
    const req = http.getRequest<any>()
    const start = Date.now()

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start
          this.logger.log(`${req.method} ${req.url} ${http.getResponse().statusCode} ${ms}ms`)
        },
        error: (err) => {
          const ms = Date.now() - start
          this.logger.error(`${req.method} ${req.url} ERR ${ms}ms :: ${err?.message}`)
        },
      }),
    )
  }
}
