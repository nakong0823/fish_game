// game.js — Angler's Secret v0.6 MVP
// 명세 그대로. 명세 외 값 0 / 빈배열 / TODO(spec).
// 라이브러리 0개. file:// 동작.

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
  // entries: [[key, weight], ...]
  const sum = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * sum;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
};

// ============================================================
// 1. 화면 전환
// ============================================================
const SCREENS = ['title', 'meta', 'run-map', 'fishing', 'reward',
                 'shop', 'meta-shop', 'codex', 'stage-result', 'run-result'];

function showScreen(name) {
  for (const s of SCREENS) {
    const el = document.getElementById('screen-' + s);
    if (el) el.classList.toggle('hidden', s !== name);
  }
}

function toast(msg, kind = '') {
  const t = qs('#toast');
  t.textContent = msg;
  t.className = 'toast ' + (kind ? 'is-' + kind : '');
  setTimeout(() => { t.classList.add('hidden'); }, 1400);
  t.classList.remove('hidden');
}

// ============================================================
// 2. 저장 (localStorage angler_save_v1)
// ============================================================
const SAVE_KEY = 'angler_save_v1';
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw);
    if (data.version !== 1) return defaultSave();
    return Object.assign(defaultSave(), data);
  } catch {
    return defaultSave();
  }
}
function defaultSave() {
  return {
    version: 1,
    renown: 0,
    unlocks: [],          // string[]
    encyclopedia: {},     // fishId -> { firstDate, maxSize, count }
    stats: { bestRunScore: 0, totalRuns: 0, clears: 0 },
  };
}
function save() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(meta));
}

// ============================================================
// 3. 메타 / 영구
// ============================================================
let meta = loadSave();

function metaHas(perkId) { return meta.unlocks.includes(perkId); }

// 명성 상점 6개 (id 일치)
function metaShopState(item) {
  if (item.id === 'perk_start_bait' || item.id === 'perk_start_card' || item.id === 'perk_start_reroll') {
    // 퍽은 영구 적용이므로 "구매"는 1회만 (MVP: 1회 구매로 즉시 영구)
    return { owned: meta.unlocks.includes(item.id) };
  }
  return { owned: meta.unlocks.includes(item.id) };
}

function buyMetaShop(item) {
  if (meta.renown < item.cost) { toast('명성 부족', 'bad'); return; }
  if (meta.unlocks.includes(item.id)) { toast('이미 보유', 'bad'); return; }
  meta.renown -= item.cost;
  meta.unlocks.push(item.id);
  save();
  renderMetaShop();
  toast(`${item.name} 해금!`, 'good');
}

// ============================================================
// 4. RUN 상태 (휘발성)
// ============================================================
let run = null; // RUN 진행 중일 때만 객체

function startRun() {
  const startBait = CONFIG.RUN.startBait + (metaHas('perk_start_bait') ? 3 : 0);
  const rerollTokens = CONFIG.REROLL.startTokens + (metaHas('perk_start_reroll') ? 1 : 0);

  run = {
    stage: 1,                         // 1~3
    stageScore: 0,                    // 현재 스테이지 누적 점수
    totalScore: 0,                    // RUN 전체 누적
    bait: startBait,
    joker: [],                        // [{ id, level }]
    jokerCapacity: CONFIG.RUN.jokerSlots,
    path: null,                       // 현재 스테이지 경로
    nodeCursor: { col: 0, idx: 0 },   // 현재 위치 (시작 노드)
    // RUN 통계 (리롤 토큰 산정용)
    stageStats: emptyStageStats(),
    runStats: { caughtFish: [], perfectReel: 0, totalCasts: 0, successfulCasts: 0, comboReel: 0, maxComboReel: 0, largeCatch: 0 },
    rerollTokens,
    rerollInScreen: 0,                // 현재 보상 화면 리롤 횟수 (화면 나가면 리셋)
    bossDefeated: false,              // 보스 잡힘 여부
    safetyNetUsed: false,             // 안전그물 발동 여부
    pendingRevive: false,
  };

  // 시작 비법 (perk_start_card)
  if (metaHas('perk_start_card')) {
    const c = pickByRarity('common');
    addCardToJoker(c.id, /*silent*/ true);
  }

  enterStage(1);
}

function emptyStageStats() {
  return { score: 0, perfect: 0, newFish: new Set(), bossBig: false, catches: 0 };
}

function enterStage(stage) {
  run.stage = stage;
  run.stageScore = 0;
  run.stageStats = emptyStageStats();
  run.path = generatePath();
  run.nodeCursor = { col: 0, idx: 0 };
  // 시작 노드 자동 진입
  enterNode(run.path[0][0]);
}

