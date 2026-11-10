// 운영자 로그인 — 성공하면 서버가 httpOnly 쿠키를 심고, 원래 가려던 화면으로 돌아간다
import { $, busy } from './common.js';

const next = new URLSearchParams(location.search).get('next');
const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#login-error');
  err.hidden = true;
  const userName = $('#login-id').value.trim();
  const password = $('#login-pw').value;
  if (!userName || !password) {
    err.textContent = '아이디와 비밀번호를 입력하세요';
    err.hidden = false;
    return;
  }
  await busy($('button[type=submit]'), async () => {
    const res = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userName, password }) });
    if (res.ok) {
      location.href = safeNext;
      return;
    }
    const data = await res.json().catch(() => ({}));
    err.textContent = data.message ?? '로그인하지 못했습니다';
    err.hidden = false;
  });
});
