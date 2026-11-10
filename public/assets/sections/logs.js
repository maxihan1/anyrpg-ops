// 기록 — 운영자 작업(누가 언제 무엇을)과 아이템 흐름(지급 · 수령 · 회수)을 탭으로 나눠 거른다
import { $, api, dt, esc, query, setQuery } from '../common.js';

const AREAS = { AUTH: '로그인', SANCTION: '제재', GRANT: '지급 · 회수', NOTICE: '공지', MAINTENANCE: '점검' };
const KINDS = { GRANTED: '지급', TAKEN: '수령', RECALLED: '회수' };
const SIZE = 50;

export async function render(main) {
  let tab = query().get('tab') === 'items' ? 'items' : 'audit';
  let filter = query().get('f') ?? '';
  let keyword = query().get('q') ?? '';
  let page = 1;
  main.innerHTML = `<h1>기록</h1>
    <div class="tabs" role="tablist"><button type="button" role="tab" data-tab="audit">운영자 작업</button><button type="button" role="tab" data-tab="items">아이템 흐름</button></div>
    <div class="ops-bar"><label>종류 <select id="log-filter"></select></label>
      <label>검색 <input type="search" id="log-q" value="${esc(keyword)}"></label><span class="push muted" id="log-total" aria-live="polite"></span></div>
    <div class="ops-table" id="log-table"></div>
    <div class="ops-bar"><button type="button" class="btn" id="log-prev">이전</button><span id="log-page"></span><button type="button" class="btn" id="log-next">다음</button></div>
    <p class="ops-note">최근 것부터. 아이템 흐름은 운영툴이 보낸 우편의 지급 · 게임에서 받은 것 · 회수한 것입니다.</p>`;

  function drawTabs() {
    for (const b of main.querySelectorAll('[role=tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    const opts = tab === 'audit' ? AREAS : KINDS;
    $('#log-filter').innerHTML = `<option value="">전체</option>${Object.entries(opts).map(([v, l]) => `<option value="${v}"${v === filter ? ' selected' : ''}>${l}</option>`).join('')}`;
    $('#log-q').placeholder = tab === 'audit' ? '운영자 · 대상 · 내용' : '캐릭터 · 아이템';
  }

  async function load() {
    const base = tab === 'audit' ? `/api/ops/logs/audit?area=${filter}` : `/api/ops/logs/items?kind=${filter}`;
    const r = await api('GET', `${base}&q=${encodeURIComponent(keyword)}&page=${page}&size=${SIZE}`);
    const last = Math.max(1, Math.ceil(r.total / SIZE));
    $('#log-total').textContent = `총 ${r.total.toLocaleString('ko-KR')}건`;
    $('#log-page').textContent = `${page} / ${last}`;
    $('#log-prev').disabled = page <= 1;
    $('#log-next').disabled = page >= last;
    if (!r.items.length) { $('#log-table').innerHTML = '<p class="empty-state">기록이 없습니다</p>'; return; }
    $('#log-table').innerHTML = tab === 'audit'
      ? `<table class="list"><thead><tr><th>시각</th><th>운영자</th><th>메뉴</th><th>작업</th><th>대상</th><th>내용</th></tr></thead><tbody>
        ${r.items.map((a) => `<tr><td>${dt(a.at)}</td><td>${esc(a.operator)}</td><td><span class="status">${esc(AREAS[a.area] ?? a.area)}</span></td><td>${esc(a.action)}</td>
          <td>${esc(a.target)}</td><td>${esc(a.detail)}</td></tr>`).join('')}</tbody></table>`
      : `<table class="list"><thead><tr><th>시각</th><th>흐름</th><th>캐릭터</th><th>아이템 · 재화</th><th class="num">수량</th><th class="num">재화</th><th>지급 번호</th><th>누가</th></tr></thead><tbody>
        ${r.items.map((f) => `<tr><td>${dt(f.at)}</td><td><span class="status">${esc(KINDS[f.kind] ?? f.kind)}</span></td><td>${esc(f.characterName)} <span class="mini">#${f.playerCharacterId}</span></td>
          <td>${esc(f.itemName)}</td><td class="num">${f.quantity || ''}</td><td class="num">${f.currencyAmount ? f.currencyAmount.toLocaleString('ko-KR') : ''}</td>
          <td>${f.grantId ?? ''}</td><td>${esc(f.actor)}</td></tr>`).join('')}</tbody></table>`;
  }

  main.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.dataset.tab && t.dataset.tab !== tab) {
      tab = t.dataset.tab; filter = ''; page = 1;
      setQuery('tab', tab === 'items' ? 'items' : ''); setQuery('f', '');
      drawTabs(); await load();
    }
    if (t.id === 'log-prev') { page -= 1; await load(); }
    if (t.id === 'log-next') { page += 1; await load(); }
  });
  main.addEventListener('change', async (e) => {
    if (e.target.id !== 'log-filter') return;
    filter = e.target.value; page = 1; setQuery('f', filter); await load();
  });
  let timer;
  main.addEventListener('input', (e) => {
    if (e.target.id !== 'log-q') return;
    clearTimeout(timer);
    timer = setTimeout(async () => { keyword = e.target.value.trim(); page = 1; setQuery('q', keyword); await load(); }, 300);
  });
  drawTabs();
  await load();
}