function generatePath() {
  // 5열: 시작 → 1열 → 2열 → 3열 → 보스
  // 각 열 1~2 노드. 인접 연결.
  // 중간 열(1~3)은 가중치로 타입 결정. 시작/보스는 고정.
  const cols = [];
  // col 0 = 시작 (fishing 강제)
  cols.push([{ type: 'fishing', label: '출발' }]);
  for (let c = 1; c <= 3; c++) {
    const n = CONFIG.PATH.nodesPerColumn;
    const arr = [];
    for (let i = 0; i < n; i++) {
      const type = weighted(Object.entries(CONFIG.NODE_WEIGHT).map(([k, w]) => [k, w]));
      arr.push({ type, label: labelOfType(type) });
    }
    cols.push(arr);
  }
  // col 4 = 보스
  cols.push([{ type: 'boss', label: '보스', bossMod: pick(BOSS_MODIFIERS) }]);
  return cols;
}

function labelOfType(t) {
  return { fishing: '낚시', hotspot: '명당', shop: '어구점', rest: '휴식', boss: '보스' }[t] || t;
}

// ============================================================
// 5. 노드 진입
// ============================================================
function enterNode(node) {
  if (!run) return;
  if (node.type === 'fishing' || node.type === 'hotspot') {
    run.currentNode = node;
    run.currentCastIdx = 0;
    run.castsTotal = CONFIG.PATH.castsPerNode[0]; // 명세: 2~3, MVP 2로 고정
    enterCasting();
  } else if (node.type === 'shop') {
    enterShopNode();
  } else if (node.type === 'rest') {
    run.bait = Math.min(99, run.bait + 4);
    toast('미끼 +4 회복', 'good');
    advanceAfterNode();
  } else if (node.type === 'boss') {
    run.currentNode = node;
    run.currentCastIdx = 0;
    run.castsTotal = Math.max(1, CONFIG.PATH.castsPerNode[0] + (node.bossMod?.effect?.castsDelta || 0));
    enterCasting();
  }
}

function advanceAfterNode() {
  // 다음 열로 진행. 마지막(보스)였으면 스테이지 결과.
  const path = run.path;
  const cur = run.nodeCursor;
  cur.col += 1;
  if (cur.col >= path.length) {
    finishStage();
  } else {
    // 다음 노드 후보는 path[cur.col] 전부 (단순화: 1개씩)
    showRunMap();
  }
}

// ============================================================
// 6. 캐스팅 3단계 (CAST/BITE/REEL)
// ============================================================
let cast = null;

function enterCasting() {
  const stage = run.stage;
  const node = run.currentNode;
  // 보스면 손수 조정 (deadline)
  cast = {
    phase: 'CAST',
    gaugePos: 0,
    gaugeDir: 1,
    gaugeSpeed: CONFIG.CAST_GAUGE_SPEED * (node.bossMod?.effect?.castGaugeSpeed || 1),
    accuracy: 0,
    bitDelayMs: 0,
    bitWindow: CONFIG.BITE_WINDOW_MS,
    // REEL
    tension: 50,
    progress: 0,
    reelTimeMs: CONFIG.REEL.timeLimitMs,
    fishState: 'relax',         // resist | relax
    nextSwitchMs: 0,
    fish: null,                  // 성공 시 어종 결정
    sizeRoll: 0,                 // cm
  };
  // 어종 풀 미리 결정하지 않음 (REEL 성공 시 가중)
  showScreen('fishing');
  qs('#fishing-stage-title').textContent = `스테이지 ${stage} · ${STAGE_INFO[stage].name} · ${labelOfType(node.type)}`;
  qs('#fishing-cast-info').textContent = `${run.currentCastIdx + 1} / ${run.castsTotal} 손`;
  setFishingHUD();
  setFishingPhase('CAST');
  requestAnimationFrame(fishingTick);
}

function setFishingPhase(p) {
  for (const k of ['cast', 'bite', 'reel', 'result']) {
    const el = qs('#phase-' + k);
    if (el) el.classList.toggle('hidden', k !== p.toLowerCase());
  }
}

function setFishingHUD() {
  qs('#fishing-target').textContent = STAGE_INFO[run.stage].target;
  qs('#fishing-score').textContent = run.stageScore;
  qs('#fishing-bait').textContent = run.bait;
}

