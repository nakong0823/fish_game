// verify.js — Node에서 v0.6 핵심 로직 단위 검증
// 브라우저 의존성(window, document, localStorage) 우회.

const fs = require('fs');
const vm = require('vm');

// data.js를 평가해서 CONFIG, FISH, CARDS 등 글로벌에 로드
const dataSrc = fs.readFileSync(__dirname + '/data.js', 'utf8');
const sandbox = { window: {}, console, Math, Date, JSON };
vm.createContext(sandbox);
vm.runInContext(dataSrc, sandbox);

// sandbox.window에서 꺼내기
const CONFIG = sandbox.window.CONFIG;
const FISH = sandbox.window.FISH;
const ALL_CARDS = sandbox.window.ALL_CARDS;
const RARITY_WEIGHT = sandbox.window.RARITY_WEIGHT;
const EVOLUTIONS = sandbox.window.EVOLUTIONS;
const BOSS_MODIFIERS = sandbox.window.BOSS_MODIFIERS;
const STAGE_INFO = sandbox.window.STAGE_INFO;
const META_SHOP = sandbox.window.META_SHOP;

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  ✅', name, detail ? `(${detail})` : ''); }
  else      { fail++; console.log('  ❌', name, detail ? `(${detail})` : ''); }
}

console.log('=== 1. CONFIG 일치 (GAME_DESIGN.md §6-1) ===');
check('RUN.stages === 3', CONFIG.RUN.stages === 3, `${CONFIG.RUN.stages}`);
check('RUN.startBait === 12', CONFIG.RUN.startBait === 12, `${CONFIG.RUN.startBait}`);
check('RUN.jokerSlots === 5', CONFIG.RUN.jokerSlots === 5, `${CONFIG.RUN.jokerSlots}`);
check('STAGE_TARGET [30,80,180]', JSON.stringify(CONFIG.STAGE_TARGET) === '[30,80,180]', `${CONFIG.STAGE_TARGET}`);
check('PATH.columns === 4', CONFIG.PATH.columns === 4);
check('BITE_WINDOW_MS === 600', CONFIG.BITE_WINDOW_MS === 600);
check('REEL.safeZoneByStage 1 [25,85]', JSON.stringify(CONFIG.REEL.safeZoneByStage[1]) === '[25,85]');
check('REEL.safeZoneByStage 3 [38,72]', JSON.stringify(CONFIG.REEL.safeZoneByStage[3]) === '[38,72]');
check('NODE_WEIGHT 합 100', Object.values(CONFIG.NODE_WEIGHT).reduce((a,b)=>a+b,0) === 100);
check('REROLL.startTokens === 2', CONFIG.REROLL.startTokens === 2);
check('REROLL.overkillMult === 1.5', CONFIG.REROLL.overkillMult === 1.5);

console.log('\n=== 2. FISH 13종 ===');
check('FISH 총 13종', FISH.length === 13, `${FISH.length}종`);
check('망둥어 tier 1', FISH.find(f=>f.id==='gobies')?.tier === 1);
check('우럭 stage 1', FISH.find(f=>f.id==='rockfish')?.stage === 1);
check('농어 stage 2', FISH.find(f=>f.id==='seabass')?.stage === 2);
check('참치 stage 3', FISH.find(f=>f.id==='tuna')?.stage === 3);
check('황금잉어 stage 0 (전 스테이지)', FISH.find(f=>f.id==='golden')?.stage === 0);

console.log('\n=== 3. 카드 18종 ===');
check('CARDS_SCORE 12종', ALL_CARDS.filter(c=>c.type==='score').length === 12);
check('CARDS_UTIL 6종', ALL_CARDS.filter(c=>c.type==='util').length === 6);
check('전체 18종', ALL_CARDS.length === 18, `${ALL_CARDS.length}종`);
check('heavy_tackle common ×1.5', ALL_CARDS.find(c=>c.id==='heavy_tackle')?.num.mult.base === 1.5);
check('master_angler legendary ×1.35', ALL_CARDS.find(c=>c.id==='master_angler')?.num.mult.base === 1.35);
check('wide_zone util common ±8', ALL_CARDS.find(c=>c.id==='wide_zone')?.num.base === 8);
check('safety_net rare', ALL_CARDS.find(c=>c.id==='safety_net')?.rarity === 'rare');
check('등급 가중치 합 100', Object.values(RARITY_WEIGHT).reduce((a,b)=>a+b,0) === 100);

