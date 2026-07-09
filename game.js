// game.js — Angler's Secret v0.7.1 fixed
// 핵심 수정:
// - 튜토리얼 3회 성공 후 정상 종료
// - 정식 RUN 시작 화면 꼬임 제거
// - 미끼 이중 차감 제거
// - totalScore 중복 누적 제거
// - REEL 물고기 tier 난이도 정상 적용
// - REEL dt 기반 물리 계산
// - 퍼펙트 판정: 초록존 이탈 없음
// - 보스 small_only / scoreMult 정상화
// - 카드 수치 일부 정합성 수정
// - 보상/슬롯 초과 흐름 안정화

'use strict';

// ============================================================
// 0. 유틸
// ============================================================
const qs  = (sel) => document.querySelector(sel);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));
const rand = (a, b) => Math.random() * (b - a) + a;
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const weighted = (entries) => {
  const sum = entries.reduce((s, [, w]) => s + Math.max(0, w), 0);
  if (sum <= 0) return entries[entries.length - 1][0];

  let r = Math.random() * sum;
  for (const [k, w] of entries) {
    r -= Math.max(0, w);
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
};

function safeText(sel, text) {
  const el = qs(sel);
  if (el) el.textContent = text;
}

function safeHTML(sel, html) {
  const el = qs(sel);
  if (el) el.innerHTML = html;
}

// ============================================================
// 1. 화면 전환
// ============================================================
const SCREENS = [
  'title', 'meta', 'run-map', 'fishing', 'reward',
  'shop', 'meta-shop', 'codex', 'stage-result', 'run-result',
];

function showScreen(name) {
  for (const s of SCREENS) {
    const el = document.getElementById('screen-' + s);
    if (el) el.classList.toggle('hidden', s !== name);
  }
  window.__lastScreen = window.__currentScreen || name;
  window.__currentScreen = name;
}

function toast(msg, kind = '') {
  const t = qs('#toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast ' + (kind ? 'is-' + kind : '');
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 1400);
}

// ============================================================
// 2. 비주얼 헬퍼
// ============================================================
function spawnScorePopup(text, kind = 'mult', big = false) {
  let wrap = document.querySelector('.score-popups');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'score-popups';
    document.body.appendChild(wrap);
  }

  const el = document.createElement('div');
  el.className = 'score-popup is-' + kind + (big ? ' is-big' : '');
  el.textContent = text;
  el.style.left = (40 + Math.random() * 20) + '%';
  el.style.top  = (30 + Math.random() * 20) + '%';
  wrap.appendChild(el);

  setTimeout(() => el.remove(), 1500);
}

function fishImageHTML(fishId, extraClass) {
  return `<img src="images/fish-${fishId}.png" alt="${fishId}" data-fish-id="${fishId}" class="fish-photo${extraClass ? ' ' + extraClass : ''}" loading="lazy" onerror="handleFishImgError(this)">`;
}

function handleFishImgError(imgEl) {
  const fid = imgEl.dataset.fishId;
  const span = document.createElement('span');
  span.className = 'fish-emoji';
  span.innerHTML = (window.FISH_SVG && window.FISH_SVG[fid]) || String.fromCodePoint(0x1F41F);
  imgEl.replaceWith(span);
}

const FISH_EMOJI = {
  gobies: '🐟', rockfish: '🐠', mullet: '🐟', flatfish1: '🐟',
  seabass: '🐠', blackbeam: '🐟', greenling: '🐠', conger: '🐍',
  tuna: '🐟', amberjack: '🐠', snapper: '🐠', cutlass: '🐟', golden: '✨',
};

function spawnNewSpeciesBanner(fishName) {
  const el = document.createElement('div');
  el.className = 'new-species-banner';
  el.textContent = `🐟 신규 어종! ${fishName} (+20)`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1900);
}

function spawnLegendFlash(fishName) {
  const flash = document.createElement('div');
  flash.className = 'legend-flash';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 1150);

  const banner = document.createElement('div');
  banner.className = 'legend-banner';
  banner.innerHTML = `<img src="images/fish-golden-hero.png" class="legend-banner-art" alt="전설" onerror="this.remove()"><span>🌟 전설의 손맛! ${fishName} 🌟</span>`;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 2250);

  const screen = qs('#screen-fishing');
  if (screen) {
    screen.classList.add('is-shaking');
    setTimeout(() => screen.classList.remove('is-shaking'), 600);
  }
}