function fishingTick(now) {
  if (!cast || !run || run.currentNode !== cast.node) return; // 안전
  if (!cast.lastT) cast.lastT = now;
  const dt = (now - cast.lastT) / 1000;
  cast.lastT = now;

  if (cast.phase === 'CAST') {
    // 좌우 왕복
    cast.gaugePos += cast.gaugeDir * cast.gaugeSpeed * 100 * dt;
    if (cast.gaugePos >= 100) { cast.gaugePos = 100; cast.gaugeDir = -1; }
    if (cast.gaugePos <= 0)   { cast.gaugePos = 0;   cast.gaugeDir = 1; }
    qs('#cast-marker').style.left = cast.gaugePos + '%';
  } else if (cast.phase === 'DRIFT') {
    cast.bitDelayMs -= dt * 1000;
    if (cast.bitDelayMs <= 0) {
      cast.phase = 'BITE';
      cast.biteStartMs = now;
      setFishingPhase('BITE');
    }
  } else if (cast.phase === 'REEL') {
    cast.reelTimeMs -= dt * 1000;
    if (cast.reelTimeMs <= 0) {
      // 시간 초과 → 실패
      finalizeCast(false, false);
      return requestAnimationFrame(fishingTick);
    }
    // 상태 전환
    cast.nextSwitchMs -= dt * 1000;
    if (cast.nextSwitchMs <= 0) {
      cast.fishState = cast.fishState === 'resist' ? 'relax' : 'resist';
      const isResist = cast.fishState === 'resist';
      const mult = isResist ? [700, 1500] : [500, 1200];
      cast.nextSwitchMs = randInt(mult[0], mult[1]);
    }
    // 조작: 누르고 있으면 릴 감음 (MVP: 자동 진행, 입력은 단순화)
    // 텐션/진행도 자동 업데이트 (인터랙티브 단순화 버전)
    const tier = cast.fish?.tier || 1;
    const tierMult = CONFIG.REEL.tierTensionMult[tier];
    const wideZoneLv = jokerLevel('wide_zone');
    const slowTensionLv = jokerLevel('slow_tension');
    const calmFishLv = jokerLevel('calm_fish');
    const fastProgressLv = jokerLevel('fast_progress');

    const safeZone = CONFIG.REEL.safeZoneByStage[Math.min(run.stage, 4)];
    let zoneLow = safeZone[0], zoneHigh = safeZone[1];
    // wide_zone 효과: ±(8 + 4*lv) 확장
    const zoneExpand = wideZoneLv > 0 ? 8 + 4 * wideZoneLv : 0;
    zoneLow = Math.max(0, zoneLow - zoneExpand);
    zoneHigh = Math.min(100, zoneHigh + zoneExpand);

    // 초록존 마커 표시
    qs('#tension-zone').style.bottom = zoneLow + '%';
    qs('#tension-zone').style.height = (zoneHigh - zoneLow) + '%';

    // 자동으로 부드럽게 증감 (단순화)
    let up = CONFIG.REEL.reelUpRate * (1 + 0.0); // MVP 자동
    if (slowTensionLv > 0) up *= (1 + (slowTensionLv - 1) * 0); // Lv1=0.8, 단순화
    const isResist = cast.fishState === 'resist';
    const tensVar = (run.currentNode.bossMod?.effect?.reelTensionVar || 1);
    const tensRise = up * (isResist ? CONFIG.REEL.resistTensionMult : 1) * tierMult * tensVar;
    const tensDrop = CONFIG.REEL.reelDownRate;
    // 천천히 변동
    cast.tension += (isResist ? tensRise : -tensDrop) * 0.5 * dt;
    // 진행도 (이완 중 가속)
    const progRate = CONFIG.REEL.progressRate * (1 + (fastProgressLv - 1) * 0) * (isResist ? 1 : CONFIG.REEL.relaxProgressMult);
    cast.progress += progRate * 0.5 * dt;

    // 안전그물
    if (cast.tension >= 100) {
      if (jokerHas('safety_net') && !run.safetyNetUsed) {
        run.safetyNetUsed = true;
        // 안전그물 발동 = 라인 파손 무효
        cast.tension = 99;
      }
    }
    if (cast.tension <= 0) {
      cast.tension = 0;
      cast.progress = Math.max(0, cast.progress - CONFIG.REEL.slackPenalty);
    }
    cast.progress = clamp(cast.progress, 0, 100);

    // 텐션 표시
    qs('#tension-fill').style.height = cast.tension + '%';
    qs('#tension-tick').style.bottom = cast.tension + '%';
    qs('#progress-fill').style.width = cast.progress + '%';
    const rs = qs('#reel-state');
    rs.textContent = isResist ? '저항 중' : '이완 중';
    rs.className = 'reel-state ' + (isResist ? 'is-resist' : 'is-relax');
    qs('#reel-time').textContent = (cast.reelTimeMs / 1000).toFixed(1) + 's';

    // 판정
    if (cast.tension >= 100) {
      finalizeCast(false, false);
      return requestAnimationFrame(fishingTick);
    }
    if (cast.progress >= 100) {
      // 성공 — 초록존 이탈 여부
      const inZone = cast.tension >= zoneLow && cast.tension <= zoneHigh;
      finalizeCast(true, inZone);
      return requestAnimationFrame(fishingTick);
    }
  } else if (cast.phase === 'CATCH' || cast.phase === 'MISS') {
    cast.phaseT -= dt;
    if (cast.phaseT <= 0) {
      // 다음 손 or 노드 종료
      run.currentCastIdx += 1;
      if (run.currentCastIdx >= run.castsTotal) {
        // 노드 완료
        run.totalScore += run.stageScore;
        advanceAfterNode();
      } else {
        // 다음 손
        enterCasting();
      }
      return;
    }
  }

  if (run && cast) requestAnimationFrame(fishingTick);
}

