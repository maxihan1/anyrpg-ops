// 유저 · 제재 — 아이디 · 이메일 · 번호 · 캐릭터 이름으로 찾고, 표에서 바로 정지 · 채팅 금지 · 해제. 상세에 캐릭터와 제재 이력
import { $, api, chip, confirmModal, dt, esc, modal, query, setQuery, toast } from '../common.js';

const SIZE = 20;
const TYPE = { SUSPEND: '정지', CHAT_MUTE: '채팅 금지' };
const PERIODS = [['1', '1시간'], ['24', '1일'], ['72', '3일'], ['168', '7일'], ['720', '30일'], ['', '해제할 때까지']];

const isActive = (s) => !s.releasedAt && (!s.endsAt || new Date(s.endsAt) > Date.now());

function stateChips(u) {
  const parts = [];
  if (u.suspended) parts.push(chip('정지', 'bad'));
  if (u.chatMuted) parts.push(chip('채팅 금지', 'warn'));
  return parts.length ? parts.join(' ') : chip('정상', 'ok');
}

function rowActions(u) {
  return (u.suspended
    ? `<button type="button" class="btn" data-act="release" data-type="SUSPEND" data-id="${u.id}">정지 해제</button>`
    : `<button type="button" class="btn danger" data-act="sanction" data-type="SUSPEND" data-id="${u.id}">정지</button>`)
    + ' ' + (u.chatMuted
    ? `<button type="button" class="btn" data-act="release" data-type="CHAT_MUTE" data-id="${u.id}">채팅 금지 해제</button>`
    : `<button type="button" class="btn" data-act="sanction" data-type="CHAT_MUTE" data-id="${u.id}">채팅 금지</button>`)
    + ` <button type="button" class="btn" data-act="detail" data-id="${u.id}">상세</button>`;
}

