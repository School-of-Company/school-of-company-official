"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CATALOG_GROUP_ORDER,
  createPr,
  descriptionOf,
  fetchCatalog,
  fetchRepos,
  groupOf,
  isHookItem,
  platformOf,
  repoKey,
  type CatalogGroup,
  type CatalogItem,
  type RegisteredRepo,
} from "@/entities/harness";

type Status =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "error"; message: string };

const FIELD_CLASS =
  "w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm text-fg outline-none transition-colors focus:border-accent";

export default function HarnessSync() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [repos, setRepos] = useState<RegisteredRepo[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);

  const [selectedRepoKey, setSelectedRepoKey] = useState("");
  const [baseBranch, setBaseBranch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [submitting, setSubmitting] = useState(false);
  const [prUrl, setPrUrl] = useState("");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchRepos(), fetchCatalog()])
      .then(([loadedRepos, loadedCatalog]) => {
        if (cancelled) return;
        setRepos(loadedRepos);
        setCatalog(loadedCatalog);
        setStatus({ kind: "ready" });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "하네스 서버에 연결할 수 없습니다",
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedRepo = repos.find((repo) => repoKey(repo) === selectedRepoKey);

  // 레포를 고르면 그 레포의 기본 브랜치를 base 브랜치 기본값으로 함께 채웁니다(이후 수정 가능).
  function selectRepo(key: string) {
    setSelectedRepoKey(key);
    const repo = repos.find((candidate) => repoKey(candidate) === key);
    setBaseBranch(repo?.defaultBranch ?? "");
  }

  const grouped = useMemo(() => {
    const map = new Map<CatalogGroup, CatalogItem[]>();
    for (const item of catalog) {
      const group = groupOf(item);
      map.set(group, [...(map.get(group) ?? []), item]);
    }
    return map;
  }, [catalog]);

  const hookSelected = useMemo(
    () => catalog.some((item) => selectedIds.has(item.id) && isHookItem(item)),
    [catalog, selectedIds],
  );

  function toggle(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPrUrl("");
    setSubmitError("");
  }

  function toggleGroup(items: CatalogItem[], selectAll: boolean) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      for (const item of items) {
        if (selectAll) next.add(item.id);
        else next.delete(item.id);
      }
      return next;
    });
    setPrUrl("");
    setSubmitError("");
  }

  async function submit() {
    if (!selectedRepo || selectedIds.size === 0 || !baseBranch) return;
    setSubmitting(true);
    setPrUrl("");
    setSubmitError("");
    try {
      const { url } = await createPr({
        owner: selectedRepo.owner,
        repo: selectedRepo.repo,
        installationId: selectedRepo.installationId,
        baseBranch,
        itemIds: [...selectedIds],
      });
      setPrUrl(url);
    } catch (error: unknown) {
      setSubmitError(
        error instanceof Error ? error.message : "PR 생성에 실패했습니다",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (status.kind === "loading") {
    return (
      <p className="rounded-card border border-border bg-surface p-8 text-sm text-muted">
        카탈로그를 불러오는 중입니다…
      </p>
    );
  }

  if (status.kind === "error") {
    return (
      <div className="rounded-card border border-accent/30 bg-surface p-8">
        <p className="text-sm font-semibold text-fg">
          하네스 서버에 연결하지 못했습니다
        </p>
        <p className="mt-2 text-sm text-muted">{status.message}</p>
      </div>
    );
  }

  const canSubmit =
    Boolean(selectedRepo) && Boolean(baseBranch) && selectedIds.size > 0;

  return (
    <div className="pb-28">
      {/* 1단계 — 배포 대상 */}
      <section className="rounded-card border border-border bg-surface p-6 sm:p-8">
        <h3 className="text-lg font-semibold">배포 대상</h3>
        <p className="mt-1 text-sm text-muted">
          GitHub App이 설치된 레포만 목록에 표시됩니다.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-accent-soft">
              레포
            </span>
            <select
              value={selectedRepoKey}
              onChange={(event) => selectRepo(event.target.value)}
              className={FIELD_CLASS}
            >
              <option value="">레포를 선택하세요</option>
              {repos.map((repo) => (
                <option key={repoKey(repo)} value={repoKey(repo)}>
                  {repoKey(repo)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-accent-soft">
              base 브랜치
            </span>
            <input
              value={baseBranch}
              onChange={(event) => setBaseBranch(event.target.value)}
              placeholder="main"
              className={FIELD_CLASS}
            />
          </label>
        </div>
      </section>

      {/* 2단계 — 항목 선택 */}
      <div className="mt-8 space-y-8">
        {CATALOG_GROUP_ORDER.filter((group) => grouped.has(group)).map(
          (group) => {
            const items = grouped.get(group)!;
            const selectedCount = items.filter((item) =>
              selectedIds.has(item.id),
            ).length;
            const allSelected = selectedCount === items.length;

            return (
              <section key={group}>
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h3 className="text-lg font-semibold">
                    {group}
                    <span className="ml-2 text-sm font-normal text-muted">
                      {selectedCount}/{items.length}
                    </span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => toggleGroup(items, !allSelected)}
                    className="rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-accent hover:text-fg"
                  >
                    {allSelected ? "전체 해제" : "전체 선택"}
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((item) => {
                    const checked = selectedIds.has(item.id);
                    return (
                      <label
                        key={item.id}
                        className={`group flex h-full cursor-pointer gap-3 rounded-card border p-4 transition-colors ${
                          checked
                            ? "border-accent bg-accent/5"
                            : "border-border bg-surface hover:border-accent/40"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(item.id)}
                          className="mt-0.5 size-4 shrink-0 accent-accent"
                        />
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-fg">
                              {item.title}
                            </span>
                            <span className="shrink-0 rounded-full bg-surface2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                              {platformOf(item)}
                            </span>
                          </span>
                          {descriptionOf(item) && (
                            <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                              {descriptionOf(item)}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            );
          },
        )}
      </div>

      {/* 액션 바 */}
      <div className="frost fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 rounded-card border border-border bg-bg/70 px-5 py-4 backdrop-blur-xl sm:inset-x-8 sm:px-6">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg">
            {selectedIds.size}개 선택됨
            {selectedRepo && (
              <span className="ml-2 font-normal text-muted">
                → {repoKey(selectedRepo)} ({baseBranch})
              </span>
            )}
          </p>
          {hookSelected && (
            <p className="mt-0.5 text-xs text-muted">
              훅을 선택했으므로 dispatcher와 설정 파일이 함께 포함됩니다
            </p>
          )}
          {prUrl && (
            <a
              href={prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 block truncate text-xs font-semibold text-accent-soft underline"
            >
              PR이 생성되었습니다 — 열어보기
            </a>
          )}
          {submitError && (
            <p className="mt-0.5 line-clamp-2 text-xs text-accent-soft">
              {submitError}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="shrink-0 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "생성 중…" : "PR 생성"}
        </button>
      </div>
    </div>
  );
}