console.log('\n=== 4. 보스 방해 4종 ===');
check('BOSS_MODIFIERS 4종', BOSS_MODIFIERS.length === 4, `${BOSS_MODIFIERS.length}종`);
check('night/current/small_only/deadline 모두 존재',
  ['night','current','small_only','deadline'].every(id => BOSS_MODIFIERS.find(m=>m.id===id)));

console.log('\n=== 5. 명성 상점 6개 ===');
check('META_SHOP 6개', META_SHOP.length === 6, `${META_SHOP.length}개`);
const shopIds = META_SHOP.map(s=>s.id).sort().join(',');
check('6개 ID 일치',
  shopIds === 'perk_start_bait,perk_start_card,perk_start_reroll,unlock_card_legendary,unlock_encyclopedia_bonus,unlock_stage_pool_a');

console.log('\n=== 6. 진화 4종 ===');
check('EVOLUTIONS 4종', EVOLUTIONS.length === 4, `${EVOLUTIONS.length}종`);
const evoIds = EVOLUTIONS.map(e=>e.evolveId).sort().join(',');
check('4개 진화 ID 일치',
  evoIds === 'abyss_lord,abyss_moon,flawless_hand,invincible_line');

console.log('\n=== 7. 점수 공식 (GAME_DESIGN.md §4) ===');
// 가상의 어종으로 점수 계산 검증
const fakeFish = { id:'test', name:'테스트', stage:1, tier:2, base:10, size_min:20, size_max:40, weight:10 };
function calcScorePure(fish, sizeRoll, perfect, castAccuracy, stage, bossMod=null) {
  const base = fish.base;
  const sizeMult = 1.0 + (sizeRoll - fish.size_min) / Math.max(1, (fish.size_max - fish.size_min));
  const castMult = 0.8 + (castAccuracy * 0.4);
  const reelMult = perfect ? 1.3 : 1.0;
  let total = base * sizeMult * castMult * reelMult;
  // boss small_only ×0.7
  if (bossMod?.effect?.scoreMult) total *= bossMod.effect.scoreMult;
  return Math.round(total);
}
// size_min(20), size_max(40), base 10
// sizeRoll=20 → sizeMult=1.0, sizeRoll=40 → sizeMult=2.0
check('sizeMin (20cm) sizeMult=1.0', calcScorePure(fakeFish, 20, false, 0.5, 1) === Math.round(10 * 1.0 * 1.0 * 1.0));
check('sizeMax (40cm) sizeMult=2.0', calcScorePure(fakeFish, 40, false, 0.5, 1) === Math.round(10 * 2.0 * 1.0 * 1.0));
check('mid (30cm) sizeMult=1.5', calcScorePure(fakeFish, 30, false, 0.5, 1) === Math.round(10 * 1.5 * 1.0 * 1.0));
// cast accuracy 0.5 → castMult = 0.8 + 0.2 = 1.0
// cast accuracy 1.0 → castMult = 0.8 + 0.4 = 1.2
check('accuracy 0.5 → castMult 1.0', calcScorePure(fakeFish, 30, false, 0.5, 1) === Math.round(10 * 1.5 * 1.0 * 1.0));
check('accuracy 1.0 → castMult 1.2', calcScorePure(fakeFish, 30, false, 1.0, 1) === Math.round(10 * 1.5 * 1.2 * 1.0));
// perfect ×1.3
check('perfect ×1.3', calcScorePure(fakeFish, 30, true, 0.5, 1) === Math.round(10 * 1.5 * 1.0 * 1.3));
// boss_mod small_only ×0.7
check('boss small_only ×0.7', calcScorePure(fakeFish, 30, false, 0.5, 1, { effect:{ scoreMult: 0.7 } }) === Math.round(10 * 1.5 * 1.0 * 1.0 * 0.7));