function spawnComboIndicator(combo) {
  const old = document.querySelector('.combo-indicator');
  if (old) old.remove();

  const el = document.createElement('div');
  el.className = 'combo-indicator';
  el.textContent = `🔥 콤보 ×${combo}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

function renderSignatureBanner() {
  const existing = qs('#signature-banner');
  if (existing) existing.remove();
  if (!run?.signatureBonus) return;

  const header = qs('#run-map .run-header') || qs('#screen-run-map .run-header');
  if (!header) return;

  const div = document.createElement('div');
  div.id = 'signature-banner';
  div.className = 'signature-banner';
  div.innerHTML = '🏆 빌드 시그니처 완성 — 모든 점수 ×1.15';
  header.parentElement.insertBefore(div, header.nextSibling);
}

function showOnePointTip(text) {
  const old = document.querySelector('.onepoint-tip');
  if (old) old.remove();

  const el = document.createElement('div');
  el.className = 'onepoint-tip';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

// ============================================================
// 3. 저장
// ============================================================
const SAVE_KEY = 'angler_save_v1';

function defaultSave() {
  return {
    version: 1,
    renown: 0,
    unlocks: [],
    encyclopedia: {},
    stats: { bestRunScore: 0, totalRuns: 0, clears: 0 },
    tutorialDone: false,
    tooltipsShown: { reward: false, hotspot: false, shop: false },
  };
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();

    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return defaultSave();

    const base = defaultSave();
    return {
      ...base,
      ...data,
      stats: { ...base.stats, ...(data.stats || {}) },
      tooltipsShown: { ...base.tooltipsShown, ...(data.tooltipsShown || {}) },
      encyclopedia: data.encyclopedia || {},
      unlocks: Array.isArray(data.unlocks) ? data.unlocks : [],
    };
  } catch {
    return defaultSave();
  }
}

function save() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(meta));
}

let meta = loadSave();

function metaHas(perkId) {
  return meta.unlocks.includes(perkId);
}

function tutorialTier() {
  if (!meta.tutorialDone) return 0;
  if (meta.stats.totalRuns === 0) return 1;
  return 2;
}

function updateTitleForOnboarding() {
  const btn = qs('#title-start-btn');
  const skipBtn = qs('#skip-tutorial-btn');
  if (!btn) return;

  if (!meta.tutorialDone) {
    btn.textContent = '낚시 배우기';
    btn.dataset.action = 'start-tutorial';
    if (skipBtn) skipBtn.classList.remove('hidden');
  } else {
    btn.textContent = '출조하기';
    btn.dataset.action = 'goto-meta';
    if (skipBtn) skipBtn.classList.add('hidden');
  }
}

// ============================================================
// 4. 메타 상점
// ============================================================
function metaShopState(item) {
  return { owned: meta.unlocks.includes(item.id) };
}

function buyMetaShop(item) {
  if (meta.renown < item.cost) {
    toast('명성 부족', 'bad');
    return;
  }
  if (meta.unlocks.includes(item.id)) {
    toast('이미 보유', 'bad');
    return;
  }

  meta.renown -= item.cost;
  meta.unlocks.push(item.id);
  save();

  renderMetaShop();
  toast(`${item.name} 해금!`, 'good');
}

// ============================================================
// 5. RUN 상태
// ============================================================
let run = null;

function emptyStageStats() {
  return {
    score: 0,
    perfect: 0,
    newFish: new Set(),
    bossBig: false,
    catches: 0,
    tokensGained: 0,
  };
}

function startRun(isTutorial) {
  const startBait = isTutorial
    ? 999
    : CONFIG.RUN.startBait + (metaHas('perk_start_bait') ? 3 : 0);

  const rerollTokens = isTutorial
    ? 0
    : CONFIG.REROLL.startTokens + (metaHas('perk_start_reroll') ? 1 : 0);

  run = {
    stage: 1,
    stageScore: 0,
    totalScore: 0,
    bait: startBait,

    joker: [],
    jokerCapacity: CONFIG.RUN.jokerSlots,

    path: null,
    nodeCursor: { col: 0, idx: 0 },
    currentNode: null,
    currentCastIdx: 0,
    castsTotal: 0,

    stageStats: emptyStageStats(),
    runStats: {
      caughtFish: [],
      perfectReel: 0,
      totalCasts: 0,
      successfulCasts: 0,
      comboReel: 0,
      maxComboReel: 0,
      largeCatch: 0,
    },

    rerollTokens,
    rerollInScreen: 0,

    safetyNetUsed: false,
    beginnerSafetyNet: !isTutorial && meta.stats.totalRuns < CONFIG.BEGINNER_RUNS_THRESHOLD,
    beginnerSafetyNetUsed: false,

    pendingRevive: false,
    signatureBonus: false,
    evolvedState: { abyssLordStacks: 0 },

    isTutorial: !!isTutorial,
    tutorialCatches: 0,

    stageStartTotalScore: 0,
    ended: false,
    settlement: null,
  };

  if (!isTutorial && metaHas('perk_start_card')) {
    const c = pickByRarity('common');
    if (c) addCardToJoker(c.id, true);
  }

  if (isTutorial) {
    enterTutorialCasting();
  } else {
    enterStage(1);
  }
}

function enterTutorialCasting() {
  if (!run) return;

  run.currentNode = { type: 'fishing', label: '튜토리얼' };
  run.currentCastIdx = run.tutorialCatches;
  run.castsTotal = 3;

  enterCasting();
}

function finishTutorial() {
  meta.tutorialDone = true;
  save();

  run = null;
  cast = null;
  applyTimeOfDay();
  renderMeta();
  updateTitleForOnboarding();
  showScreen('title');

  setTimeout(() => {
    toast('손맛을 익혔습니다! 이제 진짜 바다로 나가볼까요?', 'good');
  }, 300);
}

function enterStage(stage) {
  if (!run || run.ended) return;

  run.stage = stage;
  run.stageScore = 0;
  run.stageStats = emptyStageStats();
  run.stageStartTotalScore = run.totalScore;

  run.path = generatePath();
  run.nodeCursor = { col: 0, idx: 0 };

  // 시작 노드는 자동 낚시 진입
  enterNode(run.path[0][0]);
}

function generatePath() {
  const cols = [];

  cols.push([{ type: 'fishing', label: '출발' }]);

  const nodeWeight =
    run.stage === 1 && CONFIG.NODE_WEIGHT_STAGE1
      ? CONFIG.NODE_WEIGHT_STAGE1
      : CONFIG.NODE_WEIGHT;

  for (let c = 1; c <= 3; c++) {
    const arr = [];
    for (let i = 0; i < CONFIG.PATH.nodesPerColumn; i++) {
      const type = weighted(Object.entries(nodeWeight).map(([k, w]) => [k, w]));
      arr.push({ type, label: labelOfType(type) });
    }
    cols.push(arr);
  }

  cols.push([{ type: 'boss', label: '보스', bossMod: pick(BOSS_MODIFIERS) }]);
  return cols;
}

function labelOfType(t) {
  return {
    fishing: '낚시',
    hotspot: '명당',
    shop: '어구점',
    rest: '휴식',
    boss: '보스',
  }[t] || t;
}

// ============================================================
// 6. 노드 진입 / 완료
// ============================================================
function enterNode(node) {
  if (!run || run.ended) return;

  run.currentNode = node;

  if (node.type === 'fishing' || node.type === 'hotspot') {
    if (!run.isTutorial && run.bait <= 0) {
      finishRun(false);
      return;
    }

    run.currentCastIdx = 0;
    run.castsTotal = CONFIG.PATH.castsPerNode[0]; // MVP: 2손 고정
    enterCasting();
    return;
  }

  if (node.type === 'boss') {
    if (!run.isTutorial && run.bait <= 0) {
      finishRun(false);
      return;
    }

    run.currentCastIdx = 0;
    run.castsTotal = Math.max(
      1,
      CONFIG.PATH.castsPerNode[0] + (node.bossMod?.effect?.castsDelta || 0)
    );
    enterCasting();
    return;
  }

  if (node.type === 'shop') {
    enterShopNode();
    return;
  }

  if (node.type === 'rest') {
    const recover = CONFIG.REST_BAIT_RECOVER || 4;
    run.bait = Math.min(99, run.bait + recover);
    toast(`미끼 +${recover} 회복`, 'good');
    advanceAfterNode();
    return;
  }
}

function completeFishingNode() {
  if (!run || run.ended) return;

  const node = run.currentNode;

  if (node?.type === 'fishing' || node?.type === 'hotspot') {
    enterReward();
    return;
  }

  advanceAfterNode();
}

function advanceAfterNode() {
  if (!run || run.ended) return;

  if (run.nodeCursor.col >= run.path.length - 1) {
    finishStage();
  } else {
    showRunMap();
  }
}

// ============================================================
// 7. CAST / BITE / REEL
// ============================================================
let cast = null;
let castSeq = 0;

function applyTimeOfDay() {
  const body = document.body;
  body.classList.remove('time-day', 'time-dusk', 'time-night');

  if (!run) return;

  if (run.stage === 1) body.classList.add('time-day');
  else if (run.stage === 2) body.classList.add('time-dusk');
  else if (run.stage === 3) body.classList.add('time-night');
}

function enterCasting() {
  if (!run || run.ended) return;

  if (!run.isTutorial && run.bait <= 0) {
    finishRun(false);
    return;
  }

  applyTimeOfDay();

  const stage = run.stage;
  const node = run.currentNode;
  const id = ++castSeq;

  cast = {
    id,
    phase: 'CAST',

    gaugePos: 0,
    gaugeDir: 1,
    gaugeSpeed: CONFIG.CAST_GAUGE_SPEED * (node.bossMod?.effect?.castGaugeSpeed || 1),
    accuracy: 0,

    bitDelayMs: 0,
    bitWindow: CONFIG.BITE_WINDOW_MS,
    biteState: null,
    biteWaitStartMs: 0,
    biteStartMs: 0,
    biteCountdownTimer: null,
    biteMissTimer: null,

    tension: 50,
    progress: 0,
    reelTimeMs: CONFIG.REEL.timeLimitMs,
    fishState: 'relax',
    nextSwitchMs: 0,
    reeling: false,
    leftSafeZone: false,
    slackLocked: false,

    fish: null,
    sizeRoll: 0,
    perfect: false,
    castNode: node,

    lastT: 0,
    lastProg: 0,
    phaseT: 0,
  };

  showScreen('fishing');

  const castZone = qs('#cast-zone');
  if (castZone) {
    // 실제 정확도 중심이 50이므로 UI 초록존도 중앙으로 맞춤
    castZone.style.left = '40%';
    castZone.style.width = '20%';
  }

  if (run.isTutorial) {
    safeText('#fishing-stage-title', '낚시 배우기');
    qsa('#screen-fishing .run-stats > span').forEach(el => el.classList.add('hidden'));
  } else {
    qsa('#screen-fishing .run-stats > span').forEach(el => el.classList.remove('hidden'));

    const bossText = node.type === 'boss' && node.bossMod
      ? ` · ${node.bossMod.name}`
      : '';

    safeText(
      '#fishing-stage-title',
      `스테이지 ${stage} · ${STAGE_INFO[stage].name} · ${labelOfType(node.type)}${bossText}`
    );
  }

  safeText('#fishing-cast-info', `${run.currentCastIdx + 1} / ${run.castsTotal} 손`);

  setFishingHUD();
  setFishingPhase('CAST');

  if (tutorialTier() === 1 && node.type === 'hotspot' && !meta.tooltipsShown.hotspot) {
    meta.tooltipsShown.hotspot = true;
    save();
    showOnePointTip('명당 포인트! 희귀 어종이 2배 더 잘 나오고, 좋은 카드가 확정 등장해요.');
  }

  requestAnimationFrame((t) => fishingTick(t, id));
}

function clearCastTimers(c) {
  if (!c) return;
  if (c.biteCountdownTimer) clearTimeout(c.biteCountdownTimer);
  if (c.biteMissTimer) clearTimeout(c.biteMissTimer);
  c.biteCountdownTimer = null;
  c.biteMissTimer = null;
}

function setFishingPhase(p) {
  for (const k of ['cast', 'bite', 'reel', 'result']) {
    const el = qs('#phase-' + k);
    if (el) el.classList.toggle('hidden', k !== p.toLowerCase());
  }

  const biteEl = qs('#phase-bite');
  if (biteEl) {
    biteEl.classList.toggle('is-bite-wait', p.toLowerCase() === 'bite' && cast?.biteState === 'wait');
    biteEl.classList.toggle('is-bite-hit',  p.toLowerCase() === 'bite' && cast?.biteState === 'hit');
  }

  updateTutorialHint(p);
}

function updateTutorialHint(phase) {
  const hintEl = qs('#tutorial-hint');
  if (!hintEl) return;

  if (!run || !run.isTutorial || !cast) {
    hintEl.classList.add('hidden');
    return;
  }

  const p = (phase || cast.phase || '').toUpperCase();
  const texts = {
    CAST: '게이지가 초록 칸에 있을 때 탭/클릭(스페이스바)하세요!<span class="hint-step">STEP 1 · CAST</span>',
    BITE: cast.biteState === 'hit'
      ? '입질이 왔어요! 지금 바로 탭하세요!<span class="hint-step">STEP 2 · BITE</span>'
      : '조금만 기다리세요… 곧 입질이 옵니다.<span class="hint-step">STEP 2 · BITE</span>',
    REEL: '누르고 있으면 릴을 감아요. 빨강(저항)일 땐 살짝, 파랑(이완)일 땐 힘껏!<span class="hint-step">STEP 3 · REEL</span>',
  };

  if (texts[p]) {
    hintEl.innerHTML = texts[p];
    hintEl.classList.remove('hidden');
  } else {
    hintEl.classList.add('hidden');
  }
}

function setFishingHUD() {
  if (!run) return;
  safeText('#fishing-target', STAGE_INFO[run.stage].target);
  safeText('#fishing-score', run.stageScore);
  safeText('#fishing-bait', run.bait);
}

function getSafeZoneForCurrentReel() {
  let [zoneLow, zoneHigh] = CONFIG.REEL.safeZoneByStage[Math.min(run.stage, 4)];

  if (jokerHas('invincible_line')) {
    return [0, 100];
  }

  const wideZoneLv = jokerLevel('wide_zone');
  if (wideZoneLv > 0) {
    const expand = 8 + 4 * (wideZoneLv - 1);
    zoneLow = Math.max(0, zoneLow - expand);
    zoneHigh = Math.min(100, zoneHigh + expand);
  }

  return [zoneLow, zoneHigh];
}

function rollFishPhaseDuration(phase) {
  const resistRange =
    run.stage === 1 && CONFIG.REEL.resistPhaseMsStage1
      ? CONFIG.REEL.resistPhaseMsStage1
      : [700, 1500];

  let range = phase === 'resist' ? resistRange : [500, 1200];
  let dur = randInt(range[0], range[1]);

  if (phase === 'resist') {
    const calmLv = jokerLevel('calm_fish');
    if (calmLv > 0) {
      const mult = Math.max(0.35, 0.7 - 0.1 * (calmLv - 1));
      dur *= mult;
    }
  }

  return dur;
}

function fishingTick(now, id) {
  if (!cast || cast.id !== id || !run || run.ended) return;

  if (!cast.lastT) cast.lastT = now;
  const dtRaw = (now - cast.lastT) / 1000;
  const dt = clamp(dtRaw, 0, 0.05);
  cast.lastT = now;

  if (cast.phase === 'CAST') {
    cast.gaugePos += cast.gaugeDir * cast.gaugeSpeed * 100 * dt;

    if (cast.gaugePos >= 100) {
      cast.gaugePos = 100;
      cast.gaugeDir = -1;
    }
    if (cast.gaugePos <= 0) {
      cast.gaugePos = 0;
      cast.gaugeDir = 1;
    }

    const marker = qs('#cast-marker');
    if (marker) marker.style.left = cast.gaugePos + '%';
  }

  else if (cast.phase === 'BITE') {
    const ring = qs('#bite-ring-progress');
    if (ring) {
      const CIRC = 276.5;

      if (cast.biteState === 'wait') {
        const elapsed = now - (cast.biteWaitStartMs || now);
        const t = clamp(elapsed / Math.max(1, cast.bitDelayMs), 0, 1);
        ring.style.strokeDashoffset = (CIRC * (1 - t)).toFixed(1);
      } else if (cast.biteState === 'hit') {
        const elapsed = now - (cast.biteStartMs || now);
        const t = clamp(elapsed / Math.max(1, cast.bitWindow), 0, 1);
        ring.style.strokeDashoffset = (CIRC * t).toFixed(1);
      }
    }
  }

  else if (cast.phase === 'REEL') {
    cast.reelTimeMs -= dt * 1000;
    if (cast.reelTimeMs <= 0) {
      finalizeCast(false, false);
      requestAnimationFrame((t) => fishingTick(t, id));
      return;
    }

    cast.nextSwitchMs -= dt * 1000;
    if (cast.nextSwitchMs <= 0) {
      cast.fishState = cast.fishState === 'resist' ? 'relax' : 'resist';
      cast.nextSwitchMs = rollFishPhaseDuration(cast.fishState);
    }

    const [zoneLow, zoneHigh] = getSafeZoneForCurrentReel();
    const zone = qs('#tension-zone');
    if (zone) {
      zone.style.bottom = zoneLow + '%';
      zone.style.height = (zoneHigh - zoneLow) + '%';
    }

    const isResist = cast.fishState === 'resist';
    const tier = cast.fish?.tier || 1;
    const tierMult = CONFIG.REEL.tierTensionMult[tier] || 1;

    const slowLv = jokerLevel('slow_tension');
    const autoLv = jokerLevel('auto_reel');
    const fastLv = jokerLevel('fast_progress');

    const slowMult = slowLv > 0
      ? Math.max(0.35, 0.8 - 0.1 * (slowLv - 1))
      : 1;

    const autoMult = autoLv > 0
      ? 1.4 + 0.2 * (autoLv - 1)
      : 1;

    const fastMult = fastLv > 0
      ? 1.3 + 0.2 * (fastLv - 1)
      : 1;

    const tensVar = run.currentNode?.bossMod?.effect?.reelTensionVar || 1;
    const resistTensionMult =
      run.stage === 1 && CONFIG.REEL.resistTensionMultStage1
        ? CONFIG.REEL.resistTensionMultStage1
        : CONFIG.REEL.resistTensionMult;

    if (cast.reeling) {
      const tensionRate =
        CONFIG.REEL.reelUpRate *
        (isResist ? resistTensionMult : 1) *
        tierMult *
        tensVar *
        slowMult;

      cast.tension += tensionRate * dt;

      const progressRate =
        CONFIG.REEL.progressRate *
        0.5 *
        fastMult *
        (isResist ? 1 : CONFIG.REEL.relaxProgressMult);

      cast.progress += progressRate * dt;
    } else {
      const downRate = CONFIG.REEL.reelDownRate * 0.5 * autoMult;
      cast.tension -= downRate * dt;
    }

    if (cast.tension <= 0) {
      cast.tension = 0;

      if (!cast.slackLocked) {
        cast.progress = Math.max(0, cast.progress - CONFIG.REEL.slackPenalty);
        cast.slackLocked = true;
      }
    } else if (cast.tension > 2) {
      cast.slackLocked = false;
    }

    cast.progress = clamp(cast.progress, 0, 100);

    if (cast.tension < zoneLow || cast.tension > zoneHigh) {
      cast.leftSafeZone = true;
    }

    const tFill = qs('#tension-fill');
    const tTick = qs('#tension-tick');
    const pFill = qs('#progress-fill');

    if (tFill) tFill.style.height = clamp(cast.tension, 0, 100) + '%';
    if (tTick) tTick.style.bottom = clamp(cast.tension, 0, 100) + '%';
    if (pFill) pFill.style.width = cast.progress + '%';

    const prevProg = cast.lastProg || 0;
    if (prevProg < 25 && cast.progress >= 25) spawnScorePopup('25%', 'add', false);
    if (prevProg < 50 && cast.progress >= 50) spawnScorePopup('50%', 'add', false);
    if (prevProg < 75 && cast.progress >= 75) spawnScorePopup('75%', 'add', false);
    cast.lastProg = cast.progress;

    const rs = qs('#reel-state');
    if (rs) {
      rs.textContent = isResist ? '저항 중' : '이완 중';
      rs.className = 'reel-state ' + (isResist ? 'is-resist' : 'is-relax');
    }

    safeText('#reel-time', (cast.reelTimeMs / 1000).toFixed(1) + 's');

    if (cast.tension >= 100) {
      if (jokerHas('invincible_line')) {
        cast.tension = 99;
      } else if (jokerHas('safety_net') && !run.safetyNetUsed) {
        run.safetyNetUsed = true;
        toast('안전 그물 발동! 포획 성공 처리', 'good');
        try { window.playSound('saved'); } catch {}
        finalizeCast(true, false);
        requestAnimationFrame((t) => fishingTick(t, id));
        return;
      } else if (
        run.beginnerSafetyNet &&
        run.stage === 1 &&
        !run.beginnerSafetyNetUsed
      ) {
        run.beginnerSafetyNetUsed = true;
        toast('초보 배려! 라인 파손 무효', 'good');
        try { window.playSound('saved'); } catch {}
        finalizeCast(true, false);
        requestAnimationFrame((t) => fishingTick(t, id));
        return;
      } else {
        finalizeCast(false, false);
        requestAnimationFrame((t) => fishingTick(t, id));
        return;
      }
    }

    if (cast.progress >= 100) {
      const perfect = !cast.leftSafeZone;
      finalizeCast(true, perfect);
      requestAnimationFrame((t) => fishingTick(t, id));
      return;
    }
  }

  else if (cast.phase === 'CATCH' || cast.phase === 'MISS') {
    cast.phaseT -= dt;

    if (cast.phaseT <= 0) {
      const oldPhase = cast.phase;

      if (run.isTutorial) {
        if (oldPhase === 'MISS') {
          enterTutorialCasting();
          return;
        }

        if (run.tutorialCatches >= 3) {
          finishTutorial();
        } else {
          enterTutorialCasting();
        }
        return;
      }

      run.currentCastIdx += 1;

      if (run.currentCastIdx >= run.castsTotal) {
        cast = null;
        completeFishingNode();
        return;
      }

      if (run.bait <= 0) {
        finishRun(false);
        return;
      }

      enterCasting();
      return;
    }
  }

  if (run && cast && cast.id === id && !run.ended) {
    requestAnimationFrame((t) => fishingTick(t, id));
  }
}

function finalizeCast(success, perfect) {
  if (!cast || !run || run.ended) return;

  clearCastTimers(cast);

  if (!success) {
    run.runStats.totalCasts += 1;
    run.runStats.comboReel = 0;

    setFishingHUD();
    setFishingPhase('RESULT');

    safeHTML(
      '#fish-line',
      run.isTutorial
        ? `<div style="font-size:48px;">💨</div><div style="font-size:18px;margin-top:8px;">아쉽지만 괜찮아요! 다시 도전해봐요</div>`
        : `<div style="font-size:48px;">💨</div><div style="font-size:18px;margin-top:8px;">놓침! 점수 0</div>`
    );

    const scoreEl = qs('#fish-score');
    if (scoreEl) {
      scoreEl.textContent = '+0';
      scoreEl.classList.remove('count-up');
      void scoreEl.offsetWidth;
      scoreEl.classList.add('count-up');
    }

    try { window.playSound('miss'); } catch {}

    cast.phase = 'MISS';
    cast.phaseT = run.isTutorial ? 0.9 : 0.8;
    return;
  }

  if (!cast.fish) {
    cast.fish = pickFish();
    cast.sizeRoll = randInt(cast.fish.size_min, cast.fish.size_max);
  }

  const fish = cast.fish;
  const sizeRoll = cast.sizeRoll || randInt(fish.size_min, fish.size_max);

  run.runStats.totalCasts += 1;
  run.runStats.successfulCasts += 1;

  if (perfect) {
    run.runStats.perfectReel += 1;
    run.stageStats.perfect += 1;
  }

  run.runStats.comboReel += 1;
  run.runStats.maxComboReel = Math.max(run.runStats.maxComboReel, run.runStats.comboReel);

  if (run.isTutorial) {
    setFishingHUD();
    setFishingPhase('RESULT');

    safeHTML('#fish-line', `
      <div class="catch-fish-svg">${fishImageHTML(fish.id)}</div>
      <div style="font-size:18px;margin-top:8px;">
        <strong>${fish.name}</strong>
        <span class="stat-value">(${sizeRoll}cm)</span>
        ${perfect ? '⭐ 완벽한 릴링!' : '잘하셨어요!'}
      </div>
    `);

    const scoreEl = qs('#fish-score');
    if (scoreEl) {
      scoreEl.textContent = perfect ? '⭐ PERFECT' : '✅ 성공';
      scoreEl.classList.remove('count-up');
      void scoreEl.offsetWidth;
      scoreEl.classList.add('count-up');
    }

    try { window.playSound(perfect ? 'perfect' : 'catch'); } catch {}

    run.tutorialCatches += 1;
    cast.phase = 'CATCH';
    cast.phaseT = 1.2;
    return;
  }

  const wasNewSpecies = !meta.encyclopedia[fish.id];

  const score = calcScore({
    fish,
    sizeRoll,
    perfect,
    castAccuracy: cast.accuracy || 0.7,
    stage: run.stage,
    castIndex: run.currentCastIdx + 1,
  });

  registerEncyclopedia(fish.id, sizeRoll);

  let gained = score;
  if (wasNewSpecies) {
    gained += 20;
    run.stageStats.newFish.add(fish.id);
  }

  run.stageScore += gained;
  run.totalScore += gained;
  run.stageStats.score += gained;
  run.stageStats.catches += 1;

  run.runStats.caughtFish.push({
    id: fish.id,
    name: fish.name,
    size: sizeRoll,
    score: gained,
  });

  if (sizeRoll >= 60) {
    run.runStats.largeCatch += 1;
    if (jokerHas('abyss_lord')) {
      run.evolvedState.abyssLordStacks += 1;
    }
  }

  if (run.currentNode?.type === 'boss' && fish.tier >= 3) {
    run.stageStats.bossBig = true;
  }

  const isLegendary = fish.tier >= 4;

  setFishingHUD();
  setFishingPhase('RESULT');

  safeHTML('#fish-line', `
    <div class="catch-fish-svg${isLegendary ? ' is-legendary' : ''}">${fishImageHTML(fish.id)}</div>
    <div style="font-size:18px;margin-top:8px;">
      <strong>${fish.name}</strong>
      <span class="stat-value">(${sizeRoll}cm)</span>
      ${perfect ? '⭐ 퍼펙트' : ''}
    </div>
  `);

  const scoreEl = qs('#fish-score');
  if (scoreEl) {
    scoreEl.textContent = `+${gained}`;
    scoreEl.classList.remove('count-up');
    void scoreEl.offsetWidth;
    scoreEl.classList.add('count-up');
  }

  try { window.playSound(perfect ? 'perfect' : 'catch'); } catch {}

  spawnScorePopup(`+${gained}`, 'add', gained >= 100);

  if (isLegendary) {
    spawnLegendFlash(fish.name);
    try { window.playSound('evolve'); } catch {}
  } else if (gained >= 500) {
    spawnScorePopup('🔥🔥 신기록!', 'mult', true);
    const screen = qs('#screen-fishing');
    if (screen) {
      screen.classList.add('is-shaking');
      setTimeout(() => screen.classList.remove('is-shaking'), 500);
    }
  } else if (gained >= 200) {
    spawnScorePopup('🔥 대박!', 'mult', true);
  } else if (gained >= 100) {
    spawnScorePopup('✨ 좋은 어종', 'mult', false);
  }

  if (perfect) spawnScorePopup('⭐ 퍼펙트 ×1.3', 'mult', false);

  if (run.runStats.comboReel >= 2) {
    spawnComboIndicator(run.runStats.comboReel);
  }

  if (wasNewSpecies) {
    toast('신규 어종! +20', 'good');
    spawnNewSpeciesBanner(fish.name);
    try { window.playSound('clear'); } catch {}
  }

  cast.phase = 'CATCH';
  cast.phaseT = isLegendary ? 1.8 : 1.2;
}

// ============================================================
// 8. 어종 결정 / 점수 계산
// ============================================================
function pickFish() {
  const stage = run.stage;
  const node = run.currentNode;

  let pool = FISH.filter(f => f.stage === stage);

  if (node.type === 'hotspot') {
    pool = FISH.filter(f => f.stage === 0 || f.stage === stage)
      .map(f => f.tier === 4 ? { ...f, weight: f.weight * 2 } : f);
  }

  if (node.type === 'boss') {
    if (node.bossMod?.effect?.fishFilter === 'small') {
      let smallPool = FISH.filter(f => f.stage === stage && (f.tier <= 2 || f.size_max < 40));
      if (smallPool.length === 0) {
        const stagePool = FISH.filter(f => f.stage === stage);
        const minTier = Math.min(...stagePool.map(f => f.tier));
        smallPool = stagePool.filter(f => f.tier === minTier);
      }
      pool = smallPool;
    } else {
      pool = pool.filter(f => f.tier >= 3);
    }
  }

  if (pool.length === 0) pool = FISH.filter(f => f.stage === stage);
  return weighted(pool.map(f => [f, f.weight]));
}

function getCardById(id) {
  const normal = ALL_CARDS.find(c => c.id === id);
  if (normal) return normal;

  const evo = EVOLUTIONS.find(e => e.evolveId === id);
  if (evo) {
    const scoreIds = ['abyss_lord', 'flawless_hand', 'abyss_moon'];
    return {
      id: evo.evolveId,
      name: evo.evolveName,
      rarity: 'legendary',
      type: scoreIds.includes(evo.evolveId) ? 'score' : 'util',
      desc: evo.desc,
      num: evo.num || {},
      isEvolved: true,
    };
  }

  return null;
}

function cardMultValue(card, lv) {
  if (!card?.num?.mult) return 1;
  return card.num.mult.base + card.num.mult.perLvl * (lv - 1);
}

function cardAddValue(card, lv) {
  if (!card?.num?.add) return 0;
  return card.num.add.base + card.num.add.perLvl * (lv - 1);
}

function calcScore(ctx) {
  const { fish, sizeRoll, perfect, castAccuracy, stage, castIndex } = ctx;

  const base = fish.base;
  const sizeMult = 1.0 + (sizeRoll - fish.size_min) / Math.max(1, fish.size_max - fish.size_min);
  const castMult = 0.8 + castAccuracy * 0.4;
  const reelMult = perfect ? 1.3 : 1.0;

  let total = base * sizeMult * castMult * reelMult;
  let add = 0;
  const mults = [];

  const isNight = stage === 3 || run.currentNode?.bossMod?.id === 'night';
  const isFirstOfSpecies = !run.runStats.caughtFish.some(c => c.id === fish.id);
  const encyclopediaCount = Object.keys(meta.encyclopedia).length;
  const combo = run.runStats.comboReel;

  for (const j of run.joker) {
    const card = getCardById(j.id);
    if (!card) continue;

    const lv = j.level || 1;

    switch (j.id) {
      case 'chum':
        if (castAccuracy >= 0.9) add += cardAddValue(card, lv);
        break;

      case 'combo_reel':
        if (combo >= 2) add += cardAddValue(card, lv) * (combo - 1);
        break;

      case 'collector': {
        const baseAdd = cardAddValue(card, lv);
        const scale = lv + 1;
        let value = encyclopediaCount * baseAdd * scale;
        if (metaHas('unlock_encyclopedia_bonus')) value *= 1.5;
        add += value;
        break;
      }

      case 'heavy_tackle':
        if (sizeRoll >= 60) mults.push(cardMultValue(card, lv));
        break;

      case 'night_owl':
        if (isNight) mults.push(cardMultValue(card, lv));
        break;

      case 'species_hunter':
        if (isFirstOfSpecies) mults.push(cardMultValue(card, lv));
        break;

      case 'deep_sea':
        if (stage === 3) mults.push(cardMultValue(card, lv));
        break;

      case 'perfect_hook':
        if (perfect) mults.push(cardMultValue(card, lv));
        break;

      case 'golden_hour':
        if (castIndex === 3) mults.push(cardMultValue(card, lv));
        break;

      case 'small_master':
        if (sizeRoll < 30) mults.push(cardMultValue(card, lv));
        break;

      case 'lucky_lure':
        if (Math.random() < 0.2) {
          mults.push(cardMultValue(card, lv));
          run.runStats.comboReel += 1;
          spawnScorePopup('🍀 행운!', 'mult', false);
        }
        break;

      case 'master_angler': {
        let m = cardMultValue(card, lv);
        if (card.num?.extra?.kind === 'jokerCount') {
          m *= 1 + run.joker.length * card.num.extra.v;
        }
        mults.push(m);
        break;
      }

      case 'abyss_lord':
        if (sizeRoll >= 60) {
          mults.push(3.0 + (run.evolvedState?.abyssLordStacks || 0) * 0.05);
        }
        break;

      case 'flawless_hand':
        if (combo >= 2) {
          mults.push(1 + 0.08 * (combo - 1));
        }
        break;

      case 'abyss_moon':
        if (isNight || stage === 3) {
          mults.push(4.0);
        }
        break;
    }
  }

  total += add;

  if (run.signatureBonus) mults.push(1.15);

  for (const m of mults) {
    total *= m;
  }

  if (run.currentNode?.bossMod?.effect?.scoreMult) {
    total *= run.currentNode.bossMod.effect.scoreMult;
  }

  return Math.round(total);
}

// ============================================================
// 9. 카드 시스템
// ============================================================
function jokerHas(id) {
  return !!run?.joker?.some(j => j.id === id);
}

function jokerLevel(id) {
  const j = run?.joker?.find(j => j.id === id);
  return j ? j.level : 0;
}

function canEvolve(evo) {
  if (!run) return false;

  if (run.joker.some(j => j.id === evo.evolveId)) return false;

  if (evo.condition.kind === 'largeCatchCount') {
    return run.runStats.largeCatch >= evo.condition.v;
  }

  if (evo.condition.kind === 'comboCount') {
    return run.runStats.maxComboReel >= evo.condition.v;
  }

  if (evo.condition.kind === 'perfectReelCount') {
    return run.runStats.perfectReel >= evo.condition.v;
  }

  if (evo.condition.kind === 'twoCards') {
    return evo.condition.ids.every(id =>
      run.joker.some(j => j.id === id && j.level >= 3)
    );
  }

  return false;
}

function availableEvolutions() {
  if (!run) return [];

  return EVOLUTIONS.filter(evo => {
    if (!canEvolve(evo)) return false;

    if (evo.condition.kind === 'twoCards') return true;

    const base = run.joker.find(j => j.id === evo.base);
    return base && base.level >= 3;
  });
}

function applyEvolutionCard(evolveId) {
  const evo = EVOLUTIONS.find(e => e.evolveId === evolveId);
  if (!evo || !run) return false;

  if (evo.condition.kind === 'twoCards') {
    run.joker = run.joker.filter(j => !evo.condition.ids.includes(j.id));
  } else {
    run.joker = run.joker.filter(j => j.id !== evo.base);
  }

  run.joker.push({ id: evo.evolveId, level: 1, isEvolved: true });

  toast(`진화! ${evo.evolveName}`, 'good');
  try { window.playSound('evolve'); } catch {}

  return true;
}

function checkSignatureBonus() {
  if (!run) return;

  if (run.joker.length === run.jokerCapacity && !run.signatureBonus) {
    run.signatureBonus = true;
    toast('🏆 빌드 시그니처 완성! 모든 점수 ×1.15', 'good');

    const tEl = document.createElement('div');
    tEl.className = 'trophy-banner';
    tEl.textContent = '🏆';
    document.body.appendChild(tEl);
    setTimeout(() => tEl.remove(), 2100);

    try { window.playSound('evolve'); } catch {}
  }
}

function addCardToJoker(cardId, silent = false, onSlotResolved = null) {
  if (!run) return false;

  const card = getCardById(cardId);
  if (!card) return false;

  const existing = run.joker.find(j => j.id === cardId);

  if (existing) {
    if (existing.level < 3) {
      existing.level += 1;
      if (!silent) toast(`${card.name} 레벨업! Lv.${existing.level}`, 'good');
      return true;
    }

    if (!silent) toast('이미 최대 레벨', 'bad');
    return true;
  }

  if (run.joker.length >= run.jokerCapacity) {
    if (!silent) {
      showSlotDiscardChoice(cardId, (accepted) => {
        if (onSlotResolved) onSlotResolved(accepted);
      });
      return false;
    }

    run.joker.shift();
  }

  run.joker.push({ id: cardId, level: 1, isEvolved: card.isEvolved || false });

  if (!silent) {
    toast(`비법 획득: ${card.name}`, 'good');
    try { window.playSound('reroll'); } catch {}
  }

  checkSignatureBonus();
  return true;
}

function showSlotDiscardChoice(newCardId, onDone) {
  const newCard = getCardById(newCardId);
  if (!newCard || !run) return;

  const modal = document.createElement('div');
  modal.className = 'modal-slot-discard';
  modal.innerHTML = `
    <div class="modal-slot-card">
      <h3>${newCard.isEvolved ? '🌟 진화 카드 등장!' : '슬롯 가득! 1개 폐기 필요'}</h3>
      <p>새 카드: <strong style="color:${RARITY_COLOR[newCard.rarity] || '#f59e0b'}">${newCard.name}</strong> (${newCard.rarity})</p>
      <p class="modal-sub">아래 기존 카드 중 1개를 폐기하거나, 새 카드를 받지 않을 수 있어요.</p>
      <div class="discard-options">
        <button class="btn btn-ghost" data-discard="cancel">← 새 카드 받지 않기</button>
        ${run.joker.map((j, i) => {
          const c = getCardById(j.id);
          return `<button class="card rarity-${c?.rarity || 'common'} discard-card" data-discard-idx="${i}">
            <div class="card-rarity">${c?.rarity || 'common'} · Lv.${j.level}</div>
            <div class="card-name">${c?.name || j.id}</div>
            <div class="card-desc">${c?.desc || ''}</div>
          </button>`;
        }).join('')}
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener('click', (e) => {
    const t = e.target.closest('[data-discard], [data-discard-idx]');
    if (!t) return;

    if (t.dataset.discard === 'cancel') {
      modal.remove();
      toast('새 카드 받지 않음', 'good');
      if (onDone) onDone(false);
      return;
    }

    const idx = parseInt(t.dataset.discardIdx, 10);
    if (!Number.isNaN(idx) && idx >= 0 && idx < run.joker.length) {
      const removed = run.joker[idx];
      const removedCard = getCardById(removed.id);

      run.joker.splice(idx, 1);
      run.joker.push({ id: newCardId, level: 1, isEvolved: newCard.isEvolved || false });

      modal.remove();
      toast(`${removedCard?.name || removed.id} 폐기 → ${newCard.name} 획득`, 'good');
      try { window.playSound('reroll'); } catch {}

      checkSignatureBonus();

      if (onDone) onDone(true);
    }
  });
}

