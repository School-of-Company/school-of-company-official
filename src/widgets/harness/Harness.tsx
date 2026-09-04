import { HarnessSync } from "@/features/harness-sync";
import { SectionGlow } from "@/shared/ui";

export default function Harness() {
  return (
    <section className="relative overflow-hidden py-16 sm:py-24">
      <SectionGlow className="-right-40 top-0 h-[420px] w-[420px]" />

      <div className="relative mx-auto max-w-content px-6 sm:px-8 lg:px-10">
        <div className="mb-10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent-soft">
            Internal
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            AI 하네스 배포
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            프로젝트에 필요한 스킬·에이전트·훅만 골라 대상 레포에 PR로 보냅니다.
          </p>
        </div>

        <HarnessSync />
      </div>
    </section>
  );
}
