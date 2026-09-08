import { HARNESS_API_URL } from "@/shared/config";
import type { CatalogItem, RegisteredRepo } from "./model";

// 하네스 서버가 응답 없이 멈추면 로딩 스피너가 무한히 도는 것처럼 보인다.
// 일정 시간이 지나면 요청을 끊고 명확한 에러로 바꿔, 사용자가 재시도할지 판단할 수 있게 한다.
const TIMEOUT_MS = 15_000;

async function get<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${HARNESS_API_URL}${path}`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`${path} 요청 실패 (${response.status})`);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`${path} 요청이 시간 초과되었습니다`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
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