function finalizeCast(success, perfect) {
  if (!cast) return;
  if (!success) {
    // 실패 — 미끼만 소모
    run.bait -= 1;
    if (run.bait < 0) run.bait = 0;
    run.runStats.totalCasts += 1;
    // 콤보 리셋
    run.runStats.comboReel = 0;
    setFishingHUD();
    setFishingPhase('RESULT');
    qs('#fish-line').textContent = '놓침! 미끼만 소모';
    qs('#fish-score').textContent = '+0';
    cast.phase = 'MISS';
    cast.phaseT = 0.8;
    if (run.bait <= 0) {
      // 즉시 종료 예약
      setTimeout(() => finishRun(/*win*/ run.stageScore >= STAGE_INFO[run.stage].target), 900);
    }
    return;
  }
  // 성공 — 어종 결정
  const fish = pickFish();
  const sizeRoll = randInt(fish.size_min, fish.size_max);
  run.runStats.totalCasts += 1;
  run.runStats.successfulCasts += 1;
  if (perfect) {
    run.runStats.perfectReel += 1;
    run.stageStats.perfect += 1;
  }
  // 콤보
  run.runStats.comboReel += 1;
  run.runStats.maxComboReel = Math.max(run.runStats.maxComboReel, run.runStats.comboReel);
  // 도감 등록
  registerEncyclopedia(fish.id, sizeRoll);
  run.stageStats.newFish.add(fish.id);

  // 점수 계산 (4장)
  cast.fish = fish;
  cast.sizeRoll = sizeRoll;
  cast.perfect = perfect;
  cast.castAccuracy = cast.accuracy || 0.7; // MVP: 게이지값 단순화
  const score = calcScore({ fish, sizeRoll, perfect, castAccuracy: cast.castAccuracy, stage: run.stage, castIndex: run.currentCastIdx + 1 });

  run.stageScore += score;
  run.stageStats.score += score;
  run.runStats.caughtFish.push({ id: fish.id, name: fish.name, size: sizeRoll, score });
  if (fish.size_max >= 60 || fish.tier >= 3) run.runStats.largeCatch += 1;
  if (run.currentNode.type === 'boss' && fish.tier >= 3) run.stageStats.bossBig = true;

  setFishingHUD();
  setFishingPhase('RESULT');
  const sizeLabel = `${sizeRoll}cm`;
  qs('#fish-line').textContent = `${fish.name} (${sizeLabel}) ${perfect ? '⭐ 퍼펙트' : ''}`;
  qs('#fish-score').textContent = `+${score}`;
  cast.phase = 'CATCH';
  cast.phaseT = 0.8;
}

// ============================================================
// 7. 어종 결정 + 점수 공식
// ============================================================
function pickFish() {
  const stage = run.stage;
  const node = run.currentNode;
  let pool = FISH.filter(f => f.stage === stage);
  if (node.type === 'hotspot') {
    // hotspot: tier4 weight ×2
    pool = FISH.filter(f => f.stage === 0 || f.stage === stage);
    pool = pool.map(f => f.tier === 4 ? { ...f, weight: f.weight * 2 } : f);
  }
  if (node.type === 'boss') {
    // tier3 이상만
    pool = pool.filter(f => f.tier >= 3);
  }
  // boss_mod: small_only
  if (node.bossMod?.effect?.fishFilter === 'small') {
    pool = pool.filter(f => f.size_max < 40);
  }
  if (pool.length === 0) pool = FISH.filter(f => f.stage === stage);
  const weights = pool.map(f => [f, f.weight]);
  return weighted(weights);
}

function calcScore(ctx) {
  const { fish, sizeRoll, perfect, castAccuracy, stage, castIndex } = ctx;
  // 1) 기본
  const base = fish.base;
  // 2) 크기배율
  const sizeMult = 1.0 + (sizeRoll - fish.size_min) / Math.max(1, (fish.size_max - fish.size_min));
  // 3) 캐스팅배율
  const castMult = 0.8 + (castAccuracy * 0.4);
  // 4) REEL 배율
  const reelMult = perfect ? 1.3 : 1.0;

  let total = base * sizeMult * castMult * reelMult;
  let totalAdd = 0;

  // 카드 효과 — 순서: ①합(add) 전부 → ②곱(mult) 전부
  const conditions = {
    fish, sizeRoll, perfect, castAccuracy, stage, castIndex,
    encyclopediaCount: Object.keys(meta.encyclopedia).length,
    comboReel: run.runStats.comboReel,
    isFirstOfSpecies: !run.runStats.caughtFish.some(c => c.id === fish.id),
    isNight: stage === 3 || run.currentNode.bossMod?.id === 'night',
    run: run, meta: meta,
  };

  for (const j of run.joker) {
    const card = ALL_CARDS.find(c => c.id === j.id);
    if (!card || card.type !== 'score') continue;
    const lv = j.level || 1;
    if (card.num.add) {
      if (matchCondition(card.num.cond, conditions)) {
        const add = card.num.add.base + card.num.add.perLvl * (lv - 1);
        // collector: 등록수 × v
        if (card.id === 'collector') {
          totalAdd += conditions.encyclopediaCount * (card.num.add.base + card.num.add.perLvl * (lv - 1));
        } else {
          totalAdd += add;
        }
      }
    }
  }
  // 합 먼저
  total += totalAdd;

  for (const j of run.joker) {
    const card = ALL_CARDS.find(c => c.id === j.id);
    if (!card || card.type !== 'score') continue;
    const lv = j.level || 1;
    if (card.num.mult) {
      if (matchCondition(card.num.cond, conditions)) {
        let mult = card.num.mult.base + card.num.mult.perLvl * (lv - 1);
        // lucky_lure: 20% 확률
        if (card.id === 'lucky_lure') {
          if (Math.random() > 0.2) mult = 1;
        }
        // boss_mod: small_only ×0.7
        if (run.currentNode.bossMod?.effect?.scoreMult) {
          mult *= run.currentNode.bossMod.effect.scoreMult;
        }
        total *= mult;
      }
    }
  }

  return Math.round(total);
}

