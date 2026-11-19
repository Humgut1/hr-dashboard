// 공고뱅크 코드. bank/index.html(모든 회사) · game/jobs.html(게임 회사만, <body data-mode="game">) · bank/job.html(공고 상세)이 같이 쓴다.
// 자료: 한국 = bank.json (목록), bank/<회사>.json (본문). 둘 다 job_bank.py 가 만든다. 비공개 화면.
//       미국(?r=US) = bank_us.json (목록), bank_us/<회사>/<주>.json (본문). us/job_bank_us.py 가 만든다.
"use strict";
const GAME = document.body.dataset.mode === "game";
const US = !GAME && window.SITE_COUNTRY === "US";
const LIST = US ? "bank_us.json" : "bank.json";
const bodyFile = j => US ? `bank_us/${j.k}/${j.b}.json` : `bank/${j.k}.json`;
const R = US ? "US" : "KR";
// 미국 목록은 크기를 줄이려고 빈 칸 · 회사 이름 · 틀로 만들 수 있는 링크를 뺐다 → 여기서 다시 채운다
const FILL = ["ind", "title", "cat", "team", "occ", "job", "emp", "emp0", "car", "exp", "hiring", "loc", "st", "wp", "open_date", "due", "first", "last", "closed", "url", "pay", "deg", "b"];
function prep(d) {
  if (!US) return d;
  const co = {};
  for (const c of d.companies) co[c.k] = c;
  for (const j of d.jobs) {
    for (const f of FILL) if (j[f] == null) j[f] = "";
    j.co = co[j.k] ? co[j.k].name : j.k;
    if (!j.url && co[j.k] && co[j.k].u) j.url = co[j.k].u.replace("{id}", j.id);
    if (j.yrs) j.exp = `${j.yrs} years+`;
    j.known = !!j.known; j.body = !!j.body;
  }
  return d;
}
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
const href = u => /^https?:\/\//.test(u || "") ? u : "";
const day = s => new Date(s + "T00:00:00");
const diff = (a, b) => Math.round((day(a) - day(b)) / 864e5);
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
const words = q => q.toLowerCase().split(/\s+/).filter(Boolean);
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function hi(text, ws) {   // 찾은 낱말에 형광펜
  const t = esc(text);
  if (!ws.length) return t;
  return t.replace(new RegExp("(" + ws.map(w => reEsc(esc(w))).join("|") + ")", "gi"), "<mark>$1</mark>");
}
const jobHref = j => `../bank/job.html?k=${encodeURIComponent(j.k)}&id=${encodeURIComponent(j.id)}&r=${R}${GAME ? "&from=game" : ""}`;
const loadErr = LOCK.local ? `자료를 못 읽었습니다. 먼저 python ${US ? "us/job_bank_us.py" : "job_bank.py"} 를 돌리고, python -m http.server 8765 -d docs 로 열어 주세요.`
  : "비밀번호를 넣어야 볼 수 있어요. 새로 고침하면 다시 물어요.";

