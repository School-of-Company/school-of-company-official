"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ownersOf, repoKey, type RegisteredRepo } from "@/entities/harness";

type Props = {
  repos: RegisteredRepo[];
  value: string;
  onChange: (key: string) => void;
};

/**
 * 배포 대상 레포를 고르는 창.
 *
 * 처음에는 드롭다운 하나에 전부 넣었는데, 등록 절차 없이 "GitHub App이 설치된 레포"가 모두
 * 들어오는 구조라 소유자(조직/개인 계정)가 늘어나는 만큼 목록이 그대로 길어진다. 그래서 목록을
 * 따로 띄우고, 그 안에서 **소유자를 먼저 고른 뒤 레포를 고르는** 2단 구조로 나눴다.
 * 이름 검색도 함께 두어, 소유자를 모르는 상태에서도 바로 찾을 수 있게 했다.
 */
export default function RepoPicker({ repos, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  // "" = 전체 소유자
  const [ownerFilter, setOwnerFilter] = useState("");
  const [query, setQuery] = useState("");
  const owners = useMemo(() => ownersOf(repos), [repos]);

  /**
   * 소유자 칩과 같은 순서로 묶고, 그 안에서는 이름순으로 정렬한다 (GitHub이 돌려주는 순서는
   * 보장이 없어서, 그대로 쓰면 목록 위치가 매번 달라진다).
   */
  const sorted = useMemo(() => {
    const rank = new Map(owners.map(({ owner }, index) => [owner, index]));
    return [...repos].sort(
      (a, b) =>
        (rank.get(a.owner) ?? 0) - (rank.get(b.owner) ?? 0) ||
        a.repo.localeCompare(b.repo),
    );
  }, [repos, owners]);

  const keyword = query.trim().toLowerCase();
  const visible = sorted.filter(
    (repo) =>
      (!ownerFilter || repo.owner === ownerFilter) &&
      (!keyword || repoKey(repo).toLowerCase().includes(keyword)),
  );

  // 창을 열고 닫을 때마다 필터·검색어를 초기 상태로 돌린다 (지난번 검색어가 남아 "레포가
  // 없다"처럼 보이는 걸 막는다). 선택된 레포가 있으면 그 소유자를 미리 골라 둔다.
  function openPicker() {
    const selected = repos.find((repo) => repoKey(repo) === value);
    setOwnerFilter(selected?.owner ?? "");
    setQuery("");
    setOpen(true);
  }

  function choose(repo: RegisteredRepo) {
    onChange(repoKey(repo));
    setOpen(false);
  }

  // 창이 떠 있는 동안은 뒤 페이지가 스크롤되지 않게 하고, Escape로 닫는다.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const dialog = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="레포 선택"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[18vh] backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-card border border-border bg-surface shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-fg">레포 선택</p>
            <p className="mt-0.5 text-xs text-muted">
              GitHub App이 설치된 레포 {repos.length}개
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="닫기"
            className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted transition-colors hover:border-accent hover:text-fg"
          >
            닫기
          </button>
        </div>

        <div className="border-b border-border px-5 py-3">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              // 검색해서 원하는 레포가 맨 위에 왔을 때 Enter로 바로 고를 수 있게 한다.
              if (event.key === "Enter" && visible[0]) choose(visible[0]);
            }}
            placeholder="레포 이름으로 검색"
            className="w-full rounded-xl border border-border bg-bg px-4 py-2.5 text-sm text-fg outline-none transition-colors focus:border-accent"
          />
        </div>

        <div className="grid sm:grid-cols-[minmax(0,11rem)_1fr]">
          {/* 소유자 목록 — 소유자가 하나뿐이면 고를 게 없어 감춘다 */}
          {owners.length > 1 && (
            <div className="flex gap-2 overflow-x-auto border-b border-border p-3 sm:max-h-80 sm:flex-col sm:overflow-y-auto sm:border-b-0 sm:border-r">
              <OwnerButton
                label="전체"
                count={repos.length}
                active={ownerFilter === ""}
                onClick={() => setOwnerFilter("")}
              />
              {owners.map(({ owner, count }) => (
                <OwnerButton
                  key={owner}
                  label={owner}
                  count={count}
                  active={ownerFilter === owner}
                  onClick={() => setOwnerFilter(owner)}
                />
              ))}
            </div>
          )}

          <ul className="max-h-80 overflow-y-auto p-2">
            {visible.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted">
                조건에 맞는 레포가 없습니다
              </li>
            ) : (
              visible.map((repo) => {
                const selected = repoKey(repo) === value;
                return (
                  <li key={repoKey(repo)}>
                    <button
                      type="button"
                      onClick={() => choose(repo)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                        selected
                          ? "bg-accent/10 text-accent-soft"
                          : "text-fg hover:bg-surface2"
                      }`}
                    >
                      <span className="min-w-0 truncate">
                        {/* 소유자는 흐리게 — 목록에서 실제로 구분되는 건 레포 이름이다 */}
                        <span className="text-muted">{repo.owner}/</span>
                        <span className="font-medium">{repo.repo}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted">
                        {repo.defaultBranch}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-bg px-4 py-3 text-left text-sm transition-colors hover:border-accent/50"
      >
        <span className={`truncate ${value ? "text-fg" : "text-muted"}`}>
          {value || "레포를 선택하세요"}
        </span>
        <span className="shrink-0 text-xs font-semibold text-accent-soft">
          {value ? "변경" : "선택"}
        </span>
      </button>

      {/*
        페이지 안쪽에는 스크롤 애니메이션(transform)이 걸린 컨테이너가 있어서, 그 안에서
        `position: fixed`를 쓰면 화면 전체가 아니라 그 컨테이너를 기준으로 잡힌다.
        그래서 창은 `body`로 빼서 그린다. (`open`은 클릭으로만 켜지므로 서버 렌더 때는
        포털에 닿지 않는다 — `document`가 없는 시점에 그려질 일이 없다)
      */}
      {open && createPortal(dialog, document.body)}
    </>
  );
}

function OwnerButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex shrink-0 items-center justify-between gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:w-full sm:shrink ${
        active
          ? "bg-accent text-white"
          : "text-muted hover:bg-surface2 hover:text-fg"
      }`}
    >
      <span className="truncate">{label}</span>
      <span className={`font-normal ${active ? "text-white/70" : "text-muted"}`}>
        {count}
      </span>
    </button>
  );
}