function pickByRarity(rarity = null) {
  let pool = ALL_CARDS;

  if (rarity) pool = pool.filter(c => c.rarity === rarity);

  if (!metaHas('unlock_card_legendary')) {
    pool = pool.filter(c => c.rarity !== 'legendary');
  }

  if (pool.length === 0) {
    pool = ALL_CARDS.filter(c => c.rarity !== 'legendary');
  }

  return pool[randInt(0, pool.length - 1)];
}

function drawRewardCards(count = 3, isHotspot = false) {
  const cards = [];
  const used = new Set();

  const pushUnique = (card) => {
    if (!card || used.has(card.id)) return false;
    used.add(card.id);
    cards.push(card);
    return true;
  };

  const evos = availableEvolutions();
  if (evos.length > 0) {
    const evo = pick(evos);
    pushUnique({
      id: evo.evolveId,
      name: evo.evolveName,
      rarity: 'legendary',
      type: getCardById(evo.evolveId)?.type || 'score',
      desc: evo.desc,
      num: evo.num || {},
      isEvolved: true,
    });
  }

  if (isHotspot && cards.length < count) {
    const roll = Math.random();
    let r = 'uncommon';
    if (roll > 0.85) r = 'legendary';
    else if (roll > 0.5) r = 'rare';

    if (r === 'legendary' && !metaHas('unlock_card_legendary')) r = 'rare';

    pushUnique(pickByRarity(r));
  }

  while (cards.length < count) {
    const r = weighted(Object.entries(RARITY_WEIGHT).map(([k, w]) => [k, w]));
    let realR = r;

    if (realR === 'legendary' && !metaHas('unlock_card_legendary')) {
      realR = 'rare';
    }

    pushUnique(pickByRarity(realR));
  }

  return cards.slice(0, count);
}

