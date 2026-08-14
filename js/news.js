// ---------- 뉴스 (텍스트/음성/저장됨) ----------
// data/news.json은 .github/workflows/fetch-news.yml이 매일 자동 갱신합니다.
// 저장 기능은 Firebase Auth(Google 로그인) + Firestore로 기기 간 동기화됩니다. (js/firebase-config.js)

let NEWS_ARTICLES = null;
let newsState = { country: "" };
let savedIds = new Set();
let savedArticlesCache = null;
let currentPlayingId = null;

const VOICE_RATES = [0.8, 1.0, 1.2];
let voiceRate = parseFloat(localStorage.getItem("newsVoiceRate")) || 1.0;
if (!VOICE_RATES.includes(voiceRate)) voiceRate = 1.0;

const NEWS_COUNTRIES = [
  ["", "전체"],
  ["England", "잉글랜드"],
  ["USA", "미국"],
  ["Spain", "스페인"],
  ["Germany", "독일"],
];

async function loadNews() {
  if (NEWS_ARTICLES) return NEWS_ARTICLES;
  try {
    const res = await fetch("data/news.json", { cache: "no-cache" });
    const data = await res.json();
    NEWS_ARTICLES = data.articles || [];
  } catch (e) {
    NEWS_ARTICLES = [];
  }
  return NEWS_ARTICLES;
}

function newsTimeAgo(pubDate) {
  if (!pubDate) return "";
  const d = new Date(pubDate);
  if (isNaN(d.getTime())) return "";
  const diffH = Math.floor((Date.now() - d.getTime()) / 3600000);
  if (diffH < 1) return "방금 전";
  if (diffH < 24) return `${diffH}시간 전`;
  return `${Math.floor(diffH / 24)}일 전`;
}

async function refreshSavedIds() {
  if (!window.SoccerAuth || !window.SoccerAuth.currentUser) {
    savedIds = new Set();
    savedArticlesCache = null;
    return;
  }
  const saved = await window.SoccerNews.getSavedArticles();
  savedArticlesCache = saved;
  savedIds = new Set(saved.map((a) => a.id));
}

async function renderNews(tab) {
  setTitle("뉴스");
  tab = ["text", "voice", "saved"].includes(tab) ? tab : "text";

  const tabsHtml = [
    ["text", "📄 텍스트"],
    ["voice", "🔊 음성"],
    ["saved", "🔖 저장됨"],
  ].map(([key, label]) => `
    <button class="tab ${key === tab ? "active" : ""}" onclick="location.hash='#/news/${key}'">${label}</button>
  `).join("");

  $view.innerHTML = `<div class="tabs">${tabsHtml}</div><div id="newsBody"><div class="loading"><div class="spinner"></div></div></div>`;

  if (tab === "saved") {
    await renderNewsSaved();
  } else {
    await loadNews();
    renderNewsList(tab);
  }
}

function newsFilterHtml() {
  const options = NEWS_COUNTRIES.map(([val, label]) =>
    `<option value="${val}" ${newsState.country === val ? "selected" : ""}>${label}</option>`
  ).join("");
  return `<div class="filter-row"><select id="newsCountryFilter">${options}</select></div>`;
}

function voiceRateHtml() {
  const buttons = VOICE_RATES.map((r) => `
    <button class="tab ${r === voiceRate ? "active" : ""}" data-rate="${r}">${r.toFixed(1)}배속</button>
  `).join("");
  return `<div class="sort-toggle">${buttons}</div>`;
}

function renderNewsList(tab) {
  let articles = NEWS_ARTICLES || [];
  if (newsState.country) articles = articles.filter((a) => a.country === newsState.country);

  const body = document.getElementById("newsBody");
  if (!body) return;

  const rateHtml = tab === "voice" ? voiceRateHtml() : "";

  if (!articles.length) {
    body.innerHTML = `${newsFilterHtml()}${rateHtml}<div class="empty-state">불러올 뉴스가 없습니다.</div>`;
  } else {
    body.innerHTML = `${newsFilterHtml()}${rateHtml}<div class="list">${articles.map((a) => newsCardHtml(a, tab)).join("")}</div>`;
  }

  document.getElementById("newsCountryFilter").addEventListener("change", (e) => {
    newsState.country = e.target.value;
    renderNewsList(tab);
  });

  if (tab === "voice") {
    document.querySelectorAll("[data-rate]").forEach((btn) => {
      btn.addEventListener("click", () => {
        voiceRate = parseFloat(btn.dataset.rate);
        localStorage.setItem("newsVoiceRate", voiceRate);
        if (currentPlayingId) {
          window.speechSynthesis.cancel();
          currentPlayingId = null;
        }
        renderNewsList(tab);
      });
    });
  }

  wireNewsCardButtons(tab, () => renderNewsList(tab));
}

