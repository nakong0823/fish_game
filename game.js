/* ============================================================
   Case & Reel — Stage 3
   - 라이브러리 0개, vanilla JS + Canvas2D
   - file:// 동작: fetch 실패 시 폴백 데이터 사용
   - 상태머신: TITLE → PLAY(7페이즈) → RESULT / SHOP
   - Stage 2: 어종 3종 + 크기 기록(localStorage) + 결과 모달 폴리시
   - Stage 2+: 콤보 / FLURRY / 대물 예고
   - Stage 3: 코인·업그레이드 3축(Rod/Reel/Bait) + 영구 저장 + SHOP 화면
   ============================================================ */

(() => {
  'use strict';

  // ----------------------------------------------------------
  // CONFIG — 밸런싱 수치를 한곳에서 관리
  // ----------------------------------------------------------
  const CONFIG = {
    // 세션
    baitPerRun: 10,

    // CAST
    castPingpongSpeed: 140,   // 파워 게이지 왕복 속도 (units/sec)
    castZone:    { min: 35, max: 100 }, // 성공 영역
    perfectZone: { min: 90, max: 100 }, // PERFECT 영역

    // DRIFT / BITE
    driftMin: 1.5,
    driftMax: 4.0,
    biteWindow: 1.2,

    // REEL
    reelBaseRate: 40,
    reelBoostRate: 70,

    // 연출
    catchAnimTime: 0.8,
    missAnimTime: 0.6,
    toastTime: 0.7,

    // 점수
    score: { castOk: 10, perfect: 20 },

    // Stage 2 — 도감/신기록
    codexKey: 'case_reel.codex.v1',
    economyKey: 'case_reel.economy.v1',
    recordBonusPerCm: 2,   // 신기록 갱신 시 cm당 가산

    // Stage 2+ — 콤보 / FLURRY / 대물 예고
    comboKeep: 3,          // 콤보 유지 (마지막 캐스트 후 이 시간 내 catch 해야 콤보 유지)
    comboMax: 10,          // 표시 콤보 캡
    flurryAt: 5,           // 5콤보에서 FLURRY 발동
    flurryDuration: 5,     // FLURRY 5초 (어획 점수 ×1.5)
    flurryMult: 1.5,
    bigFishDiff: 1.3,      // 이 이상이면 대물 — BITE 윈도우 살짝 길어짐
    bigFishBiteBonus: 0.3, // 대물 BITE 추가 시간(초)
  };

  // 폴백 데이터 (fetch 실패 대비, file:// 대응)
  const FALLBACK_FISH = {
    version: 4,
    fish: [
      {
        id: 'mackerel', name_ko: '고등어', name_en: 'Mackerel',
        rarity: 'common', size: 'S', region: 'east_breakwater', time: 'all',
        scoreMin: 30, scoreMax: 60, coin: 1, reelDifficulty: 1.0,
        sizeMinCm: 28, sizeMaxCm: 42, weight: 50,
        title: '연습용 입문어', color: '#7A8C99', body: 'oval', tail: 'forked',
        codex: '은빛 줄무늬, 빠른 회수. 입문자에게 익숙한 맛.',
        locked: false,
      },
      {
        id: 'horse_mackerel', name_ko: '전갱이', name_en: 'Horse Mackerel',
        rarity: 'common', size: 'S', region: 'east_breakwater', time: 'all',
        scoreMin: 35, scoreMax: 70, coin: 2, reelDifficulty: 1.0,
        sizeMinCm: 25, sizeMaxCm: 38, weight: 35,
        title: '동해의 은빛 미끼', color: '#A8C0BF', body: 'slender', tail: 'forked',
        codex: '고등어보다 살짝 큰 코인. 가늘고 빠르다.',
        locked: false,
      },
      {
        id: 'rockfish', name_ko: '우럭', name_en: 'Rockfish',
        rarity: 'common', size: 'M', region: 'east_breakwater', time: 'all',
        scoreMin: 60, scoreMax: 110, coin: 3, reelDifficulty: 1.4,
        sizeMinCm: 22, sizeMaxCm: 45, weight: 15,
        title: '방파제의 큰놈', color: '#C24A3A', body: 'stocky', tail: 'rounded',
        codex: '드물게 큰 놈이 나옴. 신기록 가능성, 파이팅이 길다.',
        locked: false,
      },
      { id: 'sea_bream',     name_ko: '??', rarity: 'rare',      region: 'south_rocky', locked: true },
      { id: 'red_snapper',   name_ko: '??', rarity: 'rare',      region: 'south_rocky', locked: true },
      { id: 'hairtail',      name_ko: '??', rarity: 'rare',      region: 'south_rocky', locked: true },
      { id: 'cuttlefish',    name_ko: '??', rarity: 'rare',      region: 'south_rocky', locked: true },
      { id: 'yellowtail',    name_ko: '??', rarity: 'rare',      region: 'open_sea',    locked: true },
      { id: 'tuna',          name_ko: '??', rarity: 'epic',      region: 'open_sea',    locked: true },
      { id: 'cod',           name_ko: '??', rarity: 'epic',      region: 'open_sea',    locked: true },
      { id: 'ocean_sunfish', name_ko: '??', rarity: 'legendary', region: 'open_sea',    locked: true },
      { id: 'rainbow_fish',  name_ko: '??', rarity: 'legendary', region: 'event',       locked: true },
    ],
  };

  // ----------------------------------------------------------
  // 유틸
  // ----------------------------------------------------------
  const rand = (min, max) => Math.random() * (max - min) + min;
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function pingpong(t, speed, span) {
    // 0→span→0 왕복 (속도 units/sec, span 총 길이)
    const period = (span * 2) / speed;
    const phase = (t % period) / period; // 0..1
    return phase < 0.5
      ? phase * 2 * span
      : (1 - (phase - 0.5) * 2) * span;
  }

  // ----------------------------------------------------------
  // 데이터 로더 (fetch + 폴백)
  // ----------------------------------------------------------
  async function loadFishData() {
    try {
      const res = await fetch('data/fish.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!data || !Array.isArray(data.fish) || data.fish.length === 0) {
        throw new Error('Empty fish array');
      }
      return data;
    } catch (err) {
      console.warn('[Case&Reel] fetch 실패 → 폴백 데이터 사용:', err.message);
      return FALLBACK_FISH;
    }
  }

  // 폴백 경제 데이터 (Stage 3)
  const FALLBACK_ECONOMY = {
    version: 1,
    upgrades: [
      {
        id: 'rod',
        name_ko: '낚싯대', name_en: 'Rod', icon: '🎣', maxLevel: 5,
        costs: [30, 80, 180, 380, 800],
        effectPerLevel: { perfectZoneMinDelta: -1 },
        descPerLevel: [
          'PERFECT 1% 더 넓어짐', 'PERFECT 1% 더 넓어짐',
          'PERFECT 1% 더 넓어짐', 'PERFECT 1% 더 넓어짐', '최대 업그레이드',
        ],
        summary: 'PERFECT 구간을 조금씩 넓혀 큰 점수를 더 자주 받습니다.',
      },
      {
        id: 'reel',
        name_ko: '릴', name_en: 'Reel', icon: '🌀', maxLevel: 5,
        costs: [30, 80, 180, 380, 800],
        effectPerLevel: { reelBaseRateDelta: 6, reelBoostRateDelta: 10 },
        descPerLevel: [
          'REEL 자동 +6, 부스트 +10 (%/s)', 'REEL 자동 +6, 부스트 +10',
          'REEL 자동 +6, 부스트 +10', 'REEL 자동 +6, 부스트 +10', '최대 업그레이드',
        ],
        summary: 'REEL 속도가 빨라져 손맛이 좋아집니다.',
      },
      {
        id: 'bait',
        name_ko: '미끼통', name_en: 'Bait', icon: '🪱', maxLevel: 5,
        costs: [30, 80, 180, 380, 800],
        effectPerLevel: { baitPerRunDelta: 2, comboKeepDelta: 0.4 },
        descPerLevel: [
          '출조 미끼 +2, 콤보 유지 +0.4s', '출조 미끼 +2, 콤보 유지 +0.4s',
          '출조 미끼 +2, 콤보 유지 +0.4s', '출조 미끼 +2, 콤보 유지 +0.4s', '최대 업그레이드',
        ],
        summary: '한 판에 더 오래, 콤보를 더 오래 유지할 수 있습니다.',
      },
    ],
  };

  async function loadEconomyData() {
    try {
      const res = await fetch('data/economy.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!data || !Array.isArray(data.upgrades) || data.upgrades.length === 0) {
        throw new Error('Empty upgrades array');
      }
      return data;
    } catch (err) {
      console.warn('[Case&Reel] economy.json fetch 실패 → 폴백 데이터 사용:', err.message);
      return FALLBACK_ECONOMY;
    }
  }

  // ----------------------------------------------------------
  // Input 어댑터 (후속 단계에서 터치 확장 가능)
  // ----------------------------------------------------------
  function makeInput(actionOnPress, actionOnRelease) {
    const keys = new Set();
    const mouse = { down: false };

    function onKeyDown(e) {
      if (e.code === 'Space' || e.code === 'Enter') {
        if (!keys.has(e.code)) {
          keys.add(e.code);
          e.preventDefault();
          actionOnPress();
        } else {
          e.preventDefault();
        }
      }
    }
    function onKeyUp(e) {
      if (e.code === 'Space' || e.code === 'Enter') {
        keys.delete(e.code);
        e.preventDefault();
        actionOnRelease();
      }
    }
    function onMouseDown(e) {
      if (e.button !== 0) return;
      if (!mouse.down) {
        mouse.down = true;
        actionOnPress();
      }
    }
    function onMouseUp(e) {
      if (e.button !== 0) return;
      mouse.down = false;
      actionOnRelease();
    }
    function onContextMenu(e) { e.preventDefault(); }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('contextmenu', onContextMenu);

    return {
      isPressed() { return mouse.down || keys.has('Space') || keys.has('Enter'); },
    };
  }

  // ----------------------------------------------------------
  // 게임 본체
  // ----------------------------------------------------------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  // HUD DOM
  const elScore   = document.querySelector('#score strong');
  const elBait    = document.querySelector('#bait strong');
  const elCombo   = document.querySelector('#combo strong');
  const elFlurry  = document.querySelector('#flurry strong');
  const elCoins   = document.querySelector('#coins strong');
  const elVignette = document.getElementById('vignette');
  const elToast   = document.getElementById('toast');
  const elTitle   = document.getElementById('title');
  const elModal   = document.getElementById('modal');
  const elShop    = document.getElementById('shop');
  const elCodex   = document.getElementById('codex');
  const elFinalS  = document.getElementById('final-score');
  const elFinalC  = document.getElementById('final-catch');
  const btnAgain  = document.getElementById('again');
  const btnShop   = document.getElementById('btn-shop');
  const btnShopClose = document.getElementById('btn-shop-close');
  const btnCodex  = document.getElementById('btn-codex');
  const btnCodexClose = document.getElementById('btn-codex-close');

  // 게임 상태
  const STATE = { TITLE: 'TITLE', PLAY: 'PLAY', RESULT: 'RESULT', SHOP: 'SHOP', CODEX: 'CODEX' };
  const PHASE = {
    IDLE: 'IDLE',
    CASTING: 'CASTING',
    DRIFT: 'DRIFT',
    BITE: 'BITE',
    REELING: 'REELING',
    CATCH: 'CATCH',
    MISS: 'MISS',
  };

  const game = {
    state: STATE.TITLE,
    phase: PHASE.IDLE,

    // 세션
    score: 0,
    bait: CONFIG.baitPerRun,
    catchCount: 0,

    // Stage 2 — 어종별 카운트 (key: fish.id)
    catchByFish: {},   // { mackerel: 2, horse_mackerel: 1, ... }
    newCodexIds: [],   // 이번 판에서 처음 잡은 어종
    records: [],       // 이번 판 신기록 목록 [{id, name_ko, sizeCm, prevCm}]
    coinsEarned: 0,    // 이번 판 코인 합계

    // Stage 2+ — 콤보 / FLURRY
    combo: 0,              // 현재 콤보
    maxCombo: 0,           // 최장 콤보
    flurryCount: 0,        // 이번 판 FLURRY 발동 횟수
    flurryLeft: 0,         // FLURRY 남은 시간(초)
    lastCatchT: 0,         // 마지막 catch 시각(누적)
    baitZeroT: 0,          // 미끼 0 긴장 연출 남은 시간

    // 페이즈별 타이머
    castT: 0,        // CASTING: 핑퐁 누적 시간
    driftLeft: 0,    // DRIFT: 남은 시간(초)
    biteLeft: 0,     // BITE: PULL 윈도우 남은 시간
    reelPct: 0,      // REELING: 0~100
    animT: 0,        // CATCH / MISS 연출 남은 시간
    toastT: 0,       // 토스트 페이드

    // 어종 카탈로그 (1종)
    fish: null,
    activeFish: null, // 현재 잡은/잡으려는 어종

    // PERFECT 캐스트 여부 (이 단계는 표시만)
    lastCastPerfect: false,
  };

  // ----------------------------------------------------------
  // 상태/페이즈 전환
  // ----------------------------------------------------------
  function changeState(next) {
    if (game.state === next) return;
    game.state = next;
    if (next === STATE.TITLE) {
      elTitle.classList.remove('hidden');
      elModal.classList.add('hidden');
      elShop.classList.add('hidden');
      elCodex.classList.add('hidden');
    } else if (next === STATE.PLAY) {
      // 세션 초기화
      game.score = 0;
      game.bait = RT.baitPerRun;
      game.catchCount = 0;
      game.lastCastPerfect = false;
      game.catchByFish = {};
      game.newCodexIds = [];
      game.records = [];
      game.coinsEarned = 0;
      game.combo = 0;
      game.maxCombo = 0;
      game.flurryCount = 0;
      game.flurryLeft = 0;
      game.lastCatchT = 0;
      game.baitZeroT = 0;
      enterPhase(PHASE.IDLE);
      elTitle.classList.add('hidden');
      elModal.classList.add('hidden');
      elShop.classList.add('hidden');
      elCodex.classList.add('hidden');
    } else if (next === STATE.RESULT) {
      elFinalS.textContent = game.score;
      elFinalC.textContent = game.catchCount;
      renderResult();
      elModal.classList.remove('hidden');
      elShop.classList.add('hidden');
      elCodex.classList.add('hidden');
    } else if (next === STATE.SHOP) {
      renderShop();
      elShop.classList.remove('hidden');
      elModal.classList.add('hidden');
      elTitle.classList.add('hidden');
      elCodex.classList.add('hidden');
    } else if (next === STATE.CODEX) {
      renderCodex();
      elCodex.classList.remove('hidden');
      elShop.classList.add('hidden');
      elModal.classList.add('hidden');
      elTitle.classList.add('hidden');
    }
    updateHUD();
  }

  function enterPhase(next) {
    game.phase = next;
    if (next === PHASE.IDLE) {
      game.castT = 0;
      game.driftLeft = 0;
      game.biteLeft = 0;
      game.reelPct = 0;
      game.animT = 0;
      // 미끼 0이면 즉시 RESULT
      if (game.bait <= 0) {
        // 1.2초 긴장 연출 후 RESULT 로
        game.baitZeroT = 1.2;
        showToast('미끼 0 · 출조 종료', 'miss');
      }
    } else if (next === PHASE.CASTING) {
      game.castT = 0;
    } else if (next === PHASE.DRIFT) {
      game.driftLeft = rand(CONFIG.driftMin, CONFIG.driftMax);
      game.activeFish = pickActiveFish();
      // 대물 예고 토스트
      if (game.activeFish && game.activeFish.reelDifficulty >= CONFIG.bigFishDiff) {
        showToast('🐟 대물! ' + game.activeFish.name_ko + '  ·  REEL ' +
                  (game.activeFish.reelDifficulty.toFixed(1)) + '×', 'perfect');
      }
    } else if (next === PHASE.BITE) {
      let w = CONFIG.biteWindow;
      const f = game.activeFish;
      if (f && f.reelDifficulty && f.reelDifficulty >= CONFIG.bigFishDiff) {
        w += CONFIG.bigFishBiteBonus;
      }
      game.biteLeft = w;
    } else if (next === PHASE.REELING) {
      game.reelPct = 0;
    } else if (next === PHASE.CATCH) {
      game.animT = CONFIG.catchAnimTime;
    } else if (next === PHASE.MISS) {
      game.animT = CONFIG.missAnimTime;
    }
  }

  // ----------------------------------------------------------
  // 입력 처리
  // ----------------------------------------------------------
  // PRESS: TITLE→PLAY, BITE 윈도우 내 → REELING, CATCH/MISS 연출 중 무시, RESULT에서 한 판 더
  // RELEASE: CASTING → 판정
  function onPress() {
    if (game.state === STATE.TITLE) {
      changeState(STATE.PLAY);
      return;
    }
    if (game.state === STATE.RESULT) {
      changeState(STATE.PLAY);
      return;
    }
    if (game.state === STATE.SHOP) {
      // SHOP 화면에서 스페이스/클릭은 무시 (각 카드 버튼으로 구매)
      return;
    }
    if (game.state === STATE.CODEX) {
      // CODEX 화면에서 스페이스/클릭은 무시
      return;
    }
    if (game.state !== STATE.PLAY) return;

    if (game.phase === PHASE.IDLE) {
      // 콤보 시간 초과 검사
      if (game.combo > 0 && game.lastCatchT > 0) {
        const now = performance.now() / 1000;
        if ((now - game.lastCatchT) > RT.comboKeep) {
          game.combo = 0;
          game.lastCatchT = 0;
        }
      }
      enterPhase(PHASE.CASTING);
    } else if (game.phase === PHASE.BITE) {
      // PULL 성공 → REELING
      enterPhase(PHASE.REELING);
    } else if (game.phase === PHASE.CATCH || game.phase === PHASE.MISS) {
      // 연출 중 입력 무시
    } else if (game.phase === PHASE.REELING) {
      // 가속은 isPressed()로 매 프레임 체크 (아래 update에서)
    }
  }

  function onRelease() {
    if (game.state !== STATE.PLAY) return;
    if (game.phase === PHASE.CASTING) {
      const power = pingpong(game.castT, CONFIG.castPingpongSpeed, 100);
      const inZone    = power >= CONFIG.castZone.min    && power <= CONFIG.castZone.max;
      const perfect   = power >= CONFIG.perfectZone.min && power <= CONFIG.perfectZone.max;
      // 성공/실패 무관 미끼 -1
      game.bait = Math.max(0, game.bait - 1);
      game.lastCastPerfect = perfect;

      if (inZone) {
        if (perfect) {
          game.score += CONFIG.score.perfect;
          showToast('PERFECT! +' + CONFIG.score.perfect, 'perfect');
        } else {
          game.score += CONFIG.score.castOk;
          showToast('CAST +' + CONFIG.score.castOk, 'score');
        }
        enterPhase(PHASE.DRIFT);
      } else {
        showToast('FAIL', 'fail');
        enterPhase(PHASE.IDLE);
      }
      updateHUD();
    }
  }

  // ----------------------------------------------------------
  // 업데이트 (고정 timestep dt=1/60, accumulator 방식)
  // ----------------------------------------------------------
  const FIXED_DT = 1 / 60;
  let acc = 0;
  let lastT = performance.now();

  function tick(now) {
    const elapsed = Math.min(0.1, (now - lastT) / 1000);
    lastT = now;
    acc += elapsed;
    while (acc >= FIXED_DT) {
      update(FIXED_DT);
      acc -= FIXED_DT;
    }
    render();
    requestAnimationFrame(tick);
  }

  function update(dt) {
    if (game.state !== STATE.PLAY) return;

    switch (game.phase) {
      case PHASE.CASTING: {
        game.castT += dt;
        break;
      }
      case PHASE.DRIFT: {
        game.driftLeft -= dt;
        if (game.driftLeft <= 0) enterPhase(PHASE.BITE);
        break;
      }
      case PHASE.BITE: {
        game.biteLeft -= dt;
        if (game.biteLeft <= 0) {
          // 윈도우 초과 → MISS + 콤보 리셋
          if (game.combo > 0) {
            showToast('MISS · 콤보 리셋 (' + game.combo + ')', 'miss');
          } else {
            showToast('MISS', 'miss');
          }
          game.combo = 0;
          game.lastCatchT = 0;
          enterPhase(PHASE.MISS);
        }
        break;
      }
      case PHASE.REELING: {
        const baseRate = input.isPressed() ? RT.reelBoostRate : RT.reelBaseRate;
        const diff = game.activeFish && game.activeFish.reelDifficulty
                     ? game.activeFish.reelDifficulty : 1.0;
        const rate = baseRate / diff;  // difficulty 1.4 우럭은 1.4배 오래
        game.reelPct += rate * dt;
        if (game.reelPct >= 100) {
          game.reelPct = 100;
          onCatch();
          enterPhase(PHASE.CATCH);
          updateHUD();
        }
        break;
      }
      case PHASE.CATCH:
      case PHASE.MISS: {
        game.animT -= dt;
        if (game.animT <= 0) enterPhase(PHASE.IDLE);
        break;
      }
    }

    // 토스트 페이드
    if (game.toastT > 0) {
      game.toastT -= dt;
      if (game.toastT <= 0) hideToast();
    }

    // FLURRY 카운트다운
    if (game.flurryLeft > 0) {
      game.flurryLeft = Math.max(0, game.flurryLeft - dt);
      // HUD 갱신 (남은 초가 바뀔 때만)
      if (Math.ceil(game.flurryLeft) !== _lastFlurryShown) {
        _lastFlurryShown = Math.ceil(game.flurryLeft);
        updateHUD();
      }
      if (game.flurryLeft === 0) updateHUD();
    }

    // 미끼 0 긴장 카운트다운
    if (game.baitZeroT > 0) {
      game.baitZeroT = Math.max(0, game.baitZeroT - dt);
      if (game.baitZeroT === 0) {
        changeState(STATE.RESULT);
      }
    }
  }
  let _lastFlurryShown = -1;

  // ----------------------------------------------------------
  // 렌더
  // ----------------------------------------------------------
  function render() {
    // 배경 (바다 그라데이션은 CSS에서 처리 — canvas는 투명 위에 그린다)
    ctx.clearRect(0, 0, W, H);

    drawBoatAndSea();

    if (game.state === STATE.PLAY) {
      drawPhaseUI();
    }
  }

  function drawBoatAndSea() {
    // 수평선
    const horizon = H * 0.55;
    ctx.fillStyle = '#FDF6E3';
    ctx.fillRect(0, horizon, W, H - horizon);

    // 파도 라인
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const y = horizon + 12 + i * 22;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 12) {
        const yy = y + Math.sin((x + i * 30 + performance.now() / 600) * 0.04) * 2;
        if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    // 배 (왼쪽)
    const bx = 110, by = horizon - 8;
    ctx.fillStyle = '#F4A261';   // sand
    ctx.beginPath();
    ctx.moveTo(bx - 50, by);
    ctx.lineTo(bx + 50, by);
    ctx.lineTo(bx + 35, by + 24);
    ctx.lineTo(bx - 35, by + 24);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#2B7A9B';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 캐릭터 (작은 인형)
    ctx.fillStyle = '#264653';
    ctx.beginPath();
    ctx.arc(bx, by - 14, 10, 0, Math.PI * 2);
    ctx.fill();
    // 몸통
    ctx.fillRect(bx - 6, by - 6, 12, 18);

    // 낚싯대 (캐스팅 중이면 위로 휨)
    drawRod(bx, by - 6);

    // 바늘 (낚싯바늘): 페이즈에 따라 위치/표시
    drawActiveFish();
  }

  function drawRod(ox, oy) {
    ctx.save();
    ctx.translate(ox, oy);
    let angle = -Math.PI / 4;
    if (game.phase === PHASE.CASTING) {
      // 홀드 중 흔들기
      angle = -Math.PI / 4 - Math.sin(performance.now() / 120) * 0.05;
    }
    ctx.rotate(angle);
    ctx.strokeStyle = '#2B2A2A';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(110, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawActiveFish() {
    // 페이즈별 가시성/위치
    const visible = (game.phase === PHASE.DRIFT || game.phase === PHASE.BITE ||
                     game.phase === PHASE.REELING);
    if (!visible) return;
    const f = game.activeFish;
    if (!f) return;

    // 바늘 위치: DRIFT/BITE는 바다 위 표류, REELING은 위로 올라오는 중
    let hx, hy;
    if (game.phase === PHASE.REELING) {
      hx = 220 + (1 - game.reelPct / 100) * 350;
      hy = H * 0.55 + 10 - (game.reelPct / 100) * 30;
    } else {
      hx = 240 + Math.sin(performance.now() / 300) * 8;
      hy = H * 0.62;
    }

    // 줄
    const isBig = f.reelDifficulty && f.reelDifficulty >= CONFIG.bigFishDiff;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = isBig ? 2.2 : 1;
    ctx.beginPath();
    ctx.moveTo(110 + 80, H * 0.55 - 6);
    if (isBig && game.phase === PHASE.DRIFT) {
      const wave = Math.sin(performance.now() / 80) * 6;
      ctx.lineTo((110 + 80 + hx) / 2, (H * 0.55 - 6 + hy) / 2 + wave);
    }
    ctx.lineTo(hx, hy);
    ctx.stroke();

    // 어종별 크기/모양
    const bodySize = f.size === 'M' ? 1.35 : (f.size === 'S' ? 1.0 : 1.0);
    const len = 18 * bodySize;
    const tailW = f.tail === 'rounded' ? 5 : 8;
    const color = f.color || '#1a1a1a';
    const isReeling = game.phase === PHASE.REELING;
    const w = isReeling ? (1 - game.reelPct / 100) * 0.6 + 0.4 : 1; // 0.4 → 1.0 흔들림

    ctx.save();
    ctx.translate(hx, hy);
    ctx.scale(w, 1);
    // body shape: oval (기본), slender (가늘게), stocky (두껍게)
    if (f.body === 'slender') {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, len, len * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (f.body === 'stocky') {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, len * 0.85, len * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, len, len * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // tail
    ctx.fillStyle = color;
    if (f.tail === 'rounded') {
      ctx.beginPath();
      ctx.arc(-len, 0, tailW, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // forked
      ctx.beginPath();
      ctx.moveTo(-len, 0);
      ctx.lineTo(-len - tailW, -tailW * 0.7);
      ctx.lineTo(-len - tailW * 0.4, 0);
      ctx.lineTo(-len - tailW, tailW * 0.7);
      ctx.closePath();
      ctx.fill();
    }
    // eye
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(len * 0.55, -len * 0.2, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(len * 0.55, -len * 0.2, 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // 어종 명찰 (DRIFT/BITE 페이즈에서만)
    if (game.phase !== PHASE.REELING) {
      ctx.fillStyle = 'rgba(15,42,56,0.75)';
      ctx.fillRect(hx - 30, hy - 28, 60, 16);
      ctx.fillStyle = '#fff';
      ctx.font = '600 11px -apple-system, "Apple SD Gothic Neo", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.name_ko, hx, hy - 17);
    }
  }

  function drawPhaseUI() {
    switch (game.phase) {
      case PHASE.IDLE: return;
      case PHASE.CASTING: drawCastGauge(); break;
      case PHASE.DRIFT:   drawDriftIndicator(); break;
      case PHASE.BITE:    drawBiteBar(); break;
      case PHASE.REELING: drawReelGauge(); break;
      case PHASE.CATCH:   drawCatchFx(); break;
      case PHASE.MISS:    drawMissFx(); break;
    }
  }

  function drawCastGauge() {
    const power = pingpong(game.castT, CONFIG.castPingpongSpeed, 100);
    const x = W / 2 - 160, y = H - 70, w = 320, h = 22;

    // 배경
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x, y, w, h);

    // 파워 채움
    const pw = (power / 100) * w;
    const grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, '#4FB3D9');
    grad.addColorStop(0.5, '#FFD166');
    grad.addColorStop(1, '#E76F51');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, pw, h);

    // 성공 / PERFECT 영역 표시
    drawZone(x + (CONFIG.castZone.min / 100) * w, x + (CONFIG.castZone.max / 100) * w, y, h, 'rgba(255,255,255,0.25)');
    drawZone(x + (CONFIG.perfectZone.min / 100) * w, x + (CONFIG.perfectZone.max / 100) * w, y, h, 'rgba(231,111,81,0.6)');

    // 라벨
    ctx.fillStyle = '#fff';
    ctx.font = '600 14px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CAST 파워  (스페이스 떼면 발사)', W / 2, y - 8);
  }

  function drawZone(x0, x1, y, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x0, y, x1 - x0, h);
  }

  function drawDriftIndicator() {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(W / 2 - 80, 40, 160, 26);
    ctx.fillStyle = '#fff';
    ctx.font = '600 14px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('입질 대기…', W / 2, 58);
  }

  function drawBiteBar() {
    const w = 360, h = 18;
    const x = W / 2 - w / 2, y = H / 2 - h / 2;

    // 노랑→빨강
    const ratio = 1 - (game.biteLeft / CONFIG.biteWindow);
    const r = Math.floor(255);
    const g = Math.floor(209 + (67 - 209) * ratio);
    const b = Math.floor(102 + (70 - 102) * ratio);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, y, w, h);

    // 테두리
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // 라벨
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '700 16px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('입질!  PULL', W / 2, y - 8);
  }

  function drawReelGauge() {
    const w = 420, h = 24;
    const x = W / 2 - w / 2, y = H - 80;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#E76F51';
    ctx.fillRect(x, y, (game.reelPct / 100) * w, h);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#fff';
    ctx.font = '600 14px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.textAlign = 'center';
    const f = game.activeFish;
    const sub = f ? ` · ${f.name_ko}${f.reelDifficulty && f.reelDifficulty > 1 ? ` (×${f.reelDifficulty.toFixed(1)})` : ''}` : '';
    const baseLabel = input && input.isPressed() ? Math.round(RT.reelBoostRate) : Math.round(RT.reelBaseRate);
    ctx.fillText('REEL  ' + Math.floor(game.reelPct) + '%' + sub + '  [' + baseLabel + '%/s]', W / 2, y - 8);
  }

  function drawCatchFx() {
    const t = 1 - (game.animT / CONFIG.catchAnimTime);
    const a = 1 - t;
    const f = game.activeFish;
    const color = (f && f.color) ? f.color : '#FFD166';
    const sizeBoost = f && f.size === 'M' ? 1.4 : 1.0;

    // 컬러 버스트 (어종 색)
    ctx.fillStyle = hexToRgba(color, 0.45 * a);
    ctx.beginPath();
    ctx.arc(W / 2, H * 0.55, 30 + t * 90 * sizeBoost, 0, Math.PI * 2);
    ctx.fill();
    // 노란 링
    ctx.strokeStyle = `rgba(255, 209, 102, ${0.9 * a})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(W / 2, H * 0.55, 24 + t * 70 * sizeBoost, 0, Math.PI * 2);
    ctx.stroke();

    // CATCH! 라벨
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '800 30px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CATCH!', W / 2, H * 0.55 - 64 - t * 18);

    // 어종 칭호 (작게)
    if (f) {
      ctx.fillStyle = hexToRgba(color, 0.85);
      ctx.font = '700 14px -apple-system, "Apple SD Gothic Neo", sans-serif';
      ctx.fillText(`${f.name_ko}  ·  ${f.title || ''}`, W / 2, H * 0.55 - 38 - t * 12);
    }
  }

  // '#RRGGBB' 와 알파를 받아 rgba 문자열 반환
  function hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function drawMissFx() {
    const t = 1 - (game.animT / CONFIG.missAnimTime);
    ctx.fillStyle = `rgba(200, 200, 200, ${0.7 * (1 - t)})`;
    ctx.font = '700 22px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('…놓침', W / 2, H * 0.5 - t * 20);
  }

  // ----------------------------------------------------------
  // HUD / 토스트
  // ----------------------------------------------------------
  function updateHUD() {
    elScore.textContent = game.score;
    elBait.textContent = game.bait;
    if (elCoins) elCoins.textContent = economy.data.coins;
    // 콤보 표시
    const comboEl = document.getElementById('combo');
    if (comboEl) {
      if (game.combo > 1) {
        elCombo.textContent = Math.min(game.combo, CONFIG.comboMax);
        comboEl.classList.remove('hidden');
      } else {
        comboEl.classList.add('hidden');
      }
    }
    // FLURRY 표시 (남은 시간)
    const flurryEl = document.getElementById('flurry');
    if (flurryEl) {
      if (game.flurryLeft > 0) {
        elFlurry.textContent = Math.ceil(game.flurryLeft) + 's';
        flurryEl.classList.remove('hidden');
      } else {
        flurryEl.classList.add('hidden');
      }
    }
  }

  function showToast(text, kind) {
    elToast.textContent = text;
    elToast.className = 'toast' + (kind ? ' ' + kind : '');
    game.toastT = CONFIG.toastTime;
  }
  function hideToast() {
    elToast.classList.add('hidden');
  }

  // 화면 비네트 — 신기록 갱신 시 1.4초 플래시
  function flashVignette() {
    if (!elVignette) return;
    elVignette.classList.remove('hidden');
    // 강제 리플로우 후 클래스 재부여 (연속 트리거 대비)
    void elVignette.offsetWidth;
    elVignette.classList.add('flash');
    setTimeout(() => {
      elVignette.classList.remove('flash');
      elVignette.classList.add('hidden');
    }, 1500);
  }

  // ----------------------------------------------------------
  // Stage 2 — 도감 (localStorage, 신기록/신규 등록)
  // ----------------------------------------------------------
  // 스키마: { caughtAt: { [fishId]: ISO }, records: { [fishId]: maxCm } }
  const codex = {
    data: { caughtAt: {}, records: {} },
    load() {
      try {
        const raw = localStorage.getItem(CONFIG.codexKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.data.caughtAt = parsed.caughtAt || {};
          this.data.records  = parsed.records  || {};
        }
      } catch (e) {
        console.warn('[Case&Reel] 도감 로드 실패 — 빈 도감으로 시작', e.message);
        this.data = { caughtAt: {}, records: {} };
      }
    },
    save() {
      try { localStorage.setItem(CONFIG.codexKey, JSON.stringify(this.data)); }
      catch (e) { console.warn('[Case&Reel] 도감 저장 실패', e.message); }
    },
    isCaught(fishId)      { return !!this.data.caughtAt[fishId]; },
    record(fishId)        { return this.data.records[fishId] || 0; },
    register(fishId)      { if (!this.isCaught(fishId)) this.data.caughtAt[fishId] = new Date().toISOString(); },
    updateRecord(fishId, cm) {
      const prev = this.record(fishId);
      if (cm > prev) { this.data.records[fishId] = cm; return { isNew: true, prevCm: prev }; }
      return { isNew: false, prevCm: prev };
    },
  };
  codex.load();

  // ----------------------------------------------------------
  // Stage 3 — Economy (코인·업그레이드 영구 저장)
  // ----------------------------------------------------------
  // 스키마: { coins: number, levels: { [upgradeId]: level 1..maxLevel } }
  const economy = {
    data: { coins: 0, levels: {} },
    upgrades: null, // fetch 결과 채움
    load() {
      try {
        const raw = localStorage.getItem(CONFIG.economyKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.data.coins  = parsed.coins  || 0;
          this.data.levels = parsed.levels || {};
        }
      } catch (e) {
        console.warn('[Case&Reel] economy 로드 실패 — 초기화', e.message);
        this.data = { coins: 0, levels: {} };
      }
    },
    save() {
      try { localStorage.setItem(CONFIG.economyKey, JSON.stringify(this.data)); }
      catch (e) { console.warn('[Case&Reel] economy 저장 실패', e.message); }
    },
    level(uid)       { return this.data.levels[uid] || 0; },
    nextCost(uid) {
      const u = this.upgrades.find((x) => x.id === uid);
      if (!u) return null;
      const lv = this.level(uid);
      if (lv >= u.maxLevel) return null;
      return u.costs[lv] || null;
    },
    canBuy(uid) {
      const cost = this.nextCost(uid);
      return cost !== null && this.data.coins >= cost;
    },
    buy(uid) {
      if (!this.canBuy(uid)) return false;
      const cost = this.nextCost(uid);
      this.data.coins -= cost;
      this.data.levels[uid] = this.level(uid) + 1;
      this.save();
      return true;
    },
    addCoins(n) {
      if (n > 0) { this.data.coins += n; this.save(); }
    },
  };
  economy.load();

  // 업그레이드 효과 적용 — 게임 시작 시 1회 + 업그레이드 직후 1회
  // 변경 가능한 값을 별도 객체(runTime)에 저장하여 CONFIG 불변 유지
  const RT = {
    castZoneMin: CONFIG.castZone.min,
    castZoneMax: CONFIG.castZone.max,
    perfectZoneMin: CONFIG.perfectZone.min,
    perfectZoneMax: CONFIG.perfectZone.max,
    reelBaseRate: CONFIG.reelBaseRate,
    reelBoostRate: CONFIG.reelBoostRate,
    baitPerRun: CONFIG.baitPerRun,
    comboKeep: CONFIG.comboKeep,
  };
  function applyUpgrades() {
    // 기본값으로 리셋
    RT.castZoneMin    = CONFIG.castZone.min;
    RT.castZoneMax    = CONFIG.castZone.max;
    RT.perfectZoneMin = CONFIG.perfectZone.min;
    RT.perfectZoneMax = CONFIG.perfectZone.max;
    RT.reelBaseRate   = CONFIG.reelBaseRate;
    RT.reelBoostRate  = CONFIG.reelBoostRate;
    RT.baitPerRun     = CONFIG.baitPerRun;
    RT.comboKeep      = CONFIG.comboKeep;

    if (!economy.upgrades) return;
    for (const u of economy.upgrades) {
      const lv = economy.level(u.id);
      if (lv <= 0) continue;
      const e = u.effectPerLevel || {};
      if (e.perfectZoneMinDelta) RT.perfectZoneMin = Math.max(0, RT.perfectZoneMin + e.perfectZoneMinDelta * lv);
      if (e.perfectZoneMaxDelta) RT.perfectZoneMax = Math.min(100, RT.perfectZoneMax + e.perfectZoneMaxDelta * lv);
      if (e.castZoneMinDelta)    RT.castZoneMin    = Math.max(0, RT.castZoneMin + e.castZoneMinDelta * lv);
      if (e.castZoneMaxDelta)    RT.castZoneMax    = Math.min(100, RT.castZoneMax + e.castZoneMaxDelta * lv);
      if (e.reelBaseRateDelta)   RT.reelBaseRate   = RT.reelBaseRate + e.reelBaseRateDelta * lv;
      if (e.reelBoostRateDelta)  RT.reelBoostRate  = RT.reelBoostRate + e.reelBoostRateDelta * lv;
      if (e.baitPerRunDelta)     RT.baitPerRun     = RT.baitPerRun + e.baitPerRunDelta * lv;
      if (e.comboKeepDelta)      RT.comboKeep      = RT.comboKeep + e.comboKeepDelta * lv;
    }
  }
  applyUpgrades();

  // 어종 가중치 랜덤 선택
  function pickActiveFish() {
    if (!game.fish || game.fish.length === 0) return null;
    // 잠금 어종은 선택에서 제외
    const pool = game.fish.filter((f) => !f.locked);
    if (pool.length === 0) return null;
    const total = pool.reduce((s, f) => s + (f.weight || 1), 0);
    let r = Math.random() * total;
    for (const f of pool) {
      r -= (f.weight || 1);
      if (r <= 0) return f;
    }
    return pool[pool.length - 1];
  }

  // 어획 1회 처리 — 점수/카운트/도감/신기록
  function onCatch() {
    const f = game.activeFish || game.fish[0];
    if (!f) return;

    // 1) 점수
    const baseGain = randInt(f.scoreMin, f.scoreMax);
    let gain = baseGain;

    // 2) 크기(cm) 결정
    const sizeCm = +(rand(f.sizeMinCm, f.sizeMaxCm)).toFixed(1);
    const sizeBonus = Math.max(0, (sizeCm - f.sizeMinCm)) | 0; // min 초과분에 대해 가산
    gain += sizeBonus;

    // 3) 신기록 판정
    const rec = codex.updateRecord(f.id, sizeCm);
    if (rec.isNew) {
      const bonusCm = +((sizeCm - rec.prevCm) * CONFIG.recordBonusPerCm).toFixed(0);
      gain += bonusCm;
      game.records.push({ id: f.id, name_ko: f.name_ko, sizeCm, prevCm: rec.prevCm, bonus: bonusCm });
      // 신기록 비네트 (최초 등극도 동일 효과)
      flashVignette();
    }

    // 4) 도감 등록 (최초 1회)
    if (!codex.isCaught(f.id)) {
      codex.register(f.id);
      game.newCodexIds.push(f.id);
    }

    // 5) 누적
    // FLURRY 활성 시 ×1.5
    if (game.flurryLeft > 0) {
      const extra = Math.round(gain * (CONFIG.flurryMult - 1));
      gain += extra;
    }
    game.score += gain;
    game.catchCount += 1;
    game.catchByFish[f.id] = (game.catchByFish[f.id] || 0) + 1;
    game.coinsEarned += f.coin || 0;
    economy.addCoins(f.coin || 0);
    codex.save();

    // 6) 콤보 / FLURRY
    // 누적 catch 간격이 comboKeep 안이면 콤보 유지, 아니면 1부터 재시작
    const now = performance.now() / 1000;
    if (game.lastCatchT > 0 && (now - game.lastCatchT) <= RT.comboKeep) {
      game.combo += 1;
    } else {
      game.combo = 1;
    }
    game.lastCatchT = now;
    if (game.combo > game.maxCombo) game.maxCombo = game.combo;
    if (game.combo === CONFIG.flurryAt) {
      game.flurryLeft = CONFIG.flurryDuration;
      game.flurryCount += 1;
      showToast('🔥 FLURRY ×' + CONFIG.flurryMult.toFixed(1) + ' (' + CONFIG.flurryDuration + 's)', 'perfect');
    }

    // 7) 토스트
    let msg = '+' + gain + ' ' + f.name_ko + ' (' + sizeCm + 'cm)';
    if (rec.isNew && rec.prevCm > 0) msg = '신기록! ' + msg;
    else if (rec.isNew) msg = '신규 도감! ' + msg;
    if (game.combo > 1) msg = '×' + game.combo + ' ' + msg;
    if (game.flurryLeft > 0 && game.combo < CONFIG.flurryAt) {
      msg = '🔥 ' + msg;
    }
    showToast(msg, rec.isNew ? 'perfect' : (game.flurryLeft > 0 ? 'perfect' : 'score'));
  }

  // 결과 모달 폴리시 (어종별 어획/신기록/수집률/다음 목표)
  function renderResult() {
    elFinalS.textContent = game.score;
    elFinalC.textContent = game.catchCount;
    const elFinalCoins = document.getElementById('final-coins');
    if (elFinalCoins) elFinalCoins.textContent = game.coinsEarned;

    // 콤보 / FLURRY 통계
    const statCombo = document.getElementById('stat-combo');
    const statFlurry = document.getElementById('stat-flurry');
    if (statCombo) statCombo.textContent = '×' + game.maxCombo;
    if (statFlurry) statFlurry.textContent = game.flurryCount + '×';

    // 어황 요약
    const summaryEl = document.getElementById('result-summary');
    if (summaryEl) {
      const lines = Object.keys(game.catchByFish).map((id) => {
        const f = game.fish.find((x) => x.id === id);
        const n = game.catchByFish[id];
        const rec = codex.record(id);
        const colorDot = f && f.color ? `<span class="dot" style="background:${f.color}"></span>` : '';
        return f ? `<li>${colorDot}<span class="rs-name">${f.name_ko}</span> <strong>${n}</strong>마리 · 최대 <strong>${rec}cm</strong></li>` : '';
      }).join('');
      summaryEl.innerHTML = lines ? `<ul class="result-list">${lines}</ul>` : '<p class="muted">잡은 물고기가 없습니다.</p>';
    }

    // 신기록 / 신규 도감 배지
    const badgeEl = document.getElementById('result-badge');
    if (badgeEl) {
      const parts = [];
      if (game.newCodexIds.length) {
        const names = game.newCodexIds.map((id) => (game.fish.find((x) => x.id === id) || {}).name_ko).filter(Boolean);
        parts.push(`<span class="badge new">신규 ${names.join(', ')}</span>`);
      }
      game.records.forEach((r) => {
        const detail = r.prevCm > 0 ? `+${r.bonus}점` : '신규';
        parts.push(`<span class="badge record big">${r.name_ko} ${r.sizeCm}cm <em>${detail}</em></span>`);
      });
      // 이번 판의 "최고 신기록" 1개 강조 (prev>0 인 것 중 가장 큰 delta)
      const upgrades = game.records.filter((r) => r.prevCm > 0);
      if (upgrades.length > 0) {
        const top = upgrades.reduce((a, b) => ((b.sizeCm - b.prevCm) > (a.sizeCm - a.prevCm) ? b : a));
        const delta = +(top.sizeCm - top.prevCm).toFixed(1);
        parts.unshift(`<span class="badge best-record">⭐ 최고 신기록 ${top.name_ko} +${delta}cm</span>`);
      }
      badgeEl.innerHTML = parts.join(' ');
    }

    // 다음 목표 (별도 카드)
    const nextEl = document.getElementById('result-next');
    if (nextEl) {
      const next = game.fish.find((f) => !codex.isCaught(f.id) && !f.locked);
      if (next) {
        const colorDot = `<span class="dot" style="background:${next.color || '#999'}"></span>`;
        nextEl.innerHTML = `<p class="next-label">NEXT</p><p class="next-line">${colorDot}<strong>${next.name_ko}</strong> 한 마리! <span class="next-sub">(${next.title || ''})</span></p>`;
      } else {
        nextEl.innerHTML = `<p class="next-label">NEXT</p><p class="next-line">동해방파제 <strong>100% 수집!</strong></p>`;
      }
    }

    // 수집률 (활성 어종만 — 잠금 9종 제외)
    const rateEl = document.getElementById('result-meta');
    if (rateEl) {
      const active = game.fish.filter((f) => !f.locked);
      const total = active.length;
      const caught = active.filter((f) => codex.isCaught(f.id)).length;
      const pct = total > 0 ? Math.round((caught / total) * 100) : 0;
      const region = active[0] && active[0].region ? active[0].region : '';
      rateEl.innerHTML = `<p class="modal-line">수집률 <strong>${caught}/${total}</strong> (${pct}%)</p>` +
        (caught === total ? `<p class="modal-line muted">동해방파제 100%! SHOP/다음 지역 coming soon</p>` : '');
    }
  }
  // RESULT 진입 시 changeState() 가 이 함수를 호출한다 (위 changeState RESULT 분기에서).
  // renderResult 는 어종별 어획/신기록 배지/수집률/다음 목표를 모달에 채워 넣는다.

  // SHOP 화면 — 3축 업그레이드 카드
  function renderShop() {
    const listEl = document.getElementById('shop-list');
    const coinsEl = document.getElementById('shop-coins');
    if (!listEl) return;
    if (coinsEl) coinsEl.textContent = economy.data.coins;

    listEl.innerHTML = '';
    economy.upgrades.forEach((u) => {
      const lv = economy.level(u.id);
      const cost = economy.nextCost(u.id);
      const can = economy.canBuy(u.id);
      const maxed = lv >= u.maxLevel;
      const nextDesc = maxed ? '최대 레벨' : u.descPerLevel[lv] || '';

      const card = document.createElement('div');
      card.className = 'shop-card';
      card.innerHTML = `
        <div class="shop-card-head">
          <span class="shop-icon">${u.icon || '🛠'}</span>
          <div class="shop-title">
            <strong>${u.name_ko}</strong>
            <span class="muted">${u.name_en}</span>
          </div>
          <div class="shop-level">Lv <strong>${lv}</strong>/${u.maxLevel}</div>
        </div>
        <p class="shop-summary">${u.summary || ''}</p>
        <div class="shop-pips">${Array.from({length: u.maxLevel}, (_, i) => `<span class="pip${i < lv ? ' on' : ''}"></span>`).join('')}</div>
        <p class="shop-next">${nextDesc}</p>
        <button class="primary shop-buy" data-uid="${u.id}" ${maxed || !can ? 'disabled' : ''}>
          ${maxed ? '최대' : '🪙 ' + cost + ' 업그레이드'}
        </button>
      `;
      listEl.appendChild(card);
    });

    // 구매 핸들러 (이벤트 위임)
    listEl.querySelectorAll('.shop-buy').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const uid = e.currentTarget.getAttribute('data-uid');
        if (economy.buy(uid)) {
          applyUpgrades();
          renderShop();
          showToast('업그레이드 완료!', 'perfect');
        }
      });
    });
  }

  // ----------------------------------------------------------
  // CODEX 화면 — 12슬롯 도감 카드 그리드
  // ----------------------------------------------------------
  // 등급별 색/라벨 (잠금은 회색)
  const RARITY_META = {
    common:    { label: 'COMMON',    color: '#7A8C99' },
    uncommon:  { label: 'UNCOMMON',  color: '#5DA39A' },
    rare:      { label: 'RARE',      color: '#C24A3A' },
    epic:      { label: 'EPIC',      color: '#8E44AD' },
    legendary: { label: 'LEGENDARY', color: '#E0A800' },
  };
  // region 표시명
  const REGION_META = {
    east_breakwater: '동해 방파제',
    south_rocky:     '남해 갯바위',
    open_sea:        '원양',
    event:           '라이브 이벤트',
  };

  function renderCodex() {
    const listEl = document.getElementById('codex-list');
    const rateEl = document.getElementById('codex-rate');
    const titleEl = document.getElementById('codex-title-region');
    if (!listEl) return;

    const total = game.fish.length;
    const caught = game.fish.filter((f) => !f.locked && codex.isCaught(f.id)).length;
    const activeTotal = game.fish.filter((f) => !f.locked).length;
    const pct = activeTotal > 0 ? Math.round((caught / activeTotal) * 100) : 0;
    if (rateEl) rateEl.textContent = `${caught} / ${activeTotal}  (${pct}%)`;

    // 현재 region (활성 어종 중 첫 region)
    const currentRegion = (game.fish.find((f) => !f.locked) || {}).region || '';
    if (titleEl) titleEl.textContent = REGION_META[currentRegion] || '도감';

    listEl.innerHTML = '';
    game.fish.forEach((f) => {
      const isLocked = f.locked;
      const isCaught = !isLocked && codex.isCaught(f.id);
      const rec = isCaught ? codex.record(f.id) : 0;
      const rarityMeta = RARITY_META[f.rarity] || RARITY_META.common;
      const regionName = REGION_META[f.region] || f.region || '';

      const card = document.createElement('div');
      card.className = 'codex-card'
        + (isLocked ? ' locked' : '')
        + (isCaught ? ' caught' : ' unseen')
        + ' rarity-' + (f.rarity || 'common');

      if (isLocked) {
        // 잠금 카드
        card.innerHTML = `
          <div class="codex-card-top">
            <span class="codex-silhouette" aria-hidden="true">?</span>
            <span class="codex-rarity-pill locked-pill">LOCKED</span>
          </div>
          <div class="codex-card-name">${regionName || '???'}</div>
          <div class="codex-card-sub muted">다음 지역 · coming soon</div>
          <div class="codex-card-record muted">최대 <strong>--</strong> cm</div>
        `;
      } else if (isCaught) {
        const color = f.color || rarityMeta.color;
        card.innerHTML = `
          <div class="codex-card-top">
            <span class="codex-dot" style="background:${color}"></span>
            <span class="codex-rarity-pill">${rarityMeta.label}</span>
          </div>
          <div class="codex-card-name">${f.name_ko}</div>
          <div class="codex-card-sub">${f.title || ''}</div>
          <div class="codex-card-record">최대 <strong>${rec}</strong> cm</div>
          <div class="codex-card-tip">${f.codex || ''}</div>
        `;
      } else {
        // 미획득 활성 어종 — 실루엣 + 어종명 안 보이고 ?? + 힌트
        card.innerHTML = `
          <div class="codex-card-top">
            <span class="codex-silhouette">?</span>
            <span class="codex-rarity-pill">${rarityMeta.label}</span>
          </div>
          <div class="codex-card-name">???</div>
          <div class="codex-card-sub muted">${regionName}</div>
          <div class="codex-card-record muted">최대 <strong>--</strong> cm</div>
        `;
      }
      listEl.appendChild(card);
    });
  }

  // ----------------------------------------------------------
  // 부트스트랩
  // ----------------------------------------------------------
  let input; // 전역 참조 (REEL 가속 체크용)

  Promise.all([loadFishData(), loadEconomyData()]).then(([fishData, economyData]) => {
    game.fish = fishData.fish;
    economy.upgrades = economyData.upgrades;
    applyUpgrades(); // economy.data.levels 가 비어있어도 기본값으로 채워짐
    input = makeInput(onPress, onRelease);
    updateHUD();
    requestAnimationFrame(tick);
  });

  // 결과 모달의 [한 판 더] 버튼
  btnAgain.addEventListener('click', () => {
    if (game.state === STATE.RESULT) changeState(STATE.PLAY);
  });

  // 결과 모달의 [상점] 버튼
  if (btnShop) {
    btnShop.addEventListener('click', () => {
      if (game.state === STATE.RESULT) changeState(STATE.SHOP);
    });
  }
  // 결과 모달의 [도감] 버튼
  if (btnCodex) {
    btnCodex.addEventListener('click', () => {
      if (game.state === STATE.RESULT) changeState(STATE.CODEX);
    });
  }
  // 타이틀의 [SHOP] 버튼
  const btnShopTitle = document.getElementById('btn-shop-title');
  if (btnShopTitle) {
    btnShopTitle.addEventListener('click', () => {
      if (game.state === STATE.TITLE) changeState(STATE.SHOP);
    });
  }
  // 타이틀의 [CODEX] 버튼
  const btnCodexTitle = document.getElementById('btn-codex-title');
  if (btnCodexTitle) {
    btnCodexTitle.addEventListener('click', () => {
      if (game.state === STATE.TITLE) changeState(STATE.CODEX);
    });
  }
  // SHOP 닫기
  if (btnShopClose) {
    btnShopClose.addEventListener('click', () => {
      if (game.state === STATE.SHOP) changeState(STATE.TITLE);
    });
  }
  // CODEX 닫기
  if (btnCodexClose) {
    btnCodexClose.addEventListener('click', () => {
      if (game.state === STATE.CODEX) changeState(STATE.TITLE);
    });
  }

  // 창 포커스 잃으면 토스트 정리 (안전장치)
  window.addEventListener('blur', () => { game.toastT = 0; hideToast(); });
})();
