// The typed error contract the data layer throws for a non-2xx response (AC3, AD-9). It carries
// the HTTP `status` and, when the AD-9 body parsed, the server `code`/`message`. The 4xx/5xx split
// at every surface branches on this: a `4xx` inlines the server `message` with NO retry (retrying
// the user's malformed input is futile); a `5xx`/network/timeout offers a retry. A network/timeout
// throw is NOT an ApiError (fetch rejects with a bare Error, no status) and is treated as our fault.

/**
 * The typed non-2xx error. `status` is the HTTP status; `code` is the AD-9 vocab code when the
 * error body parsed (`validation_error` / `not_found` / `internal_error`), else undefined.
 */
export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Build an ApiError from a non-2xx Response, parsing the AD-9 `{ error: { code, message } }` body
 * for the user-facing message + code. DEFENSIVE: a non-JSON, empty, or misshaped body never throws
 * — it falls back to a generic status-keyed message. Callers do `throw await toApiError(res)`.
 */
export async function toApiError(res: Response): Promise<ApiError> {
  let code: string | undefined;
  let message: string | undefined;

  try {
    const body: unknown = await res.json();
    if (body && typeof body === 'object' && 'error' in body) {
      const inner = (body as { error: unknown }).error;
      if (inner && typeof inner === 'object') {
        const e = inner as { code?: unknown; message?: unknown };
        if (typeof e.code === 'string') code = e.code;
        if (typeof e.message === 'string') message = e.message;
      }
    }
  } catch {
    // Non-JSON, empty, or already-consumed body — fall through to the generic fallback. Parsing an
    // error response must NEVER itself throw, or a failed request would surface as an opaque crash.
  }

  return new ApiError(res.status, message ?? `Request failed (status ${res.status})`, code);
}

/**
 * Retryable = our fault or unknown. A network/timeout throw (not an ApiError, so it has no status)
 * or a `5xx` is retryable; a `4xx` (the user's input) is not — retrying malformed input is futile.
 */
export function isRetryable(err: unknown): boolean {
  if (!(err instanceof ApiError)) return true; // network / unknown → treat as our fault
  return err.status >= 500;
}

/**
 * True when the error is a client (`4xx`) ApiError — the surface inlines its server `message` and
 * offers no retry control. A type predicate so callers can read `err.message` in the true branch.
 */
export function is4xx(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status >= 400 && err.status < 500;
}

/**
 * The inline text to show for a 4xx: the server's AD-9 `message` when the body actually parsed
 * (`code` set), else a voice-safe generic — NEVER the raw `Request failed (status N)` fallback,
 * which would leak a status code + jargon into the UI (voice rule).
 */
export function inline4xxText(err: ApiError): string {
  return err.code ? err.message : 'Something got in the way.';
}
