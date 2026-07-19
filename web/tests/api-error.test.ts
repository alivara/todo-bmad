import { describe, it, expect } from 'vitest';
import { ApiError, toApiError, isRetryable, is4xx } from '@/lib/apiError';

// AC3: the typed ApiError + the 4xx/5xx/network classification the whole error split hinges on.
// toApiError must parse the AD-9 body for code/message, be DEFENSIVE (never throw on a non-JSON or
// empty body), and the predicates must class 4xx (inline, no retry) vs 5xx/network (retry).

// A minimal Response stub — just the fields toApiError reads. `json` may resolve, reject, or be
// absent (a body already consumed / a synthetic response) to exercise the defensive path.
function res(status: number, json?: () => Promise<unknown>): Response {
  return { status, json } as unknown as Response;
}

describe('ApiError', () => {
  it('carries the status, message, and optional code', () => {
    const err = new ApiError(400, 'title is required', 'validation_error');
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(400);
    expect(err.message).toBe('title is required');
    expect(err.code).toBe('validation_error');
    expect(err.name).toBe('ApiError');
  });
});

describe('toApiError', () => {
  it('parses the AD-9 { error: { code, message } } body', async () => {
    const err = await toApiError(
      res(400, async () => ({ error: { code: 'validation_error', message: 'title is required' } })),
    );
    expect(err.status).toBe(400);
    expect(err.code).toBe('validation_error');
    expect(err.message).toBe('title is required');
  });

  it('falls back to a generic message when the body has no error envelope', async () => {
    const err = await toApiError(res(500, async () => ({ unexpected: true })));
    expect(err.status).toBe(500);
    expect(err.code).toBeUndefined();
    expect(err.message).toContain('500');
  });

  it('never throws when the body is not JSON (json() rejects)', async () => {
    const err = await toApiError(
      res(502, async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      }),
    );
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(502);
    expect(err.message).toContain('502');
  });

  it('never throws when there is no json method at all (empty/synthetic response)', async () => {
    const err = await toApiError(res(504));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(504);
  });
});

describe('isRetryable / is4xx', () => {
  it('classes a 4xx as NOT retryable and is4xx true', () => {
    const err = new ApiError(400, 'title is required', 'validation_error');
    expect(is4xx(err)).toBe(true);
    expect(isRetryable(err)).toBe(false);
  });

  it('classes a 404 as a 4xx (not retryable)', () => {
    const err = new ApiError(404, 'not found', 'not_found');
    expect(is4xx(err)).toBe(true);
    expect(isRetryable(err)).toBe(false);
  });

  it('classes a 5xx as retryable and is4xx false', () => {
    const err = new ApiError(500, 'boom', 'internal_error');
    expect(is4xx(err)).toBe(false);
    expect(isRetryable(err)).toBe(true);
  });

  it('classes a network throw (a bare Error, no status) as retryable and not 4xx', () => {
    const err = new TypeError('Failed to fetch');
    expect(is4xx(err)).toBe(false);
    expect(isRetryable(err)).toBe(true);
  });

  it('classes an unknown non-error value as retryable (our fault / unknown)', () => {
    expect(isRetryable(undefined)).toBe(true);
    expect(is4xx(undefined)).toBe(false);
  });
});
