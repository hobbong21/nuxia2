import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { Response } from 'express'

export interface ApiErrorBody {
  code: string
  message: string
  details?: unknown
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter')

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let body: ApiErrorBody = { code: 'INTERNAL_ERROR', message: 'Internal server error' }

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const payload = exception.getResponse() as any
      body = {
        code: payload?.code ?? mapStatusToCode(status),
        message: payload?.message ?? exception.message,
        details: payload?.details,
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT
        body = { code: 'UNIQUE_CONSTRAINT', message: 'Duplicate value', details: exception.meta }
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND
        body = { code: 'NOT_FOUND', message: 'Record not found' }
      }
    } else {
      this.logger.error(exception)
    }

    res.status(status).json(body)
  }
}

function mapStatusToCode(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST'
    case 401:
      return 'UNAUTHORIZED'
    case 403:
      return 'FORBIDDEN'
    case 404:
      return 'NOT_FOUND'
    case 409:
      return 'CONFLICT'
    case 422:
      return 'UNPROCESSABLE'
    case 429:
      return 'RATE_LIMITED'
    default:
      return 'INTERNAL_ERROR'
  }
}
