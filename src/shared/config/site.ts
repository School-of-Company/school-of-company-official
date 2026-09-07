// 이 파일에 있는 값만 바꾸면 전체 사이트에 반영할 수 있습니다.

export const BRAND = "스타트업";

// 지원하기 버튼이 이동할 외부 지원 폼 URL. .env의 NEXT_PUBLIC_APPLY_URL로 관리합니다.
export const APPLY_URL = process.env.NEXT_PUBLIC_APPLY_URL ?? "";

// 모집 마감(KST). 실시간 카운트다운의 기준 시각입니다. .env의 NEXT_PUBLIC_APPLICATION_DEADLINE으로 관리합니다.
export const APPLICATION_DEADLINE =
  process.env.NEXT_PUBLIC_APPLICATION_DEADLINE ?? "2026-08-31T23:59:00+09:00";

// 모집 일정(Process) 진행 단계. 0=서류 접수(마감 여부로 자동 판단), 1=서류 발표까지,
// 2=면접까지, 3=전체 완료. .env의 NEXT_PUBLIC_PROCESS_STAGE로 관리합니다.
const rawProcessStage = Number(process.env.NEXT_PUBLIC_PROCESS_STAGE ?? 0);
export const PROCESS_STAGE = Number.isFinite(rawProcessStage)
  ? Math.min(3, Math.max(0, Math.trunc(rawProcessStage)))
  : 0;

// AI 하네스 API 호출 경로. /harness 페이지에서만 사용합니다.
//
// 하네스 서버를 직접 가리키지 않고 같은 오리진 경로를 씁니다 — CSP의 `connect-src 'self'`가
// 다른 오리진 호출을 막기 때문입니다. 실제 서버 주소는 next.config.mjs의 rewrite가
// `HARNESS_API_ORIGIN` 환경변수에서 읽습니다.
export const HARNESS_API_URL = "/api/harness";
