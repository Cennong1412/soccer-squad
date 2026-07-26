// 앱 상태 & 라우터
let ROWS = [];
let PRIMARY_LABELS = {};
let LOADED = false;

const $view = document.getElementById("view");
const $topTitle = document.getElementById("topTitle");
const $backBtn = document.getElementById("backBtn");
const $searchBtn = document.getElementById("searchBtn");

$backBtn.addEventListener("click", () => history.back());
$searchBtn.addEventListener("click", () => { location.hash = "#/search"; });

document.querySelectorAll(".navbtn").forEach((btn) => {
  btn.addEventListener("click", () => { location.hash = btn.dataset.route; });
});

function playerKey(p) {
  return [p.leagueId, p.team, p.number, p.name].map(encodeURIComponent).join("::");
}
function parsePlayerKey(key) {
  const [leagueId, team, number, name] = key.split("::").map(decodeURIComponent);
  return { leagueId, team, number, name };
}

function fmt(v, suffix = "") {
  return v === null || v === undefined ? "-" : `${v}${suffix}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function leagueById(id) {
  return LEAGUES.find((l) => l.id === id);
}

function initials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ---------- 라우터 ----------

function currentRoute() {
  const hash = location.hash || "#/home";
  const parts = hash.replace(/^#\//, "").split("/").filter(Boolean);
  return { name: parts[0] || "home", params: parts.slice(1) };
}

async function router() {
  if (!LOADED) {
    renderLoading();
    return;
  }
  const { name, params } = currentRoute();
  $backBtn.hidden = name === "home";

  document.querySelectorAll(".navbtn").forEach((b) => {
    const route = b.dataset.route.replace("#/", "");
    b.classList.toggle("active", route === name);
  });

  switch (name) {
    case "home": return renderHome();
    case "teams":
      if (params[1]) return renderTeamSquad(params[0], decodeURIComponent(params[1]));
      if (params[0]) return renderTeamList(params[0]);
      return renderLeagueList();
    case "nations":
      if (params[0]) return renderNationDetail(decodeURIComponent(params[0]));
      return renderNationList();
    case "positions":
      return renderPositions(params[0] || "F");
    case "ages":
      return renderAges();
    case "values":
      return renderValues(params[0] || "players");
    case "search":
      return renderSearch();
    case "player":
      return renderPlayerDetail(params[0]);
    case "about":
      return renderAbout();
    default:
      return renderHome();
  }
}

window.addEventListener("hashchange", router);

function setTitle(t) { $topTitle.textContent = t; }

function renderLoading() {
  setTitle("월드 사커 스쿼드");
  $view.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <div>선수 데이터를 불러오는 중...</div>
    </div>`;
}

// ---------- 홈 ----------

function renderHome() {
  setTitle("월드 사커 스쿼드");
  const gapLeagues = LEAGUES.filter((l) => l.note);
  const totalPlayers = ROWS.length;
  const totalLeagues = LEAGUES.length;

  let bannerHtml = "";
  if (gapLeagues.length) {
    bannerHtml = `
      <div class="banner">
        <b>⚠ 데이터 공백 안내</b>
        <ul>
          ${gapLeagues.map((l) => `<li><b>${l.displayName}</b>: ${l.note}</li>`).join("")}
        </ul>
        <div style="margin-top:6px"><a href="#/about">자세히 보기 →</a></div>
      </div>`;
  }

  const cards = LEAGUES.map((lg) => {
    const rows = ROWS.filter((r) => r.leagueId === lg.id);
    const teams = new Set(rows.map((r) => r.team));
    const ages = rows.map((r) => r.age).filter((a) => a !== null);
    const avgAge = ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : "-";
    const teamNote = teams.size < lg.expectedTeams ? `${teams.size}/${lg.expectedTeams}팀` : `${teams.size}팀`;
    return `
      <button class="league-card" onclick="location.hash='#/teams/${lg.id}'">
        <span class="lg-name">${lg.displayName}</span>
        <span class="lg-meta">${teamNote} · 선수 ${rows.length}명 · 평균 ${avgAge}세</span>
        ${lg.note ? `<span class="badge warn">데이터 공백</span>` : ""}
        ${lg.noStats ? `<span class="badge muted">시즌 기록 없음</span>` : ""}
        ${lg.noMarketValue ? `<span class="badge muted">몸값 정보 없음</span>` : ""}
      </button>`;
  }).join("");

  $view.innerHTML = `
    ${bannerHtml}
    <div class="stat-grid">
      <div class="stat-tile"><div class="v">${totalLeagues}</div><div class="l">리그</div></div>
      <div class="stat-tile"><div class="v">${totalPlayers.toLocaleString()}</div><div class="l">선수</div></div>
      <div class="stat-tile"><div class="v">${new Set(ROWS.map((r) => r.nationality).filter(Boolean)).size}</div><div class="l">국적</div></div>
    </div>
    <div class="section-title">리그</div>
    <div class="card-grid">${cards}</div>
    <div style="text-align:center; margin-top:20px;">
      <button class="tab" onclick="location.hash='#/about'">ℹ 데이터 안내 / 마지막 업데이트</button>
    </div>
  `;
}

