// data.js — v0.6 정본 데이터 (GAME_DESIGN.md §5, §6 그대로)
// 명세 외 값 추가 금지. 애매하면 0/빈배열 + TODO(spec).

// ---------- 6-1. CONFIG ----------
const CONFIG = {
  RUN: { stages: 3, startBait: 16, jokerSlots: 5 }, // v0.7: 12 -> 16 (미끼 경제 보강)
  STAGE_TARGET: [30, 80, 180],
  PATH: { columns: 4, nodesPerColumn: 2, castsPerNode: [2, 3] },
  BITE_DELAY_MS: [500, 2000],
  BITE_WINDOW_MS: 600,
  CAST_GAUGE_SPEED: 1.0,
  REST_BAIT_RECOVER: 6, // v0.7: 4 -> 6
  REEL: {
    tensionMax: 100,
    safeZoneByStage: { 1: [15, 90], 2: [32, 78], 3: [38, 72], 4: [42, 68] }, // v0.7: stage1 [25,85] -> [15,90]
    timeLimitMs: 12000,
    reelUpRate: 22, reelDownRate: 30, progressRate: 18,
    slackPenalty: 10, resistTensionMult: 2.0, relaxProgressMult: 2.0,
    resistTensionMultStage1: 1.6, // v0.7: 스테이지 1 한정 2.0 -> 1.6
    resistPhaseMsStage1: [900, 1400], // v0.7: 스테이지 1 한정 저항 지속시간 단축 (기본 700~1500)
    tierTensionMult: { 1: 1.0, 2: 1.15, 3: 1.3, 4: 1.5 },
  },
  META_RENOWN_PER_10PTS: 1,
  META_RENOWN_PER_STAGE: 5,
  CARD_RARITY_WEIGHT: { common: 55, uncommon: 30, rare: 13, legendary: 2 },
  NODE_WEIGHT: { fishing: 50, hotspot: 20, shop: 15, rest: 15 },
  NODE_WEIGHT_STAGE1: { fishing: 50, hotspot: 15, shop: 13, rest: 22 }, // v0.7: 스테이지 1 한정 미끼 생존율 강화
  BEGINNER_RUNS_THRESHOLD: 3, // v0.7: 처음 N판 동안 초보 배려 적용 (safety_net 기본지급 등)
  REROLL: {
    startTokens: 2, clearBonus: 1,
    overkillMult: 1.5, overkillBonus: 1,
    perfectCountForBonus: 3, perfectBonus: 1,
    newFishBonus: 1, bossBigCatchBonus: 1,
    costCurve: "n",
  },
};

// ---------- 6-2. FISH ----------
// { id, name, stage, tier, base, size_min, size_max, weight }
// tier: 1=소형 2=중형 3=대형 4=희귀
const FISH = [
  // 스테이지 1
  { id: "gobies",    name: "망둥어",   stage: 1, tier: 1, base: 4,  size_min: 8,  size_max: 20,  weight: 40 },
  { id: "rockfish",  name: "우럭",     stage: 1, tier: 2, base: 8,  size_min: 15, size_max: 35,  weight: 30 },
  { id: "mullet",    name: "숭어",     stage: 1, tier: 2, base: 10, size_min: 20, size_max: 50,  weight: 20 },
  { id: "flatfish1", name: "도다리",   stage: 1, tier: 3, base: 16, size_min: 25, size_max: 45,  weight: 10 },
  // 스테이지 2
  { id: "seabass",   name: "농어",     stage: 2, tier: 3, base: 20, size_min: 40, size_max: 90,  weight: 30 },
  { id: "blackbeam", name: "감성돔",   stage: 2, tier: 3, base: 24, size_min: 25, size_max: 55,  weight: 25 },
  { id: "greenling", name: "노래미",   stage: 2, tier: 2, base: 12, size_min: 20, size_max: 40,  weight: 30 },
  { id: "conger",    name: "붕장어",   stage: 2, tier: 2, base: 14, size_min: 40, size_max: 100, weight: 15 },
  // 스테이지 3
  { id: "tuna",      name: "참치",     stage: 3, tier: 4, base: 60, size_min: 80, size_max: 200, weight: 10 },
  { id: "amberjack", name: "방어",     stage: 3, tier: 3, base: 40, size_min: 60, size_max: 130, weight: 30 },
  { id: "snapper",   name: "참돔",     stage: 3, tier: 3, base: 38, size_min: 40, size_max: 90,  weight: 30 },
  { id: "cutlass",   name: "갈치",     stage: 3, tier: 2, base: 22, size_min: 60, size_max: 120, weight: 30 },
  // 전 스테이지 희귀 (hotspot weight ×2)
  { id: "golden",    name: "황금잉어", stage: 0, tier: 4, base: 80, size_min: 30, size_max: 60,  weight: 3 },
];

