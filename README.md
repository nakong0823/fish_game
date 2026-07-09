# 낚시 비법 — Angler's Secret (v1.0)

**컨셉**: Balatro × Slay the Spire × 낚시 — 카드 기반 로그라이크 낚시 게임
**기술 스택**: Vanilla JS + Canvas/DOM (라이브러리 0개), `localStorage` 영구 저장, `file://` 프로토콜에서도 동작
**배포 URL**: https://fish-game-six.vercel.app/

---

## 1. 현재 완료된 기능

### 🎣 핵심 게임플레이
- CAST(캐스팅) → BITE(입질) → REEL(릴링) 3단계 낚시 미니게임
- 스페이스바 또는 화면 탭으로 조작 (모바일/데스크탑 겸용)
- REEL 단계: 텐션(저항/이완) 관리 + 진행도 게이지, 안전존 적중 시 퍼펙트
- 로그라이크 경로(RUN_MAP): 낚시/명당(hotspot)/어구점/휴식/보스 노드로 구성된 3스테이지 경로
- 19종 "낚시 비법" 카드(점수형 12 + 유틸리티형 7, `bait_master` 포함) — 등급(common~legendary), Lv1~3 레벨업, 조건부 진화
- 리롤 토�큰 경제, 미끼(bait) 자원 관리, 명성(renown) 기반 영구 메타 상점(6종 퍽)
- 도감(encyclopedia) — 13개 어종 수집 현황 추적

### 🆕 v0.7 — 온보딩 & 밸런스 & 피드백 개선
- **강제 튜토리얼**: 첫 플레이 시 로그라이크 요소(카드/경로/상점)를 숨기고 CAST→BITE→REEL 3회 성공 손맛 체험만 제공. 실패해도 페널티 없이 같은 손 재시도. 숙련자는 "튜토리얼 건너뛰기" 가능
- **점진적 전략 레이어 개방**: `tutorialTier()` (0=튜토리얼 전, 1=튜토리얼 완료 후 첫 정식 RUN, 2+=전체 기능) 기준으로 2번째 RUN에서 명당(hotspot) 원포인트 툴팁 1회 노출
- **초기 밸런스 완화**:
  - 시작 미끼 12→16, 휴식 노드 회복량 4→6
  - 스테이지 1 한정 REEL 안전존 확대 [25,85]→[15,90], 저항 텐션 배율 완화(2.0→1.6), 저항 지속시간 단축(700~1500ms→900~1400ms)
  - 스테이지 1 한정 노드 가중치 조정(휴식 15%→22%, 어구점 15%→13%, 명당 20%→15%) — 미끼 생존율 강화
  - 신규 플레이어 첫 3판 동안 스테이지1 한정 "초보 배려" 안전그물 1회 무상 제공(카드 슬롯 소모 없음)
- **미끼 소진 버그 수정**: 미끼 0 도달 시 성공/실패 캐스팅 양쪽 경로 모두에서 RUN 자동 종료 (GAME_DESIGN.md §3-6 정합성)
- **포획 연출 강화**: 전설(tier4) 어종 포획 시 골드 화면 플래시 + 전용 배너(전설 히어로 아트 포함) + 화면 흔들림, 콤보 2 이상 시 콤보 인디케이터 표시
- **재도전 유도**: 결과 화면에 "🎣 한 판 더!" 버튼 추가 — 마을 경유 없이 바로 재출조

### 🎨 v1.0 — 실사 이미지 자산 도입 (신규)
기존에 이모지(🎣🐟🪱)와 단순 인라인 SVG 도형만 사용하던 것을, 실제 AI 생성 일러스트로 대폭 교체했습니다.

- **Phase 1 — 배경/분위기**: 타이틀 화면 배경(방파제 풍경), 스테이지별 시간대 배경 3종(낮/노을/밤 바다), 전설 어종 히어로 아트(황금잉어)
- **Phase 2 — 어종 일러스트**: 13개 전 어종을 flat-vector 페인팅 스타일 일러스트로 제작(배경 제거 처리), 포획 결과 화면·도감 화면에 적용. 이미지 로드 실패 시 기존 SVG/이모지로 자동 폴백
- **Phase 3 — 디테일 마감**: 카드 뒷면/앞면 장식 텍스처, 물결 장식 패턴(경로 보드·마을 화면 배경), 미끼 아이콘 이미지화

모든 이미지는 `images/` 폴더에 저장되며, 기존 UI 컬러(네이비+골드)와 통일된 톤으로 제작했습니다.

---

## 2. 화면 흐름 (엔트리 포인트)

단일 페이지 앱(`index.html`)이며 별도 URL 파라미터는 사용하지 않습니다. 화면 전환은 JS의 `showScreen()`으로 처리됩니다.

