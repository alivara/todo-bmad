import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST, PATCH, DELETE } from '@/app/api/[...path]/route';

// The dumb BFF proxy (AD-3): the browser calls same-origin /api/*; this route forwards
// verbatim to the internal `api` (status + JSON body untouched) and — critically — never
// lets a thrown fetch or an HTML error reach the browser. On an unreachable/timed-out api
// it synthesizes the AD-9 envelope (502/504). These paths are exercised end-to-end by the
// Playwright suite; this unit test pins the proxy's own logic (verbatim forward, hop-by-hop
// header stripping, null-body statuses, and the AD-9 error synthesis) deterministically —
// the file the coverage report flagged at 0%. Upstream `fetch` is stubbed; no network.

const UPSTREAM = 'http://api:8080';

let fetchMock: ReturnType<typeof vi.fn>;

function ctx(path: string[]) {
  return { params: Promise.resolve({ path }) };
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('BFF proxy route (AD-3 pass-through + AD-9 error synthesis)', () => {
  it('forwards GET verbatim — upstream status, JSON body, and content-type are untouched', async () => {
    // Given the api answers 200 with a bare array (the GET /todos wire shape)
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ id: '1' }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    // When the browser hits the proxied path with a query string
    const res = await GET(new NextRequest('http://localhost:3000/api/todos?status=active'), ctx(['todos']));

    // Then the upstream was called at the internal api with the path + search preserved
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [target, init] = fetchMock.mock.calls[0];
    expect(target).toBe(`${UPSTREAM}/todos?status=active`);
    expect((init as RequestInit).method).toBe('GET');

    // ...and the response is forwarded verbatim (status, body, content-type)
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(await res.json()).toEqual([{ id: '1' }]);
  });

  it('strips hop-by-hop/host request headers but forwards the rest', async () => {
    fetchMock.mockResolvedValue(
      new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    await GET(
      new NextRequest('http://localhost:3000/api/todos', {
        headers: { connection: 'keep-alive', 'x-trace-id': 'abc-123', accept: 'application/json' },
      }),
      ctx(['todos']),
    );

    const forwarded = (fetchMock.mock.calls[0][1] as RequestInit).headers as Headers;
    expect(forwarded.get('connection')).toBeNull(); // hop-by-hop stripped
    expect(forwarded.get('x-trace-id')).toBe('abc-123'); // app header passed through
    expect(forwarded.get('accept')).toBe('application/json');
  });

  it('forwards a POST body to the upstream', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 'new' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const res = await POST(
      new NextRequest('http://localhost:3000/api/todos', {
        method: 'POST',
        body: JSON.stringify({ title: 'hi' }),
        headers: { 'content-type': 'application/json' },
      }),
      ctx(['todos']),
    );

    expect(res.status).toBe(201);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBeDefined(); // body buffered + forwarded, not dropped
  });

  it('forwards a 204 (null-body status) without a body and without throwing', async () => {
    // A commit-DELETE / test-reset returns 204; the Response ctor throws if given a body for
    // a null-body status, which would wrongly surface as a 502. The proxy must drop the body.
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const res = await DELETE(
      new NextRequest('http://localhost:3000/api/todos/1', { method: 'DELETE' }),
      ctx(['todos', '1']),
    );

    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
  });

  it('synthesizes a 502 AD-9 error when the api is unreachable', async () => {
    // A connection refusal is a generic (non-abort) throw → 502 unavailable.
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await GET(new NextRequest('http://localhost:3000/api/todos'), ctx(['todos']));

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: { code: 'internal_error', message: 'The server is unavailable.' },
    });
  });

  it('synthesizes a 504 AD-9 error when the api times out (AbortError)', async () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError'; // mirrors the AbortController firing on the timeout
    fetchMock.mockRejectedValue(abort);

    const res = await PATCH(
      new NextRequest('http://localhost:3000/api/todos/1', {
        method: 'PATCH',
        body: '{"status":"completed"}',
      }),
      ctx(['todos', '1']),
    );

    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({
      error: { code: 'internal_error', message: 'The server took too long to respond.' },
    });
  });
});