// ============================================================
// 10. 보상 화면
// ============================================================
let rewardCards = [];
let rewardSelecting = false;

function enterReward() {
  if (!run || run.ended) return;

  const isHotspot = run.currentNode?.type === 'hotspot';

  rewardCards = drawRewardCards(3, isHotspot);
  run.rerollInScreen = 0;
  rewardSelecting = false;

  cast = null;
  showScreen('reward');
  renderReward();

  if (tutorialTier() === 1 && !meta.tooltipsShown.reward) {
    meta.tooltipsShown.reward = true;
    save();
    showOnePointTip('카드는 이번 출조 동안만 유지되는 비법입니다. 같은 카드를 다시 얻으면 Lv이 올라가요.');
  }
}

function renderReward() {
  if (!run) return;

  safeText('#reward-reroll', run.rerollTokens);
  safeText('#reward-slots', `${run.joker.length} / ${run.jokerCapacity}${run.signatureBonus ? ' 🏆' : ''}`);

  const btn = qs('[data-action="reroll-reward"]');
  if (btn) {
    const cost = run.rerollInScreen + 1;
    btn.textContent = `🔄 리롤 (${cost}토큰)`;
    btn.disabled = run.rerollTokens < cost;
  }

  const wrap = qs('#reward-cards');
  if (!wrap) return;
  wrap.innerHTML = '';

  for (const c of rewardCards) {
    const div = document.createElement('div');
    div.className = 'card rarity-' + c.rarity;

    if (c.isEvolved) div.classList.add('is-evolution', 'is-evolve-glow');

    const owned = run.joker.find(j => j.id === c.id);
    const lv = owned ? owned.level : 0;

    let previewText = c.desc;
    if (c.num?.mult) previewText += ` ×${c.num.mult.base}`;
    if (c.num?.add) previewText += ` +${c.num.add.base}`;
    if (c.num?.base && !c.num?.mult && !c.num?.add && c.num.base !== 0) {
      previewText += ` (${c.num.base})`;
    }

    div.innerHTML = `
      <div class="card-rarity">${c.rarity}${owned ? ` · Lv.${lv}` : ''}${c.isEvolved ? ' · 진화' : ''}</div>
      <div class="card-name">${c.name}</div>
      <div class="card-desc">${c.desc}</div>
      <div class="card-preview">${previewText}</div>
    `;

    div.addEventListener('click', () => {
      if (rewardSelecting) return;
      rewardSelecting = true;

      wrap.querySelectorAll('.card').forEach(el => {
        el.classList.add('is-disabled');
        el.style.pointerEvents = 'none';
      });
      div.classList.add('is-selected');

      setTimeout(() => {
        if (!run || run.ended) return;

        if (c.isEvolved) {
          applyEvolutionCard(c.id);
          advanceAfterNode();
          return;
        }

        const added = addCardToJoker(c.id, false, () => {
          advanceAfterNode();
        });

        if (added) {
          advanceAfterNode();
        }
      }, 300);
    });

    wrap.appendChild(div);
  }
}