// ---------- 5-1. 점수형 카드 (12종) ----------
// { id, name, rarity, type:"score", desc, num }
// num: { mult?:{base,perLvl}, add?:{base,perLvl}, condition }
const CARDS_SCORE = [
  // common
  { id: "heavy_tackle", name: "묵직한 채비", rarity: "common", type: "score",
    desc: "대형(≥60cm) 점수 곱", num: { mult: { base: 1.5, perLvl: 0.3 }, cond: { kind: "minSize", v: 60 } } },
  { id: "night_owl",    name: "야밤의 손맛", rarity: "common", type: "score",
    desc: "야간(night or 3스테이지) 점수 곱", num: { mult: { base: 1.4, perLvl: 0.2 }, cond: { kind: "isNight" } } },
  { id: "chum",         name: "밑밥 마스터", rarity: "common", type: "score",
    desc: "캐스팅 정확도 ≥0.9면 점수 합", num: { add: { base: 8, perLvl: 4 }, cond: { kind: "accuracyAtLeast", v: 0.9 } } },
  // uncommon
  { id: "species_hunter", name: "어종 사냥꾼", rarity: "uncommon", type: "score",
    desc: "RUN 첫 포획 어종 점수 곱", num: { mult: { base: 2.0, perLvl: 0.3 }, cond: { kind: "firstOfSpecies" } } },
  { id: "combo_reel",     name: "연속 릴링", rarity: "uncommon", type: "score",
    desc: "직전 성공 시 다음 점수 합 누적", num: { add: { base: 5, perLvl: 3 }, cond: { kind: "comboContinued" } } },
  { id: "deep_sea",       name: "심해 탐사가", rarity: "uncommon", type: "score",
    desc: "3스테이지 점수 곱", num: { mult: { base: 1.6, perLvl: 0.2 }, cond: { kind: "stageIs", v: 3 } } },
  { id: "perfect_hook",   name: "완벽한 훅셋", rarity: "uncommon", type: "score",
    desc: "REEL 퍼펙트 시 추가 곱", num: { mult: { base: 1.5, perLvl: 0.2 }, cond: { kind: "perfectReel" } } },
  // rare
  { id: "collector",    name: "수집가의 눈", rarity: "rare", type: "score",
    desc: "도감 등록 어종 수 × (Lv+1) 점수 합", num: { add: { base: 2, perLvl: 1 }, cond: { kind: "perEncyclopedia", v: 1 }, scale: { kind: "levelPlus1" } } },
  { id: "golden_hour",  name: "골든타임", rarity: "rare", type: "score",
    desc: "스테이지 3번째 손 점수 곱", num: { mult: { base: 2.5, perLvl: 0.3 }, cond: { kind: "castIndexIs", v: 3 } } },
  { id: "small_master", name: "잔챙이의 달인", rarity: "rare", type: "score",
    desc: "소형(<30cm) 점수 곱", num: { mult: { base: 2.0, perLvl: 0.3 }, cond: { kind: "maxSize", v: 30 } } },
  { id: "lucky_lure",   name: "행운의 루어", rarity: "rare", type: "score",
    desc: "캐스팅 20% 확률 점수 ×3 + 콤보+1", num: { mult: { base: 3.0, perLvl: 0.5 }, cond: { kind: "randomChance", v: 0.2 }, onTrigger: { kind: "comboPlus" } } },
  // legendary
  { id: "master_angler", name: "명인의 비법", rarity: "legendary", type: "score",
    desc: "모든 점수 곱 (Lv당 +0.2)", num: { mult: { base: 1.6, perLvl: 0.2 }, extra: { kind: "jokerCount", v: 0.05 } } },
];

// ---------- 5-2. 유틸리티 카드 (6종) ----------
const CARDS_UTIL = [
  { id: "wide_zone",   name: "튼튼한 라인",   rarity: "common",    type: "util",
    desc: "초록존 상하 확장", num: { base: 8,  perLvl: 4 } },
  { id: "slow_tension", name: "부드러운 릴",   rarity: "common",    type: "util",
    desc: "텐션 상승 속도 감소", num: { base: 0.8, perLvl: -0.1 } },
  { id: "auto_reel",    name: "자동 드랙",     rarity: "uncommon",  type: "util",
    desc: "손 뗄 때 텐션 하락 빨라짐", num: { base: 1.4, perLvl: 0.2 } },
  { id: "calm_fish",    name: "어부의 여유",   rarity: "uncommon",  type: "util",
    desc: "저항 구간 길이 감소", num: { base: 0.7, perLvl: -0.1 } },
  { id: "fast_progress", name: "강한 완력",    rarity: "rare",      type: "util",
    desc: "진행도 상승 속도 증가", num: { base: 1.3, perLvl: 0.2 } },
  { id: "safety_net",   name: "안전 그물",     rarity: "rare",      type: "util",
    desc: "RUN당 1회 라인 파손 무효(성공 처리)", num: { base: 1, perLvl: 0 } },
  // 추가: 미끼 미소모 조건 (시그니처 빌드용)
  { id: "bait_master",  name: "미끼 절약술",   rarity: "uncommon",  type: "util",
    desc: "캐스팅 시 확률로 미끼 소모 없음", num: { base: 0.1, perLvl: 0.1 } }, // GAME_DESIGN.md v0.7 §5-2 정식 19번째 카드
];

