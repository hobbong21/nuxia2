import { z } from 'zod';
import { ApiErrorSchema } from '@nuxia2/shared-types';

/**
 * API 기본 fetch 래퍼.
 * - 토큰 주입 (나중에 zustand auth store 또는 cookies로 확장 예정)
 * - zod 런타임 검증
 * - 실패 시 ApiError 래핑
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://api.nuxia2.kr';

export interface ApiRequestInit extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Accept-Authorization 토큰 (임시; 추후 interceptor로 대체) */
  token?: string;
}

export class ApiClientError extends Error {
  code: string;
  status: number;
  details: unknown;
  constructor(opts: { code: string; message: string; status: number; details?: unknown }) {
    super(opts.message);
    this.code = opts.code;
    this.status = opts.status;
    this.details = opts.details;
  }
}

async function request<T>(
  path: string,
  init: ApiRequestInit,
  schema: z.ZodType<T>,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (init.token) headers.set('Authorization', `Bearer ${init.token}`);

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    // 서버 컴포넌트에서도 동작하도록 캐시는 기본 no-store, 필요 시 호출부에서 override
    cache: init.cache ?? 'no-store',
  });

  const text = await res.text();
  const json = text ? safeParseJson(text) : null;

  if (!res.ok) {
    const errParsed = ApiErrorSchema.safeParse(json);
    throw new ApiClientError({
      code: errParsed.success ? errParsed.data.code : 'UNKNOWN',
      message: errParsed.success ? errParsed.data.message : `HTTP ${res.status}`,
      status: res.status,
      details: errParsed.success ? errParsed.data.details : json ?? text,
    });
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiClientError({
      code: 'SCHEMA_MISMATCH',
      message: 'Response schema mismatch',
      status: 500,
      details: parsed.error.flatten(),
    });
  }
  return parsed.data;
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  get: <T>(path: string, schema: z.ZodType<T>, init?: ApiRequestInit) =>
    request(path, { ...init, method: 'GET' }, schema),
  post: <T>(path: string, body: unknown, schema: z.ZodType<T>, init?: ApiRequestInit) =>
    request(path, { ...init, method: 'POST', body }, schema),
  patch: <T>(path: string, body: unknown, schema: z.ZodType<T>, init?: ApiRequestInit) =>
    request(path, { ...init, method: 'PATCH', body }, schema),
  delete: <T>(path: string, schema: z.ZodType<T>, init?: ApiRequestInit) =>
    request(path, { ...init, method: 'DELETE' }, schema),
};
