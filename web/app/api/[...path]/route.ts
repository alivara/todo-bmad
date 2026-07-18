import { NextResponse, type NextRequest } from 'next/server';

// The dumb BFF proxy (AD-3). The browser calls same-origin `/api/*`; this route
// forwards verbatim to the internal `api` service (status + JSON body untouched),
// with NO business logic, reshaping, or data ownership. If `api` is unreachable or
// exceeds the timeout, it synthesizes an AD-9-shaped error — never an HTML page or a
// thrown fetch reaching the browser.

export const dynamic = 'force-dynamic';

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://api:8080';

// Validated so a malformed env can't collapse the timeout to 0/NaN (which would abort
// every request instantly). Falls back to 10s on anything non-positive/non-finite.
const TIMEOUT_MS = (() => {
  const parsed = Number(process.env.API_PROXY_TIMEOUT_MS ?? '10000');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10_000;
})();

// Host + RFC 7230 hop-by-hop headers that must not be forwarded verbatim to upstream.
const STRIP_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'te',
  'trailer',
  'upgrade',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
]);

function apiError(status: number, code: string, message: string) {
  // AD-9 envelope. 502 = api unreachable, 504 = api timed out.
  return NextResponse.json({ error: { code, message } }, { status });
}

async function forward(req: NextRequest, path: string[]): Promise<Response> {
  const search = req.nextUrl.search;
  const target = `${API_INTERNAL_URL}/${path.join('/')}${search}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const headers = new Headers();
    req.headers.forEach((value, key) => {
      if (!STRIP_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
    });

    // Reading the request body is inside the try so a client disconnect mid-body is
    // caught and returned as an AD-9 error, never an uncaught throw / HTML 500.
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const body = hasBody ? await req.arrayBuffer() : undefined;

    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      signal: controller.signal,
      cache: 'no-store',
    });

    // Buffer the response body so the abort timer covers the FULL exchange (headers
    // AND body) — a stalled upstream body now aborts to a 504 instead of hanging the
    // browser. Payloads are small JSON; this stays a verbatim status+body forward.
    const respBody = await upstream.arrayBuffer();

    const respHeaders = new Headers();
    const contentType = upstream.headers.get('content-type');
    if (contentType) respHeaders.set('content-type', contentType);

    return new Response(respBody, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: respHeaders,
    });
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    return isTimeout
      ? apiError(504, 'internal_error', 'The server took too long to respond.')
      : apiError(502, 'internal_error', 'The server is unavailable.');
  } finally {
    clearTimeout(timer);
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

async function handle(req: NextRequest, ctx: Ctx): Promise<Response> {
  const { path } = await ctx.params;
  return forward(req, path);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
