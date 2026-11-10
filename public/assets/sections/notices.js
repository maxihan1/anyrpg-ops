// 공지 — 게임에 띄울 공지를 쓰고, 표에서 바로 켜기 · 끄기 · 고치기 · 지우기. 게임은 /api/serverstatus 로 읽는다
import { $, api, chip, confirmModal, dt, esc, fromLocalInput, modal, toLocalInput, toast } from '../common.js';

function form(n = {}) {
  return `<div class="form-row"><label for="nt-title">제목 (1~60자)</label><input type="text" id="nt-title" maxlength="60" value="${esc(n.title ?? '')}"></div>
    <div class="form-row"><label for="nt-body">내용 (1~1,000자)</label><textarea id="nt-body" rows="5" maxlength="1000">${esc(n.body ?? '')}</textarea></div>
    <div class="ops-two">
      <div class="form-row"><label for="nt-start">보이기 시작 (비우면 지금)</label><input type="datetime-local" id="nt-start" value="${toLocalInput(n.startsAt)}"></div>
      <div class="form-row"><label for="nt-end">보이기 끝 (비우면 끌 때까지)</label><input type="datetime-local" id="nt-end" value="${toLocalInput(n.endsAt)}"></div>
    </div>
    <label class="switch"><input type="checkbox" id="nt-enabled"${n.enabled === false ? '' : ' checked'}> 켜기</label>`;
}

const read = (box) => ({
  title: $('#nt-title', box).value, body: $('#nt-body', box).value,
  startsAt: fromLocalInput($('#nt-start', box).value), endsAt: fromLocalInput($('#nt-end', box).value), enabled: $('#nt-enabled', box).checked,
});

function state(n) {
  const now = Date.now();
  if (!n.enabled) return chip('꺼짐', 'off');
  if (new Date(n.startsAt) > now) return chip('예약', 'info');
  if (n.endsAt && new Date(n.endsAt) <= now) return chip('끝남', 'off');
  return chip('게임에 보임', 'ok');
}

export async function render(main) {
  let list = [];
  main.innerHTML = `<h1>공지</h1>
    <div class="ops-bar"><span class="ops-note">켜져 있고 기간 안인 공지만 게임 로그인 화면 · 접속 중 알림에 나갑니다.</span><button type="button" class="btn primary push" id="nt-new">새 공지</button></div>
    <div class="ops-table" id="nt-table"></div>`;

  async function load() {
    list = await api('GET', '/api/ops/notices');
    $('#nt-table').innerHTML = list.length
      ? `<table class="list"><thead><tr><th>번호</th><th>제목</th><th>기간</th><th>상태</th><th>켜기</th><th>고친 시각</th><th></th></tr></thead><tbody>
        ${list.map((n) => `<tr><td>${n.id}</td><td>${esc(n.title)}</td><td>${dt(n.startsAt)} ~ ${n.endsAt ? dt(n.endsAt) : ''}</td><td>${state(n)}</td>
          <td><label class="switch"><input type="checkbox" data-toggle="${n.id}"${n.enabled ? ' checked' : ''} aria-label="${esc(n.title)} 켜기"></label></td>
          <td>${dt(n.updatedAt)} · ${esc(n.createdBy)}</td>
          <td><button type="button" class="btn" data-edit="${n.id}">고치기</button> <button type="button" class="btn danger" data-del="${n.id}">지우기</button></td></tr>`).join('')}</tbody></table>`
      : '<p class="empty-state">공지가 없습니다</p>';
  }

  async function edit(n) {
    const input = await modal({
      title: n ? `공지 #${n.id} 고치기` : '새 공지', className: 'wide', body: form(n ?? {}),
      buttons: [{ label: '닫기', value: null }, { label: '저장', primary: true, value: read }],
    });
    if (!input) return;
    try {
      await api(n ? 'PUT' : 'POST', n ? `/api/ops/notices/${n.id}` : '/api/ops/notices', input);
      toast('공지를 저장했습니다');
    } catch (e) {
      toast(e.message);
    }
    await load();
  }

  main.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.id === 'nt-new') await edit(null);
    if (t.dataset.edit) await edit(list.find((n) => n.id === Number(t.dataset.edit)));
    if (t.dataset.del) {
      const n = list.find((x) => x.id === Number(t.dataset.del));
      if (!(await confirmModal(`「${n.title}」 공지를 지울까요?`, '지우기', '닫기'))) return;
      await api('DELETE', `/api/ops/notices/${n.id}`);
      toast('공지를 지웠습니다');
      await load();
    }
  });
  main.addEventListener('change', async (e) => {
    const id = Number(e.target.dataset.toggle);
    if (!id) return;
    const n = list.find((x) => x.id === id);
    try {
      await api('PUT', `/api/ops/notices/${id}`, { title: n.title, body: n.body, startsAt: n.startsAt, endsAt: n.endsAt, enabled: e.target.checked });
      toast(e.target.checked ? '공지를 켰습니다' : '공지를 껐습니다');
    } catch (err) {
      toast(err.message);
    }
    await load();
  });
  await load();
}
