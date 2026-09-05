"use client";

import { useEffect, useMemo, useState } from "react";
import { Select } from "@/shared/ui";
import {
  BUILT_IN_PRESETS,
  CATALOG_GROUP_ORDER,
  createPr,
  deleteSavedPreset,
  descriptionOf,
  fetchCatalog,
  fetchRepos,
  groupOf,
  isHookItem,
  loadSavedPresets,
  platformOf,
  repoKey,
  saveSavedPreset,
  type CatalogGroup,
  type CatalogItem,
  type RegisteredRepo,
  type SavedPreset,
} from "@/entities/harness";

type Status =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "error"; message: string };

const FIELD_CLASS =
  "w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm text-fg outline-none transition-colors focus:border-accent";

// 같은 스킬이 Claude·Codex로 두 번씩 들어오므로, 한쪽만 보도록 걸러낼 수 있게 한다.
type PlatformFilter = "all" | "Claude" | "Codex";

const PLATFORM_FILTERS: { value: PlatformFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "Claude", label: "Claude" },
  { value: "Codex", label: "Codex" },
];

const PLATFORM_BADGE_CLASS: Record<string, string> = {
  Claude: "bg-accent/15 text-accent-soft",
  Codex: "bg-surface2 text-muted",
};

export default function HarnessSync() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [repos, setRepos] = useState<RegisteredRepo[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");

  const [selectedRepoKey, setSelectedRepoKey] = useState("");
  const [baseBranch, setBaseBranch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [submitting, setSubmitting] = useState(false);
  const [prUrl, setPrUrl] = useState("");
  const [submitError, setSubmitError] = useState("");

  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [namingPreset, setNamingPreset] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchRepos(), fetchCatalog()])
      .then(([loadedRepos, loadedCatalog]) => {
        if (cancelled) return;
        setRepos(loadedRepos);
        setCatalog(loadedCatalog);
        // localStorage는 서버 렌더 시점에 없으므로, 데이터 로드 후 클라이언트에서만 읽는다.
        setSavedPresets(loadSavedPresets());
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
      if (platformFilter !== "all" && platformOf(item) !== platformFilter) {
        continue;
      }
      const group = groupOf(item);
      map.set(group, [...(map.get(group) ?? []), item]);
    }
    return map;
  }, [catalog, platformFilter]);

  // 필터로 가려진 항목도 선택 상태는 유지되므로, 숨은 선택이 몇 개인지 알려줄 수 있게 센다.
  const hiddenSelectedCount = useMemo(
    () =>
      catalog.filter(
        (item) =>
          selectedIds.has(item.id) &&
          platformFilter !== "all" &&
          platformOf(item) !== platformFilter,
      ).length,
    [catalog, selectedIds, platformFilter],
  );

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

  /**
   * 기본 프리셋은 항목 "이름"으로 정의되어 있으므로, 현재 플랫폼 필터가 곧 적용 대상이 된다
   * (전체면 Claude·Codex 양쪽, 한쪽만 보고 있으면 그 플랫폼만).
   */
  function applyBuiltInPreset(itemNames: string[]) {
    const names = new Set(itemNames);
    const ids = catalog
      .filter(
        (item) =>
          names.has(item.title) &&
          (platformFilter === "all" || platformOf(item) === platformFilter),
      )
      .map((item) => item.id);
    setSelectedIds(new Set(ids));
    setPrUrl("");
    setSubmitError("");
  }

  function applySavedPreset(preset: SavedPreset) {
    // 저장 후 카탈로그에서 사라진 항목은 걸러낸다.
    const existing = new Set(catalog.map((item) => item.id));
    setSelectedIds(new Set(preset.itemIds.filter((id) => existing.has(id))));
    setPrUrl("");
    setSubmitError("");
  }

  function saveCurrentSelection() {
    const name = presetName.trim();
    if (!name || selectedIds.size === 0) return;
    setSavedPresets(saveSavedPreset({ name, itemIds: [...selectedIds] }));
    setPresetName("");
    setNamingPreset(false);
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
          <div>
            <span
              id="repo-select-label"
              className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-accent-soft"
            >
              레포
            </span>
            <Select
              value={selectedRepoKey}
              onChange={selectRepo}
              placeholder="레포를 선택하세요"
              emptyMessage="GitHub App이 설치된 레포가 없습니다"
              options={repos.map((repo) => ({
                value: repoKey(repo),
                label: repoKey(repo),
                hint: repo.defaultBranch,
              }))}
            />
          </div>

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

      {/* 프리셋 — 자주 쓰는 조합. 사용자 프리셋은 이 브라우저에만 저장된다 */}
      <section className="mt-8 rounded-card border border-border bg-surface p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">프리셋</h3>
            <p className="mt-1 text-sm text-muted">
              기본 조합을 불러오거나, 지금 선택을 이 브라우저에 저장해 다음에
              다시 쓸 수 있습니다.
            </p>
          </div>
          {namingPreset ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={presetName}
                onChange={(event) => setPresetName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveCurrentSelection();
                  if (event.key === "Escape") setNamingPreset(false);
                }}
                placeholder="프리셋 이름"
                className="w-40 rounded-full border border-border bg-bg px-4 py-1.5 text-sm text-fg outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={saveCurrentSelection}
                disabled={!presetName.trim()}
                className="rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                저장
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setNamingPreset(true)}
              disabled={selectedIds.size === 0}
              className="rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-accent hover:text-fg disabled:opacity-40 disabled:hover:border-border disabled:hover:text-muted"
            >
              현재 선택 저장
            </button>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {BUILT_IN_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => applyBuiltInPreset(preset.itemNames)}
              className="rounded-full border border-accent/40 px-4 py-1.5 text-xs font-semibold text-accent-soft transition-colors hover:bg-accent/10"
            >
              {preset.name}
            </button>
          ))}
          {savedPresets.map((preset) => (
            <span
              key={preset.name}
              className="flex items-center gap-1 rounded-full border border-border bg-bg pl-4 pr-2 text-xs font-semibold text-fg"
            >
              <button
                type="button"
                onClick={() => applySavedPreset(preset)}
                className="py-1.5"
              >
                {preset.name}
                <span className="ml-1.5 font-normal text-muted">
                  {preset.itemIds.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSavedPresets(deleteSavedPreset(preset.name))}
                aria-label={`${preset.name} 프리셋 삭제`}
                className="px-1 text-muted transition-colors hover:text-accent"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </section>

      {/* 플랫폼 필터 — 같은 스킬이 Claude·Codex 두 벌로 들어오므로 한쪽만 골라 볼 수 있게 한다 */}
      <div className="mt-8 flex items-center gap-2 rounded-full border border-border bg-surface p-1 sm:w-fit">
        {PLATFORM_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setPlatformFilter(value)}
            aria-pressed={platformFilter === value}
            className={`flex-1 rounded-full px-5 py-2 text-sm font-semibold transition-colors sm:flex-none ${
              platformFilter === value
                ? "bg-accent text-white"
                : "text-muted hover:text-fg"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 2단계 — 항목 선택 */}
      <div className="mt-6 space-y-8">
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
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                PLATFORM_BADGE_CLASS[platformOf(item)]
                              }`}
                            >
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
            {hiddenSelectedCount > 0 && (
              <span className="ml-1 font-normal text-muted">
                (필터에 가려진 {hiddenSelectedCount}개 포함)
              </span>
            )}
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
