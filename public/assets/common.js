// 운영툴 화면이 같이 쓰는 도구 — API 호출 · 토스트 · 모달 · 버튼 로딩 · 날짜 표시 (데모마켓 운영툴 common.js 에서 가져옴)

export class ApiFail extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && data.code === 'UNAUTHORIZED') goLogin();
    throw new ApiFail(res.status, data.code ?? 'INTERNAL', data.message ?? '잠시 후 다시 시도해 주세요');
  }
  return data;
}

export function goLogin() {
  location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
}

let sessionPromise;
export function session() {
  sessionPromise ??= fetch('/api/session', { credentials: 'same-origin' }).then((r) => r.json()).then((d) => d.operator);
  return sessionPromise;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}


const pad = (n) => String(n).padStart(2, '0');
export const ymd = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const hm = (t) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

export function toast(message) {
  let box = $('#toast-box');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toast-box';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    document.body.append(box);
  }
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = message;
  box.append(t);
  setTimeout(() => t.classList.add('leaving'), 2700);
  setTimeout(() => t.remove(), 3000);
}

// 응답을 기다리는 동안 버튼을 막고 로딩 표시
export async function busy(button, work) {
  const label = button.innerHTML;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.innerHTML = '<span class="spinner" aria-label="처리 중"></span>';
  try {
    return await work();
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.innerHTML = label;
  }
}
// 모달 — 0.3초 페이드, ESC · X · 바깥 클릭으로 닫힘, 닫히면 연 버튼으로 초점 복귀
// buttons: [{ label, value, primary }]. 닫기만 하면 null 로 끝난다
export function modal({ title, body, buttons = [{ label: '확인', value: true, primary: true }], dismissable = true, className = '' }) {
  const opener = document.activeElement;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const box = document.createElement('div');
  box.className = `modal ${className}`;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  const titleId = `m-${Math.random().toString(36).slice(2, 7)}`;
  box.setAttribute('aria-labelledby', titleId);
  box.innerHTML = `<div class="modal-head"><h2 id="${titleId}">${esc(title)}</h2>`
    + (dismissable ? '<button type="button" class="modal-x" aria-label="닫기">×</button>' : '') + '</div>'
    + '<div class="modal-body"></div><div class="modal-foot"></div>';
  const bodyEl = $('.modal-body', box);
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body) bodyEl.append(body);
  backdrop.append(box);
  document.body.append(backdrop);
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => backdrop.classList.add('open'));

  return new Promise((resolve) => {
    const close = (value) => {
      document.removeEventListener('keydown', onKey);
      backdrop.classList.remove('open');
      setTimeout(() => {
        backdrop.remove();
        if (!$('.modal-backdrop')) document.body.classList.remove('no-scroll');
        opener?.focus?.();
      }, 300);
      resolve(value);
    };
    const onKey = (e) => { if (e.key === 'Escape' && dismissable) close(null); };
    document.addEventListener('keydown', onKey);
    if (dismissable) {
      $('.modal-x', box).addEventListener('click', () => close(null));
      backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(null); });
    }
    for (const b of buttons) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = b.primary ? 'btn primary' : 'btn';
      el.textContent = b.label;
      el.addEventListener('click', () => {
        const v = typeof b.value === 'function' ? b.value(box) : b.value;
        if (v !== undefined) close(v);
      });
      $('.modal-foot', box).append(el);
    }
    setTimeout(() => ($('.modal-foot .primary', box) ?? $('.modal-foot button', box))?.focus(), 50);
  });
}

export function confirmModal(message, okLabel = '확인', cancelLabel = '취소', title = '확인') {
  return modal({ title, body: `<p>${esc(message)}</p>`, buttons: [{ label: cancelLabel, value: false }, { label: okLabel, value: true, primary: true }] })
    .then((v) => v === true);
}

// API 는 UTC ISO 로 주고받는다. 화면은 브라우저 시간대로 보여 준다
export const dt = (t) => (t ? `${ymd(t)} ${hm(t)}` : '');
// <input type=datetime-local> 값 ↔ ISO
export const toLocalInput = (t) => {
  if (!t) return '';
  const d = new Date(t);
  return `${ymd(d)}T${hm(d)}`;
};
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
export const query = () => new URLSearchParams(location.search);
// 거르기 값을 주소에 남겨 새로 고침 · 뒤로 가기에도 같은 목록이 나오게 한다
export function setQuery(key, value) {
  const q = query();
  if (value) q.set(key, value); else q.delete(key);
  history.replaceState(null, '', `${location.pathname}${q.size ? `?${q}` : ''}`);
}
export const chip = (label, kind = '') => `<span class="status ${kind}">${esc(label)}</span>`;
