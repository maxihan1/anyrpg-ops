// 점검 — 켜면 허용 계정 말고는 게임 로그인이 503 으로 막히고, 안내 문구가 게임에 나간다
import { $, api, busy, chip, confirmModal, dt, esc, fromLocalInput, toLocalInput, toast } from '../common.js';

const activeNow = (m) => m.enabled && (!m.startsAt || new Date(m.startsAt) <= Date.now()) && (!m.endsAt || new Date(m.endsAt) > Date.now());

export async function render(main) {
  let m = await api('GET', '/api/ops/maintenance');
  function draw() {
    main.innerHTML = `<h1>점검</h1>
      <div class="ops-ok" style="${activeNow(m) ? 'background:#fef2f2;border-color:#fecaca' : ''}">
        ${activeNow(m) ? chip('점검 중', 'bad') : m.enabled ? chip('점검 예약', 'info') : chip('운영 중', 'ok')}
        <span>${m.updatedAt && m.updatedBy ? `마지막 변경 ${dt(m.updatedAt)} · ${esc(m.updatedBy)}` : '아직 바꾼 적 없음'}</span></div>
      <form class="card form" id="mt-form" novalidate>
        <label class="switch"><input type="checkbox" id="mt-enabled"${m.enabled ? ' checked' : ''}> 점검 켜기</label>
        <div class="form-row"><label for="mt-message">게임에 보일 안내 (켤 때 1~300자)</label><textarea id="mt-message" rows="3" maxlength="300">${esc(m.message)}</textarea></div>
        <div class="ops-two">
          <div class="form-row"><label for="mt-start">시작 (비우면 바로)</label><input type="datetime-local" id="mt-start" value="${toLocalInput(m.startsAt)}"></div>
          <div class="form-row"><label for="mt-end">끝 (비우면 끌 때까지)</label><input type="datetime-local" id="mt-end" value="${toLocalInput(m.endsAt)}"></div>
        </div>
        <div class="form-row"><label for="mt-allow">점검 중에도 들어올 게임 계정 번호 (쉼표로)</label><input type="text" id="mt-allow" value="${esc(m.allowedAccountIds)}" placeholder="예 1, 2"></div>
        <p class="ops-note">점검 중에는 비밀번호가 맞아도 로그인 응답이 503(MAINTENANCE)입니다. 이미 접속한 유저는 게임 서버가 처리합니다.</p>
        <div class="ops-bar"><button type="submit" class="btn primary push">저장</button></div>
      </form>`;
  }
  draw();
  main.addEventListener('submit', async (e) => {
    e.preventDefault();
    const enabled = $('#mt-enabled').checked;
    const ids = $('#mt-allow').value.split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.some((s) => !/^\d+$/.test(s))) { toast('허용 계정에는 숫자 번호만 쉼표로 적으세요'); return; }
    if (enabled !== m.enabled && !(await confirmModal(enabled ? '점검을 켜면 허용 계정 말고는 게임에 로그인할 수 없습니다. 켤까요?' : '점검을 끄고 로그인을 다시 열까요?', enabled ? '점검 켜기' : '점검 끄기', '닫기'))) return;
    await busy(e.submitter ?? $('#mt-form button[type=submit]'), async () => {
      try {
        m = await api('PUT', '/api/ops/maintenance', {
          enabled, message: $('#mt-message').value, startsAt: fromLocalInput($('#mt-start').value), endsAt: fromLocalInput($('#mt-end').value), allowedAccountIds: ids.map(Number),
        });
        toast('점검 설정을 저장했습니다');
        draw();
        const head = document.getElementById('ops-maint');
        head.innerHTML = activeNow(m) ? chip('점검 중', 'bad') : '';
        head.hidden = !activeNow(m);
      } catch (err) {
        toast(err.message);
      }
    });
  });
}
