import type { Metadata } from "next";
import { Header } from "@/widgets/header";
import { Harness } from "@/widgets/harness";
import { Footer } from "@/widgets/footer";

// 내부 운영 페이지라 검색엔진에 노출하지 않습니다(헤더 내비게이션에도 링크를 두지 않음).
export const metadata: Metadata = {
  title: "AI 하네스 배포",
  robots: { index: false, follow: false },
};

export default function HarnessPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Harness />
      </main>
      <Footer />
    </>
  );
}