function matchCondition(cond, ctx) {
  if (!cond) return true;
  switch (cond.kind) {
    case 'minSize':      return ctx.sizeRoll >= cond.v;
    case 'maxSize':      return ctx.sizeRoll < cond.v;
    case 'accuracyAtLeast': return ctx.castAccuracy >= cond.v;
    case 'firstOfSpecies': return ctx.isFirstOfSpecies;
    case 'comboContinued': return ctx.comboReel > 1;
    case 'stageIs':      return ctx.stage === cond.v;
    case 'perfectReel':  return ctx.perfect;
    case 'castIndexIs':  return ctx.castIndex === cond.v;
    case 'perEncyclopedia': return true;
    case 'randomChance': return Math.random() < cond.v;
    case 'isNight':      return ctx.isNight;
    default: return false;
  }
}

// ============================================================
// 8. 카드 시스템 (조커 + 리롤 + 레벨업 + 진화)
// ============================================================
function jokerHas(id) {
  return run.joker.some(j => j.id === id);
}
function jokerLevel(id) {
  const j = run.joker.find(j => j.id === id);
  return j ? j.level : 0;
}

function addCardToJoker(cardId, silent) {
  if (!run) return;
  const existing = run.joker.find(j => j.id === cardId);
  if (existing) {
    if (existing.level < 3) {
      existing.level += 1;
      if (!silent) toast(`레벨업! (Lv.${existing.level})`, 'good');
    } else {
      // Lv.3 진화 가능?
      const evo = EVOLUTIONS.find(e => e.base === cardId);
      if (evo && canEvolve(evo)) {
        // 진화는 보상 등장 시점에 처리 (단순화: 즉시 진화 카드 추가 + 원본 제거)
        run.joker = run.joker.filter(j => j.id !== cardId);
        run.joker.push({ id: evo.evolveId, level: 1, isEvolved: true });
        if (!silent) toast(`진화! ${evo.evolveName}`, 'good');
      } else {
        if (!silent) toast('이미 최대 레벨', 'bad');
      }
    }
  } else {
    if (run.joker.length >= run.jokerCapacity) {
      if (!silent) toast('슬롯 부족! 카드 폐기', 'bad');
      // MVP: 가장 오래된 것 자동 폐기
      run.joker.shift();
    }
    run.joker.push({ id: cardId, level: 1 });
    if (!silent) toast(`비법 획득: ${ALL_CARDS.find(c => c.id === cardId).name}`, 'good');
  }
}

function canEvolve(evo) {
  if (!run) return false;
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
    return evo.condition.ids.every(id => run.joker.some(j => j.id === id && j.level >= 3));
  }
  return false;
}

function pickByRarity(rarity = null) {
  let pool = ALL_CARDS;
  if (rarity) pool = pool.filter(c => c.rarity === rarity);
  // 잠금 처리 (unlock_card_legendary)
  if (!metaHas('unlock_card_legendary')) {
    pool = pool.filter(c => c.rarity !== 'legendary');
  }
  return pool[randInt(0, pool.length - 1)];
}

function drawRewardCards(count = 3, isHotspot = false) {
  // hotspot: 1장 uncommon 이상 확정
  const cards = [];
  if (isHotspot) {
    const rarities = ['uncommon', 'rare', 'legendary'];
    let r = 'uncommon';
    const roll = Math.random();
    if (roll > 0.85) r = 'legendary';
    else if (roll > 0.5) r = 'rare';
    if (r === 'legendary' && !metaHas('unlock_card_legendary')) r = 'rare';
    const c = pickByRarity(r);
    cards.push(c);
    count -= 1;
  }
  for (let i = 0; i < count; i++) {
    const r = weighted(Object.entries(RARITY_WEIGHT).map(([k, w]) => [k, w]));
    let realR = r;
    if (r === 'legendary' && !metaHas('unlock_card_legendary')) realR = 'rare';
    cards.push(pickByRarity(realR));
  }
  return cards;
}

// ============================================================
// 9. 보상 화면
// ============================================================
let rewardCards = [];

function enterReward() {
  const isHotspot = run.currentNode.type === 'hotspot';
  rewardCards = drawRewardCards(3, isHotspot);
  run.rerollInScreen = 0;
  showScreen('reward');
  renderReward();
}

