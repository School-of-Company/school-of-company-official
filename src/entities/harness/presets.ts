// 자주 쓰는 조합. 서버는 완전 무상태라 사용자가 만든 프리셋은 브라우저 localStorage에만 저장합니다.

const STORAGE_KEY = "harness-presets";

/** 기본 제공 프리셋. 항목 "이름"으로 정의해 Claude·Codex 어느 쪽에도 적용할 수 있게 한다. */
export type BuiltInPreset = { name: string; itemNames: string[] };

const COMMON = [
  "git-commit",
  "write-pr",
  "resolve-reviews",
  "planning",
  "systematic-debugging",
  "security-checklist",
  "secret-guard",
  "command-guard",
];

export const BUILT_IN_PRESETS: BuiltInPreset[] = [
  {
    name: "공통 최소",
    itemNames: COMMON,
  },
  {
    name: "Kotlin·Spring 백엔드",
    itemNames: [
      ...COMMON,
      "api-design",
      "docker",
      "test",
      "kotlin-convention-validator",
      "kotlin-test-fixer",
      "contradiction-finder",
      "doc-polisher",
      "ktlint",
      "gradle-test",
      "spotless",
    ],
  },
  {
    name: "Next.js 프론트엔드",
    itemNames: [
      ...COMMON,
      "docker",
      "test",
      "frontend-convention-validator",
      "contradiction-finder",
      "doc-polisher",
      "eslint",
      "prettier",
      "ts-check",
      "jest",
    ],
  },
];

/** 사용자가 저장한 프리셋. 저장한 그대로 복원되도록 항목 id를 그대로 담는다. */
export type SavedPreset = { name: string; itemIds: string[] };

export function loadSavedPresets(): SavedPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedPreset[]) : [];
  } catch {
    // 저장소를 못 읽는 환경(프라이빗 모드 등)에서는 프리셋 없이 동작한다.
    return [];
  }
}

function persist(presets: SavedPreset[]): SavedPreset[] {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // 저장 실패는 무시 — 이번 세션 선택에는 영향이 없다.
  }
  return presets;
}

/** 같은 이름이면 덮어쓴다. */
export function saveSavedPreset(preset: SavedPreset): SavedPreset[] {
  const rest = loadSavedPresets().filter((item) => item.name !== preset.name);
  return persist([...rest, preset]);
}

export function deleteSavedPreset(name: string): SavedPreset[] {
  return persist(loadSavedPresets().filter((item) => item.name !== name));
}