function rerollReward() {
  if (!run) return;

  const cost = run.rerollInScreen + 1;
  if (run.rerollTokens < cost) {
    toast('리롤 토큰 부족', 'bad');
    return;
  }

  run.rerollTokens -= cost;
  run.rerollInScreen += 1;

  const isHotspot = run.currentNode?.type === 'hotspot';
  rewardCards = drawRewardCards(3, isHotspot);
  rewardSelecting = false;

  try { window.playSound('reroll'); } catch {}

  renderReward();
}

// ============================================================
// 11. 어구점 / 명성 상점
// ============================================================
let shopCards = [];

function enterShopNode() {
  if (!run || run.ended) return;

  shopCards = drawRewardCards(3, false);
  run.rerollInScreen = 0;

  showScreen('shop');
  renderShop();

  if (tutorialTier() === 1 && !meta.tooltipsShown.shop) {
    meta.tooltipsShown.shop = true;
    save();
    showOnePointTip('어구점에서는 미끼를 써서 카드나 추가 미끼를 살 수 있어요.');
  }
}

function renderShop() {
  if (!run) return;

  safeText('#shop-target', STAGE_INFO[run.stage].target);
  safeText('#shop-score', run.stageScore);
  safeText('#shop-bait', run.bait);

  const rerollBtn = qs('[data-action="reroll-shop"]');
  if (rerollBtn) {
    const cost = run.rerollInScreen + 1;
    rerollBtn.textContent = `🔄 리롤 (${cost}토큰)`;
    rerollBtn.disabled = run.rerollTokens < cost;
  }

  const wrap = qs('#shop-body');
  if (!wrap) return;

  wrap.innerHTML = '';

  const bait = document.createElement('div');
  bait.className = 'shop-item is-buyable';
  bait.innerHTML = `
    <div class="shop-item-name">미끼 +4</div>
    <div class="shop-item-cost"><img src="images/bait-icon.png" class="bait-icon-img" alt="미끼"> 3 → +4</div>
  `;
  bait.addEventListener('click', () => {
    if (run.bait >= 3) {
      run.bait -= 3;
      run.bait = Math.min(99, run.bait + 4);
      toast('미끼 거래 완료 (+1)', 'good');
      renderShop();
    } else {
      toast('미끼 부족', 'bad');
    }
  });

  wrap.appendChild(bait);

  for (const c of shopCards) {
    const div = document.createElement('div');
    div.className = 'card rarity-' + c.rarity;
    if (c.isEvolved) div.classList.add('is-evolution', 'is-evolve-glow');

    const owned = run.joker.find(j => j.id === c.id);

    div.innerHTML = `
      <div class="card-rarity">${c.rarity}${owned ? ` · Lv.${owned.level}` : ''}${c.isEvolved ? ' · 진화' : ''}</div>
      <div class="card-name">${c.name}</div>
      <div class="card-desc">${c.desc}</div>
      <div class="card-lv"><img src="images/bait-icon.png" class="bait-icon-img" alt="미끼"> 2로 구매</div>
    `;

    div.addEventListener('click', () => {
      if (run.bait < 2) {
        toast('미끼 부족', 'bad');
        return;
      }

      if (c.isEvolved) {
        run.bait -= 2;
        applyEvolutionCard(c.id);
        renderShop();
        return;
      }

      const beforeBait = run.bait;
      run.bait -= 2;

      const added = addCardToJoker(c.id, false, (accepted) => {
        if (!accepted) run.bait = beforeBait;
        renderShop();
      });

      if (added) renderShop();
    });

    wrap.appendChild(div);
  }
}