| 화면 ID | 설명 |
|---|---|
| `#screen-title` | 타이틀 (첫 방문 시 "낚시 배우기" 튜토리얼 유도, 이후 "출조하기") |
| `#screen-meta` | 마을(META_HUB) — 출조/도감/명성상점 진입 |
| `#screen-run-map` | RUN 경로 지도 |
| `#screen-fishing` | CAST/BITE/REEL 낚시 미니게임 |
| `#screen-reward` | 카드 보상 선택 |
| `#screen-shop` | 어구점(RUN 내 노드) |
| `#screen-meta-shop` | 명성 상점(영구 해금) |
| `#screen-codex` | 도감 |
| `#screen-stage-result` | 스테이지 결과 |
| `#screen-run-result` | RUN 최종 결과 (+"한 판 더" 버튼) |

---

## 3. 데이터 모델 & 저장소

- **저장 방식**: `localStorage` 키 `angler_save_v1` (JSON)
- **저장 데이터 구조** (`defaultSave()` in `game.js`):
  ```js
  {
    version: 1,
    renown: 0,                 // 명성 (영구 재화)
    unlocks: [],                // 영구 해금 목록 (퍽/전설카드 등)
    encyclopedia: {},           // { fishId: { firstDate, maxSize, count } }
    stats: { bestRunScore, totalRuns, clears },
    tutorialDone: false,        // 강제 튜토리얼 완료 여부
    tooltipsShown: { reward, hotspot, shop }, // 원포인트 툴팁 1회성 노출 추적
  }
  ```
- **런타임 데이터** (`data.js`, `window` 전역 노출): `CONFIG`, `FISH`(13종), `CARDS_SCORE`/`CARDS_UTIL`/`ALL_CARDS`(19종), `RARITY_COLOR`/`RARITY_WEIGHT`, `EVOLUTIONS`, `META_SHOP`, `BOSS_MODIFIERS`, `STAGE_INFO`
- **시각 자산**: `fish-svg.js` (인라인 SVG 폴백 + Web Audio 사운드 합성), `images/*.png` (실사 일러스트, v1.0 신규)
- 외부 API/서버 없음 — 완전한 정적 사이트, RESTful Table API는 사용하지 않음(로컬 저장으로 충분한 요구사항)

---

## 4. 파일 구조

```
index.html          메인 페이지 (전체 화면 마크업)
style.css           전체 스타일 (애니메이션, 반응형, 이미지 통합 포함)
data.js             CONFIG/FISH/CARDS/META_SHOP 등 정본 데이터
fish-svg.js         인라인 SVG 폴백 + 카드 SVG + 사운드 합성
game.js             전체 게임 로직 (상태머신, 렌더링, 이벤트 라우팅)
balance-sim.js      밸런스 시뮬레이션 참고용 스크립트 (로컬 Node 전용, 미실행)
GAME_DESIGN.md       게임 설계 문서 (v0.7, 정본 스펙)
images/
  bg-title.png              타이틀 배경
  bg-stage-day.png           스테이지1 낮 배경
  bg-stage-dusk.png          스테이지2 노을 배경
  bg-stage-night.png         스테이지3 밤 배경
  fish-golden-hero.png       전설 연출용 대형 히어로 아트
  fish-golden.png            도감/포획용 황금잉어 아이콘
  fish-{gobies,rockfish,mullet,flatfish1,seabass,blackbeam,
        greenling,conger,tuna,amberjack,snapper,cutlass}.png
                              12종 일반 어종 아이콘 (투명 배경)
  card-back.png              카드 뒷면/장식 텍스처
  wave-pattern.png            물결 장식 패턴
  bait-icon.png               미끼 아이콘
```

---

## 5. 아직 구현되지 않은 기능 / 알려진 제한사항

- `unlock_stage_pool_a` (심해 어종 확장) 명성 상점 항목은 구매는 가능하나 실제 신규 어종 추가 로직은 TODO 상태
- 배경 이미지 파일 용량이 다소 큼(각 4~5MB) — 향후 WebP 변환/압축으로 로딩 최적화 여지 있음
- 카드 앞면은 여전히 데이터 기반 텍스트 카드이며, 카드별 개별 일러스트(19종)는 미제작 (현재는 공통 장식 텍스처만 배경으로 사용)
- 사운드는 Web Audio 합성음만 사용 중 (실제 녹음된 SFX/BGM 없음)
- 모바일 환경에서의 세부 터치 반응성 최적화는 기본 수준

## 6. 권장 다음 단계

1. 이미지 파일 용량 최적화 (WebP 변환, 리사이즈)
2. 카드 19종 개별 일러스트 아이콘 추가 검토
3. 실제 배경음악/효과음 파일 도입 검토 (현재는 오실레이터 합성음)
4. 신규 어종 확장 콘텐츠(`unlock_stage_pool_a`) 실제 구현
5. 자동화된 밸런스 시뮬레이션(현재 `balance-sim.js`는 참고용 수치 계산 스크립트로, 실제 실행 환경 없음) 결과를 실측 플레이 데이터와 비교해 추가 튜닝

---

## 7. 배포

정적 사이트이며 별도 빌드 과정이 없습니다. **Publish 탭**에서 원클릭 배포하면 됩니다.
