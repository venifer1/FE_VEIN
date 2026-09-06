# VEIN Frontend (내부 알파)

Next.js 14 (App Router) 모바일 웹/PWA 클라이언트. 레거시 데스크톱 11탭 터미널을 **5탭 모바일 IA**(홈·스캐너·속보·데이터·설정)로 재구성. 4시장(CRYPTO·US·KOSPI·KOSDAQ) · 패턴 4종(ABC·고점판독(TOP)·이말올(IMALOL)·삼각수렴(TRIANGLE)).

## 빠른 시작

```bash
cd frontend
npm install
cp .env.local.example .env.local   # 필요 시 값 조정
npm run dev                        # http://localhost:3000
```

기본 `.env.local.example`은 **목 모드(`NEXT_PUBLIC_USE_MOCK=true`)** 로 설정되어 있어 백엔드 없이 전 화면이 렌더링됩니다.

### 목 모드 로그인
- 이메일: `tester@vein.test`
- 비밀번호: `mock1234`
- 상태 테스트용 계정: `locked@vein.test`(잠금), `pending@vein.test`(승인 전), 잘못된 비밀번호(입력/인증 오류)

### 실제 백엔드 연동
`.env.local`에서:
```
NEXT_PUBLIC_API_BASE=http://localhost:8080/api/v1
NEXT_PUBLIC_USE_MOCK=false
```
목 모드를 끄면 axios가 실제 `NEXT_PUBLIC_API_BASE`로 요청합니다.

## 스크립트
- `npm run dev` — 개발 서버
- `npm run build` — 프로덕션 빌드
- `npm run start` — 빌드 결과 실행
- `npm run typecheck` — 타입 체크

## 화면 (5탭 + 스택)
| 라우트 | 화면 | API |
|---|---|---|
| `/login` | 로그인 | `POST /auth/login` |
| `/` | 홈/터미널 — 시장지표·김프·통합검색·관심 미니 | `GET /market/indices`, `/market/kimchi-premium`, `/instruments?q=&market=`, `/watchlists/default` |
| `/scanner` | 스캐너 — 패턴 4종 필터(무한 커서+30s) + 틱띄기 서브탭 | `GET /signals`, `GET /scalp/ranking` |
| `/news` | 속보 — 텔레그램/Bloomberg 토글 | `GET /news?source=` |
| `/data` | 데이터 — TVL·유통량·테마/섹터·펀비차익 서브탭 | `GET /tvl`, `/supply`, `/themes`, `/funding-arb` |
| `/settings` | 설정 — 알림규칙·알림함·데이터출처·진단·로그아웃 | `GET /alerts`, `/notifications`, `/system/status` |
| `/instruments/[id]` | 종목 상세 (market별 봉 탭 + 지표 오버레이) | `GET /instruments/{id}`, `.../candles`, `.../indicators`, `/signals?instrument_id` |
| `/signals/[id]` | 신호 상세 (패턴 4종 오버레이) | `GET /signals/{id}`, `.../candles` |
| `/tvl/[id]` | TVL 히스토리 라인 | `GET /tvl/{id}/history` |
| `/themes/[id]` | 테마 구성종목 | `GET /themes/{id}/constituents` |
| `/scalp/[symbol]` | 스캘핑 상세 | `GET /scalp/{symbol}` |

하단 탭 5개: 홈 · 스캐너 · 속보 · 데이터 · 설정 (lucide-react 아이콘). 관심종목은 홈에, 알림/알림함은 설정에 통합.

## API 계약 매핑
- `docs/API_CONTRACT.md`를 단일 진실 소스로 사용. JSON 키는 snake_case, 시간은 UTC ISO-8601, 가격/수량/점수는 **문자열 Decimal**.
- 응답 envelope: 성공 `{ data, meta }`, 목록 `{ data, meta.next_cursor }`, 오류 `{ error: { code, message, trace_id, field_errors } }`.
- `lib/types.ts` — 모든 계약 엔티티 타입.
- `lib/api.ts` — axios 인스턴스 + 인터셉터(401 → `/auth/refresh` 1회 회전 → 재시도, 실패 시 로그인 이동). access는 메모리, refresh는 localStorage.
- `lib/queries.ts` — TanStack Query 훅(신호 무한 커서+30s 폴링, 알림 unread 폴링, 알림/관심 mutation).
- `lib/format.ts` — Decimal.js / Intl 가격 포맷, date-fns-tz UTC→로컬 표시.

## 차트 오버레이 (lightweight-charts)
`components/chart-view.tsx`가 evidence를 패턴 4종에 맞춰 매핑:
- ABC/TOP: 피벗(`PIVOT_0/A/B`) → `setMarkers`, `C_TARGET` → `createPriceLine`
- TRIANGLE: 추세선(`TREND_UPPER/LOWER`, 점 ≥2) → `LineSeries`
- IMALOL: 볼린저(`BOLL_UPPER/MID/LOWER`) → `LineSeries`(점선), `MATCH_BOX` → 마커
- 무효화가 → `createPriceLine`; 선택 시 indicators MA(20/60/120) 오버레이.

## 상태 처리 (TABLE 9)
모든 목록/상세 화면이 Loading · Empty · Stale · Partial · Fatal 상태를 구현 (`components/states.tsx`, `badges.tsx`).

## 컴플라이언스
로그인(SCR-01)·신호 화면(SCR-02/03) 하단에 "투자 참고용 · 투자권유 아님" 고지 노출.

## 디렉터리
```
app/            라우트(로그인·신호함·상세·종목·관심·알림·설정) + layout/providers
components/     AppShell·BottomTabs·SignalCard·ChartView·배지·상태·알림 다이얼로그·ui/*
lib/            api·types·queries·format·utils·mockData·mockAdapter
store/          Zustand auth
public/         vein_logo.svg, manifest.json
```
