import { HARNESS_API_URL } from "@/shared/config";
import type { CatalogItem, RegisteredRepo } from "./model";

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${HARNESS_API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`${path} 요청 실패 (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function fetchRepos(): Promise<RegisteredRepo[]> {
  return get<RegisteredRepo[]>("/repos");
}

export function fetchCatalog(): Promise<CatalogItem[]> {
  return get<CatalogItem[]>("/catalog");
}

export type CreatePrParams = {
  owner: string;
  repo: string;
  installationId: number;
  baseBranch: string;
  itemIds: string[];
};

export async function createPr(
  params: CreatePrParams,
): Promise<{ url: string }> {
  const response = await fetch(`${HARNESS_API_URL}/pr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    // 서버는 잘못된 요청에 방어 로직 없이 예외를 던지므로, 본문에 이유가 담겨 오면 그대로 보여줍니다.
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `PR 생성 실패 (${response.status})`);
  }
  return response.json() as Promise<{ url: string }>;
}