// ---------------- 목록 (bank/index.html · game/jobs.html) ----------------
function listPage() {
  const PER = 40;
  const KEYS = ["ind", "cat", "emp", "car", "co"];
  const S = {q: "", deep: false, state: "open", recent: "", sort: "new", page: 1};
  for (const k of KEYS) S[k] = new Set();
  const STATES = [["open", "열린 공고"], ["closed", "마감"], ["all", "전부"]];
  const RECENT = [["", "전체"], ["7", "최근 7일 새 공고"], ["30", "최근 30일 새 공고"]];
  const CARS = ["신입", "신입·경력", "경력", "경력 무관", "인턴", "적혀 있지 않음"];
  let D = null, JOBS = [], today = "";
  const BODY = new Map();   // "회사|번호" → 소문자 본문 ('본문까지 찾기'를 켤 때만 읽는다)
  let bodyState = "none";   // none · loading · done

  function save() {
    const p = new URLSearchParams();
    if (!GAME) p.set("r", R);
    if (S.q) p.set("q", S.q);
    if (S.deep) p.set("deep", "1");
    if (S.state !== "open") p.set("state", S.state);
    for (const k of KEYS) if (S[k].size) p.set(k, [...S[k]].join("|"));
    if (S.recent) p.set("recent", S.recent);
    if (S.sort !== "new") p.set("sort", S.sort);
    if (S.page > 1) p.set("page", S.page);
    history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : ""));
  }
  function load() {
    const p = new URLSearchParams(location.search);
    S.q = p.get("q") || ""; S.deep = p.get("deep") === "1"; S.state = p.get("state") || "open";
    S.recent = p.get("recent") || ""; S.sort = p.get("sort") || (S.q ? "hit" : "new"); S.page = +p.get("page") || 1;
    for (const k of KEYS) S[k] = new Set((p.get(k) || "").split("|").filter(Boolean));
  }

  // 찾는 말: 공고명 · 조직 · 회사 · 분류에서 찾고, '본문까지'면 본문도. 점수는 공고명에 있으면 높게.
  function score(j, ws) {
    if (!ws.length) return 1;
    const head = j._h || (j._h = (j.title + " " + j.team + " " + j.co + " " + j.occ + " " + j.job + " " + j.cat).toLowerCase());
    const title = j.title.toLowerCase();
    const body = S.deep ? BODY.get(j.k + "|" + j.id) || "" : "";
    let s = 0;
    for (const w of ws) {
      if (title.includes(w)) s += 3;
      else if (head.includes(w)) s += 2;
      else if (body.includes(w)) s += 1;
      else return 0;
    }
    return s;
  }
  function pass(j, skip, ws) {
    if (skip !== "state" && S.state === "open" && j.closed) return false;
    if (skip !== "state" && S.state === "closed" && !j.closed) return false;
    for (const k of KEYS) if (skip !== k && S[k].size && !S[k].has(k === "co" ? j.k : j[k])) return false;
    if (skip !== "recent" && S.recent && !(j.known && diff(today, j.first) < +S.recent)) return false;
    return score(j, ws) > 0;
  }
  const countBy = (skip, key, ws) => { const c = {}; for (const j of JOBS) if (pass(j, skip, ws)) c[j[key]] = (c[j[key]] || 0) + 1; return c; };

  function chips(id, key, values, counts) {
    $(id).innerHTML = values.map(v => `<button type="button" class="chip" data-k="${key}" data-v="${esc(v)}" aria-pressed="${S[key].has(v)}">${esc(v)}<small>${counts[v] || 0}</small></button>`).join("");
  }
  function radios(id, key, list, counts) {
    $(id).innerHTML = list.map(([v, t]) => `<button type="button" class="chip" data-r="${key}" data-v="${v}" aria-pressed="${S[key] === v}">${esc(t)}${counts ? `<small>${counts[v] ?? ""}</small>` : ""}</button>`).join("");
  }
  const byCount = (c, sel) => Object.keys(c).concat([...sel].filter(v => !(v in c))).sort((a, b) => (c[b] || 0) - (c[a] || 0));

  function filters(ws) {
    const st = {open: 0, closed: 0, all: 0};
    for (const j of JOBS) if (pass(j, "state", ws)) { st.all++; st[j.closed ? "closed" : "open"]++; }
    radios("fState", "state", STATES, st);
    if ($("fInd")) { const ic = countBy("ind", "ind", ws); chips("fInd", "ind", byCount(ic, S.ind), ic); }
    const cc = countBy("cat", "cat", ws); chips("fCat", "cat", byCount(cc, S.cat), cc);
    const ec = countBy("emp", "emp", ws); chips("fEmp", "emp", (US ? ["정규직", "파트타임", "계약직", "시즌", "인턴"] : ["정규직", "계약직", "인턴"]).filter(v => ec[v] || S.emp.has(v)), ec);
    const rc = countBy("car", "car", ws); chips("fCar", "car", CARS.filter(v => rc[v] || S.car.has(v)), rc);
    radios("fNew", "recent", RECENT);
    const kc = countBy("co", "k", ws), cq = $("coQ").value.trim().toLowerCase();
    const cos = D.companies.filter(c => (kc[c.k] || S.co.has(c.k)) && (!cq || c.name.toLowerCase().includes(cq)))
      .sort((a, b) => (S.co.has(b.k) - S.co.has(a.k)) || (kc[b.k] || 0) - (kc[a.k] || 0));
    $("fCo").innerHTML = cos.map(c => `<label><input type="checkbox" data-co="${esc(c.k)}" ${S.co.has(c.k) ? "checked" : ""}><span>${esc(c.name)}</span><small>${kc[c.k] || 0}</small></label>`).join("")
      || `<p class="meta">맞는 회사가 없습니다.</p>`;
  }

  function snippet(j, ws) {   // 공고명에 없는 말을 본문에서 찾았으면 그 앞뒤를 보여 준다
    if (!S.deep || !ws.length) return "";
    const head = j._h, w = ws.find(x => !head.includes(x));
    if (!w) return "";
    const body = BODY.get(j.k + "|" + j.id) || "", i = body.indexOf(w);
    if (i < 0) return "";
    const raw = BODY.get("raw|" + j.k + "|" + j.id) || "";
    const a = Math.max(0, i - 50), part = raw.slice(a, i + w.length + 70).replace(/\s+/g, " ");
    return `<div class="snip">본문: ${a ? "…" : ""}${hi(part, ws)}…</div>`;
  }
  function row(j, ws) {
    const tags = [`<span class="tag">${esc(j.cat)}</span>`, j.emp && `<span class="tag">${esc(j.emp)}</span>`,
      j.car !== "적혀 있지 않음" && j.car !== j.emp && `<span class="tag">${esc(j.car === "경력" && j.yrs ? j.exp : j.car)}</span>`];
    if (j.closed) tags.unshift(`<span class="tag end">마감</span>`);
    else if (j.known && diff(today, j.first) < 7) tags.unshift(`<span class="tag new">새 공고</span>`);
    let d;
    if (j.closed) d = `${j.closed} 닫힘`;
    else d = (j.known ? `${j.first} 처음 봄` : `${j.first} 전부터 열림`) + (isDate(j.due) ? ` · 마감 D-${Math.max(0, diff(j.due, today))}` : (j.due ? ` · ${esc(j.due)}` : ""));
    const ind = GAME ? "" : ` <i>${esc(j.ind)}</i>`;
    return `<a class="job${j.closed ? " closed" : ""}" href="${jobHref(j)}">`
      + `<div class="co">${hi(j.co, ws)}${j.team ? " · " + hi(j.team, ws) : ""}${ind}</div><div class="t">${hi(j.title, ws)}</div>${snippet(j, ws)}`
      + `<div class="tags">${tags.filter(Boolean).join("")}<span class="d">${d}</span></div></a>`;
  }

  const dueKey = j => isDate(j.due) ? j.due : "9999";
  function render() {
    const ws = words(S.q);
    filters(ws);
    const rows = JOBS.filter(j => pass(j, null, ws));
    const SORTS = {
      hit: (a, b) => score(b, ws) - score(a, ws) || b.first.localeCompare(a.first),
      new: (a, b) => b.first.localeCompare(a.first) || a.co.localeCompare(b.co, "ko"),
      old: (a, b) => a.first.localeCompare(b.first) || a.co.localeCompare(b.co, "ko"),
      due: (a, b) => dueKey(a).localeCompare(dueKey(b)) || b.first.localeCompare(a.first),
      co: (a, b) => a.co.localeCompare(b.co, "ko") || b.first.localeCompare(a.first),
    };
    rows.sort(SORTS[S.sort] || SORTS.new);
    const pages = Math.max(1, Math.ceil(rows.length / PER));
    S.page = Math.min(Math.max(1, S.page), pages);
    $("count").textContent = `공고 ${rows.length.toLocaleString()}개`;
    $("sort").value = S.sort; $("q").value = S.q; $("deep").checked = S.deep;
    $("list").innerHTML = rows.slice((S.page - 1) * PER, S.page * PER).map(j => row(j, ws)).join("")
      || `<div class="empty">조건에 맞는 공고가 없습니다.${S.q && !S.deep && !US ? "<br>'본문까지 찾기'를 켜 보세요." : ""}</div>`;
    const nums = [];
    for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - S.page) <= 2) nums.push(i); else if (nums[nums.length - 1] !== "…") nums.push("…");
    $("pager").innerHTML = pages < 2 ? "" : `<button type="button" data-p="${S.page - 1}" ${S.page === 1 ? "disabled" : ""} aria-label="앞 쪽">‹</button>`
      + nums.map(n => n === "…" ? `<button type="button" disabled>…</button>` : `<button type="button" data-p="${n}" ${n === S.page ? 'aria-current="page"' : ""}>${n}</button>`).join("")
      + `<button type="button" data-p="${S.page + 1}" ${S.page === pages ? "disabled" : ""} aria-label="다음 쪽">›</button>`;
    save();
  }

  async function loadBodies() {
    if (bodyState !== "none") return;
    bodyState = "loading";
    const keys = D.companies.map(c => c.k);
    let n = 0;
    $("deepNote").textContent = `본문 읽는 중… 0/${keys.length}`;
    await Promise.all(keys.map(k => LOCK.json(`bank/${k}.json`).catch(() => ({})).then(b => {
      for (const [id, v] of Object.entries(b)) { BODY.set(k + "|" + id, (v.body || "").toLowerCase()); BODY.set("raw|" + k + "|" + id, v.body || ""); }
      $("deepNote").textContent = `본문 읽는 중… ${++n}/${keys.length}`;
    })));
    bodyState = "done";
    $("deepNote").textContent = `본문 ${(BODY.size / 2).toLocaleString()}개에서도 찾습니다. 본문이 없는 공고는 공고명으로만 찾습니다.`;
    render();
  }

  document.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.k) { const s = S[b.dataset.k], v = b.dataset.v; s.has(v) ? s.delete(v) : s.add(v); S.page = 1; render(); }
    else if (b.dataset.r) { S[b.dataset.r] = b.dataset.v; S.page = 1; render(); }
    else if (b.dataset.clear) { S[b.dataset.clear].clear(); S.page = 1; render(); }
    else if (b.dataset.p) { S.page = +b.dataset.p; render(); window.scrollTo({top: $("list").offsetTop - 60}); }
  });
  $("fCo").addEventListener("change", e => { const k = e.target.dataset.co; if (!k) return; e.target.checked ? S.co.add(k) : S.co.delete(k); S.page = 1; render(); });
  let t;
  $("q").addEventListener("input", e => { clearTimeout(t); t = setTimeout(() => {
    const was = S.q; S.q = e.target.value.trim(); S.page = 1;
    if (S.q && !was && S.sort === "new") S.sort = "hit"; else if (!S.q && S.sort === "hit") S.sort = "new";
    render(); }, 200); });
  $("deep").addEventListener("change", e => { S.deep = e.target.checked; S.page = 1; if (S.deep) loadBodies(); else $("deepNote").textContent = ""; render(); });
  $("coQ").addEventListener("input", () => filters(words(S.q)));
  $("sort").addEventListener("change", e => { S.sort = e.target.value; S.page = 1; render(); });
  $("reset").addEventListener("click", () => { history.replaceState(null, "", location.pathname + (GAME ? "" : "?r=" + R)); load(); $("coQ").value = ""; render(); });
  $("filt").addEventListener("click", () => $("side").classList.toggle("open"));

  if (US) {   // 미국: 본문이 너무 커서(약 280MB) '본문까지 찾기'는 없다. 공고명 · 조직 · 분류로만 찾는다
    document.title = "미국 공고뱅크";
    $("h1").textContent = "미국 회사 공고 찾기";
    $("hInd").textContent = "일 종류";
    $("deep").closest("label").hidden = true; S.deep = false;
    $("deepNote").textContent = "띄어 쓴 낱말은 모두 들어간 공고만 찾습니다 (공고명 · 조직 · 회사 · 분류에서). 미국 공고는 본문이 너무 커서 본문 안까지는 안 찾습니다.";
    $("q").placeholder = "생각나는 말로 찾기 · 예: recruiter, HR business partner, Google PM";
    for (const a of document.querySelectorAll(".top")) a.hidden = true;
  }
  LOCK.json(LIST).then(prep).then(d => {
    if (GAME) { d.companies = d.companies.filter(c => c.ind === "게임"); d.jobs = d.jobs.filter(j => j.ind === "게임"); }
    D = d; JOBS = d.jobs; today = d.date;
    const live = JOBS.filter(j => !j.closed).length;
    $("meta").textContent = `${GAME ? "게임 회사" : "회사"} ${d.companies.length}곳 · 열린 공고 ${live.toLocaleString()}개 · 모은 공고 전체 ${JOBS.length.toLocaleString()}개 · ${d.updated} 기준`;
    load(); render();
    if (S.deep && !US) loadBodies();
    if (!GAME && !S.q) $("q").focus();
  }).catch(() => { $("meta").textContent = loadErr; });
}

