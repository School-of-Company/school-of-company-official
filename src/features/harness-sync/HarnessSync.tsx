"use client";

import { useEffect, useMemo, useState } from "react";
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
import RepoPicker from "./RepoPicker";

/**
 * 레포 목록(`/repos`)과 카탈로그(`/catalog`)는 하네스 서버에서 응답 속도가 크게 다르다
 * (레포 목록은 GitHub 설치 정보를 조회하느라 수 초가 걸릴 수 있고, 카탈로그는 즉시 온다).
 * 두 요청을 하나로 묶어 기다리면 화면 전체가 가장 느린 쪽에 발목 잡히므로, 상태를 따로 둬서
 * 카탈로그가 오는 즉시 항목 선택 화면을 보여주고 레포 목록은 그 옆에서 따로 채워지게 한다.
 */
type ResourceStatus =
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
  const [reposStatus, setReposStatus] = useState<ResourceStatus>({
    kind: "loading",
  });
  const [catalogStatus, setCatalogStatus] = useState<ResourceStatus>({
    kind: "loading",
  });
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

  const [reposRetryCount, setReposRetryCount] = useState(0);
  const [catalogRetryCount, setCatalogRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchRepos()
      .then((loaded) => {
        if (cancelled) return;
        setRepos(loaded);
        setReposStatus({ kind: "ready" });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setReposStatus({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "레포 목록을 불러오지 못했습니다",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [reposRetryCount]);

  useEffect(() => {
    let cancelled = false;
    fetchCatalog()
      .then((loaded) => {
        if (cancelled) return;
        setCatalog(loaded);
        // localStorage는 서버 렌더 시점에 없으므로, 데이터 로드 후 클라이언트에서만 읽는다.
        setSavedPresets(loadSavedPresets());
        setCatalogStatus({ kind: "ready" });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setCatalogStatus({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "카탈로그를 불러오지 못했습니다",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [catalogRetryCount]);

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
  function builtInPresetIds(itemNames: string[]): string[] {
    const names = new Set(itemNames);
    return catalog
      .filter(
        (item) =>
          names.has(item.title) &&
          (platformFilter === "all" || platformOf(item) === platformFilter),
      )
      .map((item) => item.id);
  }

  /** 저장 후 카탈로그에서 사라진 항목은 걸러낸다. */
  function savedPresetIds(preset: SavedPreset): string[] {
    const existing = new Set(catalog.map((item) => item.id));
    return preset.itemIds.filter((id) => existing.has(id));
  }

  /** 프리셋 항목이 이미 전부 선택돼 있으면 "켜진" 상태 — 다시 누르면 빠진다. */
  function isPresetActive(ids: string[]): boolean {
    return ids.length > 0 && ids.every((id) => selectedIds.has(id));
  }

  /**
   * 프리셋은 선택을 통째로 갈아끼우지 않고 더하고 뺀다. 그래야 프리셋을 여러 개 겹쳐 쓸 수 있고
   * (공통 최소 + Kotlin 백엔드), 같은 프리셋을 다시 눌러 되돌리는 것도 자연스럽다.
   */
  function togglePreset(ids: string[]) {
    const turningOff = isPresetActive(ids);
    setSelectedIds((previous) => {
      const next = new Set(previous);
      for (const id of ids) {
        if (turningOff) next.delete(id);
        else next.add(id);
      }
      return next;
    });
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

  // 카탈로그가 화면의 본문(항목 선택)이라 이 상태만으로 전체 페이지를 가른다. 레포 목록은
  // 응답이 훨씬 느릴 수 있어(수 초) 따로 기다리지 않고, 아래 "배포 대상" 칸 안에서 자기
  // 상태를 보여준다 — 카탈로그만 왔으면 항목을 미리 훑어보고 고를 수 있다.
  if (catalogStatus.kind === "loading") {
    return <CatalogSkeleton />;
  }

  if (catalogStatus.kind === "error") {
    return (
      <div className="rounded-card border border-accent/30 bg-surface p-8">
        <p className="text-sm font-semibold text-fg">
          하네스 서버에 연결하지 못했습니다
        </p>
        <p className="mt-2 text-sm text-muted">{catalogStatus.message}</p>
        <button
          type="button"
          onClick={() => {
            setCatalogStatus({ kind: "loading" });
            setCatalogRetryCount((count) => count + 1);
          }}
          className="mt-4 rounded-full border border-accent/40 px-4 py-1.5 text-xs font-semibold text-accent-soft transition-colors hover:bg-accent/10"
        >
          다시 시도
        </button>
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
          GitHub App이 설치된 레포만 목록에 표시됩니다. 레포는 소유자별로 나뉘어
          있습니다.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <span
              id="repo-select-label"
              className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-accent-soft"
            >
              레포
            </span>
            {reposStatus.kind === "loading" && (
              <div
                aria-hidden
                className="h-[46px] w-full animate-pulse rounded-xl border border-border bg-surface2"
              />
            )}
            {reposStatus.kind === "error" && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-accent/30 bg-bg px-4 py-3 text-sm">
                <span className="text-muted">레포 목록을 불러오지 못했습니다</span>
                <button
                  type="button"
                  onClick={() => {
                    setReposStatus({ kind: "loading" });
                    setReposRetryCount((count) => count + 1);
                  }}
                  className="shrink-0 text-xs font-semibold text-accent-soft underline"
                >
                  다시 시도
                </button>
              </div>
            )}
            {reposStatus.kind === "ready" && (
              <RepoPicker
                repos={repos}
                value={selectedRepoKey}
                onChange={selectRepo}
              />
            )}
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
              여러 개를 겹쳐 쓸 수 있고, 다시 누르면 빠집니다. 지금 선택을 이
              브라우저에 저장해 다음에 다시 쓸 수도 있습니다.
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
          {BUILT_IN_PRESETS.map((preset) => {
            const ids = builtInPresetIds(preset.itemNames);
            const active = isPresetActive(ids);
            // 카탈로그에 해당 항목이 하나도 없으면(이름 변경·삭제, 플랫폼 필터로 전부 제외 등)
            // 눌러도 더하고 뺄 게 없다. 멀쩡한 버튼처럼 보이면 "안 눌린다"로 오해하므로 비활성 처리.
            const unavailable = ids.length === 0;
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => togglePreset(ids)}
                aria-pressed={active}
                disabled={unavailable}
                title={
                  unavailable
                    ? "이 프리셋의 항목이 현재 카탈로그에 없습니다"
                    : active
                      ? "다시 누르면 선택에서 빠집니다"
                      : undefined
                }
                className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
                  unavailable
                    ? "cursor-not-allowed border-border text-muted opacity-50"
                    : active
                      ? "border-accent bg-accent text-white"
                      : "border-accent/40 text-accent-soft hover:bg-accent/10"
                }`}
              >
                {preset.name}
              </button>
            );
          })}
          {savedPresets.map((preset) => {
            const ids = savedPresetIds(preset);
            const active = isPresetActive(ids);
            return (
              <span
                key={preset.name}
                className={`flex items-center gap-1 rounded-full border pl-4 pr-2 text-xs font-semibold transition-colors ${
                  active
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-bg text-fg"
                }`}
              >
                <button
                  type="button"
                  onClick={() => togglePreset(ids)}
                  aria-pressed={active}
                  disabled={ids.length === 0}
                  title={
                    ids.length === 0
                      ? "저장할 때의 항목이 카탈로그에 남아있지 않습니다"
                      : active
                        ? "다시 누르면 선택에서 빠집니다"
                        : undefined
                  }
                  className={`py-1.5 ${ids.length === 0 ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  {preset.name}
                  <span
                    className={`ml-1.5 font-normal ${active ? "text-white/70" : "text-muted"}`}
                  >
                    {ids.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSavedPresets(deleteSavedPreset(preset.name))
                  }
                  aria-label={`${preset.name} 프리셋 삭제`}
                  className={`px-1 transition-colors ${
                    active
                      ? "text-white/70 hover:text-white"
                      : "text-muted hover:text-accent"
                  }`}
                >
                  ×
                </button>
              </span>
            );
          })}
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

/**
 * 실제 레이아웃(카드 그리드)의 윤곽을 미리 보여준다. 문구 한 줄보다 "곧 이 모양이 채워진다"는
 * 기대를 주고, 로딩이 끝났을 때 레이아웃이 갑자기 뒤바뀌는 느낌(레이아웃 시프트)도 줄어든다.
 */
function CatalogSkeleton() {
  return (
    <div aria-hidden className="animate-pulse pb-28">
      <section className="rounded-card border border-border bg-surface p-6 sm:p-8">
        <div className="h-5 w-28 rounded bg-surface2" />
        <div className="mt-3 h-4 w-3/4 rounded bg-surface2" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="h-[46px] rounded-xl bg-surface2" />
          <div className="h-[46px] rounded-xl bg-surface2" />
        </div>
      </section>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="h-20 rounded-card border border-border bg-surface"
          />
        ))}
      </div>
    </div>
  );
}