function renderReward() {
  qs('#reward-reroll').textContent = run.rerollTokens;
  qs('#reward-slots').textContent = `${run.joker.length} / ${run.jokerCapacity}`;
  const wrap = qs('#reward-cards');
  wrap.innerHTML = '';
  for (const c of rewardCards) {
    const div = document.createElement('div');
    div.className = 'card rarity-' + c.rarity;
    const owned = run.joker.find(j => j.id === c.id);
    const lv = owned ? owned.level : 0;
    div.innerHTML = `
      <div class="card-rarity">${c.rarity}${owned ? ` · Lv.${lv}` : ''}</div>
      <div class="card-name">${c.name}</div>
      <div class="card-desc">${c.desc}</div>
    `;
    div.addEventListener('click', () => {
      addCardToJoker(c.id, false);
      // 다음 노드 또는 보상→다음
      advanceAfterNode();
    });
    wrap.appendChild(div);
  }
}

function rerollReward() {
  if (run.rerollTokens <= 0) { toast('리롤 토큰 부족', 'bad'); return; }
  run.rerollInScreen += 1;
  const cost = run.rerollInScreen; // 1, 2, 3, ...
  if (run.rerollTokens < cost) { toast('리롤 토큰 부족', 'bad'); run.rerollInScreen -= 1; return; }
  run.rerollTokens -= cost;
  const isHotspot = run.currentNode.type === 'hotspot';
  rewardCards = drawRewardCards(3, isHotspot);
  renderReward();
}

// ============================================================
// 10. 어구점 노드 + 명성 상점 (메타)
// ============================================================
let shopCards = [];

function enterShopNode() {
  shopCards = drawRewardCards(3, false);
  showScreen('shop');
  renderShop();
}

function renderShop() {
  qs('#shop-target').textContent = STAGE_INFO[run.stage].target;
  qs('#shop-score').textContent = run.stageScore;
  qs('#shop-bait').textContent = run.bait;
  const wrap = qs('#shop-body');
  wrap.innerHTML = '';
  // 미끼 구매 옵션
  const bait = document.createElement('div');
  bait.className = 'shop-item is-buyable';
  bait.innerHTML = `<div class="shop-item-name">미끼 +4</div><div class="shop-item-cost">🪱 4 → +4</div>`;
  bait.addEventListener('click', () => {
    if (run.bait >= 4) {
      run.bait -= 4;
      const got = Math.min(99, run.bait + 8);
      run.bait = got + 4; // 표시는 원본, +4 적용
      // 단순화: bait -= 4; +4 회복 (순환 0)
      run.bait += 0; // net 0
      run.bait = Math.max(0, run.bait);
      toast('미끼 거래 완료', 'good');
      renderShop();
    } else { toast('미끼 부족', 'bad'); }
  });
  // 카드 3장
  for (const c of shopCards) {
    const div = document.createElement('div');
    div.className = 'card rarity-' + c.rarity;
    const owned = run.joker.find(j => j.id === c.id);
    div.innerHTML = `
      <div class="card-rarity">${c.rarity}${owned ? ` · Lv.${owned.level}` : ''}</div>
      <div class="card-name">${c.name}</div>
      <div class="card-desc">${c.desc}</div>
      <div class="card-lv">🪱 2로 구매</div>
    `;
    div.addEventListener('click', () => {
      if (run.bait < 2) { toast('미끼 부족', 'bad'); return; }
      run.bait -= 2;
      addCardToJoker(c.id, false);
      renderShop();
    });
    wrap.appendChild(div);
  }
  wrap.prepend(bait);
}

function rerollShop() {
  if (run.rerollTokens <= 0) { toast('리롤 토큰 부족', 'bad'); return; }
  run.rerollInScreen += 1;
  const cost = run.rerollInScreen;
  if (run.rerollTokens < cost) { toast('리롤 토큰 부족', 'bad'); run.rerollInScreen -= 1; return; }
  run.rerollTokens -= cost;
  shopCards = drawRewardCards(3, false);
  renderShop();
}

function renderMetaShop() {
  qs('#meta-shop-renown').textContent = meta.renown;
  const wrap = qs('#meta-shop-body');
  wrap.innerHTML = '';
  for (const item of META_SHOP) {
    const st = metaShopState(item);
    const div = document.createElement('div');
    div.className = 'shop-item ' + (st.owned ? 'is-locked' : 'is-buyable');
    div.innerHTML = `
      <div class="shop-item-name">${item.name}</div>
      <div class="shop-item-cost">${st.owned ? '✅ 보유' : `🐟 ${item.cost}`}</div>
      <div class="shop-item-desc">${item.desc}</div>
    `;
    if (!st.owned) {
      div.addEventListener('click', () => buyMetaShop(item));
    }
    wrap.appendChild(div);
  }
}

// ============================================================
// 11. 경로 지도 (RUN_MAP)
// ============================================================
function showRunMap() {
  showScreen('run-map');
  qs('#run-map-stage-title').textContent = `스테이지 ${run.stage} · ${STAGE_INFO[run.stage].name}`;
  qs('#run-map-target').textContent = STAGE_INFO[run.stage].target;
  qs('#run-map-score').textContent = run.stageScore;
  qs('#run-map-bait').textContent = run.bait;
  qs('#run-map-reroll').textContent = run.rerollTokens;
  renderPath();
}

