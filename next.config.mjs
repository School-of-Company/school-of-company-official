import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Next's dev-mode webpack runtime (HMR/React Refresh) executes modules via
// `eval`, so script-src needs 'unsafe-eval' locally. Production doesn't use
// eval and stays stricter without it.
const SCRIPT_SRC =
  process.env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      SCRIPT_SRC,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

// 하네스 API의 실제 주소. 브라우저에 노출되지 않는 서버 전용 값이라 NEXT_PUBLIC_ 접두사가 없다.
// 로컬에서는 `.env.local`에, 배포 환경에서는 Vercel 환경변수에 넣는다
// (예: 로컬 SSH 터널이면 http://localhost:3001).
//
// rewrites()는 서버가 뜰 때 한 번만 평가되므로, Vercel에서 값을 바꾸면 재배포해야 반영된다.
const HARNESS_API_ORIGIN = process.env.HARNESS_API_ORIGIN;

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // 하네스 API를 같은 오리진 경로로 프록시한다.
  //
  // 위 CSP의 `connect-src 'self'`가 다른 오리진으로 나가는 fetch를 전부 막기 때문에, 브라우저가
  // 하네스 서버(다른 포트/도메인)를 직접 호출하면 차단된다. 프록시를 두면 브라우저는 자기
  // 오리진만 부르고 실제 호출은 Next 서버가 대신하므로, CSP를 느슨하게 풀지 않아도 되고
  // CORS·혼합 콘텐츠 문제도 함께 사라진다.
  //
  // 값이 없으면 프록시를 아예 등록하지 않는다. 잘못된 목적지를 넣어두면 사이트 전체가 이상하게
  // 동작하는 반면, 등록하지 않으면 하네스 페이지만 "서버에 연결할 수 없다"고 뜨고 나머지
  // 페이지는 멀쩡하다. 하네스는 사내 도구라 이 저장소를 받는 모두가 값을 갖고 있을 필요도 없다.
  async rewrites() {
    if (!HARNESS_API_ORIGIN) return [];
    return [
      {
        source: "/api/harness/:path*",
        destination: `${HARNESS_API_ORIGIN}/:path*`,
      },
    ];
  },
  experimental: {
    optimizePackageImports: ["framer-motion"],
  },
  // Next's automatic tsconfig `paths` -> webpack alias wiring doesn't kick in
  // when the native SWC binary is unavailable and it falls back to the WASM
  // build (see: Application Control policy blocking @next/swc-win32-x64-msvc
  // on this machine). Wire the `@/*` alias explicitly so it keeps working.
  webpack: (config) => {
    config.resolve.alias["@"] = path.join(__dirname, "src");
    return config;
  },
  typescript: {
    // Next's built-in "Running TypeScript" build step crashes under the same
    // native-SWC-unavailable condition ("invalid type: unit value, expected
    // usize" from the WASM fallback). Type safety is verified separately via
    // plain `tsc --noEmit` (see package.json's `typecheck` script), which
    // doesn't touch SWC at all.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
