/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a self-contained server bundle so the Docker runtime image stays small (AD-12).
  // shared/ is consumed via `import type` only, so it is erased at build and never
  // needs to be traced into the standalone runtime output.
  output: 'standalone',
};

export default nextConfig;
