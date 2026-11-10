// 게임 운영툴 웹 서버 — 화면 파일을 주고, 운영자 토큰을 httpOnly 쿠키로 들고 AnyMMO 운영자 API(/opsapi)에 대신 묻는다
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { fileURLToPath } from 'node:url';

export const COOKIE = 'anyrpg_ops';
const PAGES = ['/', '/users', '/grants', '/notices', '/maintenance', '/logs'];

export interface Options {
  apiBase: string;
  // 테스트는 가짜 API 를 넣는다
  fetchImpl?: typeof fetch;
  secureCookie?: boolean;
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

const unauthorized = (reply: FastifyReply) =>
  reply.code(401).send({ code: 'UNAUTHORIZED', message: '운영자 로그인이 필요합니다' });

export function buildApp(opts: Options) {
  const app = Fastify({ logger: false });
  const doFetch = opts.fetchImpl ?? fetch;
  const secure = opts.secureCookie ?? true;
  const setToken = (reply: FastifyReply, token: string, maxAge: number) =>
    reply.header('set-cookie', `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`);

  async function upstream(method: string, path: string, token: string | undefined, body?: unknown) {
    let res: Response;
    try {
      res = await doFetch(`${opts.apiBase}${path}`, {
        method,
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      throw new Error(`게임 API 서버에 연결하지 못했습니다 (${(e as Error).message})`, { cause: e });
    }
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { code: 'UPSTREAM', message: text.slice(0, 200) };
    }
    return { status: res.status, data };
  }

  // 요청 본문이 깨진 것(4xx)은 그대로, 나머지는 게임 API 를 못 부른 것으로 본다
  app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
    const status = err.statusCode && err.statusCode < 500 ? err.statusCode : 502;
    reply.code(status).send({ code: status === 502 ? 'UPSTREAM' : 'INVALID', message: err.message });
  });

  app.post('/api/login', async (req, reply) => {
    const r = await upstream('POST', '/opsapi/login', undefined, req.body ?? {});
    if (r.status !== 200) return reply.code(r.status).send(r.data);
    const { token, operator } = r.data as { token: string; operator: unknown };
    setToken(reply, token, 12 * 3600);
    return { operator };
  });

  app.post('/api/logout', async (_req, reply) => {
    setToken(reply, '', 0);
    return reply.code(204).send();
  });

  app.get('/api/session', async (req) => {
    const token = readCookie(req.headers.cookie, COOKIE);
    if (!token) return { operator: null };
    const r = await upstream('GET', '/opsapi/me', token);
    return { operator: r.status === 200 ? r.data : null };
  });

  // /api/ops/<경로> → /opsapi/<경로>, 쿼리 그대로
  app.all('/api/ops/*', async (req: FastifyRequest, reply) => {
    const token = readCookie(req.headers.cookie, COOKIE);
    if (!token) return unauthorized(reply);
    const rest = req.url.slice('/api/ops'.length);
    const hasBody = !['GET', 'HEAD', 'DELETE'].includes(req.method);
    const r = await upstream(req.method, `/opsapi${rest}`, token, hasBody ? (req.body ?? {}) : undefined);
    if (r.status === 401) {
      setToken(reply, '', 0);
      return unauthorized(reply);
    }
    if (r.status === 204) return reply.code(204).send();
    return reply.code(r.status).send(r.data);
  });

  const pages = fileURLToPath(new URL('../public', import.meta.url));
  app.register(fastifyStatic, { root: `${pages}/assets`, prefix: '/assets/', index: false });
  for (const page of PAGES) {
    app.get(page, async (req, reply) => {
      if (!readCookie(req.headers.cookie, COOKIE)) return reply.redirect(`/login?next=${encodeURIComponent(req.url)}`);
      return reply.sendFile('ops.html', pages);
    });
  }
  app.get('/login', async (_req, reply) => reply.sendFile('login.html', pages));
  app.get('/healthz', async () => ({ ok: true }));
  return app;
}
