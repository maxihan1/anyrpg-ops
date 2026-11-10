// 대시보드 — 유저 · 캐릭터 수, 걸린 제재, 점검 · 공지 상태, 오늘 지급 · 안 받은 우편을 카드로. 카드를 누르면 그 메뉴로 간다
import { api, chip } from '../common.js';

export async function render(main) {
  const s = await api('GET', '/api/ops/summary');
  const n = (v) => Number(v).toLocaleString('ko-KR');
  const card = (href, label, value, note = '') => `<a href="${href}"><div class="card"><span class="muted">${label}</span><strong>${value}</strong>${note}</div></a>`;
  main.innerHTML = `<h1>대시보드</h1>
    <div class="ops-cards">
      ${card('/users', '게임 계정', n(s.users))}
      ${card('/users', '캐릭터', n(s.characters))}
      ${card('/users', '정지 중 계정', n(s.suspended))}
      ${card('/users', '채팅 금지 계정', n(s.chatMuted))}
      ${card('/maintenance', '점검', s.maintenance ? '점검 중' : '운영 중', s.maintenance ? chip('로그인 막힘', 'bad') : chip('정상', 'ok'))}
      ${card('/notices', '게임에 보이는 공지', n(s.noticesShowing))}
      ${card('/grants', '오늘 지급', n(s.grantsToday))}
      ${card('/grants', '아직 안 받은 지급 우편', n(s.unclaimedGrantMails))}
    </div>
    <p class="ops-note">시각은 이 브라우저 시간대로 보입니다. 게임 서버가 읽는 공지 · 점검 상태는 <code>/api/serverstatus</code> 와 같습니다.</p>`;
}
