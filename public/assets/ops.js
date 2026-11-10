// 운영툴 틀 — 주소로 메뉴를 고르고 그 메뉴 모듈을 불러온다. 점검 중이면 머리줄에 띄운다
import { $, $$, api, chip, confirmModal, esc, session, toast } from './common.js';

const SECTIONS = { '': 'dashboard', users: 'users', grants: 'grants', notices: 'notices', maintenance: 'maintenance', logs: 'logs' };
const section = SECTIONS[location.pathname.split('/')[1]] ?? 'dashboard';
const main = $('#ops-main');

for (const a of $$('.ops-nav a')) if (a.dataset.section === section) a.setAttribute('aria-current', 'page');

session().then((op) => { $('#ops-who').textContent = op ? `${op.displayName} (${op.userName})` : ''; });

export async function refreshMaintenance() {
  const m = await api('GET', '/api/ops/maintenance');
  const now = Date.now();
  const active = m.enabled && (!m.startsAt || new Date(m.startsAt) <= now) && (!m.endsAt || new Date(m.endsAt) > now);
  const el = $('#ops-maint');
  el.innerHTML = active ? chip('점검 중', 'bad') : '';
  el.hidden = !active;
}

$('#ops-logout').addEventListener('click', async () => {
  if (!(await confirmModal('로그아웃 하시겠습니까?'))) return;
  await api('POST', '/api/logout');
  location.href = '/login';
});

try {
  const mod = await import(`./sections/${section}.js`);
  await mod.render(main);
  refreshMaintenance().catch(() => {});
} catch (e) {
  main.innerHTML = `<p class="error-text">${esc(e.message)}</p>`;
  toast(e.message);
} finally {
  main.removeAttribute('aria-busy');
}