function renderPath() {
  const board = qs('#path-board');
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
      const isCurrent = c === cur.col;
      const isNext = c === cur.col + 1;
      const isLocked = c > cur.col + 1;
      if (isVisited) div.classList.add('is-visited');
      if (isCurrent) div.classList.add('is-current');
      if (isNext) div.classList.add('is-next');
      if (isLocked) div.classList.add('is-locked');
      div.innerHTML = `
        <div class="path-node-icon">${iconOfType(node.type)}</div>
        <div class="path-node-name">${node.label}</div>
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
}

function iconOfType(t) {
  return { fishing: '🎣', hotspot: '✨', shop: '🛒', rest: '☕', boss: '👹' }[t] || '·';
}

// ============================================================
// 12. 스테이지 결과
// ============================================================
function finishStage() {
  const target = STAGE_INFO[run.stage].target;
  const achieved = run.stageScore;
  const pass = achieved >= target;
  // 리롤 토큰 산정
  const tokensGained = calcRerollTokens(run.stageStats);
  run.rerollTokens += tokensGained;
  run.stageStats.tokensGained = tokensGained;

  if (pass) {
    if (run.stage >= CONFIG.RUN.stages) {
      // 최종 RUN 클리어
      finishRun(true);
      return;
    }
    // 다음 스테이지로
    showScreen('stage-result');
    renderStageResult(pass, achieved, target);
  } else {
    // 실패 → RUN 종료
    finishRun(false);
  }
}

function calcRerollTokens(stats) {
  let t = 0;
  const r = CONFIG.REROLL;
  // 클리어 보너스는 finishStage 진입 시 항상 +1 (stage clear)
  t += r.clearBonus;
  if (stats.score >= stats.target * r.overkillMult) t += r.overkillBonus;
  if (stats.perfect >= r.perfectCountForBonus) t += r.perfectBonus;
  if (stats.newFish.size > 0) t += r.newFishBonus;
  if (stats.bossBig) t += r.bossBigCatchBonus;
  return t;
}

function renderStageResult(pass, achieved, target) {
  const s = run.stageStats;
  const overPct = Math.round((achieved / target) * 100);
  qs('#stage-result-title').textContent = `스테이지 ${run.stage} 클리어!`;
  const body = qs('#stage-result-body');
  body.innerHTML = `
    <div class="stat-row"><span class="stat-label">점수</span><span class="stat-value">${achieved} / ${target} (${overPct}%)</span></div>
    <div class="stat-row ${s.perfect >= 3 ? 'is-good' : ''}"><span class="stat-label">퍼펙트 릴링</span><span class="stat-value">${s.perfect}회</span></div>
    <div class="stat-row"><span class="stat-label">신규 도감</span><span class="stat-value">${s.newFish.size}종</span></div>
    <div class="stat-row ${s.bossBig ? 'is-good' : ''}"><span class="stat-label">보스 대물</span><span class="stat-value">${s.bossBig ? '성공' : '—'}</span></div>
    <div class="reroll-banner">+ ${s.tokensGained} 리롤 토큰!</div>
    <div class="stage-result-bar">
      ${[1,2,3].map(n => `<div class="stage-result-bar-cell ${n === run.stage ? 'is-current' : ''}">${n}단계</div>`).join('')}
    </div>
  `;
  qs('#stage-result-next').onclick = () => {
    enterStage(run.stage + 1);
  };
}

// ============================================================
// 13. RUN 종료
// ============================================================
function finishRun(win) {
  // RUN 전체 통계
  const renown = Math.floor(run.totalScore / 10) + (win ? CONFIG.RUN.stages * CONFIG.META_RENOWN_PER_STAGE : (run.stage - 1) * CONFIG.META_RENOWN_PER_STAGE);
  meta.renown += renown;
  meta.stats.totalRuns += 1;
  if (win) meta.stats.clears += 1;
  meta.stats.bestRunScore = Math.max(meta.stats.bestRunScore, run.totalScore);
  save();

  showScreen('run-result');
  qs('#run-result-title').textContent = win ? '🎉 출조 성공!' : '출조 종료';
  qs('#run-result-body').innerHTML = `
    <div class="stat-row"><span class="stat-label">총 점수</span><span class="stat-value">${run.totalScore}</span></div>
    <div class="stat-row"><span class="stat-label">클리어 스테이지</span><span class="stat-value">${run.stage - 1} / ${CONFIG.RUN.stages}</span></div>
    <div class="stat-row"><span class="stat-label">잡은 물고기</span><span class="stat-value">${run.runStats.caughtFish.length}마리</span></div>
    <div class="stat-row is-good"><span class="stat-label">획득 명성</span><span class="stat-value">+${renown}</span></div>
    <div class="stat-row"><span class="stat-label">최고 어종</span><span class="stat-value">${bestFishOfRun()}</span></div>
  `;
  // 부활 버튼 (MVP: 즉시 부활)
  const adBtn = qs('button[data-action="ad-revive"]');
  if (adBtn) adBtn.style.display = run.pendingRevive ? 'none' : '';
}

function bestFishOfRun() {
  if (run.runStats.caughtFish.length === 0) return '—';
  return run.runStats.caughtFish.reduce((a, b) => a.score > b.score ? a : b).name;
}

function adRevive() {
  if (!run) return;
  run.bait += 4;
  run.pendingRevive = true;
  toast('미끼 +4 (부활)', 'good');
  enterStage(1); // 새 RUN으로 시작 (단순화)
}

// ============================================================
// 14. 도감
// ============================================================
function registerEncyclopedia(fishId, sizeRoll) {
  if (!meta.encyclopedia[fishId]) {
    meta.encyclopedia[fishId] = { firstDate: Date.now(), maxSize: sizeRoll, count: 1 };
  } else {
    const e = meta.encyclopedia[fishId];
    e.count += 1;
    e.maxSize = Math.max(e.maxSize, sizeRoll);
  }
  save();
}

function renderCodex() {
  const wrap = qs('#codex-grid');
  wrap.innerHTML = '';
  const caught = Object.keys(meta.encyclopedia).length;
  qs('#codex-count').textContent = `${caught} / ${FISH.length}`;
  for (const f of FISH) {
    const e = meta.encyclopedia[f.id];
    const div = document.createElement('div');
    div.className = 'codex-cell ' + (e ? '' : 'is-locked');
    div.innerHTML = e
      ? `<div class="codex-cell-name">${f.name}</div>
         <div class="codex-cell-meta">최대 ${e.maxSize}cm · ${e.count}회</div>`
      : `<div class="codex-cell-name">???</div>
         <div class="codex-cell-meta">미등록</div>`;
    wrap.appendChild(div);
  }
}

// ============================================================
// 15. META_HUB 렌더
// ============================================================
function renderMeta() {
  qs('#meta-renown').textContent = meta.renown;
  qs('#meta-total-runs').textContent = meta.stats.totalRuns;
  qs('#meta-best-score').textContent = meta.stats.bestRunScore;
  const caught = Object.keys(meta.encyclopedia).length;
  qs('#meta-codex-count').textContent = `${caught} / ${FISH.length}`;
  qs('#title-renown').textContent = `명성 ${meta.renown}`;
}

// ============================================================
// 16. 입력 — 스페이스바/탭
// ============================================================
let spaceDown = false;
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
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
// 화면 탭도 캐스팅 입력
document.addEventListener('pointerdown', (e) => {
  // 버튼 위가 아니면
  if (e.target.closest('button')) return;
  handleSpace(true);
});
document.addEventListener('pointerup', () => handleSpace(false));

function handleSpace(down) {
  if (!run || !cast) return;
  if (cast.phase === 'CAST' && down) {
    // 게이지 멈춤 → 정확도 산출
    cast.accuracy = 1 - Math.abs(50 - cast.gaugePos) / 50; // 0~1
    // 게이지 정확도 보정: 명세 0.8 + (정확도 * 0.4) → 0.8~1.2
    // 게이지 50에서 멈추면 정확도 1.0
    // 미끼 1 소모
    run.bait -= 1;
    if (run.bait < 0) run.bait = 0;
    setFishingHUD();
    // DRIFT 진입
    cast.phase = 'DRIFT';
    cast.bitDelayMs = randInt(CONFIG.BITE_DELAY_MS[0], CONFIG.BITE_DELAY_MS[1]);
  } else if (cast.phase === 'BITE' && down) {
    // 훅셋
    const elapsed = performance.now() - cast.biteStartMs;
    if (elapsed <= cast.bitWindow) {
      // REEL 진입
      cast.phase = 'REEL';
      cast.tension = 50;
      cast.progress = 0;
      cast.reelTimeMs = CONFIG.REEL.timeLimitMs;
      cast.fishState = 'relax';
      cast.nextSwitchMs = randInt(500, 1200);
      setFishingPhase('REEL');
    } else {
      // 놓침
      finalizeCast(false, false);
    }
  }
}

// ============================================================
// 17. 버튼 클릭 라우팅
// ============================================================
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const action = t.dataset.action;
  switch (action) {
    case 'goto-title':    run = null; renderMeta(); showScreen('title'); break;
    case 'goto-meta':     run = null; renderMeta(); showScreen('meta'); break;
    case 'goto-codex':    renderCodex(); showScreen('codex'); break;
    case 'goto-shop':     renderMetaShop(); showScreen('meta-shop'); break;
    case 'start-run':     startRun(); showRunMap(); break;
    case 'reroll-reward': rerollReward(); break;
    case 'reroll-shop':   rerollShop(); break;
    case 'leave-shop':    advanceAfterNode(); break;
    case 'ad-revive':     adRevive(); break;
  }
});

// ============================================================
// 18. 보상 진입 (fishing 완료 후)
// ============================================================
const _origAdvance = advanceAfterNode;
advanceAfterNode = function() {
  // 보상 화면이 필요한 노드 (fishing/hotspot 완료 후)?
  if (run && (run.currentNode?.type === 'fishing' || run.currentNode?.type === 'hotspot')) {
    enterReward();
    return;
  }
  _origAdvance();
};

// ============================================================
// 19. 초기 진입
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  renderMeta();
  showScreen('title');
});