# VEIN Round 75

Date: 2026-09-12

## 조건검색 저장식 한도 선제 안내 (Track C UX)

자율 루프 R75. FREE 플랜은 저장 조건검색식이 최대 3개(초과 시 `402 PLAN_LIMIT_EXCEEDED`, R52)인데,
지금까지 UI는 **사후 에러 메시지로만** 한도를 알렸다. 사용자가 4번째 저장을 시도해 실패해야 한도를
알게 되는 흐름이라, `/me/entitlements`(R52·R60)를 붙여 **선제적으로** 안내하도록 했다.

### 바뀐 것 (FE)

- `components/condition-scanner-panel.tsx`
  - `useEntitlements()`로 `SAVED_SCANNER_RULES` 기능의 한도(-1=무제한/PRO)를 읽는다.
  - "저장된 검색식" 헤더 배지를 `사용/한도`(예: `2/3`)로 표시. 한도 도달 시 `warning` 톤.
  - 저장 입력줄 아래에 `저장식 N/한도개 사용 중` 안내. **한도 도달 시** 저장 버튼을 비활성화하고
    "FREE는 최대 N개 · 기존 삭제 또는 PRO 업그레이드(→/settings)" 안내(amber)를 노출.
  - 현재 개수는 서버 집계(staleTime)보다 즉각적인 **목록 길이(라이브)**를 기준으로 게이트.
- `lib/queries.ts` — `useSaveScannerRule`/`useDeleteScannerRule`의 `onSuccess`에서
  `entitlements` 쿼리도 무효화. 저장식 개수가 바뀌면 설정 화면의 사용량(`used`)도 함께 갱신되어
  화면 간 수치가 일치한다.

### 검증

- 프론트 `tsc --noEmit` 통과, `next build` 통과.
- 라이브 서버(3000) 재기동(리빌드 청크 갱신) 후 **Chrome full smoke 0에러**
  (`demo@vein.local`, FREE 티어 · SUPER_ADMIN).
- `GET /me/entitlements` 실측: `{key:"SAVED_SCANNER_RULES", limit:3, used:0, pro:false}` —
  FE 매칭 키/필드 일치 확인. 백엔드/계약 무변경.