function rerollShop() {
  if (!run) return;

  const cost = run.rerollInScreen + 1;
  if (run.rerollTokens < cost) {
    toast('리롤 토큰 부족', 'bad');
    return;
  }

  run.rerollTokens -= cost;
  run.rerollInScreen += 1;
  shopCards = drawRewardCards(3, false);

  try { window.playSound('reroll'); } catch {}

  renderShop();
}

function renderMetaShop() {
  safeText('#meta-shop-renown', meta.renown);

  const wrap = qs('#meta-shop-body');
  if (!wrap) return;

  wrap.innerHTML = '';

  for (const item of META_SHOP) {
    const st = metaShopState(item);
    const div = document.createElement('div');

    div.className = 'shop-item ' + (st.owned ? 'is-owned' : 'is-buyable');
    div.innerHTML = `
      <div class="shop-item-name">${item.name}</div>
      <div class="shop-item-cost">${st.owned ? '보유 중' : `🐟 ${item.cost}`}</div>
      <div class="shop-item-desc">${item.desc}</div>
      <div class="shop-item-effect">→ 다음 출조부터 자동 적용</div>
    `;

    if (!st.owned) {
      div.addEventListener('click', () => buyMetaShop(item));
    }

    wrap.appendChild(div);
  }
}

// ============================================================
// 12. 경로 지도
// ============================================================
function showRunMap() {
  if (!run || run.ended) return;

  showScreen('run-map');

  safeText('#run-map-stage-title', `스테이지 ${run.stage} · ${STAGE_INFO[run.stage].name}`);
  safeText('#run-map-target', STAGE_INFO[run.stage].target);
  safeText('#run-map-score', run.stageScore);
  safeText('#run-map-bait', run.bait);
  safeText('#run-map-reroll', run.rerollTokens);

  renderPath();
  renderSignatureBanner();
}