// ---------- 팀별 보기 ----------

function renderLeagueList() {
  setTitle("팀별 보기");
  const cards = LEAGUES.map((lg) => {
    const rows = ROWS.filter((r) => r.leagueId === lg.id);
    const teams = new Set(rows.map((r) => r.team));
    return `
      <button class="league-card" onclick="location.hash='#/teams/${lg.id}'">
        <span class="lg-name">${lg.displayName}</span>
        <span class="lg-meta">${teams.size}개 팀</span>
        ${lg.note ? `<span class="badge warn">데이터 공백</span>` : ""}
      </button>`;
  }).join("");
  $view.innerHTML = `<div class="card-grid">${cards}</div>`;
}

function renderTeamList(leagueId) {
  const lg = leagueById(leagueId);
  if (!lg) return renderLeagueList();
  setTitle(lg.displayName);
  const rows = ROWS.filter((r) => r.leagueId === leagueId);
  const teams = [...new Set(rows.map((r) => r.team))].sort((a, b) => a.localeCompare(b));

  const noteHtml = lg.note ? `<div class="banner"><b>⚠</b> ${lg.note}</div>` : "";

  const cards = teams.map((team) => {
    const count = rows.filter((r) => r.team === team).length;
    return `
      <button class="team-card" onclick="location.hash='#/teams/${leagueId}/${encodeURIComponent(team)}'">
        <span class="lg-name">${escapeHtml(team)}</span>
        <span class="lg-meta">선수 ${count}명</span>
      </button>`;
  }).join("");

  $view.innerHTML = `${noteHtml}<div class="card-grid">${cards}</div>`;
}

const POS_ORDER = { G: 0, D: 1, M: 2, F: 3 };

function renderTeamSquad(leagueId, team) {
  const lg = leagueById(leagueId);
  if (!lg) return renderLeagueList();
  setTitle(team);
  let players = ROWS.filter((r) => r.leagueId === leagueId && r.team === team);
  players = players.slice().sort((a, b) => {
    const posDiff = (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9);
    if (posDiff !== 0) return posDiff;
    return (Number(a.number) || 999) - (Number(b.number) || 999);
  });

  const statsNote = lg.noStats
    ? `<div class="banner"><b>ℹ</b> ${lg.displayName}는 시즌 기록이 제공되지 않아 기본 정보만 표시됩니다.</div>`
    : "";

  const rowsHtml = players.map((p) => {
    const statLine = lg.noStats
      ? ""
      : (!p.hasStats
        ? `<span class="row-sub">기록 없음 (${p.seasonLabel || "시즌 정보 없음"})</span>`
        : (p.position === "G"
          ? `<span class="row-stat">${fmt(p.saves)}<small>세이브</small></span>`
          : `<span class="row-stat">${fmt(p.goals)}<small>골</small></span>`));
    return `
      <button class="row-card" onclick="location.hash='#/player/${playerKey(p)}'">
        <span class="row-num">${p.number || "-"}</span>
        <span class="pos-pill pos-${p.position}">${p.position || "?"}</span>
        <span class="row-main">
          <div class="row-name">${escapeHtml(p.name)}</div>
          <div class="row-sub">${flagEmoji(p.nationality)} ${escapeHtml(p.nationality || "국적 미상")} · ${fmt(p.age, "세")}</div>
        </span>
        ${statLine}
      </button>`;
  }).join("");

  $view.innerHTML = `${statsNote}<div class="list">${rowsHtml}</div>`;
}

