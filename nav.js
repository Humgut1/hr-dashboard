// 모든 화면 맨 위 공통 메뉴: [한국 | 미국] 나라 탭 + 그 나라 메뉴.
// 화면마다 <body> 바로 안 첫 줄에  <script src="../nav.js" data-page="market"></script>  처럼 넣는다.
// - data-page: market · company · reports · game · org · bank (지금 화면, 메뉴에 표시)
// - data-country: 그 화면이 한 나라 전용이면 KR · US (안 주면 주소의 ?r= → 이 브라우저에 기억한 나라 → 한국)
// 고른 나라는 window.SITE_COUNTRY 로 화면 코드가 읽는다. 🔒 = 비밀번호를 넣어야 열리는 화면.
(() => {
  const me = document.currentScript;
  const BASE = new URL(".", me.src).href;   // docs/ (= 공개 사이트 맨 위)
  // 조직도는 회사 분석 화면을 ?v=org 로 연 것, 게임 공고 상세는 공고뱅크 화면을 ?from=game 으로 연 것이라 메뉴 표시를 바꾼다
  const Q = new URLSearchParams(location.search);
  const PAGE = me.dataset.page === "company" && Q.get("v") === "org" ? "org" : me.dataset.page === "bank" && Q.get("from") === "game" ? "game" : (me.dataset.page || "");
  const KEY = "site-country";
  let C = (me.dataset.country || Q.get("r") || (() => { try { return localStorage.getItem(KEY); } catch (e) { return null; } })() || "KR").toUpperCase();
  if (C !== "US") C = "KR";
  try { localStorage.setItem(KEY, C); } catch (e) { /* 기억 못 해도 괜찮음 */ }
  window.SITE_COUNTRY = C;

  const MENU = {
    KR: [["market", "시장 분석", "market/?r=KR"], ["company", "회사 분석", "company/"], ["reports", "리포트", "reports/?r=KR"],
         ["game", "게임산업", "game/", 1], ["org", "조직도", "org/", 1], ["bank", "공고뱅크", "bank/?r=KR", 1]],
    US: [["market", "시장 분석", "market/?r=US"], ["company", "회사 분석", "company/us.html"], ["reports", "리포트", "reports/?r=US"], ["bank", "공고뱅크", "bank/?r=US", 1]],
  };
  const url = (c, page) => BASE + (MENU[c].find(m => m[0] === page) || MENU[c][0])[2];
  const esc = s => String(s).replace(/[&<>"]/g, x => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[x]));

  const style = document.createElement("style");
  style.textContent = `
.sitenav { --sn-bg: #fff; --sn-line: #e5e8eb; --sn-text: #4e5968; --sn-strong: #191f28; --sn-on: #e8f3ff; --sn-on-text: #1b64da; --sn-pill: #f2f4f6;
  background: var(--sn-bg); border-bottom: 1px solid var(--sn-line); font: 500 14px/1.4 "Pretendard Variable", Pretendard, -apple-system, "Segoe UI", sans-serif; position: relative; z-index: 50; }
@media (prefers-color-scheme: dark) { .sitenav { --sn-bg: #17171c; --sn-line: #2c2c35; --sn-text: #b0b8c1; --sn-strong: #f2f4f6; --sn-on: #1f2d44; --sn-on-text: #8fbaff; --sn-pill: #24242b; } }
.sitenav .sn-in { max-width: 1280px; margin: 0 auto; padding: 8px 16px; display: flex; align-items: center; gap: 8px 14px; flex-wrap: wrap; }
.sitenav .sn-brand { font-weight: 700; color: var(--sn-strong); text-decoration: none; font-size: 15px; white-space: nowrap; }
.sitenav .sn-country { display: inline-flex; background: var(--sn-pill); border-radius: 10px; padding: 3px; gap: 2px; }
.sitenav .sn-country a { padding: 4px 12px; border-radius: 8px; color: var(--sn-text); text-decoration: none; font-weight: 600; white-space: nowrap; }
.sitenav .sn-country a[aria-current] { background: var(--sn-bg); color: var(--sn-strong); box-shadow: 0 1px 2px rgba(0,0,0,.08); }
.sitenav .sn-menu { display: flex; gap: 2px; overflow-x: auto; -webkit-overflow-scrolling: touch; max-width: 100%; scrollbar-width: none; }
.sitenav .sn-menu a { padding: 6px 12px; border-radius: 8px; color: var(--sn-text); text-decoration: none; white-space: nowrap; font-weight: 600; }
.sitenav .sn-menu a:hover { color: var(--sn-strong); background: var(--sn-pill); }
.sitenav .sn-menu a[aria-current] { background: var(--sn-on); color: var(--sn-on-text); }
@media (max-width: 640px) { .sitenav .sn-menu { order: 3; width: 100%; } }
html.embed .sitenav { display: none; }`;
  document.head.appendChild(style);

  const nav = document.createElement("nav");
  nav.className = "sitenav";
  nav.setAttribute("aria-label", "사이트 메뉴");
  nav.innerHTML = `<div class="sn-in">
    <a class="sn-brand" href="${esc(url(C, "market"))}">HR 채용 데이터</a>
    <span class="sn-country" role="group" aria-label="나라">
      <a href="${esc(url("KR", PAGE))}"${C === "KR" ? ' aria-current="true"' : ""}>한국</a>
      <a href="${esc(url("US", PAGE))}"${C === "US" ? ' aria-current="true"' : ""}>미국</a>
    </span>
    <span class="sn-menu">${MENU[C].map(([id, name, , lock]) =>
      `<a href="${esc(url(C, id))}"${id === PAGE ? ' aria-current="page"' : ""}>${lock ? "🔒 " : ""}${esc(name)}</a>`).join("")}</span>
  </div>`;
  me.parentNode.insertBefore(nav, me);
})();
