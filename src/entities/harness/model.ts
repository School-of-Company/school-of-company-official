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

/**
 * 레포를 소유자(조직 또는 개인 계정)별로 묶어 개수와 함께 돌려준다.
 *
 * 등록 절차가 따로 없어서 GitHub App이 설치된 레포가 전부 한 목록으로 들어오는데, 소유자가
 * 늘어나면 섞인 목록에서 원하는 레포를 찾기 어려워진다. 레포가 많은 소유자를 앞에 두고(주로
 * 쓰는 조직이 먼저 오도록), 같은 개수면 이름순으로 고정해 목록 순서가 매번 흔들리지 않게 한다.
 */
export function ownersOf(
  repos: RegisteredRepo[],
): { owner: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const repo of repos) {
    counts.set(repo.owner, (counts.get(repo.owner) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([owner, count]) => ({ owner, count }))
    .sort((a, b) => b.count - a.count || a.owner.localeCompare(b.owner));
}