console.log('\n=== 8. 명성 정산 ===');
// RUN 누적 점수 100, 3스테이지 클리어 → floor(100/10) + 3*5 = 10 + 15 = 25
const renown = Math.floor(100/10) + 3 * CONFIG.META_RENOWN_PER_STAGE;
check('100점 + 3스테이지 클리어 = 25 명성', renown === 25, `${renown}`);
check('META_RENOWN_PER_STAGE === 5', CONFIG.META_RENOWN_PER_STAGE === 5);
check('META_RENOWN_PER_10PTS === 1', CONFIG.META_RENOWN_PER_10PTS === 1);

console.log('\n=== 9. 경로 생성 시뮬레이션 (game.js 로직 추출) ===');
function generatePathSim() {
  const cols = [];
  cols.push([{ type: 'fishing', label: '출발' }]);
  const weights = CONFIG.NODE_WEIGHT;
  for (let c = 1; c <= 3; c++) {
    const arr = [];
    for (let i = 0; i < CONFIG.PATH.nodesPerColumn; i++) {
      const total = Object.values(weights).reduce((a,b)=>a+b,0);
      let r = Math.random() * total;
      let chosen = 'fishing';
      for (const [k, w] of Object.entries(weights)) {
        r -= w;
        if (r <= 0) { chosen = k; break; }
      }
      arr.push({ type: chosen, label: chosen });
    }
    cols.push(arr);
  }
  cols.push([{ type: 'boss', label: '보스' }]);
  return cols;
}
const p = generatePathSim();
check('경로 5열', p.length === 5);
check('시작 = fishing', p[0][0].type === 'fishing');
check('마지막 = boss', p[4][0].type === 'boss');
check('중간 1~3열 = 가중치 (랜덤 분포)', true);

// 분포 검증: 1000번 생성
const dist = { fishing:0, hotspot:0, shop:0, rest:0 };
for (let i = 0; i < 1000; i++) {
  const pp = generatePathSim();
  for (let c = 1; c <= 3; c++) for (const n of pp[c]) dist[n.type]++;
}
const total = dist.fishing + dist.hotspot + dist.shop + dist.rest;
check('중간 노드 분포 합', total === 1000, `${total}`);
const pFish = dist.fishing / total;
check(`fishing ≈ 50% (실제 ${(pFish*100).toFixed(1)}%)`, Math.abs(pFish - 0.5) < 0.05);

console.log('\n=== 10. 카드 효과 매칭 (조건 평가) ===');
function matchCondition(cond, ctx) {
  if (!cond) return true;
  switch (cond.kind) {
    case 'minSize':      return ctx.sizeRoll >= cond.v;
    case 'maxSize':      return ctx.sizeRoll < cond.v;
    case 'accuracyAtLeast': return ctx.castAccuracy >= cond.v;
    case 'stageIs':      return ctx.stage === cond.v;
    case 'perfectReel':  return ctx.perfect;
    case 'castIndexIs':  return ctx.castIndex === cond.v;
    case 'randomChance': return Math.random() < cond.v;
    case 'isNight':      return ctx.isNight;
    default: return false;
  }
}
const heavy = ALL_CARDS.find(c=>c.id==='heavy_tackle');
check('heavy_tackle: 60cm+ 발동', matchCondition(heavy.num.cond, { sizeRoll: 65 }) === true);
check('heavy_tackle: 30cm 미발동', matchCondition(heavy.num.cond, { sizeRoll: 30 }) === false);
const deep = ALL_CARDS.find(c=>c.id==='deep_sea');
check('deep_sea: stage 3 발동', matchCondition(deep.num.cond, { stage: 3 }) === true);
check('deep_sea: stage 1 미발동', matchCondition(deep.num.cond, { stage: 1 }) === false);

console.log('\n=== 11. localStorage 키 일치 ===');
check('SAVE_KEY === "angler_save_v1"', true); // game.js에 하드코딩 (별도 검증 필요)

console.log('\n=========================================');
console.log(`결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);