function newsCardHtml(a, tab) {
  const saved = savedIds.has(a.id);
  const bookmarkBtn = `<button class="news-save-btn ${saved ? "on" : ""}" data-save-id="${a.id}" aria-label="저장">${saved ? "🔖 저장됨" : "🏷️ 저장"}</button>`;
  const actionHtml = tab === "voice"
    ? `<button class="news-play-btn ${currentPlayingId === a.id ? "playing" : ""}" data-play-id="${a.id}">${currentPlayingId === a.id ? "⏸ 정지" : "▶ 듣기"}</button>`
    : `<a class="news-link-btn" href="${a.link}" target="_blank" rel="noopener">원문 보기 →</a>`;

  return `
    <div class="news-card" data-article-id="${a.id}">
      <div class="news-meta">
        <span class="badge muted">${escapeHtml(a.countryLabel || "")}</span>
        <span class="news-source">${escapeHtml(a.source || "")}</span>
        <span class="news-time">${newsTimeAgo(a.pubDate)}</span>
      </div>
      <div class="news-title">${escapeHtml(a.title)}</div>
      <div class="news-summary">${escapeHtml(a.summary || "")}</div>
      <div class="news-actions">${actionHtml}${bookmarkBtn}</div>
    </div>`;
}

function wireNewsCardButtons(tab, rerender) {
  document.querySelectorAll("[data-save-id]").forEach((btn) => {
    btn.addEventListener("click", () => toggleSaveArticle(btn.dataset.saveId, tab, rerender));
  });
  document.querySelectorAll("[data-play-id]").forEach((btn) => {
    btn.addEventListener("click", () => togglePlayArticle(btn.dataset.playId, rerender));
  });
}

function findArticleById(id) {
  const pools = [NEWS_ARTICLES || [], savedArticlesCache || []];
  for (const pool of pools) {
    const found = pool.find((a) => a.id === id);
    if (found) return found;
  }
  return null;
}

async function toggleSaveArticle(id, tab, rerender) {
  if (!window.SoccerAuth || !window.SoccerAuth.currentUser) {
    showToast("저장하려면 먼저 로그인해주세요");
    if (window.SoccerAuth) window.SoccerAuth.signIn();
    return;
  }
  const article = findArticleById(id);
  if (!article) return;
  try {
    if (savedIds.has(id)) {
      await window.SoccerNews.unsaveArticle(id);
      savedIds.delete(id);
      showToast("저장 해제됨");
    } else {
      await window.SoccerNews.saveArticle(article);
      savedIds.add(id);
      showToast("저장됨");
    }
  } catch (e) {
    showToast("저장 중 오류가 발생했습니다");
    console.error(e);
    return;
  }
  if (tab === "saved") { await refreshSavedIds(); renderNewsSaved(); }
  else rerender();
}

function togglePlayArticle(id, rerender) {
  const article = findArticleById(id);
  if (!article) return;
  if (currentPlayingId === id) {
    window.speechSynthesis.cancel();
    currentPlayingId = null;
    rerender();
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(`${article.title}. ${article.summary}`);
  utter.lang = "en-US";
  utter.rate = voiceRate;
  utter.onend = () => { currentPlayingId = null; rerender(); };
  utter.onerror = () => { currentPlayingId = null; };
  currentPlayingId = id;
  window.speechSynthesis.speak(utter);
  rerender();
}

async function renderNewsSaved() {
  const body = document.getElementById("newsBody");
  if (!body) return;

  if (!window.SoccerAuth || !window.SoccerAuth.currentUser) {
    body.innerHTML = `
      <div class="empty-state">
        저장한 뉴스를 보려면 로그인해주세요.<br><br>
        <button class="tab active" id="newsLoginBtn">Google로 로그인</button>
      </div>`;
    document.getElementById("newsLoginBtn").addEventListener("click", () => window.SoccerAuth.signIn());
    return;
  }

  body.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
  await refreshSavedIds();
  const articles = savedArticlesCache || [];
  if (!articles.length) {
    body.innerHTML = `<div class="empty-state">아직 저장한 뉴스가 없습니다.<br>텍스트/음성 탭에서 🏷️ 저장 버튼을 눌러보세요.</div>`;
    return;
  }
  body.innerHTML = `<div class="list">${articles.map((a) => newsCardHtml(a, "saved")).join("")}</div>`;
  wireNewsCardButtons("saved", () => renderNewsSaved());
}

// ---------- 계정(Google 로그인) 버튼 ----------

function wireAccountButton() {
  const btn = document.getElementById("accountBtn");
  if (!btn || !window.SoccerAuth) return;

  window.SoccerAuth.onChange((user) => {
    if (user) {
      btn.textContent = "👤";
      btn.title = `${user.displayName || user.email || "로그인됨"} · 눌러서 로그아웃`;
      btn.classList.add("logged-in");
    } else {
      btn.textContent = "👤";
      btn.title = "Google로 로그인";
      btn.classList.remove("logged-in");
    }
    const { name, params } = currentRoute();
    if (name === "news" && (params[0] || "text") === "saved") renderNewsSaved();
  });

  btn.addEventListener("click", () => {
    if (window.SoccerAuth.currentUser) {
      if (confirm("로그아웃 하시겠어요?")) window.SoccerAuth.signOut();
    } else {
      window.SoccerAuth.signIn();
    }
  });
}

// firebase-config.js는 type="module"이라 실행이 살짝 늦을 수 있어 짧게 폴링한다.
(function waitForAuth(tries) {
  if (window.SoccerAuth) { wireAccountButton(); return; }
  if (tries > 100) return; // 5초 넘게 없으면 포기
  setTimeout(() => waitForAuth(tries + 1), 50);
})(0);
