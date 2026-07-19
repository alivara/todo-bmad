/** @type {import('next').NextConfig} */

// Security response headers (Story 3.5, SEC-1). Applied to every route via `async headers()` below.
//
// CSP note: `script-src` MUST keep `'unsafe-inline'` — the Story 3.4 no-flash theme script is a
// streamed `dangerouslySetInnerHTML` inline `<script>` and Next's runtime also emits inline scripts,
// and a per-request nonce can't be threaded through a streamed inline script here. Nonce-based
// tightening is deferred future hardening (see deferred-work.md); this is the pragmatic v1 floor.
// `style-src 'unsafe-inline'` likewise supports the app's inline styles + Next's inline CSS.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
];

const nextConfig = {
  // Emit a self-contained server bundle so the Docker runtime image stays small (AD-12).
  // shared/ is consumed via `import type` only, so it is erased at build and never
  // needs to be traced into the standalone runtime output.
  output: 'standalone',

  // Serve the CSP + hardening headers on every response, including the /api/* proxy routes.
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
