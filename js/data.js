// CSV 로딩 + 파싱 + 정규화
// 데이터 파일에는 따옴표로 감싼 필드가 없으므로 단순 split(',')으로 충분합니다.
// (선수 이름 등에 콤마가 들어가는 경우가 생기면 이 파서를 quote-aware 버전으로 교체해야 합니다.)

const COLUMNS = [
  "League", "Team", "Number", "Player", "Position", "Age", "Nationality",
  "Season_Apps", "Season_Goals", "Season_Assists", "Season_YellowCards",
  "Season_RedCards", "Season_Saves", "Season_GoalsConceded", "Season_Label",
];

function parseCsvText(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const rows = [];
  // 첫 줄은 헤더로 간주하고 건너뜀 (컬럼 순서는 COLUMNS 상수 기준 고정)
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    const row = {};
    COLUMNS.forEach((col, idx) => {
      row[col] = (cells[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}

function toNum(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function normalizeRow(raw, leagueConfig) {
  return {
    league: raw.League,
    leagueId: leagueConfig.id,
    leagueDisplayName: leagueConfig.displayName,
    team: raw.Team,
    number: raw.Number || "",
    name: raw.Player,
    position: raw.Position,
    age: toNum(raw.Age),
    nationality: raw.Nationality || "",
    apps: toNum(raw.Season_Apps),
    goals: toNum(raw.Season_Goals),
    assists: toNum(raw.Season_Assists),
    yellowCards: toNum(raw.Season_YellowCards),
    redCards: toNum(raw.Season_RedCards),
    saves: toNum(raw.Season_Saves),
    goalsConceded: toNum(raw.Season_GoalsConceded),
    seasonLabel: raw.Season_Label || "",
  };
}

// 리그별로 가장 흔한 Season_Label을 "정규 시즌"으로 판단
function detectPrimarySeasonLabels(rows) {
  const byLeague = {};
  rows.forEach((r) => {
    if (!r.seasonLabel) return;
    byLeague[r.leagueId] = byLeague[r.leagueId] || {};
    byLeague[r.leagueId][r.seasonLabel] = (byLeague[r.leagueId][r.seasonLabel] || 0) + 1;
  });
  const primary = {};
  Object.entries(byLeague).forEach(([leagueId, counts]) => {
    let best = null;
    let bestCount = -1;
    Object.entries(counts).forEach(([label, count]) => {
      if (count > bestCount) {
        best = label;
        bestCount = count;
      }
    });
    primary[leagueId] = best;
  });
  return primary;
}

// data/market_values.csv: League,Team,Player,MarketValueEUR (공개 데이터셋과 이름/팀 매칭 결과)
async function loadMarketValues() {
  try {
    const res = await fetch("data/market_values.csv", { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const map = new Map();
    for (let i = 1; i < lines.length; i++) {
      const [league, team, player, mv] = lines[i].split(",");
      map.set(`${league}::${team}::${player}`, Number(mv));
    }
    return map;
  } catch (err) {
    console.error("몸값 데이터 로드 실패", err);
    return new Map();
  }
}

async function loadAllData() {
  const results = await Promise.all(
    LEAGUES.map(async (lg) => {
      try {
        const res = await fetch(lg.file, { cache: "no-cache" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const rawRows = parseCsvText(text);
        return rawRows.map((r) => normalizeRow(r, lg));
      } catch (err) {
        console.error(`데이터 로드 실패: ${lg.file}`, err);
        return [];
      }
    })
  );

  const allRows = results.flat();
  const primarySeasonLabels = detectPrimarySeasonLabels(allRows);
  const marketValues = await loadMarketValues();

  allRows.forEach((r) => {
    r.isPrimarySeason = r.seasonLabel === primarySeasonLabels[r.leagueId];
    r.hasStats = r.isPrimarySeason && r.apps !== null;
    const mv = marketValues.get(`${r.league}::${r.team}::${r.name}`);
    r.marketValue = mv !== undefined && !Number.isNaN(mv) ? mv : null;
  });

  return { rows: allRows, primarySeasonLabels };
}

function formatEUR(v) {
  if (v === null || v === undefined) return "-";
  if (v >= 1000000) return `€${(v / 1000000).toFixed(v >= 10000000 ? 0 : 1)}M`;
  if (v >= 1000) return `€${(v / 1000).toFixed(0)}K`;
  return `€${v}`;
}

function flagEmoji(nationality) {
  const iso = NATIONALITY_TO_ISO[nationality];
  if (!iso) return "🏳️";
  if (iso.startsWith("GB-")) {
    // 잉글랜드/스코틀랜드/웨일스/북아일랜드는 유니코드 태그 시퀀스 사용
    const tags = {
      "GB-ENG": "gbeng",
      "GB-SCT": "gbsct",
      "GB-WLS": "gbwls",
      "GB-NIR": "gbnir",
    };
    const code = tags[iso];
    if (!code) return "🏳️";
    const base = 0xe0000;
    let flag = "🏴";
    for (const ch of code) {
      flag += String.fromCodePoint(base + ch.charCodeAt(0));
    }
    flag += String.fromCodePoint(base + 0x7f);
    return flag;
  }
  const codePoints = [...iso.toUpperCase()].map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
