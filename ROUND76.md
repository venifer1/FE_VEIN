# VEIN Round 76

Date: 2026-09-12

## 알림 규칙 한도 선제 안내 (Track C UX, R75 후속)

자율 루프 R76. R75에서 조건검색 저장식 한도를 선제 안내했는데, **알림 규칙도 동일하게 FREE 10개
한도**(초과 시 `402 PLAN_LIMIT_EXCEEDED`, R56)를 가진다. 알림 생성 다이얼로그는 이 한도를
사후 에러(그마저 generic `body.message`)로만 알렸다. 조건검색과 일관되게 선제 안내로 바꿨다.

### 바뀐 것 (FE)

- `components/alert-create-dialog.tsx`
  - `useEntitlements(open)`으로 다이얼로그가 열릴 때만 `ALERTS` 기능의 한도/사용량을 읽는다.
  - 폼에 `알림 규칙 N/10개 사용 중` 안내를 상시 노출.
  - **한도 도달 시** 폼 대신 안내 화면(amber)으로 전환: "FREE는 최대 N개 · 기존 삭제 또는
    PRO 업그레이드(→/settings)". 생성 버튼 자체를 렌더하지 않아 402를 원천 차단.
  - 방어적으로 `PLAN_LIMIT_EXCEEDED` 에러 코드도 친화 메시지로 매핑(레이스/타 경로 대비).

### 검증

- 프론트 `tsc --noEmit`·`next build` 통과.
- 라이브 서버(3000) 재기동(리빌드 청크 갱신) 후 **Chrome full smoke 0에러**(`demo@vein.local`).
- `ALERTS` 엔타이틀먼트 키/한도(limit 10)는 R75 실측으로 확인됨. FE 매칭 로직은 R75 저장식과
  동일 패턴. 백엔드/계약 무변경.
