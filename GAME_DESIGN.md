낚시 비법 (Angler's Secret) — 로그라이크 낚시 게임 기획서

버전: v0.7 | 최종수정: 2026-07-08
변경이력:
▪ v0.4: 로그라이크 구조 확정, 경로(Path) 채택, 낚시 비법 12종 확정
▪ v0.5: REEL 텐션 게이지 밀당 확정, 유틸 카드 6종 추가(총 18종), RUN 경로 확장(B안)
▪ v0.6: 카드 성장(레벨/진화) 도입, 리롤 & 스테이지 성과 시스템 도입, rest 강화 폐지→레벨업 통합
▪ v0.7: 유틸 카드 bait_master 정식 편입(총 19종), 미끼 경제·스테이지1 REEL 난이도 조정, 미끼 이중차감 버그 수정, 강제 튜토리얼 1판 + 전략 레이어 점진 개방 도입, 포획 연출/재도전 유도 강화 (§13 참조)

───

0. 이 문서의 사용법 (헤르메스 필독)

• 이 문서는 MVP 1차 구현 범위를 확정한 명세다. 여기 적힌 수치·목록·공식은 임의 변경 금지. 애매하면 이 문서 값을 그대로 쓴다.
• 명세에 없는 값이 필요하면 임의로 만들지 말고 // TODO(spec) 주석을 달고 기본값 0 또는 빈 배열로 둔다.
• 기술 제약: 라이브러리 없음 (Vanilla JS) , 단일 정적 사이트, file://에서도 열려야 함(데이터는 fetch 대신 JS 객체로 내장). 빌드 툴 없음.

───

1. 한 줄 컨셉

"한 번의 출조(Run)는 15~20분. 매번 다른 낚시터 경로를 골라 나아가고, 잡은 물고기로 얻은 '낚시 비법'을 키우고 조합해 점수를 폭발시킨다. 실패하면 즉시 끝나지만, 도감과 명성은 영구히 남는다."

───

2. 게임 구조 (2층 구조)

2-1. RUN (한 판, 휘발성)
• 1 RUN = 낚시터 3개 스테이지 통과.
• 각 스테이지는 경로 지도를 가지며, 플레이어가 노드를 골라 전진한다.
• 각 노드에서 낚시(캐스팅 라운드)를 하고 스테이지 누적 목표 점수 달성 시 통과.
• 목표 미달 시 → 즉시 RUN 종료.

2-2. META (계정, 영구)
• RUN 성패와 무관하게 도감 등록, 명성(Renown) 적립.
• 명성으로 영구 해금(신규 낚시터, 어종 풀, 비법 카드, 퍽) 구매.

───

3. RUN 상세 규칙

3-1. 스테이지 & 목표 점수

스테이지
이름
누적 목표 점수

1
동네 방파제
30

2
갯바위
80

3
먼바다
180



• 목표 점수는 스테이지 전체 누적(노드 단위 아님).
• 각 스테이지 안에서 여러 노드를 거치며 점수를 쌓아 목표에 도달한다.

3-2. 경로(Path) 시스템 — 슬레이 더 스파이어式, 4열 확장 (B안)
• 각 스테이지 경로 구조: 시작 → 1열 → 2열 → 3열 → 보스. 통과 노드 5개. 
◦ 시작 노드에서 2갈래 분기, 이후 각 노드는 다음 열의 인접 노드 1~2개와 연결.
• 1 RUN에서 거치는 낚시 노드 ≈ 스테이지당 4~5개 × 3스테이지 = 12~15개 노드.
• 예상 플레이타임: 15~20분/RUN.
• 플레이어는 매 노드에서 다음 진입 노드를 1개 선택(되돌리기 불가).

노드 타입:

노드 타입
ID
효과

일반 포인트
fishing
표준 캐스팅 라운드. 통과 시 카드 3장 중 1택.

명당 포인트
hotspot
희귀 어종 출현율 2배. 카드 3장 중 1택(uncommon 이상 1장 확정).

어구점
shop
낚시 없음. 코인/명성으로 카드·미끼 구매. 리롤 가능.

휴식
rest
낚시 없음. 미끼 4개 회복. (※ 카드 강화 기능은 레벨업으로 통합되어 폐지)

대물(보스)
boss
스테이지 마지막 강제 노드. 방해 규칙(3-7) 적용 캐스팅 라운드.



• 중간 열 노드 배치 가중치: fishing 50% / hotspot 20% / shop 15% / rest 15%

3-3. 캐스팅 라운드 (핵심 낚시)
각 노드 진입 시 캐스팅 2~3손 수행(노드당 미끼 2~3 소모). 3단계:

1. CAST: 좌우로 움직이는 게이지를 탭 → 캐스팅 정확도(0.0~1.0) 결정.
2. BITE: 랜덤 딜레이(0.5~2.0초) 후 입질. 0.6초 내 탭하면 훅셋 성공, 놓치면 실패(미끼만 소모, 점수 0).
3. REEL: 텐션 게이지 밀당 미니게임(3-3-R). 성공 시 어종 확정 및 점수 계산(4장).

3-3-R. REEL — 텐션 게이지 밀당
BITE 성공 후 진입. 목표: 라인이 끊어지지 않게 텐션 관리하며 진행도 100% 달성.

화면 구성
• 세로 텐션 바(0~100). 중앙에 초록존(스테이지별 가변, 아래 표).
• 물고기 상태등: 저항 중(빨강) / 이완 중(파랑) 이 랜덤 주기 전환.
• 진행도 바: 0% → 100% 채우면 포획 성공.

조작
• 누르고 있으면 릴을 감음 → 텐션 상승 + 진행도 상승.
• 떼면 텐션 하락 + 진행도 정지.
• 저항 중에 감으면 텐션 상승폭 ×2(위험). 이완 중에 감으면 진행도 상승폭 ×2(기회).

판정
• 텐션 100 도달 → 라인 파손 = 실패(점수 0, 미끼 소모).
• 텐션 0 도달 → 진행도 -10% 페널티(실패 아님).
• 진행도 100% → 포획 성공.
• 제한 시간 12초, 초과 시 실패.

REEL 배율(점수 반영)
• 성공 + 초록존 이탈 없음 → 퍼펙트 ×1.3
• 성공 + 초록존 이탈 있음 → 일반 ×1.0
• 실패 → ×0

난이도 곡선(스테이지별 초록존)

스테이지
초록존
저항 강도

1
25~85 (넓음)
약함

2
32~78
보통

3
38~72 (좁음)
강함

4+
42~68
매우 강함



저항/이완 주기 & tier 보정
• 저항 700~1500ms / 이완 500~1200ms 랜덤 반복.
• tier 높을수록 저항 길고 텐션 상승폭 큼: tier1 ×1.0 / tier2 ×1.15 / tier3 ×1.3 / tier4 ×1.5

3-4. 어종 결정
• 캐스팅 성공 시 현재 노드의 어종 풀에서 가중 랜덤 1종(6-2).
• hotspot은 tier4 weight ×2. boss는 해당 스테이지 tier3 이상만 출현.

3-5. 실패 처리 (즉시 종료)
• 스테이지 마지막 보스까지 갔는데 누적 목표 미달, 또는 미끼 소진으로 진행 불가 → RUN 즉시 종료.
• 결과 화면: 잡은 물고기 요약, 최고 점수 물고기, 도감 신규 등록, 명성 정산, 광고 부활(3-8).
• 명성 정산: 획득 명성 = floor(RUN 누적 점수 / 10) + 클리어 스테이지 수 × 5.

3-6. 미끼(Bait)
• RUN 시작 시 16개(+영구 퍽 반영, v0.7에서 12→16 상향). 캐스팅 1회 = 1 소모. 0개면 진행 불가(성공/실패 캐스팅 직후 모두 체크).
• rest에서 +6 회복(v0.7에서 4→6 상향) / shop에서 구매로 회복.
• (v0.7) 스테이지 1 한정 NODE_WEIGHT: rest 15%→22%, shop 15%→13%, hotspot 20%→15%, fishing 50%→50%(유지) — 초반 생존율 확보. 스테이지 2 이상은 기존 가중치 유지.

3-7. 대물(보스) 방해 규칙 — 발라트로式
보스 캐스팅에 아래 중 1개 랜덤 적용:

ID
이름
효과

night
야간 조업
CAST 게이지 속도 ×1.5

current
급류
REEL 텐션 변동폭 ×1.5

small_only
잔챙이 습격
소형만 출현, 점수 ×0.7

deadline
물때 마감
보스 캐스팅 손 -1



3-8. 이어하기(부활) = 광고 접점
• RUN 종료 화면에서 1회 한정 "광고 시청 → 미끼 4개 회복 + 재도전".
• MVP는 버튼만 배치, 클릭 시 즉시 부활 처리. // TODO(ad).
• (v0.7) RUN 종료 화면 최상단에 "한 판 더" 버튼 추가 — META_HUB 경유 없이 즉시 재출조(startRun) 가능.

3-9. REEL 난이도 스테이지 1 완화 (v0.7)
• 신규 유저 이탈 방지를 위해 스테이지 1에 한해서만 적용:
  ◦ safeZoneByStage[1]: [25,85] → [15,90] (더 넓게)
  ◦ 저항 지속시간: 700~1500ms → 900~1400ms (살짝 짧게)
  ◦ resistTensionMult: 2.0 → 1.6 (스테이지 1만)
• 처음 3판(meta.stats.totalRuns < 3) 동안 스테이지 1에서 safety_net(라인 파손 1회 무효) 효과를 카드 슬롯 소모 없이 내부 플래그로 기본 지급(beginnerSafetyNet).
• 스테이지 2/3는 기존 공식 값(§3-3-R) 그대로 유지 — 난이도 곱선 의도 보존.

3-10. 온보딩 & 전략 레이어 점진 개방 (v0.7)
• meta.stats.totalRuns === 0 이면 강제 튜토리얼 RUN 1판: 경로/카드/상점/리롤 UI 전부 숨김, 고정 3회 캐스팅(CAST→BITE→REEL)만 진행. 실패 페널티 없음(즉시 재시도). 각 단계 최초 진입 시 지시 오버레이 표시.
• 3회 완료 후 tutorialDone=true 저장 → META_HUB 진입.
• meta.stats.totalRuns 기준 단계별 UI 노출(로직 동일, 노출만 분기):
  ◦ 0판(튜토리얼): 카드/조커/경로 전부 숨김.
  ◦ 1판(첨 정식 RUN): 경로 지도 노출. 첫 카드 보상 화면에 원포인트 툴팁 1회. 상점/명당 노드 진입 시 짧은 설명 토스트.
  ◦ 2판 이상: 리롤, 진화, 명성 상점 등 전체 기능 툴팁 없이 정식 오픈.

3-11. 포획 연출 강화 (v0.7)
• 전설(tier4) 포획 시: 골드 플래시 + 전용 배너("전설의 손맛!") + 화면 흔들림.
• 고득점(500점+) 포획 시 기존 연출 유지, 200~499점 구간은 "대박" 등급 유지.

───

4. 점수 계산 공식 (확정)

물고기 점수 = 기본점수 × 크기배율 × 캐스팅배율 × REEL배율

기본점수    = 어종별 base (6-2)
크기배율    = 1.0 + (roll - size_min) / (size_max - size_min)   // 1.0 ~ 2.0
캐스팅배율  = 0.8 + (castAccuracy × 0.4)                         // 0.8 ~ 1.2
REEL배율    = 퍼펙트 1.3 / 성공 1.0 / 실패 0


• 낚시 비법 카드 개입 순서: ①합연산(add) 전부 → ②곱연산(mult) 전부.
• 스테이지 점수 = 그 스테이지 모든 물고기 점수 합.

───

5. 낚시 비법 카드 (총 18종) — 콘텐츠 핵심

• 조커 상당. RUN 동안 보유 슬롯 5칸. 초과 시 버릴 카드 선택.
• 상시 발동(passive). 점수 계산 시 자동 적용.

5-1. 점수형 카드 (12종)

ID
이름
등급
효과
수치

heavy_tackle
묵직한 채비
common
대형(≥60cm) 점수 곱
×1.5

night_owl
야밤의 손맛
common
야간(night or 3스테이지) 점수 곱
×1.4

chum
밑밥 마스터
common
캐스팅 정확도 ≥0.9면 점수 합
+8

species_hunter
어종 사냥꾼
uncommon
RUN 첫 포획 어종 점수 곱
×2.0(어종당 1회)

combo_reel
연속 릴링
uncommon
직전 성공 시 다음 점수 합 누적
+5씩(실패 리셋)

deep_sea
심해 탐사가
uncommon
3스테이지 점수 곱
×1.6

perfect_hook
완벽한 훅셋
uncommon
REEL 퍼펙트 시 추가 곱
×1.5

collector
수집가의 눈
rare
도감 등록 어종 수만큼 합
+등록수×2

golden_hour
골든타임
rare
스테이지 3번째 손 점수 곱
×2.5

small_master
잔챙이의 달인
rare
소형(<30cm) 점수 곱
×2.0

lucky_lure
행운의 루어
rare
캐스팅 20% 확률 점수 2배
20%→×2

master_angler
명인의 비법
legendary
모든 점수 곱
×1.35



5-2. 유틸리티 카드 (조작 보조, 7종)

ID
이름
등급
효과
수치

wide_zone
튼튼한 라인
common
초록존 상하 확장
±8

slow_tension
부드러운 릴
common
텐션 상승 속도 감소
reelUpRate ×0.8

auto_reel
자동 드랙
uncommon
손 뗄 때 텐션 하락 빨라짐
reelDownRate ×1.4

calm_fish
어부의 여유
uncommon
저항 구간 길이 감소
resistPhase ×0.7

bait_master
미끼 절약술
uncommon
캐스팅 시 확률로 미끼 소모 없음
10%→Lv당+10%

fast_progress
강한 완력
rare
진행도 상승 속도 증가
progressRate ×1.3

safety_net
안전 그물
rare
RUN당 1회 라인 파손 무효(성공 처리)
1회/RUN



5-3. 등급별 획득 확률(보상 3장 뽑기)
• common 55% / uncommon 30% / rare 13% / legendary 2%
• hotspot 보상은 3장 중 1장 uncommon 이상 확정.
• safety_net은 상점 노출 가중치 소폭 상향(초보 구제).
• (v0.7) 낚시 비법 카드 총 수량 12(점수형) + 7(유틸) = 19종.

───

6. 데이터 정의 (확정값)

6-1. CONFIG
```js
const CONFIG = {
  RUN: { stages: 3, startBait: 12, jokerSlots: 5 },
  STAGE_TARGET: [30, 80, 180],
  PATH: { columns: 4, nodesPerColumn: 2, castsPerNode: [2,3] },
  BITE_DELAY_MS: [500, 2000],
  BITE_WINDOW_MS: 600,
  CAST_GAUGE_SPEED: 1.0,
  REEL: {
    tensionMax: 100,
    safeZoneByStage: { 1:[25,85], 2:[32,78], 3:[38,72], 4:[42,68] },
    timeLimitMs: 12000,
    reelUpRate: 22, reelDownRate: 30, progressRate: 18,
    slackPenalty: 10, resistTensionMult: 2.0, relaxProgressMult: 2.0,
    tierTensionMult: { 1:1.0, 2:1.15, 3:1.3, 4:1.5 },
  },
  META_RENOWN_PER_10PTS: 1,
  META_RENOWN_PER_STAGE: 5,
  CARD_RARITY_WEIGHT: { common: 55, uncommon: 30, rare: 13, legendary: 2 },
  NODE_WEIGHT: { fishing: 50, hotspot: 20, shop: 15, rest: 15 },
  REROLL: {
    startTokens: 2, clearBonus: 1,
    overkillMult: 1.5, overkillBonus: 1,
    perfectCountForBonus: 3, perfectBonus: 1,
    newFishBonus: 1, bossBigCatchBonus: 1,
    costCurve: "n",   // n번째 리롤 = n토큰, 화면 나가면 리셋
  },
};
```


6-2. 어종 데이터
{id, name, stage, tier, base, size_min, size_max, weight}
tier: 1=소형 2=중형 3=대형 4=희귀
```js
const FISH = [
  // 스테이지 1
  { id:"gobies",    name:"망둥어",   stage:1, tier:1, base:4,  size_min:8,  size_max:20,  weight:40 },
  { id:"rockfish",  name:"우럭",     stage:1, tier:2, base:8,  size_min:15, size_max:35,  weight:30 },
  { id:"mullet",    name:"숭어",     stage:1, tier:2, base:10, size_min:20, size_max:50,  weight:20 },
  { id:"flatfish1", name:"도다리",   stage:1, tier:3, base:16, size_min:25, size_max:45,  weight:10 },
  // 스테이지 2
  { id:"seabass",   name:"농어",     stage:2, tier:3, base:20, size_min:40, size_max:90,  weight:30 },
  { id:"blackbeam", name:"감성돔",   stage:2, tier:3, base:24, size_min:25, size_max:55,  weight:25 },
  { id:"greenling", name:"노래미",   stage:2, tier:2, base:12, size_min:20, size_max:40,  weight:30 },
  { id:"conger",    name:"붕장어",   stage:2, tier:2, base:14, size_min:40, size_max:100, weight:15 },
  // 스테이지 3
  { id:"tuna",      name:"참치",     stage:3, tier:4, base:60, size_min:80, size_max:200, weight:10 },
  { id:"amberjack", name:"방어",     stage:3, tier:3, base:40, size_min:60, size_max:130, weight:30 },
  { id:"snapper",   name:"참돔",     stage:3, tier:3, base:38, size_min:40, size_max:90,  weight:30 },
  { id:"cutlass",   name:"갈치",     stage:3, tier:2, base:22, size_min:60, size_max:120, weight:30 },
  // 전 스테이지 희귀(hotspot weight ×2)
  { id:"golden",    name:"황금잉어", stage:0, tier:4, base:80, size_min:30, size_max:60,  weight:3 },
];
```


6-3. 메타 해금 목록 (명성 상점)

ID
이름
비용
효과

unlock_stage_pool_a
심해 어종 확장
50
3스테이지 신규 희귀어 추가(추후)

unlock_card_legendary
전설 비법 해금
80
master_angler 등장 활성화

perk_start_bait
넉넉한 미끼
30
RUN 시작 미끼 +3 (영구)

perk_start_card
시작 비법
60
RUN 시작 시 common 카드 1장 지급

unlock_encyclopedia_bonus
도감 보너스
40
collector 효과 +50% (영구)

perk_start_reroll
여유로운 채비
45
RUN 시작 리롤 토큰 +1 (영구)



6-4. 도감(Encyclopedia)
• 어종별: 최초 포획일, 최대 크기, 포획 횟수.
• 저장: localStorage 키 angler_save_v1.

───

7. 카드 성장 시스템 (레벨 / 진화)

7-1. 레벨
• 카드는 Lv.1~3. 같은 카드 재획득 시 레벨업(버려지지 않음).
• rest 노드의 강화 기능은 폐지, 레벨업으로 통합.

7-2. 레벨별 수치 예시

카드
Lv.1
Lv.2
Lv.3

heavy_tackle
×1.5
×1.8
×2.2

wide_zone
±8
±12
±16

combo_reel
+5
+8
+12

master_angler
×1.35
×1.5
×1.7



• 미정의 카드는 Lv당 +30%씩 자동 증가 기본값 적용.

7-3. 진화(Evolve) — MVP 4종
Lv.3 + 조건 만족 시 다음 보상에 진화 카드 등장(선택 시 변신, 슬롯 추가 소모 없음).

원본 Lv.3
조건
진화 카드
효과

heavy_tackle
대형 10마리 포획
심해의 지배자
대형 ×3.0 + 대형 포획마다 영구 +0.05 누적

combo_reel
8연속 캐스팅 성공
무결점의 손
연속 성공 +합이 곱연산으로 전환

night_owl+deep_sea
둘 다 Lv.3
심연의 달
야간+심해 통합 ×4.0

wide_zone
퍼펙트 릴링 15회
무적의 라인
텐션 파손 발생 안 함(초록존=전체)



───

8. 리롤 & 스테이지 성과 시스템

8-1. 리롤(Reroll)
• 카드 보상 3장이 불만이면 리롤 토큰을 써서 3장 새로 뽑기.
• 상점(shop) 카드 목록도 동일 토큰으로 리롤 가능.

8-2. 리롤 토큰 획득 (= 스테이지 성과 반영)

조건
지급

RUN 시작 기본
2

스테이지 클리어
+1

스테이지 목표 1.5배 이상 초과
+1

스테이지 내 퍼펙트 릴링 3회 이상
+1

스테이지 내 신규 도감 등록
+1 (스테이지당 최대 1)

보스에서 대물(tier3+) 포획
+1



8-3. 리롤 비용 (누진)
• 같은 보상 화면 리롤: 1회 1토큰 / 2회 2토큰 / 3회 3토큰 …
• 화면 나가면 1토큰으로 리셋.
• 토큰은 RUN 내에서만 유효(다음 RUN 이월 안 됨).

8-4. 스테이지 성과 요약 화면 (도파민)
• 획득 점수 / 목표 대비 초과율(%)
• 퍼펙트 릴링 횟수, 최대어, 신규 도감
• 이번 스테이지로 번 리롤 토큰 표시 ("+3 리롤 토큰!")
• 누적 성적바(1→2→3 스테이지 점수 그래프)

───

9. 화면/상태 흐름

TITLE
 → META_HUB (도감 / 명성상점 / 출조하기)
   → RUN_MAP (경로 지도, 노드 선택)
      → NODE_FISHING (캐스팅 2~3손) → CARD_REWARD(+리롤) → RUN_MAP
      → NODE_SHOP (구매+리롤) → RUN_MAP
      → NODE_REST (미끼 회복) → RUN_MAP
      → NODE_BOSS (방해규칙) → STAGE_RESULT(성과 요약) → 다음 스테이지 RUN_MAP
   → RUN_RESULT (성공/실패 정산) → META_HUB

• 각 상태는 별도 render 함수. 전역 GameState 객체로 관리(라이브러리 없이).

9-1. 저장 스키마 (localStorage angler_save_v1)
```js
{
  version: 1,
  renown: 0,
  unlocks: [],
  encyclopedia: {},   // fishId: { firstDate, maxSize, count }
  stats: { bestRunScore: 0, totalRuns: 0, clears: 0 }
}
```


───

10. UI/연출 요구 (도파민 포인트)
• 캐스팅 성공/REEL 퍼펙트: 화면 흔들림(작게) + 점수 팝업 + 사운드.
• 카드 배율 발동: 카드 하이라이트 + "×1.5!" 순차 팝업(발라트로式).
• 희귀 어종: 골드 테두리 + 느린 등장.
• 카드 레벨업/진화: 카드 확대 + 광채 연출.
• 목표 게이지 상단 상시 표시.
• 카드 선택: 등급 색 구분(common 회색/uncommon 초록/rare 파랑/legendary 금색), 리롤 버튼+남은 토큰 표시.
• 도형+텍스트+CSS 애니메이션으로 충분(이미지 에셋 없어도 동작).

───

11. MVP 완료 기준 (헤르메스 체크리스트)
1. TITLE → META_HUB → 출조 → 3스테이지(4열 경로) → 결과 → META_HUB 전체 루프 동작.
2. 경로 지도 노드 선택, 노드 타입별 동작 정확.
3. 캐스팅 3단계(CAST/BITE/REEL 텐션 밀당) 구현, 실패 시 미끼만 소모.
4. REEL 스테이지별 난이도 곡선 적용.
5. 점수 공식(4장) 정확, 낚시 비법 18종 전부 효과 발동.
6. 카드 레벨(1~3) 및 진화 4종 동작.
7. 리롤 토큰 획득/소모/누진비용 동작, 스테이지 성과 반영.
8. 스테이지 성과 요약 화면 표시.
9. 목표 미달 즉시 종료 + 광고 부활 버튼(TODO).
10. 명성 정산 및 localStorage 저장/불러오기.
11. 도감 등록/조회.
12. 명성 상점 6개 항목, 해금 반영.
13. 보스 방해 규칙 4종 랜덤 적용.
14. file:// 및 Vercel 배포 양쪽 동작.

───

12. 이번 MVP 범위 밖 (구현 금지 — 후속)
• 온라인 리더보드, 계정 로그인, 실제 광고 SDK, 멀티플레이어, 스테이지 4+, 아이템 제작, 세트 아이템 확장.