function renderPath() {
  const board = qs('#path-board');
  if (!board || !run?.path) return;

  board.innerHTML = '';

  const path = run.path;
  const cur = run.nodeCursor;

  for (let c = 0; c < path.length; c++) {
    const col = document.createElement('div');
    col.className = 'path-col';

    for (let i = 0; i < path[c].length; i++) {
      const node = path[c][i];
      const div = document.createElement('div');

      div.className = `path-node type-${node.type}`;

      const isVisited = c < cur.col;
      const isCurrent = c === cur.col && i === cur.idx;
      const isUnchosenSameCol = c === cur.col && i !== cur.idx;
      const isNext = c === cur.col + 1;
      const isLocked = c > cur.col + 1 || isUnchosenSameCol;

      if (isVisited) div.classList.add('is-visited');
      if (isCurrent) div.classList.add('is-current');
      if (isNext) div.classList.add('is-next');
      if (isLocked) div.classList.add('is-locked');

      const restRecover = CONFIG.REST_BAIT_RECOVER || 4;
      const desc = {
        fishing: '🎣 표준 캐스팅. 카드 보상',
        hotspot: '✨ 희귀 어종 2배. 좋은 카드',
        shop: '🛒 카드·미끼 구매',
        rest: `☕ 미끼 +${restRecover} 회복`,
        boss: node.bossMod ? `👹 ${node.bossMod.name}` : '👹 방해 규칙. 마지막',
      }[node.type] || '';

      div.innerHTML = `
        <div class="path-node-icon">${iconOfType(node.type)}</div>
        <div class="path-node-name">${node.label}</div>
        <div class="path-node-desc">${desc}</div>
      `;

      if (isNext) {
        div.addEventListener('click', () => {
          run.nodeCursor = { col: c, idx: i };
          enterNode(node);
        });
      }

      col.appendChild(div);
    }

    board.appendChild(col);
  }

  drawPathLines();
}

function drawPathLines() {
  const oldSvg = qs('.path-svg');
  if (oldSvg) oldSvg.remove();

  const board = qs('#path-board');
  if (!board) return;

  const cols = board.querySelectorAll('.path-col');
  if (cols.length < 2) return;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'path-svg');
  svg.style.width = board.offsetWidth + 'px';
  svg.style.height = board.offsetHeight + 'px';

  const boardRect = board.getBoundingClientRect();

  for (let c = 0; c < cols.length - 1; c++) {
    const curNodes = cols[c].querySelectorAll('.path-node');
    const nextNodes = cols[c + 1].querySelectorAll('.path-node');

    curNodes.forEach((cn) => {
      nextNodes.forEach((nn) => {
        const r1 = cn.getBoundingClientRect();
        const r2 = nn.getBoundingClientRect();

        const x1 = r1.right - boardRect.left;
        const y1 = r1.top + r1.height / 2 - boardRect.top;
        const x2 = r2.left - boardRect.left;
        const y2 = r2.top + r2.height / 2 - boardRect.top;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', '#475569');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('opacity', '0.4');

        svg.appendChild(line);
      });
    });
  }

  board.appendChild(svg);
}

function iconOfType(t) {
  return {
    fishing: '🎣',
    hotspot: '✨',
    shop: '🛒',
    rest: '☕',
    boss: '👹',
  }[t] || '·';
}

// ============================================================
// 13. 스테이지 결과
// ============================================================
function finishStage() {
  if (!run || run.ended) return;

  const target = STAGE_INFO[run.stage].target;
  const achieved = run.stageScore;
  const pass = achieved >= target;

  if (!pass) {
    finishRun(false);
    return;
  }

  const tokensGained = calcRerollTokens(run.stageStats, target, achieved);
  run.rerollTokens += tokensGained;
  run.stageStats.tokensGained = tokensGained;

  if (run.stage >= CONFIG.RUN.stages) {
    finishRun(true);
    return;
  }

  showScreen('stage-result');
  renderStageResult(achieved, target);
}

function calcRerollTokens(stats, target, achieved) {
  let t = 0;
  const r = CONFIG.REROLL;

  t += r.clearBonus;

  if (target && achieved >= target * r.overkillMult) t += r.overkillBonus;
  if (stats.perfect >= r.perfectCountForBonus) t += r.perfectBonus;
  if (stats.newFish.size > 0) t += r.newFishBonus;
  if (stats.bossBig) t += r.bossBigCatchBonus;

  return t;
}

function renderStageResult(achieved, target) {
  const s = run.stageStats;
  const overPct = Math.round((achieved / target) * 100);

  safeText('#stage-result-title', `스테이지 ${run.stage} 클리어!`);

  safeHTML('#stage-result-body', `
    <div class="stat-row"><span class="stat-label">점수</span><span class="stat-value">${achieved} / ${target} (${overPct}%)</span></div>
    <div class="stat-row ${s.perfect >= 3 ? 'is-good' : ''}"><span class="stat-label">퍼펙트 릴링</span><span class="stat-value">${s.perfect}회</span></div>
    <div class="stat-row"><span class="stat-label">신규 도감</span><span class="stat-value">${s.newFish.size}종</span></div>
    <div class="stat-row ${s.bossBig ? 'is-good' : ''}"><span class="stat-label">보스 대물</span><span class="stat-value">${s.bossBig ? '성공' : '—'}</span></div>
    <div class="reroll-banner">+ ${s.tokensGained} 리롤 토큰!</div>
    <div class="stage-result-bar">
      ${[1, 2, 3].map(n => `<div class="stage-result-bar-cell ${n === run.stage ? 'is-current' : ''}">${n}단계</div>`).join('')}
    </div>
  `);

  const nextBtn = qs('#stage-result-next');
  if (nextBtn) {
    nextBtn.onclick = () => enterStage(run.stage + 1);
  }
}

// ============================================================
// 14. RUN 종료 / 부활
// ============================================================
function clearStagesCount(win) {
  return win ? CONFIG.RUN.stages : Math.max(0, run.stage - 1);
}

function calcRenownForRun(win) {
  const cleared = clearStagesCount(win);
  return Math.floor(run.totalScore / 10) + cleared * CONFIG.META_RENOWN_PER_STAGE;
}

function settleRunResult(win, renown) {
  if (!run.settlement) {
    meta.renown += renown;
    meta.stats.totalRuns += 1;
    if (win) meta.stats.clears += 1;
    meta.stats.bestRunScore = Math.max(meta.stats.bestRunScore, run.totalScore);

    run.settlement = {
      renownAwarded: renown,
      winAwarded: !!win,
    };

    save();
    return renown;
  }

  const delta = Math.max(0, renown - run.settlement.renownAwarded);
  if (delta > 0) {
    meta.renown += delta;
    run.settlement.renownAwarded += delta;
  }

  if (win && !run.settlement.winAwarded) {
    meta.stats.clears += 1;
    run.settlement.winAwarded = true;
  }

  meta.stats.bestRunScore = Math.max(meta.stats.bestRunScore, run.totalScore);
  save();

  return delta;
}

function finishRun(win) {
  if (!run) return;
  if (run.ended) return;

  run.ended = true;
  clearCastTimers(cast);
  cast = null;

  const renown = calcRenownForRun(win);
  const renownDisplayed = settleRunResult(win, renown);
  const isBest = run.totalScore >= meta.stats.bestRunScore && run.totalScore > 0;
  const cleared = clearStagesCount(win);

  showScreen('run-result');
  safeText('#run-result-title', win ? '🎉 출조 성공!' : '출조 종료');

  const nextTargetTeaser = win
    ? '다음 출조에서는 더 큰 대물을 노려보세요! 🎣'
    : `다음엔 스테이지 ${run.stage} 목표(${STAGE_INFO[run.stage].target}점)를 넘어봐요!`;

  safeHTML('#run-result-body', `
    <div class="stat-row ${isBest ? 'is-good is-best-flash' : ''}">
      <span class="stat-label">총 점수</span>
      <span class="stat-value">${run.totalScore}${isBest ? ' 🆕' : ''}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">클리어 스테이지</span>
      <span class="stat-value">${cleared} / ${CONFIG.RUN.stages}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">잡은 물고기</span>
      <span class="stat-value">${run.runStats.caughtFish.length}마리</span>
    </div>
    <div class="stat-row is-good">
      <span class="stat-label">획득 명성</span>
      <span class="stat-value">+${renownDisplayed}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">최고 어종</span>
      <span class="stat-value">${bestFishOfRun()}</span>
    </div>
    <div class="run-result-teaser">${nextTargetTeaser}</div>
  `);

  const adBtn = qs('button[data-action="ad-revive"]');
  if (adBtn) {
    adBtn.style.display = (!win && !run.pendingRevive) ? '' : 'none';
  }

  try { window.playSound(win ? 'clear' : 'miss'); } catch {}

  if (isBest) {
    setTimeout(() => {
      const tEl = document.createElement('div');
      tEl.className = 'trophy-banner';
      tEl.textContent = '🏆 신기록!';
      document.body.appendChild(tEl);
      setTimeout(() => tEl.remove(), 2100);
    }, 500);
  }
}