// ---------- 국적별 보기 ----------

function renderNationList() {
  setTitle("국적별 보기");
  const counts = {};
  ROWS.forEach((r) => {
    if (!r.nationality) return;
    counts[r.nationality] = (counts[r.nationality] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  const rowsHtml = sorted.map(([nat, count], i) => `
    <button class="row-card" onclick="location.hash='#/nations/${encodeURIComponent(nat)}'">
      <span class="row-rank">${i + 1}</span>
      <span class="row-main">
        <div class="row-name">${flagEmoji(nat)} ${escapeHtml(nat)}</div>
      </span>
      <span class="row-stat">${count}<small>명</small></span>
    </button>`).join("");

  $view.innerHTML = `<div class="list">${rowsHtml}</div>`;
}

function renderNationDetail(nat) {
  setTitle(nat);
  const players = ROWS.filter((r) => r.nationality === nat)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const byLeague = {};
  players.forEach((p) => { byLeague[p.leagueDisplayName] = (byLeague[p.leagueDisplayName] || 0) + 1; });
  const breakdown = Object.entries(byLeague).sort((a, b) => b[1] - a[1])
    .map(([lg, c]) => `<span class="badge muted">${lg} ${c}</span>`).join(" ");

  const rowsHtml = players.map((p) => `
    <button class="row-card" onclick="location.hash='#/player/${playerKey(p)}'">
      <span class="pos-pill pos-${p.position}">${p.position || "?"}</span>
      <span class="row-main">
        <div class="row-name">${escapeHtml(p.name)}</div>
        <div class="row-sub">${escapeHtml(p.team)} · ${p.leagueDisplayName} · ${fmt(p.age, "세")}</div>
      </span>
    </button>`).join("");

  $view.innerHTML = `
    <div style="margin-bottom:12px; display:flex; flex-wrap:wrap; gap:6px;">${breakdown}</div>
    <div class="list">${rowsHtml}</div>`;
}

// ---------- 포지션별 보기 ----------

const POSITIONS = [
  { code: "F", label: "공격수" },
  { code: "M", label: "미드필더" },
  { code: "D", label: "수비수" },
  { code: "G", label: "골키퍼" },
];

let positionState = { leagueId: "", sortBy: "goals" };

function renderPositions(pos) {
  setTitle("포지션별 랭킹");
  const tabs = POSITIONS.map((p) => `
    <button class="tab ${p.code === pos ? "active" : ""}" onclick="location.hash='#/positions/${p.code}'">${p.label}</button>
  `).join("");

  const leagueOptions = `<option value="">전체 리그</option>` +
    LEAGUES.map((l) => `<option value="${l.id}" ${positionState.leagueId === l.id ? "selected" : ""}>${l.displayName}</option>`).join("");

  const isGK = pos === "G";
  const sortOptions = isGK
    ? [["saves", "세이브"], ["apps", "출장"], ["goalsConceded", "실점 적은 순"]]
    : [["goals", "득점"], ["assists", "도움"], ["apps", "출장"], ["yellowCards", "옐로카드"]];

  const sortTabs = sortOptions.map(([key, label]) => `
    <button class="tab ${positionState.sortBy === key ? "active" : ""}" data-sort="${key}">${label}</button>
  `).join("");

  let players = ROWS.filter((r) => r.position === pos && r.hasStats);
  if (positionState.leagueId) players = players.filter((r) => r.leagueId === positionState.leagueId);

  const sortKey = sortOptions.some(([k]) => k === positionState.sortBy) ? positionState.sortBy : sortOptions[0][0];
  players = players.slice().sort((a, b) => {
    const av = a[sortKey] ?? -1, bv = b[sortKey] ?? -1;
    if (sortKey === "goalsConceded") return (a[sortKey] ?? 9999) - (b[sortKey] ?? 9999);
    return bv - av;
  }).slice(0, 100);

  const excludedNote = LEAGUES.some((l) => l.noStats)
    ? `<div class="banner"><b>ℹ</b> 시즌 기록이 없는 리그(${LEAGUES.filter((l) => l.noStats).map((l) => l.displayName).join(", ")})는 이 랭킹에서 제외됩니다.</div>`
    : "";

  const rowsHtml = players.length ? players.map((p, i) => `
    <button class="row-card" onclick="location.hash='#/player/${playerKey(p)}'">
      <span class="row-rank">${i + 1}</span>
      <span class="row-main">
        <div class="row-name">${escapeHtml(p.name)}</div>
        <div class="row-sub">${escapeHtml(p.team)} · ${p.leagueDisplayName}</div>
      </span>
      <span class="row-stat">${fmt(p[sortKey])}<small>${sortOptions.find(([k]) => k === sortKey)[1]}</small></span>
    </button>`).join("") : `<div class="empty-state">해당 조건의 기록이 없습니다.</div>`;

  $view.innerHTML = `
    <div class="tabs">${tabs}</div>
    ${excludedNote}
    <div class="filter-row">
      <select id="posLeagueFilter">${leagueOptions}</select>
    </div>
    <div class="sort-toggle">${sortTabs}</div>
    <div class="list">${rowsHtml}</div>
  `;

  document.getElementById("posLeagueFilter").addEventListener("change", (e) => {
    positionState.leagueId = e.target.value;
    renderPositions(pos);
  });
  document.querySelectorAll("[data-sort]").forEach((btn) => {
    btn.addEventListener("click", () => {
      positionState.sortBy = btn.dataset.sort;
      renderPositions(pos);
    });
  });
}

// ---------- 나이별 보기 ----------

let ageState = { leagueId: "" };

function renderAges() {
  setTitle("나이별 보기");
  const leagueOptions = `<option value="">전체 리그</option>` +
    LEAGUES.map((l) => `<option value="${l.id}" ${ageState.leagueId === l.id ? "selected" : ""}>${l.displayName}</option>`).join("");

  let players = ROWS.filter((r) => r.age !== null);
  if (ageState.leagueId) players = players.filter((r) => r.leagueId === ageState.leagueId);

  const bins = [
    [0, 20], [20, 23], [23, 26], [26, 29], [29, 32], [32, 99],
  ];
  const binLabels = ["~19", "20-22", "23-25", "26-28", "29-31", "32+"];
  const binCounts = bins.map(([lo, hi]) => players.filter((p) => p.age >= lo && p.age < hi).length);
  const maxBin = Math.max(...binCounts, 1);

  const histHtml = bins.map(([lo, hi], i) => `
    <div class="hist-bar-row">
      <span class="hist-label">${binLabels[i]}세</span>
      <span class="hist-track"><span class="hist-fill" style="width:${(binCounts[i] / maxBin * 100).toFixed(0)}%"></span></span>
      <span class="hist-count">${binCounts[i]}</span>
    </div>`).join("");

  // 리그별 평균 나이 랭킹
  const leagueAvg = LEAGUES.map((lg) => {
    const ages = ROWS.filter((r) => r.leagueId === lg.id && r.age !== null).map((r) => r.age);
    const avg = ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : null;
    return { lg, avg };
  }).filter((x) => x.avg !== null).sort((a, b) => a.avg - b.avg);

  const avgRowsHtml = leagueAvg.map((x, i) => `
    <button class="row-card" onclick="location.hash='#/teams/${x.lg.id}'">
      <span class="row-rank">${i + 1}</span>
      <span class="row-main"><div class="row-name">${x.lg.displayName}</div></span>
      <span class="row-stat">${x.avg.toFixed(1)}<small>평균세</small></span>
    </button>`).join("");

  const sortedByAge = players.slice().sort((a, b) => a.age - b.age);
  const youngest = sortedByAge.slice(0, 10);
  const oldest = sortedByAge.slice(-10).reverse();

  const listPlayer = (p) => `
    <button class="row-card" onclick="location.hash='#/player/${playerKey(p)}'">
      <span class="pos-pill pos-${p.position}">${p.position || "?"}</span>
      <span class="row-main">
        <div class="row-name">${escapeHtml(p.name)}</div>
        <div class="row-sub">${escapeHtml(p.team)} · ${p.leagueDisplayName}</div>
      </span>
      <span class="row-stat">${p.age}<small>세</small></span>
    </button>`;

  $view.innerHTML = `
    <div class="filter-row"><select id="ageLeagueFilter">${leagueOptions}</select></div>
    <div class="section-title">연령 분포 (${players.length}명)</div>
    <div>${histHtml}</div>
    <div class="section-title">리그별 평균 나이</div>
    <div class="list">${avgRowsHtml}</div>
    <div class="section-title">최연소 TOP 10</div>
    <div class="list">${youngest.map(listPlayer).join("")}</div>
    <div class="section-title">최고령 TOP 10</div>
    <div class="list">${oldest.map(listPlayer).join("")}</div>
  `;

  document.getElementById("ageLeagueFilter").addEventListener("change", (e) => {
    ageState.leagueId = e.target.value;
    renderAges();
  });
}

// ---------- 몸값 보기 ----------
// 시장 가치는 공개 데이터셋(dcaribou/transfermarkt-datasets, CC0)을 선수명/팀명으로 매칭한 값입니다.
// 챔피언십·세군다 디비시온·2.분데스리가는 해당 데이터셋이 2부 리그를 다루지 않아 값이 없습니다.
// 이름 매칭이 안 된 선수도 값이 비어 있을 수 있습니다 (전체 약 56% 매칭).

const NO_MV_LEAGUES = LEAGUES.filter((l) => l.noMarketValue);
let valuesState = { leagueId: "" };

function renderValues(tab) {
  setTitle("몸값 보기");
  const tabs = [
    ["players", "선수 랭킹"],
    ["teams", "팀별 총액"],
    ["nations", "국가별 총액"],
  ].map(([key, label]) => `
    <button class="tab ${key === tab ? "active" : ""}" onclick="location.hash='#/values/${key}'">${label}</button>
  `).join("");

  const banner = `<div class="banner"><b>ℹ</b> 시장 가치는 공개 데이터셋을 선수명/팀명으로 자동 매칭한 값입니다 (전체 약 56% 매칭). ${NO_MV_LEAGUES.map((l) => l.displayName).join(", ")}는 이 데이터셋이 2부 리그를 다루지 않아 몸값 정보가 없습니다.</div>`;

  let bodyHtml = "";
  if (tab === "teams") bodyHtml = renderValuesTeams();
  else if (tab === "nations") bodyHtml = renderValuesNations();
  else bodyHtml = renderValuesPlayers();

  $view.innerHTML = `<div class="tabs">${tabs}</div>${banner}${bodyHtml}`;

  const filterEl = document.getElementById("valuesLeagueFilter");
  if (filterEl) {
    filterEl.addEventListener("change", (e) => {
      valuesState.leagueId = e.target.value;
      renderValues(tab);
    });
  }
}

function valuesLeagueFilterHtml() {
  const options = `<option value="">전체 리그</option>` +
    LEAGUES.filter((l) => !l.noMarketValue).map((l) =>
      `<option value="${l.id}" ${valuesState.leagueId === l.id ? "selected" : ""}>${l.displayName}</option>`
    ).join("");
  return `<div class="filter-row"><select id="valuesLeagueFilter">${options}</select></div>`;
}

function renderValuesPlayers() {
  let players = ROWS.filter((r) => r.marketValue !== null);
  if (valuesState.leagueId) players = players.filter((r) => r.leagueId === valuesState.leagueId);
  players = players.slice().sort((a, b) => b.marketValue - a.marketValue).slice(0, 100);

  const rowsHtml = players.length ? players.map((p, i) => `
    <button class="row-card" onclick="location.hash='#/player/${playerKey(p)}'">
      <span class="row-rank">${i + 1}</span>
      <span class="pos-pill pos-${p.position}">${p.position || "?"}</span>
      <span class="row-main">
        <div class="row-name">${escapeHtml(p.name)}</div>
        <div class="row-sub">${escapeHtml(p.team)} · ${p.leagueDisplayName}</div>
      </span>
      <span class="row-stat">${formatEUR(p.marketValue)}</span>
    </button>`).join("") : `<div class="empty-state">해당 조건의 몸값 정보가 없습니다.</div>`;

  return `${valuesLeagueFilterHtml()}<div class="list">${rowsHtml}</div>`;
}

function renderValuesTeams() {
  let players = ROWS.slice();
  if (valuesState.leagueId) players = players.filter((r) => r.leagueId === valuesState.leagueId);

  const byTeam = {};
  players.forEach((p) => {
    const key = `${p.leagueId}::${p.team}`;
    byTeam[key] = byTeam[key] || { leagueId: p.leagueId, leagueDisplayName: p.leagueDisplayName, team: p.team, total: 0, matched: 0, count: 0 };
    byTeam[key].count += 1;
    if (p.marketValue !== null) {
      byTeam[key].total += p.marketValue;
      byTeam[key].matched += 1;
    }
  });

  const teams = Object.values(byTeam).filter((t) => t.matched > 0).sort((a, b) => b.total - a.total);

  const rowsHtml = teams.length ? teams.map((t, i) => `
    <button class="row-card" onclick="location.hash='#/teams/${t.leagueId}/${encodeURIComponent(t.team)}'">
      <span class="row-rank">${i + 1}</span>
      <span class="row-main">
        <div class="row-name">${escapeHtml(t.team)}</div>
        <div class="row-sub">${t.leagueDisplayName} · ${t.matched}/${t.count}명 매칭</div>
      </span>
      <span class="row-stat">${formatEUR(t.total)}</span>
    </button>`).join("") : `<div class="empty-state">해당 조건의 몸값 정보가 없습니다.</div>`;

  return `${valuesLeagueFilterHtml()}<div class="list">${rowsHtml}</div>`;
}

function renderValuesNations() {
  const byNation = {};
  ROWS.forEach((p) => {
    if (!p.nationality) return;
    byNation[p.nationality] = byNation[p.nationality] || { nation: p.nationality, total: 0, matched: 0, count: 0 };
    byNation[p.nationality].count += 1;
    if (p.marketValue !== null) {
      byNation[p.nationality].total += p.marketValue;
      byNation[p.nationality].matched += 1;
    }
  });

  const nations = Object.values(byNation).filter((n) => n.matched > 0).sort((a, b) => b.total - a.total).slice(0, 100);

  const rowsHtml = nations.map((n, i) => `
    <button class="row-card" onclick="location.hash='#/nations/${encodeURIComponent(n.nation)}'">
      <span class="row-rank">${i + 1}</span>
      <span class="row-main">
        <div class="row-name">${flagEmoji(n.nation)} ${escapeHtml(n.nation)}</div>
        <div class="row-sub">${n.matched}/${n.count}명 매칭</div>
      </span>
      <span class="row-stat">${formatEUR(n.total)}</span>
    </button>`).join("");

  return `<div class="list">${rowsHtml}</div>`;
}

// ---------- 검색 ----------

function renderSearch() {
  setTitle("선수 검색");
  $view.innerHTML = `
    <div class="search-wrap">
      <input type="search" id="searchInput" placeholder="선수 이름 검색 (예: Messi)" autofocus />
    </div>
    <div id="searchResults" class="list"></div>
  `;
  const input = document.getElementById("searchInput");
  const results = document.getElementById("searchResults");

  function doSearch(q) {
    const query = q.trim().toLowerCase();
    if (!query) { results.innerHTML = `<div class="empty-state">이름을 입력해 검색하세요.</div>`; return; }
    const matches = ROWS.filter((r) => r.name.toLowerCase().includes(query)).slice(0, 50);
    if (!matches.length) { results.innerHTML = `<div class="empty-state">검색 결과가 없습니다.</div>`; return; }
    results.innerHTML = matches.map((p) => `
      <button class="row-card" onclick="location.hash='#/player/${playerKey(p)}'">
        <span class="pos-pill pos-${p.position}">${p.position || "?"}</span>
        <span class="row-main">
          <div class="row-name">${escapeHtml(p.name)}</div>
          <div class="row-sub">${escapeHtml(p.team)} · ${p.leagueDisplayName}</div>
        </span>
        <span class="row-stat">${fmt(p.age, "세")}</span>
      </button>`).join("");
  }

  input.addEventListener("input", () => doSearch(input.value));
  doSearch("");
}

// ---------- 선수 상세 ----------

function renderPlayerDetail(key) {
  const { leagueId, team, number, name } = parsePlayerKey(key);
  const p = ROWS.find((r) => r.leagueId === leagueId && r.team === team && r.number === number && r.name === name);
  if (!p) { $view.innerHTML = `<div class="empty-state">선수 정보를 찾을 수 없습니다.</div>`; return; }
  setTitle(p.name);

  const lg = leagueById(p.leagueId);
  const isGK = p.position === "G";

  let statsHtml = "";
  if (lg.noStats) {
    statsHtml = `<div class="banner"><b>ℹ</b> ${lg.displayName}는 시즌 기록이 제공되지 않습니다.</div>`;
  } else if (!p.hasStats) {
    statsHtml = `<div class="banner"><b>ℹ</b> "${p.seasonLabel || "알 수 없는 시즌"}" 라벨의 기록 없음 행입니다. (다음 시즌 편성 등으로 인해 기록이 아직 없을 수 있습니다)</div>`;
  } else {
    const stats = isGK
      ? [["출장", p.apps], ["세이브", p.saves], ["실점", p.goalsConceded], ["옐로카드", p.yellowCards], ["레드카드", p.redCards]]
      : [["출장", p.apps], ["득점", p.goals], ["도움", p.assists], ["옐로카드", p.yellowCards], ["레드카드", p.redCards]];
    statsHtml = `
      <div class="section-title">${p.seasonLabel} 시즌 기록</div>
      <div class="kv-grid">
        ${stats.map(([k, v]) => `<div class="kv"><div class="k">${k}</div><div class="val">${fmt(v)}</div></div>`).join("")}
      </div>`;
  }

  $view.innerHTML = `
    <div class="player-detail-head">
      <div class="player-avatar">${initials(p.name)}</div>
      <div>
        <h2>${escapeHtml(p.name)}</h2>
        <div class="sub">${flagEmoji(p.nationality)} ${escapeHtml(p.nationality || "국적 미상")} · ${POSITION_LABELS[p.position] || p.position} · ${fmt(p.age, "세")}</div>
      </div>
    </div>
    <div class="kv-grid">
      <div class="kv"><div class="k">팀</div><div class="val">${escapeHtml(p.team)}</div></div>
      <div class="kv"><div class="k">리그</div><div class="val">${p.leagueDisplayName}</div></div>
      <div class="kv"><div class="k">등번호</div><div class="val">${p.number || "-"}</div></div>
      <div class="kv"><div class="k">포지션</div><div class="val">${POSITION_LABELS[p.position] || p.position}</div></div>
      <div class="kv"><div class="k">시장 가치</div><div class="val">${formatEUR(p.marketValue)}</div></div>
    </div>
    ${statsHtml}
    <button class="tab" onclick="location.hash='#/teams/${p.leagueId}/${encodeURIComponent(p.team)}'">${escapeHtml(p.team)} 스쿼드 전체 보기</button>
  `;
}

// ---------- 정보 페이지 ----------

async function renderAbout() {
  setTitle("데이터 안내");
  let lastUpdated = "-";
  try {
    const res = await fetch("data/meta.json", { cache: "no-cache" });
    const meta = await res.json();
    lastUpdated = meta.lastUpdated;
  } catch (e) { /* ignore */ }

  const gapList = LEAGUES.filter((l) => l.note).map((l) => `<li><b>${l.displayName}</b>: ${l.note}</li>`).join("");

  $view.innerHTML = `
    <div class="about-block">
      <h3>마지막 데이터 업데이트</h3>
      ${lastUpdated}
    </div>
    <div class="about-block">
      <h3>알려진 데이터 공백</h3>
      <ul>${gapList}</ul>
    </div>
    <div class="about-block">
      <h3>Season_Label 안내</h3>
      리그마다 시즌 표기가 다릅니다 (예: 2025-26, 2025, 2026 등). 각 리그에서 가장 많이 등장하는 라벨을 "정규 시즌"으로 자동 인식하며, 그 외 라벨(다음 시즌 편성 등으로 기록이 없는 행)은 목록에는 표시되지만 랭킹 통계에서는 제외됩니다.
    </div>
  `;
}

// ---------- 초기화 ----------

async function init() {
  renderLoading();
  const { rows, primarySeasonLabels } = await loadAllData();
  ROWS = rows;
  PRIMARY_LABELS = primarySeasonLabels;
  LOADED = true;
  router();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch((e) => console.error("SW 등록 실패", e));
  }
}

init();