const ALL_CARDS = [...CARDS_SCORE, ...CARDS_UTIL];

// 등급 색 (10번 UI 요구)
const RARITY_COLOR = {
  common: "#9ca3af",      // 회색
  uncommon: "#22c55e",    // 초록
  rare: "#3b82f6",        // 파랑
  legendary: "#f59e0b",   // 금색
};

// ---------- 5-3. 등급 가중치 ----------
const RARITY_WEIGHT = CONFIG.CARD_RARITY_WEIGHT;

// ---------- 7-3. 진화 카드 ----------
// 원본 Lv.3 + 조건 → 진화 카드
const EVOLUTIONS = [
  {
    base: "heavy_tackle", evolveId: "abyss_lord", evolveName: "심해의 지배자",
    desc: "대형 ×3.0 + 대형 포획마다 영구 +0.05 누적",
    num: { mult: { base: 3.0, perLvl: 0 }, cond: { kind: "minSize", v: 60 }, growing: { kind: "perLargeCatch", v: 0.05 } },
    condition: { kind: "largeCatchCount", v: 10 },
  },
  {
    base: "combo_reel", evolveId: "flawless_hand", evolveName: "무결점의 손",
    desc: "연속 성공 +합이 곱연산으로 전환",
    num: { mult: { base: 1.0, perLvl: 0 }, cond: { kind: "comboContinuedMul" }, convertAddToMult: true },
    condition: { kind: "comboCount", v: 8 },
  },
  {
    base: "deep_night", evolveId: "abyss_moon", evolveName: "심연의 달", // 두 카드 동시 보유 시 등장
    desc: "야간+심해 통합 ×4.0",
    num: { mult: { base: 4.0, perLvl: 0 }, cond: { kind: "isNightDeep" } },
    condition: { kind: "twoCards", ids: ["night_owl", "deep_sea"] },
  },
  {
    base: "wide_zone", evolveId: "invincible_line", evolveName: "무적의 라인",
    desc: "텐션 파손 발생 안 함(초록존=전체)",
    num: { flag: "invincible_tension" },
    condition: { kind: "perfectReelCount", v: 15 },
  },
];

// ---------- 6-3. 메타 해금 (명성 상점 6개) ----------
const META_SHOP = [
  { id: "unlock_stage_pool_a",      name: "심해 어종 확장",     cost: 50, desc: "3스테이지 신규 희귀어 추가(추후)" },
  { id: "unlock_card_legendary",    name: "전설 비법 해금",     cost: 80, desc: "master_angler 등장 활성화" },
  { id: "perk_start_bait",          name: "넉넉한 미끼",       cost: 30, desc: "RUN 시작 미끼 +3 (영구)" },
  { id: "perk_start_card",          name: "시작 비법",         cost: 60, desc: "RUN 시작 시 common 카드 1장 지급" },
  { id: "unlock_encyclopedia_bonus", name: "도감 보너스",       cost: 40, desc: "collector 효과 +50% (영구)" },
  { id: "perk_start_reroll",        name: "여유로운 채비",     cost: 45, desc: "RUN 시작 리롤 토큰 +1 (영구)" },
];

// ---------- 3-7. 보스 방해 규칙 ----------
const BOSS_MODIFIERS = [
  { id: "night",      name: "야간 조업",    effect: { castGaugeSpeed: 1.5 } },
  { id: "current",    name: "급류",        effect: { reelTensionVar: 1.5 } },
  { id: "small_only", name: "잔챙이 습격",  effect: { fishFilter: "small", scoreMult: 0.7 } },
  { id: "deadline",   name: "물때 마감",    effect: { castsDelta: -1 } },
];

// ---------- 3-3-R. 보스 잡힘 점수 등 가산 ----------
const STAGE_INFO = [
  null,
  { name: "동네 방파제", target: 30 },
  { name: "갯바위",     target: 80 },
  { name: "먼바다",     target: 180 },
];

// 안전 노출: 다른 모듈에서 import 가능하도록 (script type=module 또는 그냥 전역)
if (typeof window !== "undefined") {
  window.CONFIG = CONFIG;
  window.FISH = FISH;
  window.CARDS_SCORE = CARDS_SCORE;
  window.CARDS_UTIL = CARDS_UTIL;
  window.ALL_CARDS = ALL_CARDS;
  window.RARITY_COLOR = RARITY_COLOR;
  window.RARITY_WEIGHT = RARITY_WEIGHT;
  window.EVOLUTIONS = EVOLUTIONS;
  window.META_SHOP = META_SHOP;
  window.BOSS_MODIFIERS = BOSS_MODIFIERS;
  window.STAGE_INFO = STAGE_INFO;
}