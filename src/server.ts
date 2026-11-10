// 게임 운영툴 웹 서버 진입점 — API_BASE(게임 API 서버 주소) · PORT 를 받아 띄운다
import { buildApp } from './app.js';

const apiBase = process.env.API_BASE ?? 'http://127.0.0.1:13110';
const port = Number(process.env.PORT ?? 3000);
const app = buildApp({ apiBase, secureCookie: process.env.INSECURE_COOKIE !== '1' });
await app.listen({ host: '0.0.0.0', port });
console.log(`anyrpg-ops :${port} → ${apiBase}`);
