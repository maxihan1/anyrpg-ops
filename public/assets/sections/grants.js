// 지급 · 회수 — 캐릭터를 골라 아이템 · 재화를 우편으로 보내고, 지급 이력 표에서 안 받은 첨부를 바로 회수한다
import { $, api, busy, chip, confirmModal, dt, esc, modal, query, toast } from '../common.js';

const MAIL = { SENT: ['안 받음', 'info'], TAKEN: ['받음', 'ok'], RECALLED: ['회수', 'off'], PARTLY_RECALLED: ['일부 회수', 'warn'], DELETED_BY_PLAYER: ['받기 전 삭제', 'off'] };
const SIZE = 20;

const itemsText = (g) => [...(g.items ?? []).map((i) => `${i.itemName} x${i.quantity}`), ...(g.currencyAmount > 0 ? [`골드 ${g.currencyAmount.toLocaleString('ko-KR')}`] : [])].join(', ');

export async function render(main) {
  const picked = new Map();
  let page = 1;
  let grants = [];
  main.innerHTML = `<h1>지급 · 회수</h1>
    <form class="card form" id="grant-form" novalidate style="max-width:none">
      <h2>우편으로 보내기</h2>
      <div class="ops-two">
        <div class="form-row"><label for="grant-search">받는 캐릭터 (1~50명)</label>
          <input type="search" id="grant-search" placeholder="캐릭터 이름 또는 번호" autocomplete="off">
          <div class="ops-results" id="grant-results" hidden></div>
          <div class="ops-picked" id="grant-picked" aria-live="polite"></div></div>
        <div class="form-row"><span class="label">아이템 (5종까지, 종마다 1~99개)</span>
          <div id="grant-items"></div>
          <div><button type="button" class="btn" id="grant-add-item">아이템 줄 더하기</button></div>
          <datalist id="grant-known"></datalist>
          <label for="grant-currency">골드</label><input type="number" id="grant-currency" min="0" max="1000000" value="0"></div>
      </div>
      <div class="ops-two">
        <div class="form-row"><label for="grant-subject">우편 제목 (1~50자)</label><input type="text" id="grant-subject" maxlength="50" placeholder="예 점검 보상"></div>
        <div class="form-row"><label for="grant-reason">지급 사유 (1~200자, 기록에만 남음)</label><input type="text" id="grant-reason" maxlength="200" placeholder="예 11-10 서버 점검 보상"></div>
      </div>
      <div class="form-row"><label for="grant-body">우편 본문 (500자까지)</label><textarea id="grant-body" rows="3" maxlength="500"></textarea></div>
      <div class="ops-bar"><span class="ops-note">보낸 우편은 받는 사람이 게임 우편함에서 첨부를 받습니다. 안 받은 첨부만 회수할 수 있습니다.</span><button type="submit" class="btn primary push">보내기</button></div>
    </form>
    <h2>지급 이력</h2>
    <div class="ops-table" id="grant-table"></div>
    <div class="ops-bar"><button type="button" class="btn" id="grant-prev">이전</button><span id="grant-page"></span><button type="button" class="btn" id="grant-next">다음</button></div>`;

  function drawPicked() {
    $('#grant-picked').innerHTML = [...picked.values()].map((c) => `<button type="button" data-unpick="${c.id}" aria-label="${esc(c.name)} 빼기">${esc(c.name)} #${c.id} ×</button>`).join('');
  }
  function addItemRow(name = '', qty = 1) {
    if ($('#grant-items').children.length >= 5) { toast('아이템은 5종까지입니다'); return; }
    const row = document.createElement('div');
    row.className = 'ops-item-row';
    row.innerHTML = `<input type="text" list="grant-known" placeholder="아이템 이름(게임 리소스 이름)" value="${esc(name)}" aria-label="아이템 이름">
      <input type="number" min="1" max="99" value="${qty}" aria-label="수량"><button type="button" class="btn" data-remove-item>빼기</button>`;
    $('#grant-items').append(row);
  }

  async function load() {
    const r = await api('GET', `/api/ops/grants?page=${page}&size=${SIZE}`);
    grants = r.items;
    const last = Math.max(1, Math.ceil(r.total / SIZE));
    $('#grant-page').textContent = `${page} / ${last}`;
    $('#grant-prev').disabled = page <= 1;
    $('#grant-next').disabled = page >= last;
    $('#grant-table').innerHTML = grants.length
      ? `<table class="list"><thead><tr><th>번호</th><th>보낸 시각</th><th>제목</th><th>내용</th><th>받는 캐릭터</th><th>사유</th><th>처리</th><th></th></tr></thead><tbody>
        ${grants.map((g) => `<tr><td>${g.id}</td><td>${dt(g.createdAt)}</td><td>${esc(g.subject)}</td><td>${esc(itemsText(g))}</td>
          <td>${g.mails.map((m) => `${esc(m.characterName)} ${chip(...(MAIL[m.status] ?? [m.status]))}`).join('<br>')}</td>
          <td>${esc(g.reason)}</td><td>${esc(g.createdBy)}${g.recalledAt ? `<br><span class="mini">회수 ${dt(g.recalledAt)} · ${esc(g.recalledBy)}</span>` : ''}</td>
          <td>${!g.recalledAt && g.mails.some((m) => m.status === 'SENT') ? `<button type="button" class="btn danger" data-recall="${g.id}">회수</button>` : ''}</td></tr>`).join('')}</tbody></table>`
      : '<p class="empty-state">아직 보낸 지급이 없습니다</p>';
  }

  main.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest('[data-pick]')) {
      const b = t.closest('[data-pick]');
      if (picked.size >= 50) { toast('받는 캐릭터는 50명까지입니다'); return; }
      picked.set(Number(b.dataset.pick), { id: Number(b.dataset.pick), name: b.dataset.name });
      drawPicked();
    }
    if (t.closest('[data-unpick]')) { picked.delete(Number(t.closest('[data-unpick]').dataset.unpick)); drawPicked(); }
    if (t.id === 'grant-add-item') addItemRow();
    if (t.closest('[data-remove-item]')) t.closest('.ops-item-row').remove();
    if (t.closest('[data-recall]')) {
      const g = grants.find((x) => x.id === Number(t.closest('[data-recall]').dataset.recall));
      const reason = await modal({
        title: `지급 #${g.id} 회수`,
        body: `<p>「${esc(g.subject)}」(${esc(itemsText(g))}) 중 <strong>아직 안 받은 첨부</strong>만 거둬들입니다. 이미 받은 것은 그대로입니다.</p>
          <div class="form-row"><label for="recall-reason">회수 사유 (1~200자)</label><textarea id="recall-reason" rows="3" maxlength="200"></textarea></div>`,
        buttons: [{ label: '닫기', value: null }, { label: '회수', primary: true, value: (box) => $('#recall-reason', box).value }],
      });
      if (reason === null) return;
      try {
        const r = await api('POST', `/api/ops/grants/${g.id}/recall`, { reason });
        toast(`회수 ${r.recalled} · 일부 회수 ${r.partlyRecalled} · 이미 받음 ${r.alreadyTaken}`);
      } catch (err) {
        toast(err.message);
      }
      await load();
    }
    if (t.id === 'grant-prev') { page -= 1; await load(); }
    if (t.id === 'grant-next') { page += 1; await load(); }
  });

  let timer;
  main.addEventListener('input', (e) => {
    if (e.target.id !== 'grant-search') return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const q = e.target.value.trim();
      const box = $('#grant-results');
      if (!q) { box.hidden = true; return; }
      const list = await api('GET', `/api/ops/characters?q=${encodeURIComponent(q)}`);
      box.hidden = false;
      box.innerHTML = list.length
        ? list.map((c) => `<button type="button" data-pick="${c.id}" data-name="${esc(c.name)}">${esc(c.name)} <span class="mini">#${c.id} · 계정 ${c.accountId}${c.level ? ` · Lv ${c.level}` : ''}</span></button>`).join('')
        : '<p class="mini" style="padding:8px">찾는 캐릭터가 없습니다</p>';
    }, 250);
  });

  $('#grant-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const items = [...$('#grant-items').children].map((row) => {
      const [name, qty] = row.querySelectorAll('input');
      return { itemName: name.value.trim(), quantity: Number(qty.value) };
    }).filter((i) => i.itemName);
    const body = {
      characterIds: [...picked.keys()], subject: $('#grant-subject').value, body: $('#grant-body').value,
      items, currencyAmount: Number($('#grant-currency').value || 0), reason: $('#grant-reason').value,
    };
    const summary = itemsText(body);
    if (!(await confirmModal(`${picked.size}명에게 「${body.subject}」(${summary || '내용 없음'}) 우편을 보낼까요?`, '보내기', '닫기'))) return;
    await busy(e.submitter ?? $('#grant-form button[type=submit]'), async () => {
      try {
        const r = await api('POST', '/api/ops/grants', body);
        toast(`지급 #${r.id} 우편을 ${picked.size}명에게 보냈습니다`);
        picked.clear(); drawPicked();
        $('#grant-items').innerHTML = ''; addItemRow();
        $('#grant-subject').value = ''; $('#grant-body').value = ''; $('#grant-reason').value = ''; $('#grant-currency').value = '0';
        page = 1;
        await load();
      } catch (err) {
        toast(err.message);
      }
    });
  });

  addItemRow();
  api('GET', '/api/ops/items/known').then((names) => {
    $('#grant-known').innerHTML = names.map((n) => `<option value="${esc(n)}">`).join('');
  }).catch(() => {});
  const to = Number(query().get('to'));
  if (to) {
    const list = await api('GET', `/api/ops/characters?q=${to}`);
    const c = list.find((x) => x.id === to);
    if (c) { picked.set(c.id, { id: c.id, name: c.name }); drawPicked(); }
  }
  await load();
}
