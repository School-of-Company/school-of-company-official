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

// 하네스 API의 실제 주소. 환경변수로 빼지 않고 그냥 박아둔다 — 하네스는 사내에서만 쓰는
// 도구여서 환경별로 갈릴 일이 없고, 서버가 아직 외부에 노출되지 않아 개발자 머신의 SSH
// 터널(로컬 3001)로만 닿는다. 주소가 바뀌면 이 줄만 고치면 된다.
const HARNESS_API_ORIGIN = "http://localhost:3001";

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
  async rewrites() {
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
