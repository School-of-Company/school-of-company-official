"use client";

import { useEffect, useRef, useState } from "react";

export type SelectOption = {
  value: string;
  label: string;
  /** 오른쪽에 흐리게 붙는 보조 텍스트 (예: 기본 브랜치). */
  hint?: string;
};

type Props = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  id?: string;
};

/**
 * 브라우저 기본 `<select>` 대신 쓰는 드롭다운. 기본 select는 OS가 목록을 그려서 사이트
 * 테마·폰트가 적용되지 않고, 항목에 보조 정보(브랜치 등)를 붙일 수도 없다.
 *
 * 접근성은 직접 챙긴다 — 버튼(`aria-haspopup="listbox"`) + 목록(`role="listbox"`) 구조에
 * 방향키/Enter/Escape/Home/End 키 조작과 바깥 클릭 닫기를 붙였다.
 */
export default function Select({
  value,
  options,
  onChange,
  placeholder = "선택하세요",
  emptyMessage = "선택할 항목이 없습니다",
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // 열릴 때 현재 선택된 항목이 보이도록 스크롤을 맞춘다.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelectorAll("li")
      [highlighted]?.scrollIntoView({ block: "nearest" });
  }, [open, highlighted]);

  function openList() {
    const selectedIndex = options.findIndex((option) => option.value === value);
    setHighlighted(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }

    switch (event.key) {
      case "Escape":
        event.preventDefault();
        setOpen(false);
        break;
      case "ArrowDown":
        event.preventDefault();
        setHighlighted((i) => Math.min(i + 1, options.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlighted((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setHighlighted(0);
        break;
      case "End":
        event.preventDefault();
        setHighlighted(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        choose(highlighted);
        break;
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-bg px-4 py-3 text-left text-sm transition-colors ${
          open ? "border-accent" : "border-border hover:border-accent/50"
        }`}
      >
        <span className={`truncate ${selected ? "text-fg" : "text-muted"}`}>
          {selected?.label ?? placeholder}
        </span>
        <svg
          aria-hidden
          viewBox="0 0 12 8"
          className={`h-2 w-3 shrink-0 text-muted transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          <path
            d="M1 1.5L6 6.5L11 1.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/*
        열고 닫는 애니메이션을 두지 않는다 — 목록이 바로 뜨고 바로 사라지는 편이
        조작감이 확실하다. (모션이 있으면 아무리 짧아도 클릭과 결과 사이에 지연이 끼어든다)
      */}
      {open && (
        <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl shadow-black/20">
          {options.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">{emptyMessage}</p>
          ) : (
            <ul
              ref={listRef}
              role="listbox"
              aria-activedescendant={`option-${highlighted}`}
              className="max-h-64 overflow-y-auto py-1"
            >
              {options.map((option, index) => {
                const isSelected = option.value === value;
                return (
                  <li
                    key={option.value}
                    id={`option-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    onPointerEnter={() => setHighlighted(index)}
                    onClick={() => choose(index)}
                    className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors ${
                      index === highlighted ? "bg-accent/10" : ""
                    } ${isSelected ? "text-accent-soft" : "text-fg"}`}
                  >
                    <span className="truncate">{option.label}</span>
                    {option.hint && (
                      <span className="shrink-0 text-xs text-muted">
                        {option.hint}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
