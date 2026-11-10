// 운영툴 서버가 토큰을 쿠키로만 들고 게임 API 에 대신 묻는지 검사한다
import { describe, expect, it } from 'vitest';
import { COOKIE, buildApp, readCookie } from './app.js';

type Call = { url: string; method: string; auth: string | null; body: string | null };

function fakeApi(handler: (c: Call) => { status: number; body?: unknown }) {
  const calls: Call[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const call = { url, method: init?.method ?? 'GET', auth: headers.get('authorization'), body: (init?.body as string) ?? null };
    calls.push(call);
    const r = handler(call);
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status });
  }) as typeof fetch;
  return { calls, impl };
}

describe('anyrpg-ops 서버', () => {
  it('로그인하면 토큰을 응답 본문이 아니라 httpOnly 쿠키로만 준다', async () => {
    const api = fakeApi(() => ({ status: 200, body: { token: 'T1', operator: { id: 1, userName: 'qa_ops' } } }));
    const app = buildApp({ apiBase: 'http://api', fetchImpl: api.impl });
    const res = await app.inject({ method: 'POST', url: '/api/login', payload: { userName: 'qa_ops', password: 'pw' } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ operator: { id: 1, userName: 'qa_ops' } });
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toContain(`${COOKIE}=T1`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(api.calls[0].url).toBe('http://api/opsapi/login');
  });

  it('로그인 실패는 API 의 상태와 문구를 그대로 넘긴다', async () => {
    const api = fakeApi(() => ({ status: 401, body: { code: 'UNAUTHORIZED', message: '아이디 또는 비밀번호가 맞지 않습니다' } }));
    const app = buildApp({ apiBase: 'http://api', fetchImpl: api.impl });
    const res = await app.inject({ method: 'POST', url: '/api/login', payload: {} });
    expect(res.statusCode).toBe(401);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('운영 API 는 쿠키 토큰을 Bearer 로 붙여 경로 · 쿼리 · 본문을 그대로 넘긴다', async () => {
    const api = fakeApi(() => ({ status: 200, body: { ok: true } }));
    const app = buildApp({ apiBase: 'http://api', fetchImpl: api.impl });
    const res = await app.inject({ method: 'POST', url: '/api/ops/users/3/sanctions?x=1', cookies: { [COOKIE]: 'T2' }, payload: { type: 'SUSPEND' } });
    expect(res.statusCode).toBe(200);
    expect(api.calls[0]).toEqual({ url: 'http://api/opsapi/users/3/sanctions?x=1', method: 'POST', auth: 'Bearer T2', body: '{"type":"SUSPEND"}' });
  });

  it('쿠키가 없으면 API 를 부르지 않고 401, API 가 401 이면 쿠키를 지운다', async () => {
    const api = fakeApi(() => ({ status: 401, body: {} }));
    const app = buildApp({ apiBase: 'http://api', fetchImpl: api.impl });
    expect((await app.inject({ method: 'GET', url: '/api/ops/summary' })).statusCode).toBe(401);
    expect(api.calls).toHaveLength(0);
    const res = await app.inject({ method: 'GET', url: '/api/ops/summary', cookies: { [COOKIE]: 'old' } });
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('UNAUTHORIZED');
    expect(String(res.headers['set-cookie'])).toContain('Max-Age=0');
  });

  it('API 서버가 꺼져 있으면 502 와 까닭을 준다', async () => {
    const app = buildApp({ apiBase: 'http://api', fetchImpl: (async () => { throw new Error('ECONNREFUSED'); }) as typeof fetch });
    const res = await app.inject({ method: 'GET', url: '/api/ops/summary', cookies: { [COOKIE]: 'T' } });
    expect(res.statusCode).toBe(502);
    expect(res.json().message).toContain('ECONNREFUSED');
  });

  it('로그인 안 한 채 화면 주소로 오면 로그인 화면으로 보낸다', async () => {
    const app = buildApp({ apiBase: 'http://api', fetchImpl: fakeApi(() => ({ status: 200 })).impl });
    const res = await app.inject({ method: 'GET', url: '/users?q=a' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/login?next=%2Fusers%3Fq%3Da');
    expect((await app.inject({ method: 'GET', url: '/users', cookies: { [COOKIE]: 'T' } })).statusCode).toBe(200);
  });

  it('쿠키 읽기는 여러 쿠키 중 이름이 맞는 것만', () => {
    expect(readCookie(`a=1; ${COOKIE}=x%3Dy; b=2`, COOKIE)).toBe('x=y');
    expect(readCookie(undefined, COOKIE)).toBeUndefined();
  });
});
