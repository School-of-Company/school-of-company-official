import type { CatalogItem } from "./model";

// 화면 표시용 한글 설명. 스킬 파일의 `description` frontmatter는 Claude가 스킬 발동을 판단하는
// 기능적인 값이라 영어 원문을 그대로 두고, 사람이 읽을 설명만 여기에 둡니다.
// "이 항목을 우리 프로젝트에 넣어야 하나"를 판단할 수 있게, 실행 명령보다 효과와 적용 대상을 씁니다.
// Claude/Codex 미러 항목은 이름이 같으므로 이름(경로 마지막 세그먼트)을 키로 씁니다.
const DESCRIPTIONS: Record<string, string> = {
  // 스킬 — 작업 중 Claude가 따르는 절차·가이드
  "api-design":
    "새 엔드포인트를 만들 때 URL 구조와 응답 포맷, OpenAPI 문서화를 팀 규칙대로 맞춰줍니다",
  docker:
    "Dockerfile을 작성할 때 멀티스테이지 빌드와 레이어 캐싱으로 이미지 크기와 빌드 시간을 줄입니다",
  "git-commit":
    "여러 변경이 섞여 있어도 관심사별로 커밋을 쪼개고, 브랜치 생성과 메시지 컨벤션까지 맞춰줍니다",
  planning:
    "요구사항이 애매할 때 질문을 던져 숨은 조건과 트레이드오프를 끌어내고 구현 스펙 문서로 남깁니다",
  "resolve-reviews":
    "PR 리뷰 코멘트를 프로젝트 규칙과 비교해, 맞으면 코드를 고치고 틀리면 근거를 들어 답글을 답니다",
  "security-checklist":
    "머지 전에 시크릿 노출, 인젝션, 인증 누락 같은 취약점을 한 번에 훑어봅니다",
  "systematic-debugging":
    "버그를 추측으로 고치지 않도록 재현에서 원인 추적, 검증까지 순서를 강제합니다",
  test: "무엇을 얼마나 돌릴지 판단해 테스트를 실행하고, 실패는 원인까지 파고들어 설명합니다",
  "write-pr":
    "커밋 내역과 diff를 읽어 PR 제목·본문·라벨을 만들고 그대로 올려줍니다",
  "handle-feedback":
    "채팅·이슈로 온 피드백을 적용·설명·거절로 나눠 처리하고, 반복되는 피드백은 규칙에 반영합니다",
  "review-diff":
    "커밋 전 변경분을 버그·보안·누락된 테스트 관점으로 훑습니다 — 스타일은 린터에 맡기고 중복하지 않습니다",
  "write-test":
    "테스트가 없는 코드에 테스트를 새로 씁니다 — 프로젝트의 러너와 기존 패턴을 따르고 실패 경로까지 덮습니다",
  "refactor-safely":
    "동작을 바꾸지 않고 구조만 정리합니다 — 테스트로 기준선을 잡고 한 번에 하나씩, 커밋도 분리합니다",
  "find-skill":
    "필요한 작업에 맞는 스킬을 공개 레지스트리에서 찾아 검증하고, 우리 컨벤션에 맞게 다듬어 제안합니다",
  "nestjs-arch":
    "NestJS 모듈·DI 구조와 팀 컨벤션을 맞춰줍니다 — 토큰 주입, 환경변수, 검증 파이프, 테스트 스타일 (NestJS 프로젝트)",
  "kotlin-spring-arch":
    "Controller·Service·Repository 역할 분리와 트랜잭션 전략, N+1 방지, DTO 변환 규칙 (Kotlin·Spring 프로젝트)",
  "java-spring-arch":
    "Controller·Service·Repository 역할 분리와 트랜잭션 전략, N+1 방지, DTO 변환 규칙 (Java·Spring 프로젝트)",

  // 에이전트 — 필요할 때 따로 실행되는 검사·조사 담당
  "contradiction-finder":
    "CLAUDE.md와 컨벤션 문서, 실제 코드가 서로 다른 말을 하고 있는 지점을 찾아냅니다",
  "doc-polisher":
    "문서의 예제 코드나 설명이 실제 코드와 어긋난 부분을 찾아 최신 상태로 맞춥니다",
  "frontend-convention-validator":
    "프론트엔드 변경분이 컴포넌트 구조와 폴더 경계 규칙을 지키는지 검사합니다",
  "kotlin-convention-validator":
    "Kotlin 변경분의 DTO 애노테이션, 로깅, 트랜잭션 규칙 위반을 잡아 고칩니다 (Kotlin 프로젝트)",
  "kotlin-test-fixer":
    "테스트가 깨졌을 때 서비스 코드를 기준으로 원인을 가려내 테스트나 버그를 고칩니다 (Kotlin 프로젝트)",
  "prompt-polisher":
    "스킬·에이전트 정의가 언제 발동될지 애매한 부분을 짚어 개선안을 제시합니다",
  "web-researcher":
    "라이브러리 최신 버전이나 CVE처럼 학습 데이터에 없는 정보를 웹에서 찾아옵니다",

  // 훅 — 도구 호출 시점에 자동으로 끼어드는 안전장치·자동화
  "command-guard":
    "되돌릴 수 없는 명령을 실행 직전에 막습니다 — force push, reset --hard, 원격 삭제 등 (rm -rf dist 같은 정상 작업은 통과)",
  "secret-guard":
    "API 키·토큰이 코드에 박히는 것도, .env·키 파일을 읽어 화면에 꺼내는 것도 막습니다",
  eslint:
    "저장할 때마다 린트 오류를 자동으로 고쳐줍니다 (ESLint 설정이 있는 JS·TS 프로젝트)",
  oxlint:
    "저장할 때마다 oxlint로 린트 오류를 고쳐줍니다 — ESLint 대신 oxlint를 쓰는 프로젝트용",
  prettier:
    "저장할 때마다 포맷을 맞춰, 포맷 변경이 PR diff에 섞이지 않게 합니다",
  "ts-check":
    "저장할 때마다 타입을 검사해, 타입 오류를 커밋 전에 바로 알려줍니다 (TypeScript 프로젝트)",
  jest: "저장한 파일과 관련된 테스트만 골라 즉시 돌립니다 (Jest 프로젝트)",
  ktlint: "Kotlin 파일을 저장하면 포맷을 자동으로 맞춰줍니다 (Kotlin 프로젝트)",
  "gradle-test":
    "서비스 구현 파일을 수정하면 그 모듈의 테스트를 자동으로 돌립니다 (Gradle 프로젝트)",
  spotless:
    "Java·Kotlin 파일을 저장하면 팀 포맷 규칙을 자동 적용합니다 (Gradle 프로젝트)",
  ruff: "Python 파일을 저장하면 포맷과 린트를 함께 정리합니다 (Python 프로젝트)",
};

/** 한글 설명이 있으면 그걸, 없으면 서버가 준 원문 설명으로 폴백합니다. */
export function descriptionOf(item: CatalogItem): string | undefined {
  return DESCRIPTIONS[item.title] ?? item.description;
}
