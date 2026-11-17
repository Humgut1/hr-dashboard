// 비밀번호 잠금. 비공개 자료(조직도 · 공고뱅크 · 기록장)를 읽는 곳은 모두 LOCK.json(경로) 를 쓴다.
// - 이 PC(localhost)에서는 docs/ 의 원본 JSON 을 그대로 읽는다.
// - 공개 사이트에는 원본이 없고, lock.py 가 비밀번호로 잠근 p/<경로>.bin 만 있다.
//   비밀번호 → PBKDF2-SHA256 → AES-GCM 열쇠. 파일 = IV(12바이트) + 암호문(gzip 한 JSON).
//   비밀번호 없이는 내용을 읽을 수 없다. 맞힌 열쇠는 이 브라우저에만 남겨서(localStorage) 다음엔 안 묻는다.
(() => {
  const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const BASE = new URL(".", document.currentScript.src).href;   // docs/ (= 공개 저장소 맨 위)
  const KEY_NAME = "hrlock-v1";
  let key = null, asking = null, meta = null;

  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const saved = () => { try { return localStorage.getItem(KEY_NAME); } catch (e) { return null; } };
  const getMeta = () => meta || (meta = fetch(BASE + "p/lock.json", {cache: "no-store"}).then(r => { if (!r.ok) throw new Error("잠금 자료가 없음"); return r.json(); }));

  async function derive(pw) {
    const m = await getMeta();
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({name: "PBKDF2", hash: "SHA-256", salt: b64(m.salt), iterations: m.iter}, base, 256);
    return new Uint8Array(bits);
  }
  async function open(raw, buf) {
    const k = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt({name: "AES-GCM", iv: buf.slice(0, 12)}, k, buf.slice(12));
    const text = await new Response(new Blob([plain]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
    return JSON.parse(text);
  }
  async function check(raw) {   // 작은 확인용 파일로 비밀번호가 맞는지 본다
    const buf = new Uint8Array(await (await fetch(BASE + "p/check.bin", {cache: "no-store"})).arrayBuffer());
    try { return (await open(raw, buf)).ok === true; } catch (e) { return false; }
  }

  // 비밀번호 창. 맞을 때까지 다시 묻는다. 닫으면 reject.
  function ask() {
    if (asking) return asking;
    asking = new Promise((resolve, reject) => {
      const st = document.createElement("style");
      st.textContent = `.lk-bg{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px}
.lk{background:#fff;color:#191f28;border-radius:16px;padding:24px 22px;width:100%;max-width:340px;font:14px/1.6 "Pretendard Variable",Pretendard,"Malgun Gothic",sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.25)}
.lk h3{margin:0 0 4px;font-size:18px}.lk p{margin:0 0 14px;color:#4e5968;font-size:13px}
.lk input{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:11px 12px;border:1px solid #d1d6db;border-radius:10px;background:#fff;color:#191f28}
.lk .row{display:flex;gap:8px;margin-top:12px}.lk button{flex:1;font:inherit;font-weight:600;padding:10px;border-radius:10px;border:0;cursor:pointer}
.lk .go{background:#3182f6;color:#fff}.lk .no{background:#f2f4f6;color:#4e5968}.lk .err{color:#f04452;font-size:13px;min-height:20px;margin:6px 0 0}
@media (prefers-color-scheme: dark){.lk{background:#1d1d22;color:#f2f2f4}.lk p{color:#c3c3c9}.lk input{background:#101013;color:#f2f2f4;border-color:#2c2c34}.lk .no{background:#2c2c34;color:#c3c3c9}}`;
      const bg = document.createElement("div");
      bg.className = "lk-bg";
      bg.innerHTML = `<form class="lk"><h3>비밀번호</h3><p>공고 원문 · 조직도가 들어 있는 비공개 화면이에요.</p>
<input type="password" autocomplete="current-password" aria-label="비밀번호" required><p class="err" aria-live="polite"></p>
<div class="row"><button type="button" class="no">닫기</button><button class="go">열기</button></div></form>`;
      document.head.appendChild(st); document.body.appendChild(bg);
      const f = bg.querySelector("form"), inp = bg.querySelector("input"), err = bg.querySelector(".err"), go = bg.querySelector(".go");
      inp.focus();
      const done = () => { bg.remove(); st.remove(); asking = null; };
      bg.querySelector(".no").onclick = () => { done(); reject(new Error("닫음")); };
      f.onsubmit = async e => {
        e.preventDefault(); go.disabled = true; err.textContent = "확인하는 중…";
        try {
          const raw = await derive(inp.value);
          if (await check(raw)) {
            key = raw;
            try { localStorage.setItem(KEY_NAME, btoa(String.fromCharCode(...raw))); } catch (e2) { /* 저장 못 해도 이번엔 연다 */ }
            done(); resolve(raw); return;
          }
          err.textContent = "비밀번호가 틀렸어요.";
        } catch (e3) { err.textContent = "확인하지 못했어요. 잠시 뒤 다시 해 주세요."; }
        go.disabled = false; inp.select();
      };
    });
    return asking;
  }

  async function getKey() {
    if (key) return key;
    const s = saved();
    if (s) { const raw = b64(s); if (await check(raw)) return (key = raw); try { localStorage.removeItem(KEY_NAME); } catch (e) { /* 없음 */ } }
    return ask();
  }

  window.LOCK = {
    local: LOCAL,
    has: () => LOCAL || !!key || !!saved(),
    // 경로는 docs/ 기준 (예: "org.json", "bank/toss.json"). 없는 파일이면 reject.
    async json(path) {
      if (LOCAL) { const r = await fetch(BASE + path, {cache: "no-store"}); if (!r.ok) throw new Error(r.status); return r.json(); }
      const raw = await getKey();
      const r = await fetch(BASE + "p/" + path + ".bin", {cache: "no-store"});
      if (!r.ok) throw new Error(r.status);
      return open(raw, new Uint8Array(await r.arrayBuffer()));
    },
    forget() { key = null; try { localStorage.removeItem(KEY_NAME); } catch (e) { /* 없음 */ } },
  };
})();