function bestFishOfRun() {
  if (!run?.runStats?.caughtFish?.length) return '—';
  return run.runStats.caughtFish.reduce((a, b) => a.score > b.score ? a : b).name;
}

function adRevive() {
  if (!run || run.pendingRevive) return;

  run.pendingRevive = true;
  run.ended = false;
  run.bait += 4;

  // 현재 스테이지 재도전: 현재 스테이지 점수는 되돌림
  run.totalScore = run.stageStartTotalScore || run.totalScore;
  run.stageScore = 0;
  run.stageStats = emptyStageStats();

  toast('미끼 +4, 현재 스테이지 재도전!', 'good');
  enterStage(run.stage);
}

// ============================================================
// 15. 도감
// ============================================================
function registerEncyclopedia(fishId, sizeRoll) {
  if (!meta.encyclopedia[fishId]) {
    meta.encyclopedia[fishId] = {
      firstDate: Date.now(),
      maxSize: sizeRoll,
      count: 1,
    };
  } else {
    const e = meta.encyclopedia[fishId];
    e.count += 1;
    e.maxSize = Math.max(e.maxSize, sizeRoll);
  }

  save();
}

function renderCodex() {
  const wrap = qs('#codex-grid');
  if (!wrap) return;

  wrap.innerHTML = '';

  const caught = Object.keys(meta.encyclopedia).length;
  safeText('#codex-count', `${caught} / ${FISH.length}`);

  for (const f of FISH) {
    const e = meta.encyclopedia[f.id];
    const div = document.createElement('div');
    div.className = 'codex-cell ' + (e ? '' : 'is-locked');

    div.innerHTML = e
      ? `<div class="codex-cell-photo">${fishImageHTML(f.id)}</div>
         <div class="codex-cell-name">${f.name}</div>
         <div class="codex-cell-meta">최대 ${e.maxSize}cm · ${e.count}회</div>`
      : `<div class="codex-cell-photo codex-cell-photo-locked">❔</div>
         <div class="codex-cell-name">???</div>
         <div class="codex-cell-meta">미등록</div>`;

    wrap.appendChild(div);
  }
}

// ============================================================
// 16. META_HUB
// ============================================================
function renderMeta() {
  safeText('#meta-renown', meta.renown);
  safeText('#meta-total-runs', meta.stats.totalRuns);
  safeText('#meta-best-score', meta.stats.bestRunScore);

  const caught = Object.keys(meta.encyclopedia).length;
  safeText('#meta-codex-count', `${caught} / ${FISH.length}`);
  safeText('#title-renown', `명성 ${meta.renown}`);

  renderProgressGraph();
  updateTitleForOnboarding();
}

function renderProgressGraph() {
  const old = qs('#progress-graph');
  if (old) old.remove();

  const hubGrid = qs('#screen-meta .hub-grid');
  if (!hubGrid) return;

  const div = document.createElement('div');
  div.id = 'progress-graph';
  div.className = 'progress-graph';

  const best = meta.stats.bestRunScore || 0;
  const targets = CONFIG.STAGE_TARGET;
  const totalTarget = targets[targets.length - 1];

  for (let i = 0; i < 3; i++) {
    const target = targets[i];
    const reached = Math.min(best, target);
    const heightPct = (reached / Math.max(totalTarget, best, 1)) * 100;

    const bar = document.createElement('div');
    bar.className = 'progress-bar';
    bar.style.height = heightPct + '%';
    bar.title = `스테이지 ${i + 1}: ${reached} / ${target}`;

    const label = document.createElement('div');
    label.className = 'progress-bar-label';
    label.textContent = `${i + 1}단계 (${target})`;

    bar.appendChild(label);
    div.appendChild(bar);
  }

  hubGrid.parentElement.insertBefore(div, hubGrid.nextSibling);
}

// ============================================================
// 17. 입력
// ============================================================
let spaceDown = false;

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    if (spaceDown) return;
    spaceDown = true;
    e.preventDefault();
    handleSpace(true);
  }
});

document.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    spaceDown = false;
    handleSpace(false);
  }
});

document.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return;
  if (e.target.closest('.card')) return;
  handleSpace(true);
});

document.addEventListener('pointerup', () => handleSpace(false));

function consumeBaitForCast() {
  if (!run || run.isTutorial) return true;

  if (run.bait <= 0) {
    finishRun(false);
    return false;
  }

  const baitMasterLv = jokerLevel('bait_master');
  const skipChance = baitMasterLv > 0 ? 0.1 + 0.1 * (baitMasterLv - 1) : 0;
  const skipped = Math.random() < skipChance;

  if (skipped) {
    toast('미끼 절약!', 'good');
  } else {
    run.bait -= 1;
    if (run.bait < 0) run.bait = 0;
  }

  setFishingHUD();
  return true;
}

function handleSpace(down) {
  if (!run || !cast || run.ended) return;

  if (cast.phase === 'CAST' && down) {
    cast.accuracy = 1 - Math.abs(50 - cast.gaugePos) / 50;

    if (!consumeBaitForCast()) return;

    try { window.playSound('cast'); } catch {}

    cast.phase = 'BITE';
    cast.biteState = 'wait';
    cast.biteWaitStartMs = performance.now();
    cast.bitDelayMs = randInt(CONFIG.BITE_DELAY_MS[0], CONFIG.BITE_DELAY_MS[1]);

    const ring = qs('#bite-ring-progress');
    if (ring) ring.style.strokeDashoffset = '276.5';

    safeText('#bite-hint-text', '…곧 입질이 옵니다. 링이 다 차면 입질이 와요!');
    setFishingPhase('BITE');

    const castId = cast.id;
    cast.biteCountdownTimer = setTimeout(() => {
      if (!cast || cast.id !== castId || cast.phase !== 'BITE' || cast.biteState !== 'wait') return;

      cast.biteState = 'hit';
      cast.biteStartMs = performance.now();

      try { window.playSound('bite'); } catch {}

      const biteEl = qs('#phase-bite');
      if (biteEl) {
        biteEl.classList.remove('is-bite-wait');
        biteEl.classList.add('is-bite-hit');
      }

      safeText('#bite-hint-text', '🎣 입질이 왔어요! 링이 사라지기 전에 탭/스페이스바!');
      updateTutorialHint('BITE');

      cast.biteMissTimer = setTimeout(() => {
        if (!cast || cast.id !== castId || cast.phase !== 'BITE' || cast.biteState !== 'hit') return;
        finalizeCast(false, false);
      }, cast.bitWindow);
    }, cast.bitDelayMs);

    return;
  }

  if (cast.phase === 'BITE' && down) {
    if (cast.biteState !== 'hit') return;

    const elapsed = performance.now() - cast.biteStartMs;
    clearCastTimers(cast);

    if (elapsed <= cast.bitWindow) {
      try { window.playSound('hook'); } catch {}

      // REEL 진입 시점에 어종을 미리 결정해야 tier 난이도가 정상 적용됨
      cast.fish = pickFish();
      cast.sizeRoll = randInt(cast.fish.size_min, cast.fish.size_max);

      cast.phase = 'REEL';
      cast.tension = 50;
      cast.progress = 0;
      cast.reelTimeMs = CONFIG.REEL.timeLimitMs;
      cast.fishState = 'relax';
      cast.nextSwitchMs = rollFishPhaseDuration('relax');
      cast.reeling = false;
      cast.leftSafeZone = false;
      cast.slackLocked = false;
      cast.lastProg = 0;

      setFishingPhase('REEL');
    } else {
      finalizeCast(false, false);
    }

    return;
  }

  if (cast.phase === 'REEL') {
    cast.reeling = down;
    if (down) {
      try { window.playSound('reel'); } catch {}
    }
  }
}

// ============================================================
// 18. 버튼 라우팅
// ============================================================
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action]');
  if (!t) return;

  const action = t.dataset.action;

  switch (action) {
    case 'goto-title':
      run = null;
      cast = null;
      applyTimeOfDay();
      renderMeta();
      showScreen('title');
      break;

    case 'goto-meta':
      run = null;
      cast = null;
      applyTimeOfDay();
      renderMeta();
      showScreen('meta');
      break;

    case 'goto-codex':
      renderCodex();
      showScreen('codex');
      break;

    case 'goto-shop':
      renderMetaShop();
      showScreen('meta-shop');
      break;

    case 'start-run':
      startRun(false);
      break;

    case 'start-tutorial':
      startRun(true);
      break;

    case 'skip-tutorial':
      meta.tutorialDone = true;
      save();
      updateTitleForOnboarding();
      toast('튜토리얼을 건너뛰었어요', 'good');
      break;

    case 'play-again':
      run = null;
      cast = null;
      startRun(false);
      break;

    case 'reroll-reward':
      rerollReward();
      break;

    case 'reroll-shop':
      rerollShop();
      break;

    case 'leave-shop':
      advanceAfterNode();
      break;

    case 'ad-revive':
      adRevive();
      break;
  }
});

// ============================================================
// 19. 초기 진입
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  renderMeta();
  updateTitleForOnboarding();
  showScreen('title');
});