// ---------------- 상세 (bank/job.html) ----------------
function detailPage() {
  const p = new URLSearchParams(location.search), K = p.get("k") || "", ID = p.get("id") || "", FROM_GAME = p.get("from") === "game";
  const listUrl = FROM_GAME ? "../game/jobs.html" : `./?r=${R}`;
  if (FROM_GAME) $("tabs").hidden = false; else $("bankTop").hidden = false;
  $("back").href = listUrl;
  $("bankTop").querySelector("a").href = listUrl;
  // 목록에서 눌러 들어왔으면 '공고 목록'은 그 목록으로 (고른 조건 · 쪽 번호가 그대로 남는다)
  try { const r = new URL(document.referrer); if (r.origin === location.origin && /\/(bank\/(index\.html)?|game\/jobs\.html)$/.test(r.pathname)) $("back").href = r.pathname + r.search; } catch (e) { /* 없음 */ }
  const ws = words(new URLSearchParams(new URL($("back").href, location.href).search).get("q") || "");
  const linkify = s => s.replace(/https?:\/\/[^\s<>"')\]]+/g, u => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);

  Promise.all([
    LOCK.json(LIST).then(prep),
    US ? Promise.resolve(null) : LOCK.json(`bank/${K}.json`).catch(() => ({})),
  ]).then(async ([d, bodies]) => {
    const j = d.jobs.find(x => x.k === K && x.id === ID);
    if (j && US) bodies = j.b ? await LOCK.json(bodyFile(j)).catch(() => ({})) : {};
    if (!j) { $("root").innerHTML = `<div class="card"><p class="nobody">이 공고를 찾지 못했습니다. 목록이 새로 만들어지면서 빠졌을 수 있습니다.</p></div>`; return; }
    document.title = `${j.title} · ${j.co}`;
    const today = d.date, b = bodies[ID];
    const tags = [];
    if (j.closed) tags.push(`<span class="tag end">마감 (${esc(j.closed)} 닫힘)</span>`);
    else if (j.known && diff(today, j.first) < 7) tags.push(`<span class="tag new">새 공고</span>`);
    for (const v of [j.ind, j.cat, j.emp, j.car !== "적혀 있지 않음" && j.car !== j.emp && (j.exp || j.car), j.hiring !== "공채(수시)" && j.hiring]) if (v) tags.push(`<span class="tag">${esc(v)}</span>`);
    let due = j.due || "적혀 있지 않음";
    if (isDate(j.due) && !j.closed) due += ` (D-${Math.max(0, diff(j.due, today))})`;
    const open = j.closed ? diff(j.closed, j.first) : diff(today, j.first);
    const info = [
      ["회사", j.co], [US ? "일 종류" : "업종", j.ind], ["조직", j.team], ["직군", j.cat], ["회사가 붙인 분류", [j.occ, j.job].filter(Boolean).join(" · ")],
      ["고용 형태", j.emp], ["회사가 적은 고용 형태", US && j.emp0 !== j.emp ? j.emp0 : ""], ["경력", j.exp || (US && j.car !== "적혀 있지 않음" ? j.car : "")],
      ["채용 구분", j.hiring], ["근무지", j.loc], ["근무 방식", j.wp], ["급여", j.pay], ["학력", j.deg],
      ["공고 올린 날", j.open_date], ["마감", due],
      ["처음 본 날", j.known ? j.first : `${j.first} (모으기 시작한 날이라 그 전부터 열려 있었을 수 있음)`],
      ["마지막 본 날", j.last], ["닫힌 날", j.closed],
      [j.closed ? "열려 있던 날" : "열린 지", `${open}일${j.known ? "" : " 이상"}`],
    ].filter(([, v]) => v);
    const url = href(j.url);
    const others = d.jobs.filter(x => x.k === K && x.id !== ID && !x.closed).sort((a, c) => c.first.localeCompare(a.first));
    const pick = others.filter(x => x.cat === j.cat).concat(others.filter(x => x.cat !== j.cat)).slice(0, 6);
    $("root").innerHTML = `<div class="detail">
      <article class="card">
        <div class="co">${esc(j.co)}${j.team ? " · " + esc(j.team) : ""}</div>
        <h1>${esc(j.title)}</h1>
        <div class="tags">${tags.join("")}</div>
        <h2>공고 내용</h2>
        ${b && b.body.trim() ? `<pre class="body">${linkify(hi(b.body.trim(), ws))}</pre>
          <p class="note">${esc(b.date)}에 보관한 본문입니다${b.versions > 1 ? ` (본문이 바뀐 적이 있어 ${b.versions}벌 보관 중, 가장 최근 것)` : ""}. 회사 사이트의 원래 공고와 다를 수 있습니다.</p>`
          : `<p class="nobody">보관한 본문이 없습니다. '원래 공고 열기'로 회사 사이트에서 보세요.</p>`}
      </article>
      <aside>
        <div class="card">
          <dl>${info.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
          ${url ? `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">원래 공고 열기 ↗</a>` : `<span class="btn off">링크 없음</span>`}
        </div>
        ${pick.length ? `<div class="card more"><h3>${esc(j.co)}의 다른 열린 공고 ${others.length}개</h3>
          ${pick.map(x => `<a href="${jobHref(x)}${FROM_GAME && !GAME ? "&from=game" : ""}">${esc(x.title)}<small>${esc(x.cat)} · ${esc(x.emp)}</small></a>`).join("")}
          <a class="all" href="${listUrl}${listUrl.includes("?") ? "&" : "?"}co=${encodeURIComponent(K)}">${esc(j.co)} 공고 모두 보기 →</a></div>` : ""}
      </aside>
    </div>`;
  }).catch(() => { $("root").innerHTML = `<div class="card"><p class="nobody">${loadErr}</p></div>`; });
}

if ($("list")) listPage(); else detailPage();