async function askSanction(userName, type) {
  return modal({
    title: `${userName} ${TYPE[type]}`,
    body: `<div class="form"><div class="form-row"><label for="sc-period">기간</label><select id="sc-period">${PERIODS.map(([v, l]) => `<option value="${v}"${v === '24' ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="form-row"><label for="sc-reason">사유 (1~200자, 유저에게 보일 수 있음)</label><textarea id="sc-reason" rows="3" maxlength="200"></textarea></div>
      <p class="ops-note">${type === 'SUSPEND' ? '정지 중에는 게임 로그인이 막힙니다(비밀번호가 맞으면 정지 안내가 나감).' : '채팅 금지는 게임 서버가 읽어 채팅을 막습니다.'}</p></div>`,
    buttons: [{ label: '닫기', value: null }, {
      label: TYPE[type], primary: true, value: (box) => {
        const hours = $('#sc-period', box).value;
        return { type, reason: $('#sc-reason', box).value, endsAt: hours ? new Date(Date.now() + Number(hours) * 3600e3).toISOString() : null };
      },
    }],
  });
}

async function askReason(title, label) {
  return modal({
    title,
    body: `<div class="form-row"><label for="rs-reason">${label} (1~200자)</label><textarea id="rs-reason" rows="3" maxlength="200"></textarea></div>`,
    buttons: [{ label: '닫기', value: null }, { label: '확인', primary: true, value: (box) => $('#rs-reason', box).value }],
  });
}

function itemsSummary(items) {
  const entries = Object.entries(items ?? {});
  if (!entries.length) return '<span class="muted">-</span>';
  return esc(entries.slice(0, 4).map(([k, v]) => `${k} x${v}`).join(', ') + (entries.length > 4 ? ` 외 ${entries.length - 4}종` : ''));
}

function currencySummary(list) {
  if (!list?.length) return '<span class="muted">-</span>';
  return esc(list.map((c) => Object.values(c).join(' ')).join(', '));
}

export async function render(main) {
  let keyword = query().get('q') ?? '';
  let page = 1;
  let rows = [];
  let detailId = Number(query().get('id')) || null;
  let detail = null;
  main.innerHTML = `<h1>유저 · 제재</h1>
    <div class="ops-bar">
      <label>검색 <input type="search" id="user-q" placeholder="아이디 · 이메일 · 계정 번호 · 캐릭터 이름" value="${esc(keyword)}" size="32"></label>
      <span class="push muted" id="user-total" aria-live="polite"></span>
    </div>
    <div class="ops-table" id="user-table"></div>
    <div class="ops-bar"><button type="button" class="btn" id="user-prev">이전</button><span id="user-page"></span><button type="button" class="btn" id="user-next">다음</button></div>
    <section class="card ops-detail" id="user-detail" hidden></section>`;

  async function load() {
    const r = await api('GET', `/api/ops/users?q=${encodeURIComponent(keyword)}&page=${page}&size=${SIZE}`);
    rows = r.items;
    const last = Math.max(1, Math.ceil(r.total / SIZE));
    $('#user-total').textContent = `총 ${r.total.toLocaleString('ko-KR')}명`;
    $('#user-page').textContent = `${page} / ${last}`;
    $('#user-prev').disabled = page <= 1;
    $('#user-next').disabled = page >= last;
    $('#user-table').innerHTML = rows.length
      ? `<table class="list"><thead><tr><th>번호</th><th>아이디</th><th>이메일</th><th class="num">캐릭터</th><th>상태</th><th></th></tr></thead><tbody>
        ${rows.map((u) => `<tr><td>${u.id}</td><td><button type="button" class="link" data-act="detail" data-id="${u.id}"><strong>${esc(u.userName)}</strong></button></td>
          <td>${esc(u.email)}</td><td class="num">${u.characterCount}</td><td>${stateChips(u)}</td><td>${rowActions(u)}</td></tr>`).join('')}</tbody></table>`
      : '<p class="empty-state">조건에 맞는 유저가 없습니다</p>';
  }

  async function loadDetail() {
    const box = $('#user-detail');
    if (!detailId) { box.hidden = true; return; }
    detail = await api('GET', `/api/ops/users/${detailId}`);
    box.hidden = false;
    box.innerHTML = `<div class="ops-bar"><h2>${esc(detail.userName)} <span class="muted">#${detail.id} · ${esc(detail.email)}</span></h2><span>${stateChips(detail)}</span>
        <button type="button" class="btn push" data-act="close-detail">닫기</button></div>
      <h3>캐릭터 ${detail.characters.length}</h3>
      <div class="ops-table">${detail.characters.length ? `<table class="list"><thead><tr><th>번호</th><th>이름</th><th class="num">레벨</th><th>직업</th><th>종족</th><th>위치</th><th>재화</th><th>소지 아이템</th><th>마지막 저장</th><th></th></tr></thead><tbody>
        ${detail.characters.map((c) => `<tr><td>${c.id}</td><td>${esc(c.name)}</td><td class="num">${c.level ?? '-'}</td><td>${esc(c.characterClass ?? '-')}</td><td>${esc(c.race ?? '-')}</td>
          <td>${esc(c.scene ?? '-')}</td><td>${currencySummary(c.currencies)}</td><td>${itemsSummary(c.items)}</td><td>${esc(c.savedOn ?? '-')}</td>
          <td><a class="btn" href="/grants?to=${c.id}">지급</a></td></tr>`).join('')}</tbody></table>` : '<p class="empty-state">캐릭터가 없습니다</p>'}</div>
      <h3>제재 이력 ${detail.sanctions.length}</h3>
      <div class="ops-table">${detail.sanctions.length ? `<table class="list"><thead><tr><th>종류</th><th>사유</th><th>시작</th><th>끝</th><th>상태</th><th>처리</th><th></th></tr></thead><tbody>
        ${detail.sanctions.map((s) => `<tr><td>${chip(TYPE[s.type] ?? s.type, s.type === 'SUSPEND' ? 'bad' : 'warn')}</td><td>${esc(s.reason)}</td><td>${dt(s.startsAt)}</td>
          <td>${s.endsAt ? dt(s.endsAt) : '해제할 때까지'}</td>
          <td>${s.releasedAt ? `${chip('해제', 'off')} <span class="mini">${dt(s.releasedAt)} · ${esc(s.releasedBy)} · ${esc(s.releaseReason)}</span>` : isActive(s) ? chip('적용 중', 'bad') : chip('끝남', 'off')}</td>
          <td>${esc(s.createdBy)}</td><td>${isActive(s) ? `<button type="button" class="btn" data-act="release-one" data-sid="${s.id}">해제</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="empty-state">제재 이력이 없습니다</p>'}</div>`;
  }

  async function release(sanctionId, label) {
    const reason = await askReason(`${label} 해제`, '해제 사유');
    if (reason === null) return;
    try {
      await api('POST', `/api/ops/sanctions/${sanctionId}/release`, { reason });
      toast(`${label}를 해제했습니다`);
    } catch (e) {
      toast(e.message);
    }
  }

  main.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (b) {
      const id = Number(b.dataset.id);
      const u = rows.find((x) => x.id === id) ?? detail;
      if (b.dataset.act === 'detail') {
        detailId = id; setQuery('id', String(id)); await loadDetail(); $('#user-detail').scrollIntoView({ behavior: 'smooth' });
        return;
      }
      if (b.dataset.act === 'close-detail') { detailId = null; setQuery('id', ''); await loadDetail(); return; }
      if (b.dataset.act === 'sanction') {
        const input = await askSanction(u.userName, b.dataset.type);
        if (!input) return;
        try {
          await api('POST', `/api/ops/users/${id}/sanctions`, input);
          toast(`${u.userName} ${TYPE[b.dataset.type]} 처리했습니다`);
        } catch (err) {
          toast(err.message);
        }
      }
      if (b.dataset.act === 'release') {
        const d = await api('GET', `/api/ops/users/${id}`);
        const s = d.sanctions.find((x) => x.type === b.dataset.type && isActive(x));
        if (s) await release(s.id, TYPE[s.type]);
      }
      if (b.dataset.act === 'release-one') {
        const s = detail.sanctions.find((x) => x.id === Number(b.dataset.sid));
        if (!(await confirmModal(`${detail.userName} 의 ${TYPE[s.type]}를 해제할까요?`, '계속', '닫기'))) return;
        await release(s.id, TYPE[s.type]);
      }
      await load();
      await loadDetail();
    }
    if (e.target.id === 'user-prev') { page -= 1; await load(); }
    if (e.target.id === 'user-next') { page += 1; await load(); }
  });
  let timer;
  main.addEventListener('input', (e) => {
    if (e.target.id !== 'user-q') return;
    clearTimeout(timer);
    timer = setTimeout(async () => { keyword = e.target.value.trim(); page = 1; setQuery('q', keyword); await load(); }, 300);
  });
  await load();
  await loadDetail();
}
