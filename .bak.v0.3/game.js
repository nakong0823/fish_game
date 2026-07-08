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
      // PAUSE 토글: P / Escape (단, 입력란/모달 입력은 무시)
      if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        togglePause();
        return;
      }
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
    // 터치 어댑터 (모바일) — mousedown/up 과 동일하게 처리
    function onTouchStart(e) {
      if (e.touches && e.touches.length > 1) return; // 멀티터치 무시
      e.preventDefault();
      actionOnPress();
    }
    function onTouchEnd(e) {
      e.preventDefault();
      actionOnRelease();
    }
    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: false });

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
  const elPause   = document.getElementById('pause');
  const elFinalS  = document.getElementById('final-score');
  const elFinalC  = document.getElementById('final-catch');
  const btnAgain  = document.getElementById('again');
  const btnShop   = document.getElementById('btn-shop');
  const btnShopClose = document.getElementById('btn-shop-close');
  const btnCodex  = document.getElementById('btn-codex');
  const btnCodexClose = document.getElementById('btn-codex-close');

  // 게임 상태
  const STATE = { TITLE: 'TITLE', PLAY: 'PLAY', RESULT: 'RESULT', SHOP: 'SHOP', CODEX: 'CODEX', PAUSE: 'PAUSE' };
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
    megaFlurry: false,     // MEGA FLURRY (×3) 활성 여부
    lastCatchT: 0,         // 마지막 catch 시각(누적)
    baitZeroT: 0,          // 미끼 0 긴장 연출 남은 시간
    inGameT: 0,            // 게임 내 누적 시간(초) — 시간대 자동 순환용
    pauseT: 0,             // 일시정지 누적 시간(초)

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
  let prevState = null;  // PAUSE 진입 전 상태 기억
  let prevPhase = null;
  function togglePause() {
    if (game.state === STATE.PAUSE) {
      // 재개
      changeState(prevState || STATE.PLAY);
      if (sound && sound.resumeOcean) sound.resumeOcean();
    } else if (game.state === STATE.PLAY) {
      // 일시정지
      prevState = STATE.PLAY;
      prevPhase = game.phase;
      changeState(STATE.PAUSE);
      if (sound && sound.pauseOcean) sound.pauseOcean();
    } else if (game.state === STATE.SHOP || game.state === STATE.CODEX) {
      // 상점/도감에서도 일시정지 → 그냥 닫고 타이틀로
      changeState(STATE.TITLE);
    }
  }

  function changeState(next) {
    if (game.state === next) return;
    game.state = next;
    if (next === STATE.TITLE) {
      elTitle.classList.remove('hidden');
      elModal.classList.add('hidden');
      elShop.classList.add('hidden');
      elCodex.classList.add('hidden');
      elPause.classList.add('hidden');
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
      game.megaFlurry = false;
      game.lastCatchT = 0;
      game.baitZeroT = 0;
      game.inGameT = 0;
      game.pauseT = 0;
      timeOfDay = 1; // 새 판은 '낮'부터
      enterPhase(PHASE.IDLE);
      elTitle.classList.add('hidden');
      elModal.classList.add('hidden');
      elShop.classList.add('hidden');
      elCodex.classList.add('hidden');
      elPause.classList.add('hidden');
    } else if (next === STATE.RESULT) {
      elFinalS.textContent = game.score;
      elFinalC.textContent = game.catchCount;
      renderResult();
      elModal.classList.remove('hidden');
      elShop.classList.add('hidden');
      elCodex.classList.add('hidden');
      elPause.classList.add('hidden');
    } else if (next === STATE.SHOP) {
      renderShop();
      elShop.classList.remove('hidden');
      elModal.classList.add('hidden');
      elTitle.classList.add('hidden');
      elCodex.classList.add('hidden');
      elPause.classList.add('hidden');
    } else if (next === STATE.CODEX) {
      renderCodex();
      elCodex.classList.remove('hidden');
      elShop.classList.add('hidden');
      elModal.classList.add('hidden');
      elTitle.classList.add('hidden');
      elPause.classList.add('hidden');
    } else if (next === STATE.PAUSE) {
      elPause.classList.remove('hidden');
      elShop.classList.add('hidden');
      elModal.classList.add('hidden');
      elCodex.classList.add('hidden');
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
      if (sound && sound.bite) sound.bite();
    } else if (next === PHASE.REELING) {
      game.reelPct = 0;
    } else if (next === PHASE.CATCH) {
      game.animT = CONFIG.catchAnimTime;
      if (sound && sound.catch) sound.catch();
    } else if (next === PHASE.MISS) {
      game.animT = CONFIG.missAnimTime;
      if (sound && sound.miss) sound.miss();
    }
  }

  // ----------------------------------------------------------
  // 입력 처리
  // ----------------------------------------------------------
  // PRESS: TITLE→PLAY, BITE 윈도우 내 → REELING, CATCH/MISS 연출 중 무시, RESULT에서 한 판 더
  // RELEASE: CASTING → 판정
  function onPress() {
    // 사운드 컨텍스트 resume (사용자 인터랙션 시점)
    if (sound && sound.resume) sound.resume();
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
      if (sound && sound.pull) sound.pull();
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
      // 캐스트 사운드
      if (sound && sound.cast) sound.cast();

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
      if (game.flurryLeft === 0) {
        game.megaFlurry = false;
        updateHUD();
      }
    }

    // 시간대 자동 순환 (한 판 ≈ 100초 → 25초마다 한 단계)
    // 첫 25초는 transition 보호 (낮→아침 점프 방지, 25초 시점부터 검사)
    if (game.state === STATE.PLAY) {
      game.inGameT += dt;
      if (game.inGameT > 25) {
        const newPhase = Math.floor(game.inGameT / 25) % 4;
        if (newPhase !== timeOfDay) {
          timeOfDay = newPhase;
          liveEvent.adjustWeights();
          updateHUD();
          // 시간대 변경 토스트 (0.6초 표시)
          showToast(TIME_NAMES[timeOfDay] + '이(가) 되었습니다', 'score');
        }
      }
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

  // ============================================================
  // 환경 / 라이팅 (시간대별 하늘 + 바다 + 구름 + 해 + 안개)
  // ============================================================
  // 시간대(0=아침, 1=낮, 2=노을, 3=밤)에 따른 색 팔레트.
  // 1차 프로토는 1(낮) 고정 — 후속에서 인게임 시간 진행/지역별 다양화 가능.
  const TIME_NAMES = ['아침', '낮', '노을', '밤'];
  let   timeOfDay = 1; // 현재 시간대 (0~3)
  const SKY_PALETTES = [
    { sky1: '#FFD9A8', sky2: '#FFB199', sun: '#FFEDA0', sunGlow: 'rgba(255,237,160,0.5)' }, // 아침
    { sky1: '#7FC8E8', sky2: '#4FB3D9', sun: '#FFF1A0', sunGlow: 'rgba(255,241,160,0.35)' }, // 낮
    { sky1: '#FF8C69', sky2: '#A4506B', sun: '#FF6040', sunGlow: 'rgba(255,96,64,0.45)' },  // 노을
    { sky1: '#0F1F3D', sky2: '#1B3A5C', sun: '#E6E8F0', sunGlow: 'rgba(230,232,240,0.18)' },// 밤
  ];
  // 현재 시간대 팔레트 (drawSky 가 매 프레임 접근)
  function currentSky() { return SKY_PALETTES[timeOfDay]; }

  // 구름(파라미터 기반 — 3장 항상 다른 위치)
  const CLOUDS = [
    { x: 120, y: 50,  s: 1.0, op: 0.75 },
    { x: 480, y: 32,  s: 1.3, op: 0.65 },
    { x: 780, y: 60,  s: 0.9, op: 0.70 },
  ];

  function drawSky(t) {
    // 하늘 그라데이션
    const horizon = H * 0.55;
    const grad = ctx.createLinearGradient(0, 0, 0, horizon);
    const sky = currentSky();
    grad.addColorStop(0, sky.sky1);
    grad.addColorStop(1, sky.sky2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, horizon);

    // 해 / 달 + 글로우
    const sunX = 720, sunY = horizon - 36;
    const grd = ctx.createRadialGradient(sunX, sunY, 6, sunX, sunY, 110);
    grd.addColorStop(0, sky.sunGlow);
    grd.addColorStop(1, 'rgba(255,237,160,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(sunX - 110, sunY - 110, 220, 220);
    ctx.fillStyle = sky.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 22, 0, Math.PI * 2);
    ctx.fill();
    // 부드러운 림 (1px highlight)
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 구름 (둥근 덩어리 3-4개)
    CLOUDS.forEach((c) => {
      // 시간대별 구름 속도 (밤=정지, 아침=빠르게, 낮=보통, 노을=느리게)
      const cloudSpeed = timeOfDay === 3 ? 0 : (timeOfDay === 0 ? 0.018 : (timeOfDay === 2 ? 0.007 : 0.012));
      const cx = (c.x + t * cloudSpeed) % (W + 200) - 100;
      const cy = c.y;
      const s = c.s;
      // 밤엔 구름 안 보이게 (alpha 0)
      const baseOp = timeOfDay === 3 ? 0 : c.op;
      ctx.fillStyle = `rgba(255,255,255,${baseOp})`;
      ctx.beginPath();
      ctx.arc(cx,            cy,        18 * s, 0, Math.PI * 2);
      ctx.arc(cx + 18 * s,   cy - 6,    16 * s, 0, Math.PI * 2);
      ctx.arc(cx + 36 * s,   cy,        14 * s, 0, Math.PI * 2);
      ctx.arc(cx + 18 * s,   cy + 6,    18 * s, 0, Math.PI * 2);
      ctx.fill();
    });

    // 별 (밤 0.85 / 노을 0.30 / 낮·아침 0 — 깜빡임)
    if (timeOfDay === 2 || timeOfDay === 3) {
      const baseAlpha = timeOfDay === 3 ? 0.85 : 0.30;
      const STARS = [
        { x: 120, y: 36, s: 1.0 }, { x: 200, y: 70, s: 0.8 },
        { x: 320, y: 24, s: 1.1 }, { x: 430, y: 80, s: 0.9 },
        { x: 560, y: 38, s: 1.0 }, { x: 660, y: 95, s: 0.7 },
        { x: 780, y: 50, s: 1.2 }, { x: 880, y: 30, s: 0.9 },
      ];
      STARS.forEach((s, i) => {
        const tw = Math.sin(t / (600 + i * 80)) * 0.5 + 0.5; // 0~1
        const a = baseAlpha * (0.5 + tw * 0.5);
        ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2);
        ctx.fill();
        // 십자 빛 (가끔)
        if (tw > 0.85) {
          ctx.strokeStyle = `rgba(255, 255, 255, ${(tw - 0.85) * 3.5})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(s.x - s.s * 3, s.y);
          ctx.lineTo(s.x + s.s * 3, s.y);
          ctx.moveTo(s.x, s.y - s.s * 3);
          ctx.lineTo(s.x, s.y + s.s * 3);
          ctx.stroke();
        }
      });
    }

    // 원경 안개 띠 (수평선 부근) — 시간대별 강도/높이
    // 아침/밤은 짙은 안개, 노을/낮은 옅은
    const hazeH = timeOfDay === 0 ? 40 : (timeOfDay === 3 ? 36 : 28);
    const hazeAlpha = timeOfDay === 0 ? 0.32 : (timeOfDay === 3 ? 0.28 : 0.18);
    const hazeColor = timeOfDay === 3 ? '180, 200, 220' : '255, 255, 255';
    const haze = ctx.createLinearGradient(0, horizon - hazeH, 0, horizon + 4);
    haze.addColorStop(0, 'rgba(255,255,255,0)');
    haze.addColorStop(1, `rgba(${hazeColor},${hazeAlpha})`);
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizon - hazeH, W, hazeH + 4);
  }

  function drawWhaleShadow(t) {
    // 원경에 가끔 지나가는 고래/물고기 그림자 (수면 아래)
    const period = 14000; // 14초 주기
    const phase = ((t % period) / period);
    if (phase > 0.6) return; // 잠수 중
    const x = (phase / 0.6) * (W + 200) - 100;
    const y = H * 0.55 + 28 + Math.sin(phase * 8) * 3;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(20, 40, 60, 0.18)';
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.quadraticCurveTo(-15, -6, 0, -4);
    ctx.quadraticCurveTo(20, -2, 28, 0);
    ctx.quadraticCurveTo(20, 4, 0, 4);
    ctx.quadraticCurveTo(-15, 6, -30, 0);
    ctx.fill();
    // 꼬리
    ctx.beginPath();
    ctx.moveTo(28, 0);
    ctx.lineTo(36, -5);
    ctx.lineTo(36, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawBuoy(t) {
    // 부표 — 오른쪽 멀리 작은 빨간 부표 (보이지 않을 정도 작은 디테일)
    const x = 870, y = H * 0.55 + 8;
    const bob = Math.sin(t / 800) * 1.5;
    ctx.save();
    ctx.translate(x, y + bob);
    // 반쯤 잠긴 부분
    ctx.fillStyle = '#C24A3A';
    ctx.fillRect(-3, -2, 6, 8);
    // 꼭대기
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, -4, 3, 0, Math.PI * 2);
    ctx.fill();
    // 잔물결
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 3, 8, 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawBoatAndSea() {
    const t = performance.now();
    drawSky(t);

    const horizon = H * 0.55;

    // 바다 그라데이션 (수평선 → 가까운 바다)
    const sea = ctx.createLinearGradient(0, horizon, 0, H);
    sea.addColorStop(0, '#4FB3D9');
    sea.addColorStop(0.5, '#2B7A9B');
    sea.addColorStop(1, '#1F5C7A');
    ctx.fillStyle = sea;
    ctx.fillRect(0, horizon, W, H - horizon);

    // 햇빛 반사 (해 위치에서 일직선, 살짝 흔들림)
    const reflX = 720, reflTop = horizon;
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#FFF1A0';
    ctx.beginPath();
    for (let y = reflTop; y < H; y += 4) {
      const t2 = (y - reflTop) / (H - reflTop);
      const w = 60 * (1 - t2 * 0.8) + Math.sin(t / 200 + y * 0.1) * 8;
      ctx.moveTo(reflX - w, y);
      ctx.lineTo(reflX + w, y);
    }
    ctx.fill();
    ctx.restore();

    // 고래 그림자 (원경 디테일)
    drawWhaleShadow(t);

    // 파도 라인 6개 + 가까운 파도 (더 큰 진폭)
    // 시간대별 파도 속도 (밤=0.3 잔잔, 노을=0.7, 낮=1.0, 아침=1.1 활발)
    const waveSpeed = timeOfDay === 3 ? 0.3 : (timeOfDay === 2 ? 0.7 : (timeOfDay === 0 ? 1.1 : 1.0));
    for (let i = 0; i < 6; i++) {
      const y = horizon + 8 + i * 22;
      const amp = i < 3 ? 1.5 : 3.5;
      const speed = i < 3 ? 0.6 : 0.4;
      const op = i < 3 ? 0.35 : 0.55;
      ctx.strokeStyle = `rgba(255,255,255,${op})`;
      ctx.lineWidth = i < 3 ? 1.2 : 2;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 10) {
        const yy = y + Math.sin((x + i * 30 + t / 600 * 100 * waveSpeed) * 0.04) * amp;
        if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    // 부표
    drawBuoy(t);

    // ─── 플레이어 보트 (왼쪽 가운데) ───
    const bx = 110, by = horizon - 6;
    // 보트 그림자 (수면 위) — 시간대별 길이/방향
    // 아침/노을: 길고 옆으로(서쪽/동쪽), 정오: 짧고 바로 아래, 밤: 거의 안 보임
    const shadow = timeOfDay === 0
      ? { dx: -14, rx: 80, ry: 5, a: 0.22 }   // 아침 — 서쪽 그림자
      : timeOfDay === 1
      ? { dx:  0,  rx: 56, ry: 7, a: 0.30 }   // 정오 — 바로 아래
      : timeOfDay === 2
      ? { dx:  14, rx: 80, ry: 5, a: 0.22 }   // 노을 — 동쪽 그림자
      : { dx:  0,  rx: 50, ry: 6, a: 0.18 };    // 밤 — 옅고 짧게
    ctx.fillStyle = `rgba(20, 40, 60, ${shadow.a})`;
    ctx.beginPath();
    ctx.ellipse(bx + shadow.dx, by + 28, shadow.rx, shadow.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    // 보트 선체 (반원)
    ctx.fillStyle = '#F4A261';
    ctx.beginPath();
    ctx.moveTo(bx - 50, by);
    ctx.quadraticCurveTo(bx - 40, by + 32, bx, by + 32);
    ctx.quadraticCurveTo(bx + 40, by + 32, bx + 50, by);
    ctx.closePath();
    ctx.fill();
    // 보트 하이라이트
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(bx - 10, by + 4, 24, 4, 0, 0, Math.PI);
    ctx.fill();
    // 보트 윤곽
    ctx.strokeStyle = '#1F5C7A';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bx - 50, by);
    ctx.quadraticCurveTo(bx - 40, by + 32, bx, by + 32);
    ctx.quadraticCurveTo(bx + 40, by + 32, bx + 50, by);
    ctx.stroke();
    // 보트 줄 (lantern)
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(bx - 36, by + 4, 4, 2);
    ctx.fillRect(bx + 32, by + 4, 4, 2);
    // 마스트
    ctx.strokeStyle = '#5C3A21';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(bx, by - 4);
    ctx.lineTo(bx, by - 78);
    ctx.stroke();
    // 돛 (작은 삼각형)
    ctx.fillStyle = '#FDF8F0';
    ctx.beginPath();
    ctx.moveTo(bx, by - 78);
    ctx.lineTo(bx + 26, by - 6);
    ctx.lineTo(bx, by - 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1F5C7A';
    ctx.lineWidth = 1;
    ctx.stroke();
    // 깃발 (돛대 꼭대기)
    ctx.fillStyle = '#E76F51';
    ctx.beginPath();
    ctx.moveTo(bx, by - 78);
    const flagWiggle = Math.sin(t / 240) * 2;
    ctx.lineTo(bx + 10 + flagWiggle, by - 73);
    ctx.lineTo(bx, by - 68);
    ctx.closePath();
    ctx.fill();

    // 캐릭터
    ctx.fillStyle = '#264653';
    ctx.beginPath();
    // 머리 (살짝 그라데이션)
    const headGrad = ctx.createRadialGradient(bx, by - 18, 1, bx, by - 18, 12);
    headGrad.addColorStop(0, '#3A5A66');
    headGrad.addColorStop(1, '#1F3A45');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(bx, by - 18, 9, 0, Math.PI * 2);
    ctx.fill();
    // 모자 (작은 챙)
    ctx.fillStyle = '#E76F51';
    ctx.beginPath();
    ctx.ellipse(bx, by - 25, 11, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx, by - 24, 6, Math.PI, Math.PI * 2);
    ctx.fill();
    // 얼굴 (시간대별 표정)
    if (timeOfDay === 3) {
      // 밤 — 졸린 눈 (실눈 2개)
      ctx.strokeStyle = '#0F1F3D';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(bx - 4, by - 17);
      ctx.lineTo(bx - 1, by - 17);
      ctx.moveTo(bx + 1, by - 17);
      ctx.lineTo(bx + 4, by - 17);
      ctx.stroke();
    } else {
      // 낮/아침/노을 — 동그란 눈 2개
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(bx - 3, by - 18, 1.3, 0, Math.PI * 2);
      ctx.arc(bx + 3, by - 18, 1.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F1F3D';
      ctx.beginPath();
      ctx.arc(bx - 3, by - 18, 0.8, 0, Math.PI * 2);
      ctx.arc(bx + 3, by - 18, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    // 몸통
    ctx.fillStyle = '#E76F51';
    ctx.fillRect(bx - 6, by - 10, 12, 16);
    // 팔 (캐스팅 중이면 위로)
    if (game.phase === PHASE.CASTING) {
      ctx.fillStyle = '#E76F51';
      ctx.save();
      ctx.translate(bx + 4, by - 8);
      const castArm = Math.sin(t / 120) * 0.4;
      ctx.rotate(-Math.PI / 3 + castArm);
      ctx.fillRect(0, 0, 4, 18);
      ctx.restore();
    } else if (game.phase === PHASE.REELING) {
      ctx.fillStyle = '#E76F51';
      ctx.save();
      ctx.translate(bx + 4, by - 8);
      ctx.rotate(-Math.PI / 4);
      ctx.fillRect(0, 0, 4, 18);
      ctx.restore();
    } else {
      ctx.fillStyle = '#E76F51';
      ctx.fillRect(bx + 4, by - 6, 4, 12);
    }

    // 낚싯대
    drawRod(bx, by - 8);

    // 바늘 / 어종
    drawActiveFish();
  }

  function drawRod(ox, oy) {
    const t = performance.now();
    ctx.save();
    ctx.translate(ox, oy);
    let angle = -Math.PI / 4;
    if (game.phase === PHASE.CASTING) {
      angle = -Math.PI / 4 - Math.sin(t / 120) * 0.08;
    } else if (game.phase === PHASE.DRIFT || game.phase === PHASE.BITE) {
      // 대기 중에는 미세하게 떨림
      angle = -Math.PI / 4 + Math.sin(t / 200) * 0.015;
    } else if (game.phase === PHASE.REELING) {
      // REEL 중 흔들림
      const f = game.activeFish;
      const big = f && f.reelDifficulty && f.reelDifficulty >= 1.3;
      angle = -Math.PI / 4 + Math.sin(t / (big ? 60 : 110)) * (big ? 0.18 : 0.08);
    }
    ctx.rotate(angle);
    // 그라데이션 낚싯대
    const rod = ctx.createLinearGradient(0, 0, 110, 0);
    rod.addColorStop(0, '#2B2A2A');
    rod.addColorStop(0.6, '#5C5A5A');
    rod.addColorStop(1, '#E76F51');
    ctx.strokeStyle = rod;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(110, 0);
    ctx.stroke();
    // 릴 (가까운 끝)
    ctx.fillStyle = '#1F3A45';
    ctx.beginPath();
    ctx.arc(8, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    // 릴 손잡이
    if (game.phase === PHASE.REELING) {
      ctx.save();
      ctx.translate(8, 0);
      ctx.rotate(t / 30);
      ctx.strokeStyle = '#E76F51';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(7, 0);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawActiveFish() {
    // 페이즈별 가시성/위치
    const visible = (game.phase === PHASE.DRIFT || game.phase === PHASE.BITE ||
                     game.phase === PHASE.REELING);
    if (!visible) return;
    const f = game.activeFish;
    if (!f) return;

    const t = performance.now();

    // ─── 바늘 + 줄 + 어종 위치 계산 ───
    let hx, hy;
    if (game.phase === PHASE.REELING) {
      hx = 220 + (1 - game.reelPct / 100) * 320;
      hy = H * 0.55 + 12 - (game.reelPct / 100) * 36;
    } else {
      // DRIFT/BITE: 물결 + 약간의 수직 호흡
      hx = 260 + Math.sin(t / 320) * 14;
      hy = H * 0.62 + Math.sin(t / 220) * 2;
    }

    // ─── 줄 (메인 + 그림자) ───
    const isBig = f.reelDifficulty && f.reelDifficulty >= CONFIG.bigFishDiff;
    // 그림자 줄
    ctx.strokeStyle = 'rgba(0, 20, 40, 0.18)';
    ctx.lineWidth = isBig ? 3.2 : 1.6;
    ctx.beginPath();
    ctx.moveTo(190, H * 0.55 + 2);
    if (isBig && game.phase === PHASE.DRIFT) {
      const wave = Math.sin(t / 80) * 6;
      ctx.lineTo((190 + hx) / 2, (H * 0.55 + 2 + hy) / 2 + wave + 1);
    }
    ctx.lineTo(hx, hy + 1);
    ctx.stroke();
    // 메인 줄
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = isBig ? 1.8 : 0.9;
    ctx.beginPath();
    ctx.moveTo(190, H * 0.55);
    if (isBig && game.phase === PHASE.DRIFT) {
      const wave = Math.sin(t / 80) * 6;
      ctx.lineTo((190 + hx) / 2, (H * 0.55 + hy) / 2 + wave);
    }
    ctx.lineTo(hx, hy);
    ctx.stroke();

    // ─── 어종 본체 ───
    const bodySize = f.size === 'M' ? 1.5 : (f.size === 'L' ? 1.8 : 1.0);
    const len = 18 * bodySize;
    const tailW = f.tail === 'rounded' ? 6 : 9;
    const color = f.color || '#1a1a1a';
    const isReeling = game.phase === PHASE.REELING;

    // REEL 중에는 통통 튀는 회전 + 스케일 흔들림
    const baseRot = isReeling ? Math.sin(t / 90) * 0.5 : Math.sin(t / 700) * 0.05;
    const squashY = isReeling ? 1 + Math.sin(t / 90) * 0.18 : 1;
    const squashX = isReeling ? 1 - Math.sin(t / 90) * 0.10 : 1;
    // DRIFT/BITE는 좌우 흔들림
    const driftRot = (game.phase !== PHASE.REELING) ? Math.sin(t / 280) * 0.10 : 0;
    const rot = baseRot + driftRot;

    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(rot);
    ctx.scale(squashX, squashY);

    // ── 그림자 (수면 아래) ──
    ctx.fillStyle = 'rgba(20, 40, 60, 0.18)';
    ctx.beginPath();
    ctx.ellipse(0, 8, len * 1.05, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── 본체 (체급별 모양) ──
    let bodyW, bodyH, bodyOffY = 0;
    if (f.body === 'slender') {
      bodyW = len; bodyH = len * 0.32;
    } else if (f.body === 'stocky') {
      bodyW = len * 0.95; bodyH = len * 0.78;
      bodyOffY = 2;
    } else {
      bodyW = len * 1.05; bodyH = len * 0.55;
    }
    // 그라데이션 본체 (밝은 위 → 어두운 아래)
    const bodyGrad = ctx.createLinearGradient(0, -bodyH, 0, bodyH);
    bodyGrad.addColorStop(0, lighten(color, 0.35));
    bodyGrad.addColorStop(0.5, color);
    bodyGrad.addColorStop(1, darken(color, 0.25));
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, bodyOffY, bodyW, bodyH, 0, 0, Math.PI * 2);
    ctx.fill();
    // 윤곽
    ctx.strokeStyle = darken(color, 0.35);
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // ── 등 지느러미 (dorsal) ──
    if (f.body !== 'slender') {
      ctx.fillStyle = darken(color, 0.20);
      ctx.beginPath();
      ctx.moveTo(-bodyW * 0.25, -bodyH * 0.7);
      ctx.lineTo(0, -bodyH * 1.5);
      ctx.lineTo(bodyW * 0.25, -bodyH * 0.7);
      ctx.closePath();
      ctx.fill();
    }

    // ── 옆 지느러미 (pectoral) ──
    ctx.fillStyle = darken(color, 0.15);
    ctx.beginPath();
    ctx.ellipse(bodyW * 0.25, bodyH * 0.2, bodyW * 0.25, bodyH * 0.4, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // ── 줄무늬 (어종별) ──
    if (f.id === 'mackerel') {
      // 고등어 — 세로 줄무늬 5개
      ctx.strokeStyle = 'rgba(40, 60, 80, 0.45)';
      ctx.lineWidth = 0.9;
      for (let i = 0; i < 5; i++) {
        const sx = -bodyW * 0.7 + i * bodyW * 0.35;
        ctx.beginPath();
        ctx.moveTo(sx, -bodyH * 0.6);
        ctx.quadraticCurveTo(sx + 1, 0, sx, bodyH * 0.6);
        ctx.stroke();
      }
    } else if (f.id === 'horse_mackerel') {
      // 전갱이 — 가는 세로 줄
      ctx.strokeStyle = 'rgba(60, 90, 110, 0.35)';
      ctx.lineWidth = 0.7;
      for (let i = 0; i < 4; i++) {
        const sx = -bodyW * 0.5 + i * bodyW * 0.32;
        ctx.beginPath();
        ctx.moveTo(sx, -bodyH * 0.5);
        ctx.lineTo(sx, bodyH * 0.5);
        ctx.stroke();
      }
    } else if (f.id === 'rockfish') {
      // 우럭 — 반점 (작은 점들)
      ctx.fillStyle = 'rgba(50, 20, 10, 0.45)';
      for (let i = 0; i < 5; i++) {
        const dx = -bodyW * 0.55 + (i % 3) * bodyW * 0.4;
        const dy = -bodyH * 0.3 + Math.floor(i / 3) * bodyH * 0.6;
        ctx.beginPath();
        ctx.arc(dx, dy, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── 옆 줄 (lateral line) ──
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-bodyW * 0.8, bodyH * 0.1);
    ctx.quadraticCurveTo(0, bodyH * 0.18, bodyW * 0.8, bodyH * 0.1);
    ctx.stroke();

    // ── 하이라이트 (위쪽) ──
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.beginPath();
    ctx.ellipse(-bodyW * 0.15, -bodyH * 0.55, bodyW * 0.5, bodyH * 0.15, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // ── 꼬리 ──
    ctx.fillStyle = darken(color, 0.10);
    if (f.tail === 'rounded') {
      ctx.beginPath();
      ctx.ellipse(-bodyW, 0, tailW, tailW * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // forked
      ctx.beginPath();
      ctx.moveTo(-bodyW, 0);
      ctx.lineTo(-bodyW - tailW, -tailW * 0.8);
      ctx.lineTo(-bodyW - tailW * 0.4, 0);
      ctx.lineTo(-bodyW - tailW, tailW * 0.8);
      ctx.closePath();
      ctx.fill();
      // 갈라진 부분 음영
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.moveTo(-bodyW, 0);
      ctx.lineTo(-bodyW - tailW * 0.6, -tailW * 0.4);
      ctx.lineTo(-bodyW - tailW * 0.3, 0);
      ctx.lineTo(-bodyW - tailW * 0.6, tailW * 0.4);
      ctx.closePath();
      ctx.fill();
    }

    // ── 아가미 (gill) ──
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(bodyW * 0.35, -bodyH * 0.4);
    ctx.quadraticCurveTo(bodyW * 0.45, 0, bodyW * 0.35, bodyH * 0.4);
    ctx.stroke();

    // ── 눈 (흰자 + 검은 동공) ──
    const eyeX = bodyW * 0.55, eyeY = -bodyH * 0.25;
    // 흰자 (밝은 부분)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 0.4;
    ctx.stroke();
    // 검은 동공
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(eyeX + 0.2, eyeY, 1.1, 0, Math.PI * 2);
    ctx.fill();
    // 하이라이트 (반사광)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(eyeX - 0.2, eyeY - 0.4, 0.5, 0, Math.PI * 2);
    ctx.fill();

    // ── 입 ──
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(eyeX + 2, eyeY + 0.8);
    ctx.quadraticCurveTo(bodyW * 0.85, eyeY + 1.4, bodyW * 0.95, eyeY + 0.6);
    ctx.stroke();

    // ── 바늘 (입에 박힌 모양) ──
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(bodyW * 0.85, -bodyH * 0.3);
    ctx.lineTo(bodyW * 1.1, -bodyH * 0.45);
    ctx.moveTo(bodyW * 0.95, -bodyH * 0.3);
    ctx.lineTo(bodyW * 0.95, -bodyH * 0.05);
    ctx.stroke();

    ctx.restore();

    // ─── 미끼 (DRIFT/BITE 흔들림) — 어종 옆 작은 갈고리+미끼 ───
    if (game.phase !== PHASE.REELING) {
      const baitSway = Math.sin(t / 280) * 4; // ±4px 흔들림
      const baitY = hy + Math.sin(t / 200) * 3; // 약간 수직
      const bx2 = hx + 28; // 어종 옆에 작게
      // 미끼 (작은 호)
      ctx.fillStyle = '#C24A3A';
      ctx.beginPath();
      ctx.arc(bx2, baitY, 2.2, 0, Math.PI * 2);
      ctx.fill();
      // 갈고리
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(bx2, baitY + 2);
      ctx.lineTo(bx2 - 1, baitY + 5);
      ctx.stroke();
      // 흔들림 궤적 (작은 점)
      ctx.fillStyle = 'rgba(194, 74, 58, 0.25)';
      ctx.beginPath();
      ctx.arc(bx2 - baitSway * 0.5, baitY - 1, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // ─── 어종 명찰 (DRIFT/BITE) ───
    if (game.phase !== PHASE.REELING) {
      const isNew = !codex.isCaught(f.id);
      const tagW = 60, tagH = 18;
      const tagX = hx - tagW / 2, tagY = hy - 32;
      // 그림자
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(tagX + 1, tagY + 2, tagW, tagH);
      // 배경
      ctx.fillStyle = isNew ? 'rgba(255, 209, 102, 0.95)' : 'rgba(15, 42, 56, 0.85)';
      ctx.fillRect(tagX, tagY, tagW, tagH);
      // 윤곽
      ctx.strokeStyle = isNew ? '#C24A3A' : '#FFD166';
      ctx.lineWidth = 1;
      ctx.strokeRect(tagX, tagY, tagW, tagH);
      // 텍스트
      ctx.fillStyle = isNew ? '#1a1a1a' : '#fff';
      ctx.font = '700 11px -apple-system, "Apple SD Gothic Neo", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.name_ko, hx, tagY + 13);
      // NEW 배지
      if (isNew) {
        ctx.fillStyle = '#C24A3A';
        ctx.fillRect(tagX, tagY - 6, 16, 6);
        ctx.fillStyle = '#fff';
        ctx.font = '700 6px -apple-system, sans-serif';
        ctx.fillText('NEW', tagX + 8, tagY - 1);
      }
    }
  }

  // 색상 밝게/어둡게 (헥스 유틸)
  function lighten(hex, amt) {
    const h = hex.replace('#', '');
    let r = parseInt(h.substring(0, 2), 16);
    let g = parseInt(h.substring(2, 4), 16);
    let b = parseInt(h.substring(4, 6), 16);
    r = Math.min(255, Math.round(r + (255 - r) * amt));
    g = Math.min(255, Math.round(g + (255 - g) * amt));
    b = Math.min(255, Math.round(b + (255 - b) * amt));
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  }
  function darken(hex, amt) {
    const h = hex.replace('#', '');
    let r = parseInt(h.substring(0, 2), 16);
    let g = parseInt(h.substring(2, 4), 16);
    let b = parseInt(h.substring(4, 6), 16);
    r = Math.max(0, Math.round(r * (1 - amt)));
    g = Math.max(0, Math.round(g * (1 - amt)));
    b = Math.max(0, Math.round(b * (1 - amt)));
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
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
    const x = W / 2 - 180, y = H - 76, w = 360, h = 26;
    const t = performance.now();

    // 외곽 그림자
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    roundRect(x - 3, y - 3, w + 6, h + 6, 8);
    ctx.fill();
    // 배경
    ctx.fillStyle = 'rgba(20, 40, 60, 0.85)';
    roundRect(x, y, w, h, 6);
    ctx.fill();

    // 파워 채움 (광택 + 애니메이션 시프터)
    const pw = (power / 100) * w;
    if (pw > 0) {
      // 메인 그라데이션 — PERFECT 구간 안이면 노란색 단색
      const isInPerfect = (power >= CONFIG.perfectZone.min && power <= CONFIG.perfectZone.max);
      const grad = ctx.createLinearGradient(x, y, x + w, y);
      if (isInPerfect) {
        // PERFECT 구간에 진입 — 채워진 영역이 노란색
        grad.addColorStop(0, '#FFD166');
        grad.addColorStop(0.5, '#FFE066');
        grad.addColorStop(1, '#FFAA00');
      } else {
        grad.addColorStop(0, '#4FB3D9');
        grad.addColorStop(0.5, '#FFD166');
        grad.addColorStop(1, '#E76F51');
      }
      ctx.fillStyle = grad;
      roundRect(x, y, pw, h, 6);
      ctx.fill();
      // 광택 (위쪽 하이라이트)
      const shine = ctx.createLinearGradient(x, y, x, y + h);
      shine.addColorStop(0, 'rgba(255,255,255,0.45)');
      shine.addColorStop(0.5, 'rgba(255,255,255,0.0)');
      shine.addColorStop(1, 'rgba(0,0,0,0.18)');
      ctx.fillStyle = shine;
      roundRect(x, y, pw, h, 6);
      ctx.fill();
      // 시프터 (이동하는 광택 라인)
      const shifterX = (t / 8) % (w + 80) - 40;
      if (shifterX > 0 && shifterX < pw) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.moveTo(x + shifterX, y + 2);
        ctx.lineTo(x + shifterX + 12, y + 2);
        ctx.lineTo(x + shifterX + 8, y + h - 2);
        ctx.lineTo(x + shifterX - 4, y + h - 2);
        ctx.closePath();
        ctx.fill();
      }
    }

    // 성공 / PERFECT 영역 표시
    drawZone(x + (CONFIG.castZone.min / 100) * w, x + (CONFIG.castZone.max / 100) * w, y, h, 'rgba(255,255,255,0.18)');
    // PERFECT 구역은 펄스 + '거의 PERFECT!' 힌트 (퍼펙트 구간 진입 시)
    const pX0 = x + (CONFIG.perfectZone.min / 100) * w;
    const pX1 = x + (CONFIG.perfectZone.max / 100) * w;
    drawZone(pX0, pX1, y, h, 'rgba(231,111,81,0.5)');
    // PERFECT 구역 강조 (펄스)
    const pulse = (Math.sin(t / 110) * 0.5 + 0.5);
    ctx.fillStyle = `rgba(255, 209, 102, ${0.10 + pulse * 0.18})`;
    roundRect(pX0 - 2, y - 2, pX1 - pX0 + 4, h + 4, 8);
    ctx.fill();
    // 진입 화살표 (게이지가 PERFECT 구역에 있을 때)
    if (power >= CONFIG.perfectZone.min && power <= CONFIG.perfectZone.max) {
      // 핑크/노랑 빛
      ctx.fillStyle = `rgba(255, 237, 160, ${0.6 + pulse * 0.4})`;
      ctx.fillRect(pX0, y - 4, pX1 - pX0, 3);
      ctx.fillRect(pX0, y + h + 1, pX1 - pX0, 3);
    }

    // 영역 라벨 (PERFECT 영역)
    ctx.fillStyle = 'rgba(231, 111, 81, 0.95)';
    ctx.font = '700 10px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.textAlign = 'center';
    const pX = (pX0 + pX1) / 2;
    ctx.fillText('PERFECT', pX, y + h + 14);
    // 게이지가 PERFECT 구간 안에 있을 때 '거의 PERFECT!' 힌트 + 좌우 화살표
    if (power >= CONFIG.perfectZone.min && power <= CONFIG.perfectZone.max) {
      ctx.fillStyle = '#FFD166';
      ctx.font = '800 11px -apple-system, "Apple SD Gothic Neo", sans-serif';
      ctx.fillText('🎯 거의 PERFECT!', pX, y - 12);
      // 좌우 화살표 "여기서 멈춰!" — 펄싱
      const arrowPulse = Math.sin(t / 80) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(255, 209, 102, ${0.7 + arrowPulse * 0.3})`;
      // 왼쪽 화살표
      ctx.beginPath();
      ctx.moveTo(pX0 - 8, y + h / 2);
      ctx.lineTo(pX0, y + h / 2 - 4);
      ctx.lineTo(pX0, y + h / 2 + 4);
      ctx.closePath();
      ctx.fill();
      // 오른쪽 화살표
      ctx.beginPath();
      ctx.moveTo(pX1 + 8, y + h / 2);
      ctx.lineTo(pX1, y + h / 2 - 4);
      ctx.lineTo(pX1, y + h / 2 + 4);
      ctx.closePath();
      ctx.fill();
    }

    // 라벨
    ctx.fillStyle = '#fff';
    ctx.font = '700 13px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎣 CAST 파워 · 스페이스 떼면 발사', W / 2, y - 10);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawZone(x0, x1, y, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x0, y, x1 - x0, h);
  }

  function drawDriftIndicator() {
    const t = performance.now();
    // 미끼가 바다 위를 떠다니는 인디케이터 (찌와르르)
    const cx = W / 2;
    const cy = 56;
    // 펄스 글로우
    ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.18 + Math.sin(t / 280) * 0.08) + ')';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 96 + Math.sin(t / 280) * 4, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    // 텍스트
    ctx.fillStyle = 'rgba(15, 42, 56, 0.95)';
    ctx.fillRect(cx - 90, cy - 14, 180, 28);
    ctx.fillStyle = '#fff';
    ctx.font = '700 14px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎣 입질 대기…', cx, cy + 5);
    // 미끼 흔들림 표시 (점 3개)
    for (let i = 0; i < 3; i++) {
      const d = (t / 200 + i * 0.4) % 1.5;
      const a = Math.max(0, 1 - d / 1.5);
      const dotX = cx + (i - 1) * 24 + Math.sin(t / 200 + i) * 3;
      ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.6})`;
      ctx.beginPath();
      ctx.arc(dotX, cy + 28 + d * 4, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBiteBar() {
    const w = 360, h = 22;
    const x = W / 2 - w / 2, y = H / 2 - h / 2;
    const t = performance.now();

    // 화면 흔들림 (입질 임박 시)
    const ratio = 1 - (game.biteLeft / CONFIG.biteWindow);
    if (ratio > 0.5) {
      const shake = (ratio - 0.5) * 6; // 최대 3px
      const sx = (Math.random() - 0.5) * shake;
      const sy = (Math.random() - 0.5) * shake;
      ctx.save();
      ctx.translate(sx, sy);
    }

    // 외곽 그림자 + 라운드 박스
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(x - 3, y - 3, w + 6, h + 6, 8);
    ctx.fill();

    // 배경 어두운 슬롯
    ctx.fillStyle = 'rgba(20, 40, 60, 0.85)';
    roundRect(x, y, w, h, 6);
    ctx.fill();

    // 그라데이션 노랑 → 빨강
    const grad = ctx.createLinearGradient(x, y, x + w, y);
    const r = 255;
    const g = Math.floor(209 + (50 - 209) * ratio);
    const b = Math.floor(102 + (60 - 102) * ratio);
    grad.addColorStop(0, `rgb(${r},${Math.max(g, 130)},${b})`);
    grad.addColorStop(1, `rgb(${r},${Math.max(g, 80)},${Math.max(b, 50)})`);
    ctx.fillStyle = grad;
    const progressW = ratio * w;
    roundRect(x, y, Math.max(progressW, 4), h, 6);
    ctx.fill();

    // 광택 (상단)
    const shine = ctx.createLinearGradient(x, y, x, y + h);
    shine.addColorStop(0, 'rgba(255,255,255,0.4)');
    shine.addColorStop(0.5, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = shine;
    roundRect(x, y, Math.max(progressW, 4), h, 6);
    ctx.fill();

    // 펄스 (입질 임박 시 하트박동)
    if (ratio > 0.6) {
      const pulse = Math.sin(t / (ratio > 0.85 ? 80 : 140)) * 0.5 + 0.5;
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 + pulse * 0.4})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
    }

    // 라벨
    ctx.fillStyle = '#fff';
    ctx.font = '900 18px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('입질!  PULL  🐟', W / 2, y - 10);

    // 곧 끝남! (ratio > 0.85) — 강한 빨강 + 화살표
    if (ratio > 0.85) {
      ctx.fillStyle = `rgba(231, 76, 60, ${0.6 + pulse * 0.4})`;
      ctx.font = '900 14px -apple-system, "Apple SD Gothic Neo", sans-serif';
      ctx.fillText('⚡ 곧 끝남!', W / 2, y - 30);
    }

    // 타이머 카운트다운
    const tLeft = game.biteLeft.toFixed(1);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(W / 2 - 22, y + h + 6, 44, 18);
    ctx.fillStyle = '#fff';
    ctx.font = '700 12px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.fillText(tLeft + 's', W / 2, y + h + 19);

    if (ratio > 0.5) ctx.restore();
  }

  function drawReelGauge() {
    const w = 440, h = 28;
    const x = W / 2 - w / 2, y = H - 88;
    const t = performance.now();
    const f = game.activeFish;
    const isBig = f && f.reelDifficulty && f.reelDifficulty >= CONFIG.bigFishDiff;

    // 외곽 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(x - 3, y - 3, w + 6, h + 6, 8);
    ctx.fill();

    // 어두운 슬롯
    ctx.fillStyle = 'rgba(20, 40, 60, 0.85)';
    roundRect(x, y, w, h, 6);
    ctx.fill();

    // 게이지 채움
    const pw = (game.reelPct / 100) * w;
    if (pw > 0) {
      const grad = ctx.createLinearGradient(x, y, x + w, y);
      if (isBig) {
        grad.addColorStop(0, '#C24A3A');
        grad.addColorStop(0.7, '#FFD166');
        grad.addColorStop(1, '#FFEDA0');
      } else {
        grad.addColorStop(0, '#4FB3D9');
        grad.addColorStop(0.6, '#5DA39A');
        grad.addColorStop(1, '#FFD166');
      }
      ctx.fillStyle = grad;
      roundRect(x, y, pw, h, 6);
      ctx.fill();
      // 광택
      const shine = ctx.createLinearGradient(x, y, x, y + h);
      shine.addColorStop(0, 'rgba(255,255,255,0.45)');
      shine.addColorStop(0.5, 'rgba(255,255,255,0.0)');
      shine.addColorStop(1, 'rgba(0,0,0,0.18)');
      ctx.fillStyle = shine;
      roundRect(x, y, pw, h, 6);
      ctx.fill();
    }

    // 80% 페이크 위험 구간 (대물 한정) — 깜빡임
    if (isBig && game.reelPct > 80) {
      const blink = Math.sin(t / 80) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(231, 111, 81, ${0.3 + blink * 0.3})`;
      ctx.fillRect(x + (80 / 100) * w, y, w - (80 / 100) * w, h);
    }

    // FULL 시 폰티
    if (game.reelPct >= 100) {
      const flash = (Math.sin(t / 80) * 0.5 + 0.5);
      ctx.fillStyle = `rgba(255, 237, 160, ${0.3 + flash * 0.4})`;
      ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
    }

    // 라벨
    ctx.fillStyle = '#fff';
    ctx.font = '700 13px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.textAlign = 'center';
    const sub = f ? `${f.name_ko}${f.reelDifficulty && f.reelDifficulty > 1 ? ` (×${f.reelDifficulty.toFixed(1)})` : ''}` : '';
    const baseLabel = input && input.isPressed() ? Math.round(RT.reelBoostRate) : Math.round(RT.reelBaseRate);
    ctx.fillText('REEL  ' + Math.floor(game.reelPct) + '% · ' + sub + '  [' + baseLabel + '%/s]', W / 2, y - 10);
  }

  // 워터 스파클 파티클 (CATCH 연출 중)
  const splashParticles = [];
  function spawnSplashParticles(x, y, color) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 3.5;
      splashParticles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 1,
        life: 1.0,
        color: color || '#fff',
        size: 1 + Math.random() * 2,
        gravity: 0.15,
      });
    }
  }
  function updateAndDrawSplash() {
    for (let i = splashParticles.length - 1; i >= 0; i--) {
      const p = splashParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.life -= 0.025;
      if (p.life <= 0) {
        splashParticles.splice(i, 1);
        continue;
      }
      ctx.fillStyle = `rgba(255, 255, 255, ${p.life * 0.8})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCatchFx() {
    const t = 1 - (game.animT / CONFIG.catchAnimTime);
    const a = 1 - t;
    const f = game.activeFish;
    const color = (f && f.color) ? f.color : '#FFD166';
    const sizeBoost = f && f.size === 'M' ? 1.4 : 1.0;
    const isFirst = f && !codex.isCaught(f.id);

    // 어종이 REELING 중 잡혔을 때의 마지막 위치 (캐시) — 어종 근처 결과 표시
    let catchX, catchY;
    if (game.phase === PHASE.CATCH || game.animT > 0) {
      // REELING 위치 (REELING 의 마지막 1 시점)
      catchX = 220 + (1 - game.reelPct / 100) * 320;
      catchY = H * 0.55 + 12 - (game.reelPct / 100) * 36;
    } else {
      catchX = W / 2;
      catchY = H * 0.55;
    }
    // (어종 근처에서 표시하기 위해 catchX/catchY 사용)

    // 어종 색의 큰 폭발 (어종 근처)
    if (t < 0.15 && splashParticles.length === 0) {
      spawnSplashParticles(catchX, catchY + 7, color);
    }
    updateAndDrawSplash();

    // 어종 색의 컬러 버스트 (어종 근처)
    const burstGrad = ctx.createRadialGradient(catchX, catchY, 0, catchX, catchY, 200 * sizeBoost);
    burstGrad.addColorStop(0, hexToRgba(color, 0.6 * a));
    burstGrad.addColorStop(0.5, hexToRgba(color, 0.25 * a));
    burstGrad.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = burstGrad;
    ctx.beginPath();
    ctx.arc(catchX, catchY, 200 * sizeBoost, 0, Math.PI * 2);
    ctx.fill();

    // 노란 링
    ctx.strokeStyle = `rgba(255, 209, 102, ${0.9 * a})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(catchX, catchY, 24 + t * 90 * sizeBoost, 0, Math.PI * 2);
    ctx.stroke();
    // 두 번째 링 (지연)
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * a * (1 - t)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(catchX, catchY, 20 + t * 130 * sizeBoost, 0, Math.PI * 2);
    ctx.stroke();

    // 8방향 스파클 라인 (어종 근처)
    if (a > 0.5) {
      ctx.strokeStyle = `rgba(255, 237, 160, ${(a - 0.5) * 2})`;
      ctx.lineWidth = 2;
      const r1 = 30, r2 = 30 + t * 50 * sizeBoost;
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(catchX + Math.cos(ang) * r1, catchY + Math.sin(ang) * r1);
        ctx.lineTo(catchX + Math.cos(ang) * r2, catchY + Math.sin(ang) * r2);
        ctx.stroke();
      }
    }

    // CATCH! 라벨 (어종 위)
    const catchScale = 1 + Math.sin(t * Math.PI) * 0.3;
    ctx.save();
    ctx.translate(catchX, catchY - 64);
    ctx.scale(catchScale, catchScale);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '900 36px -apple-system, "Apple SD Gothic Neo", sans-serif';
    ctx.textAlign = 'center';
    // 외곽선
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#FFD166';
    ctx.strokeText('CATCH!', 0, 0);
    ctx.fillText('CATCH!', 0, 0);
    ctx.restore();

    // 어종 칭호
    if (f) {
      ctx.fillStyle = hexToRgba(color, 0.95);
      ctx.font = '700 16px -apple-system, "Apple SD Gothic Neo", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${f.name_ko}  ·  ${f.title || ''}`, W / 2, H * 0.55 - 32);

      // 사이즈 (cm)
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(W / 2 - 30, H * 0.55 - 18, 60, 18);
      ctx.fillStyle = '#FFD166';
      ctx.font = '700 13px -apple-system, "Apple SD Gothic Neo", sans-serif';
      const lastRec = game.records[game.records.length - 1];
      const sizeTxt = lastRec ? `${lastRec.sizeCm}cm` : '';
      ctx.fillText(sizeTxt, W / 2, H * 0.55 - 5);

      // 첫 어획 강조
      if (isFirst) {
        const popY = H * 0.55 + 30 - t * 16;
        ctx.fillStyle = 'rgba(255, 209, 102, 0.95)';
        ctx.fillRect(W / 2 - 70, popY - 14, 140, 22);
        ctx.strokeStyle = '#C24A3A';
        ctx.lineWidth = 2;
        ctx.strokeRect(W / 2 - 70, popY - 14, 140, 22);
        ctx.fillStyle = '#1a1a1a';
        ctx.font = '900 13px -apple-system, "Apple SD Gothic Neo", sans-serif';
        ctx.fillText('🎉 LIFETIME FIRST!', W / 2, popY + 1);
      }
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
    // 잔잔한 동심원
    ctx.strokeStyle = `rgba(200, 200, 200, ${0.5 * (1 - t)})`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.55, 30 + i * 22 + t * 24, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 텍스트
    ctx.fillStyle = `rgba(220, 220, 220, ${(1 - t)})`;
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
    if (elCoins) {
      const prev = parseInt(elCoins.textContent || '0', 10) || 0;
      const next = economy.data.coins;
      elCoins.textContent = next;
      // 코인 증가 시 펄스
      if (next > prev) {
        elCoins.parentElement.classList.remove('coin-pulse');
        // 강제 리플로우
        void elCoins.parentElement.offsetWidth;
        elCoins.parentElement.classList.add('coin-pulse');
      }
    }
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
        elFlurry.textContent = (game.megaFlurry ? '💎 ' : '🔥 ') + Math.ceil(game.flurryLeft) + 's';
        flurryEl.classList.remove('hidden');
        flurryEl.classList.toggle('mega', !!game.megaFlurry);
      } else {
        flurryEl.classList.add('hidden');
        flurryEl.classList.remove('mega');
      }
    }
    // 시간대 인디케이터
    const tiEl = document.getElementById('time-indicator');
    const tiNameEl = document.getElementById('time-name');
    if (tiEl && tiNameEl) {
      tiNameEl.textContent = TIME_NAMES[timeOfDay] || '낮';
      // 인디케이터 색 (시간대별)
      tiEl.classList.remove('t-0','t-1','t-2','t-3');
      tiEl.classList.add('t-' + timeOfDay);
      // 점 4개 중 현재 시간대까지 on
      const dots = tiEl.querySelectorAll('.ti-dot');
      dots.forEach((d, i) => {
        d.classList.toggle('on', i <= timeOfDay);
      });
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
      const delta = sizeCm - rec.prevCm;
      const isMega = rec.prevCm > 0 && delta >= 10; // 10cm 이상 신기록 → 메가
      game.records.push({ id: f.id, name_ko: f.name_ko, sizeCm, prevCm: rec.prevCm, bonus: bonusCm, mega: isMega });
      // 신기록 비네트 (최초 등극도 동일 효과)
      flashVignette();
      if (sound && sound.record) sound.record();
    }

    // 4) 도감 등록 (최초 1회)
    if (!codex.isCaught(f.id)) {
      codex.register(f.id);
      game.newCodexIds.push(f.id);
    }

    // 5) 누적
    // FLURRY 활성 시 ×1.5, MEGA FLURRY 시 ×3.0
    if (game.megaFlurry && game.flurryLeft > 0) {
      const extra = Math.round(gain * 2.0); // ×3.0 = gain + gain*2
      gain += extra;
    } else if (game.flurryLeft > 0) {
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

    // 콤보 마일스톤 (5/10) — 5는 FLURRY(기본), 10은 MEGA FLURRY
    if (game.combo === 5) {
      game.flurryLeft = CONFIG.flurryDuration;
      game.flurryCount += 1;
      showToast('🔥 콤보 5!  FLURRY ×' + CONFIG.flurryMult.toFixed(1) + ' (' + CONFIG.flurryDuration + 's)', 'perfect');
      if (sound && sound.combo) sound.combo();
    } else if (game.combo === 10) {
      // MEGA FLURRY — 배율 3배, 5초
      game.flurryLeft = 5;
      game.flurryCount += 1;
      game.megaFlurry = true;
      showToast('💎 콤보 10!  MEGA FLURRY ×3.0 (5s)', 'perfect');
      if (sound && sound.mega) sound.mega();
    }

    // 7) 토스트
    let msg = '+' + gain + ' ' + f.name_ko + ' (' + sizeCm + 'cm)';
    if (rec.isNew && rec.prevCm > 0) msg = '신기록! ' + msg;
    else if (rec.isNew) msg = '신규 도감! ' + msg;
    if (game.combo > 1) msg = '×' + game.combo + ' ' + msg;
    if (game.flurryLeft > 0 && game.combo < 5) {
      msg = '🔥 ' + msg;
    } else if (game.megaFlurry) {
      msg = '💎 ' + msg;
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

    // 칭호 (콤보 단계별)
    const titleEl = document.getElementById('result-title');
    if (titleEl) {
      // 칭호 결정 (시간대 + 콤보 단계)
      // 1) 콤보 최우선 (왕관)
      let title;
      if (game.maxCombo >= 8)       title = '👑 MASTER 어부';
      else if (game.maxCombo >= 7)  title = '👑 수문장';
      else if (game.maxCombo >= 5)  title = '🎣 대어 사냥꾼';
      else if (game.maxCombo >= 3)  title = '🛡️ 안정적 어부';
      // 2) 시간대 칭호 (콤보 낮을 때)
      else if (timeOfDay === 0)      title = '🌅 새벽 항해사';
      else if (timeOfDay === 1)      title = '☀️ 낮 출조자';
      else if (timeOfDay === 2)      title = '🌇 황혼 어부';
      else if (timeOfDay === 3)      title = '🌙 심해 낚시꾼';
      // 3) 기본
      else if (game.catchCount >= 1) title = '🌊 첫 출조';
      else                          title = '출조 결과';
      titleEl.textContent = title;
    }

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
        const cls = r.mega ? 'badge record big mega' : 'badge record big';
        parts.push(`<span class="${cls}">${r.name_ko} ${r.sizeCm}cm <em>${detail}</em></span>`);
      });
      // MEGA 신기록 별도 강조 (10cm 이상 갱신)
      const megas = game.records.filter((r) => r.mega);
      if (megas.length > 0) {
        parts.unshift(`<span class="badge mega-record">💎 MEGA 신기록 ${megas[0].name_ko} +${+(megas[0].sizeCm - megas[0].prevCm).toFixed(1)}cm!</span>`);
      }
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
      const liveFid = liveEvent.pick();
      const liveFish = liveFid ? game.fish.find((f) => f.id === liveFid) : null;
      const liveLine = liveFish ? `<p class="modal-line muted">⭐ 이번 주의 대물: <strong style="color:#C24A3A">${liveFish.name_ko}</strong></p>` : '';
      const timeOfDayLabel = (typeof TIME_NAMES !== 'undefined' && TIME_NAMES[timeOfDay]) || '낮';
      const timeLine = `<p class="modal-line muted">🕐 출조 시간대: <strong style="color:#2B7A9B">${timeOfDayLabel}</strong></p>`;
      // 출조 시간 (inGameT → 분:초)
      const inGameT = Math.floor(game.inGameT || 0);
      const min = Math.floor(inGameT / 60);
      const sec = inGameT % 60;
      const timeStr = min > 0 ? `${min}분 ${sec}초` : `${sec}초`;
      const runTimeLine = `<p class="modal-line muted">⏱ 출조 시간: <strong style="color:#1B3A5C">${timeStr}</strong></p>`;
      const streakLine = (daily.data.streak || 0) >= 1
        ? `<p class="modal-line muted">🔥 연속 ${daily.data.streak}일 — 내일 또 만나요</p>` : '';
      rateEl.innerHTML =
        `<p class="modal-line">수집률 <strong>${caught}/${total}</strong> (${pct}%)</p>` +
        (caught === total ? `<p class="modal-line muted">동해방파제 100%! SHOP/다음 지역 coming soon</p>` : '') +
        liveLine + timeLine + runTimeLine + streakLine;
    }
  }
  // RESULT 진입 시 changeState() 가 이 함수를 호출한다 (위 changeState RESULT 분기에서).
  // renderResult 는 어종별 어획/신기록 배지/수집률/다음 목표를 모달에 채워 넣는다.

  // SHOP 화면 — 3축 업그레이드 카드
  function renderShop() {
    const listEl = document.getElementById('shop-list');
    const coinsEl = document.getElementById('shop-coins');
    if (!listEl) return;
    if (coinsEl) {
      const prev = parseInt(coinsEl.textContent || '0', 10) || 0;
      const next = economy.data.coins;
      coinsEl.textContent = next;
      if (next > prev) {
        coinsEl.parentElement.classList.remove('coin-pulse');
        void coinsEl.parentElement.offsetWidth;
        coinsEl.parentElement.classList.add('coin-pulse');
      } else if (next < prev) {
        // 코인 차감 시 빨간 펄스
        coinsEl.parentElement.classList.remove('coin-pulse-down');
        void coinsEl.parentElement.offsetWidth;
        coinsEl.parentElement.classList.add('coin-pulse-down');
      }
    }

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
          if (sound && sound.buy) sound.buy();
        } else {
          // 코인 부족
          const need = economy.nextCost(uid);
          const have = economy.data.coins;
          showToast('🪙 부족! ' + (need - have) + ' 코인 더 필요', 'fail');
          // 버튼 빨간 펄스
          btn.classList.remove('shop-buy-shake');
          void btn.offsetWidth;
          btn.classList.add('shop-buy-shake');
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
    const liveEl = document.getElementById('codex-live');
    const liveNameEl = document.getElementById('codex-live-name');
    if (!listEl) return;

    const total = game.fish.length;
    const caught = game.fish.filter((f) => !f.locked && codex.isCaught(f.id)).length;
    const activeTotal = game.fish.filter((f) => !f.locked).length;
    const pct = activeTotal > 0 ? Math.round((caught / activeTotal) * 100) : 0;
    if (rateEl) rateEl.textContent = `${caught} / ${activeTotal}  (${pct}%)`;

    // 라이브 배지 (이번 주의 대물)
    const liveFid = liveEvent.pick();
    if (liveFid && liveEl && liveNameEl) {
      const liveFish = game.fish.find((f) => f.id === liveFid);
      if (liveFish) {
        liveNameEl.textContent = liveFish.name_ko;
        liveEl.style.display = 'block';
      } else {
        liveEl.style.display = 'none';
      }
    } else if (liveEl) {
      liveEl.style.display = 'none';
    }

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
        + ' rarity-' + (f.rarity || 'common')
        + (!isLocked && f.id === liveFid ? ' live-feature' : '');

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
  // 사운드 (Web Audio API — 라이브러리 0, v0.3 8단계)
  // ----------------------------------------------------------
  // 배경 파도 루프 + 캐스트/REEL/PULL/CATCH/MISS/FLURRY 효과음.
  // 사운드 토글은 localStorage 'case_reel.sound.v1' 에 저장.
  const sound = {
    ctx: null,
    enabled: true,
    oceanGain: null,
    oceanSource: null,
    soundKey: 'case_reel.sound.v1',

    init() {
      // 사용자 인터랙션 전에는 AudioContext가 suspended 일 수 있음 — resume 는 첫 PRESS 시.
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this._setupOcean();
      } catch (e) {
        console.warn('[Case&Reel] 사운드 초기화 실패', e.message);
      }
    },
    resume() {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    _setupOcean() {
      if (!this.ctx) return;
      // 파도 루프: 백색 잡음을 LPF + LFO 로 변조해 잔잔한 파도 생성
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 4, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const lpf = this.ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 400;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.18;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 80;
      lfo.connect(lfoGain);
      lfoGain.connect(lpf.frequency);
      const gain = this.ctx.createGain();
      gain.gain.value = 0.06;
      src.connect(lpf);
      lpf.connect(gain);
      gain.connect(this.ctx.destination);
      src.start();
      lfo.start();
      this.oceanGain = gain;
      this.oceanSource = src;
    },
    setEnabled(on) {
      this.enabled = !!on;
      try { localStorage.setItem(this.soundKey, this.enabled ? '1' : '0'); } catch (e) {}
      if (this.oceanGain) this.oceanGain.gain.value = on ? 0.06 : 0;
    },
    loadEnabled() {
      try {
        const v = localStorage.getItem(this.soundKey);
        if (v !== null) this.enabled = v === '1';
      } catch (e) {}
    },
    // PAUSE 시 BGM fadeOut / 재개 시 fadeIn
    pauseOcean() {
      if (!this.ctx || !this.oceanGain) return;
      const t = this.ctx.currentTime;
      this.oceanGain.gain.cancelScheduledValues(t);
      this.oceanGain.gain.setValueAtTime(this.oceanGain.gain.value, t);
      this.oceanGain.gain.linearRampToValueAtTime(0, t + 0.4);
    },
    resumeOcean() {
      if (!this.ctx || !this.oceanGain) return;
      const t = this.ctx.currentTime;
      const target = this.enabled ? 0.06 : 0;
      this.oceanGain.gain.cancelScheduledValues(t);
      this.oceanGain.gain.setValueAtTime(this.oceanGain.gain.value, t);
      this.oceanGain.gain.linearRampToValueAtTime(target, t + 0.4);
    },
    // 사운드 이펙트 — 단발 사인/노이즈
    // toneShift: 시간대별 톤 변형 (-1: 밤/낮은, 0: 중성, 1: 밝은)
    //   밤(3): -1 (한 옥타브 아래 + 어둡게), 노을(2): -0.3 (따뜻하게)
    //   아침(0): +0.5 (맑게), 낮(1): 0 (중성)
    _tone(freq, dur, type = 'sine', vol = 0.2, attack = 0.01, release = 0.05, toneShift = 0) {
      if (!this.enabled || !this.ctx) return;
      this.resume();
      const t = this.ctx.currentTime;
      // 톤 시프트: +1 옥타브 (×2), -1 옥타브 (×0.5), 그 사이 선형
      const freqFactor = Math.pow(2, toneShift);
      const volFactor = toneShift < 0 ? Math.max(0.55, 1 + toneShift * 0.45) : 1.0;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq * freqFactor, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol * volFactor, t + attack);
      g.gain.linearRampToValueAtTime(0, t + dur + release);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + dur + release + 0.02);
    },
    // 시간대별 toneShift 반환
    _toneShift() {
      if (typeof timeOfDay === 'undefined') return 0;
      if (timeOfDay === 3) return -1;     // 밤: 한 옥타브 아래, 어둡게
      if (timeOfDay === 2) return -0.3;   // 노을: 따뜻하게
      if (timeOfDay === 0) return 0.5;    // 아침: 한 옥타브 위, 맑게
      return 0;                            // 낮: 중성
    },
    cast() { // 캐스트 — 휘익
      const ts = this._toneShift();
      this._tone(380, 0.18, 'triangle', 0.18, 0.005, 0.05, ts);
      this._tone(180, 0.12, 'sine', 0.10, 0.01, 0.04, ts);
    },
    bite() { // 입질 — 찌르륵
      const ts = this._toneShift();
      this._tone(820, 0.06, 'square', 0.18, 0.003, 0.03, ts);
      this._tone(1200, 0.04, 'square', 0.10, 0.002, 0.02, ts);
    },
    pull() { // PULL — 짧은 클릭
      this._tone(520, 0.05, 'sine', 0.20, 0.002, 0.02, this._toneShift());
    },
    reelTick() { // REEL 1틱 — 부드러운 휙
      this._tone(220, 0.04, 'triangle', 0.10, 0.003, 0.02, this._toneShift());
    },
    catch() { // CATCH — 밝은 차임
      const ts = this._toneShift();
      this._tone(880, 0.20, 'sine', 0.22, 0.005, 0.08, ts);
      this._tone(1320, 0.18, 'sine', 0.16, 0.01, 0.06, ts);
    },
    miss() { // MISS — 둔탁한 띵
      this._tone(180, 0.20, 'sine', 0.18, 0.005, 0.10, this._toneShift());
    },
    combo() { // 콤보 5 — 상승 차임
      const ts = this._toneShift();
      this._tone(660, 0.10, 'sine', 0.20, 0.005, 0.05, ts);
      this._tone(990, 0.10, 'sine', 0.18, 0.01, 0.05, ts);
    },
    mega() { // 콤보 10 — 화려한 차임
      const ts = this._toneShift();
      this._tone(660, 0.10, 'sine', 0.22, 0.005, 0.05, ts);
      this._tone(990, 0.10, 'sine', 0.22, 0.01, 0.05, ts);
      this._tone(1320, 0.12, 'sine', 0.18, 0.015, 0.06, ts);
    },
    record() { // 신기록 — 경쾌한 2단
      const ts = this._toneShift();
      this._tone(990, 0.08, 'sine', 0.20, 0.005, 0.04, ts);
      setTimeout(() => this._tone(1320, 0.10, 'sine', 0.22, 0.005, 0.06, ts), 80);
    },
    buy() { // 상점 구매 — 짧은 확인음
      const ts = this._toneShift();
      this._tone(880, 0.06, 'sine', 0.18, 0.003, 0.04, ts);
      this._tone(1320, 0.06, 'sine', 0.14, 0.01, 0.04, ts);
    },
  };
  sound.loadEnabled();
  sound.init();

  // ----------------------------------------------------------
  // 일일 접속 (연속 접속일 + 첫 출조 보너스)
  // ----------------------------------------------------------
  // localStorage 'case_reel.daily.v1' = { lastYmd: 'YYYY-MM-DD', streak: N, claimedYmd: 'YYYY-MM-DD' }
  const daily = {
    key: 'case_reel.daily.v1',
    data: { lastYmd: '', streak: 0, claimedYmd: '' },
    load() {
      try {
        const raw = localStorage.getItem(this.key);
        if (raw) this.data = JSON.parse(raw);
      } catch (e) {}
    },
    save() {
      try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) {}
    },
    todayYmd() {
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },
    ymdDiffDays(ymd1, ymd2) {
      // 두 YYYY-MM-DD 사이의 일수 차이
      const a = new Date(ymd1 + 'T00:00:00');
      const b = new Date(ymd2 + 'T00:00:00');
      return Math.round((b - a) / 86400000);
    },
    // 오늘 첫 접속 시 streak 증가, 어제 접속이 아니면 1로 리셋
    rollOver() {
      const today = this.todayYmd();
      if (this.data.lastYmd === today) return false; // 오늘 이미 카운트됨
      if (!this.data.lastYmd) {
        this.data.streak = 1;
      } else {
        const diff = this.ymdDiffDays(this.data.lastYmd, today);
        if (diff === 1) this.data.streak = (this.data.streak || 0) + 1;
        else this.data.streak = 1; // 하루 건너뛰면 리셋
      }
      this.data.lastYmd = today;
      this.save();
      return true; // streak 갱신됨
    },
    // 첫 출조 보너스 (오늘 아직 안 받음)
    canClaim() {
      return this.data.claimedYmd !== this.todayYmd();
    },
    // 보너스 계산: 1일차 +3코인, +1미끼 / 7일차 +20코인, +3미끼
    bonus() {
      const s = Math.max(1, this.data.streak || 1);
      if (s >= 7) return { coins: 20, bait: 3, label: '🎁 7일 연속!  🪙 20 + 미끼 3' };
      if (s >= 3) return { coins: 8,  bait: 1, label: '🎁 ' + s + '일 연속  🪙 8 + 미끼 1' };
      return { coins: 3, bait: 1, label: '🎁 첫 출조  🪙 3 + 미끼 1' };
    },
    claim() {
      if (!this.canClaim()) return null;
      const b = this.bonus();
      this.data.claimedYmd = this.todayYmd();
      this.save();
      return b;
    },
  };
  daily.load();
  daily.rollOver(); // 앱 부팅 시 오늘자 streak 갱신

  // ----------------------------------------------------------
  // 라이브 이벤트 (이번 주 대물)
  // ----------------------------------------------------------
  // 매주 월요일 0시 기준, 12종 중 1종을 '이번 주의 대물'로 선정.
  // 동해에 종 가중치 5x (다음 지역 잠금 해제 전까지). 코덱스에 라이브 배지.
  const liveEvent = {
    key: 'case_reel.live.v1',
    data: { weekKey: '', featureId: '' },
    load() {
      try {
        const raw = localStorage.getItem(this.key);
        if (raw) this.data = JSON.parse(raw);
      } catch (e) {}
    },
    save() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) {} },
    weekKey() {
      const d = new Date();
      // ISO 주차 계산
      const target = new Date(d.valueOf());
      const dayNr = (d.getDay() + 6) % 7;
      target.setDate(target.getDate() - dayNr + 3);
      const firstThursday = target.valueOf();
      target.setMonth(0, 1);
      if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
      }
      const week = 1 + Math.ceil((firstThursday - target) / 604800000);
      return d.getFullYear() + '-W' + String(week).padStart(2, '0');
    },
    // 이번 주 대물 어종 결정 (동해 활성 3종 중 1종, 해시 기반 결정적)
    pick() {
      const wk = this.weekKey();
      if (this.data.weekKey === wk && this.data.featureId) return this.data.featureId;
      // 결정적 해시: weekKey 의 char 합
      let h = 0;
      for (let i = 0; i < wk.length; i++) h = (h * 31 + wk.charCodeAt(i)) >>> 0;
      const active = (game.fish || []).filter((f) => !f.locked);
      if (active.length === 0) return null;
      const idx = h % active.length;
      this.data = { weekKey: wk, featureId: active[idx].id };
      this.save();
      return active[idx].id;
    },
    // 동해의 활성 어종에 가중치 부스트 (대물 어종 weight × 3, 나머지 × 0.7).
    // 시간대별 추가: 밤(3)에 우럭 × 2, 노을(2)에 전갱이 × 1.5.
    adjustWeights() {
      const fid = this.pick();
      game.fish.forEach((f) => {
        if (f.locked) return;
        let w = f.weight || 50;
        // 기본 분배: 대물 × 3, 나머지 × 0.7
        if (f.id === fid) w *= 3;
        else w *= 0.7;
        // 시간대별 보너스
        if (timeOfDay === 3 && f.id === 'rockfish') w *= 2.0;       // 밤 = 우럭 가중
        else if (timeOfDay === 2 && f.id === 'horse_mackerel') w *= 1.5; // 노을 = 전갱이
        f.weight = Math.max(5, w);
      });
    },
  };
  liveEvent.load();

  // ----------------------------------------------------------
  // 부트스트랩
  // ----------------------------------------------------------
  let input; // 전역 참조 (REEL 가속 체크용)

  Promise.all([loadFishData(), loadEconomyData()]).then(([fishData, economyData]) => {
    game.fish = fishData.fish;
    economy.upgrades = economyData.upgrades;
    liveEvent.adjustWeights();
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

  // ─── 사운드 토글 버튼 ───
  const btnSound = document.getElementById('btn-sound');
  if (btnSound) {
    // 초기 상태 반영
    btnSound.textContent = sound.enabled ? '🔊' : '🔇';
    btnSound.classList.toggle('muted', !sound.enabled);
    btnSound.addEventListener('click', () => {
      sound.resume();
      const next = !sound.enabled;
      sound.setEnabled(next);
      btnSound.textContent = next ? '🔊' : '🔇';
      btnSound.classList.toggle('muted', !next);
    });
  }

  // ─── 타이틀 연속 접속일 배지 ───
  const titleStreakEl = document.getElementById('title-streak');
  if (titleStreakEl) {
    const s = daily.data.streak || 1;
    if (s >= 1) {
      titleStreakEl.textContent = '🔥 ' + s + '일 연속 출조';
      titleStreakEl.style.display = 'inline-block';
    } else {
      titleStreakEl.style.display = 'none';
    }
  }

  // ─── 일일 보너스 모달 (첫 출조 시 자동) ───
  const elDailyBonus = document.getElementById('daily-bonus');
  const elDailyStreak = document.getElementById('daily-streak');
  const elDailyBonusLine = document.getElementById('daily-bonus-line');
  const btnDailyClaim = document.getElementById('daily-claim');
  function showDailyBonus() {
    if (!elDailyBonus || !daily.canClaim()) return;
    const b = daily.bonus();
    if (elDailyStreak) elDailyStreak.textContent = '🔥 ' + (daily.data.streak || 1) + '일 연속 출조';
    if (elDailyBonusLine) elDailyBonusLine.textContent = '🪙 ' + b.coins + ' + 미끼 ' + b.bait;
    elDailyBonus.classList.remove('hidden');
  }
  function hideDailyBonus() {
    if (elDailyBonus) elDailyBonus.classList.add('hidden');
  }
  if (btnDailyClaim) {
    btnDailyClaim.addEventListener('click', () => {
      const b = daily.claim();
      if (b) {
        economy.addCoins(b.coins);
        // 미끼 보너스는 다음 판부터 — RT.baitPerRun 에 가산 (1회성)
        CONFIG.baitPerRun += b.bait;
        showToast(b.label, 'perfect');
      }
      hideDailyBonus();
      // 보너스 후 PLAY로 자동 전환
      changeState(STATE.PLAY);
    });
  }
  // 첫 진입 시 자동 표시 (TITLE 상태)
  if (game.state === STATE.TITLE) {
    setTimeout(showDailyBonus, 200);
  }

  // 일시정지 모달 버튼 (PAUSE 중 활성화)
  const btnResume = document.getElementById('btn-resume');
  if (btnResume) btnResume.addEventListener('click', () => togglePause());
  const btnQuit = document.getElementById('btn-quit');
  if (btnQuit) btnQuit.addEventListener('click', () => {
    // 일시정지에서 타이틀로 — 점수/미끼는 유지 (단, PLAY 상태 자체 초기화는 아님)
    changeState(STATE.TITLE);
  });

  // 창 포커스 잃으면 토스트 정리 (안전장치)
  window.addEventListener('blur', () => { game.toastT = 0; hideToast(); });
})();
