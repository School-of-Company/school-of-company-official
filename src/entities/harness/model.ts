// 하네스 서버(school-of-company-harness)의 응답 타입. 서버 쪽 정의와 1:1 대응됩니다.

export type CatalogCategory =
  | "claude-skill"
  | "claude-agent"
  | "claude-hook"
  | "codex-skill"
  | "codex-agent"
  | "codex-hook";

export type CatalogItem = {
  id: string;
  category: CatalogCategory;
  title: string;
  description?: string;
  path: string;
};

export type RegisteredRepo = {
  owner: string;
  repo: string;
  installationId: number;
  defaultBranch: string;
};

// 화면에 보여줄 그룹. 플랫폼(Claude/Codex)은 배지로 따로 표시하고, 그룹은 기능 종류로만 나눕니다.
export type CatalogGroup = "스킬" | "에이전트" | "훅";

export const CATALOG_GROUP_ORDER: CatalogGroup[] = ["스킬", "에이전트", "훅"];

const GROUP_BY_CATEGORY: Record<CatalogCategory, CatalogGroup> = {
  "claude-skill": "스킬",
  "codex-skill": "스킬",
  "claude-agent": "에이전트",
  "codex-agent": "에이전트",
  "claude-hook": "훅",
  "codex-hook": "훅",
};

export function groupOf(item: CatalogItem): CatalogGroup {
  return GROUP_BY_CATEGORY[item.category];
}

export function platformOf(item: CatalogItem): "Claude" | "Codex" {
  return item.category.startsWith("claude") ? "Claude" : "Codex";
}

export function isHookItem(item: CatalogItem): boolean {
  return item.category === "claude-hook" || item.category === "codex-hook";
}

export function repoKey(repo: RegisteredRepo): string {
  return `${repo.owner}/${repo.repo}`;
}
