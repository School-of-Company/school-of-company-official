"use client";

import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ThemeToggle } from "@/features/theme-toggle";
import { EASE_POP, useReducedMotionSafe } from "@/shared/lib";
import { Logo } from "@/shared/ui";

const HOME_PATH = "/";

const NAV_ITEMS = [
  { path: "/", label: "소개" },
  { path: "/recruit", label: "모집 안내" },
  { path: "/harness", label: "하네스" },
];

const MotionLink = motion.create(Link);

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const reduceMotion = useReducedMotionSafe();
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const menuSlide = reduceMotion ? 0 : -12;

  const scrollToTop = (e: MouseEvent) => {
    if (window.location.pathname !== HOME_PATH) return;
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow] duration-300 ${
        menuOpen
          ? "bg-bg border-b border-border"
          : scrolled
            ? "frost bg-bg/50 shadow-[0_12px_30px_-16px_rgba(0,0,0,0.35)] backdrop-blur-md"
            : "bg-transparent"
      }`}
    >
      <div className="relative mx-auto flex h-16 max-w-wide items-center justify-between px-6 sm:px-8 lg:px-10">
        <Link
          href={HOME_PATH}
          onClick={scrollToTop}
          className="flex items-center"
          aria-label="홈으로 이동"
        >
          <Logo className="h-5 w-auto text-fg sm:h-6" />
        </Link>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`text-[17px] font-semibold transition-colors ${
                pathname === item.path ? "text-fg" : "text-muted hover:text-fg"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <ThemeToggle />
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            aria-label="메뉴 열기"
            className="relative z-10 flex h-9 w-9 items-center justify-center rounded-lg text-fg"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="relative block h-4 w-5">
              <span
                className={`absolute left-0 top-0 h-[1.5px] w-5 bg-fg transition-transform ${
                  menuOpen ? "translate-y-1.75 rotate-45" : ""
                }`}
              />
              <span
                className={`absolute left-0 top-[7px] h-[1.5px] w-5 bg-fg transition-opacity ${
                  menuOpen ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`absolute left-0 top-[14px] h-[1.5px] w-5 bg-fg transition-transform ${
                  menuOpen ? "translate-y-[-7px] -rotate-45" : ""
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: menuSlide }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: menuSlide }}
            transition={{
              duration: reduceMotion ? 0.15 : 0.25,
              ease: EASE_POP,
            }}
            className="frost fixed inset-x-0 top-16 bottom-0 z-40 flex flex-col bg-bg/85 px-6 py-8 backdrop-blur-xl md:hidden"
          >
            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map((item, i) => (
                <MotionLink
                  key={item.path}
                  href={item.path}
                  onClick={() => setMenuOpen(false)}
                  initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: reduceMotion ? 0.15 : 0.3,
                    delay: reduceMotion ? 0 : 0.05 + i * 0.05,
                  }}
                  className={`border-b border-border py-4 text-lg font-medium transition-colors hover:text-accent-soft ${
                    pathname === item.path ? "text-fg" : "text-muted"
                  }`}
                >
                  {item.label}
                </MotionLink>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
