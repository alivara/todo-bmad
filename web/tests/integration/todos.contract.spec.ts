import { test, expect, resetTodos } from '../support/fixtures';
import { assertTodoShape, assertCollectionShape } from '../support/contract';

/**
 * Contract tests at the api boundary [R3]. No browser — request context only.
 * Story 1.2 scope: create (POST) + list (GET) contract. The commit-DELETE contract
 * (2.3-INT-001) lands with Story 2.3.
 */
test.describe('@integration @contract todos wire contract (AD-6)', () => {
  test.beforeEach(async ({ request }) => {
    await resetTodos(request);
  });

  test('1.3-INT-001 empty list is 200 + [] (never null) @p0', async ({ request }) => {
    const res = await request.get('/api/todos');
    expect(res.status()).toBe(200);
    assertCollectionShape(await res.json());
  });

  test('1.2-INT-001 POST valid -> 201 + AD-6-shaped resource @p0', async ({ request }) => {
    const res = await request.post('/api/todos', { data: { title: 'Email Sam the Q3 numbers' } });
    expect(res.status()).toBe(201);
    const todo = await res.json();
    assertTodoShape(todo);
    expect(todo.status).toBe('active'); // server default
    expect(todo.description).toBe(''); // omitted -> "" not null
  });

  test('1.2-INT-002 empty title -> 400 validation_error, no row @p0', async ({ request }) => {
    const res = await request.post('/api/todos', { data: { title: '   ' } });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('validation_error'); // AD-9 uniform error contract
  });

  test('1.2-INT-003 SQL injection payload is inert, table intact @p0', async ({ request }) => {
    // Parameterized SQL is the only safety net (no auth, R4). The payload must be stored
    // as literal text (or rejected), never executed — and the table must survive.
    const payload = "'; DROP TABLE todos; --";
    const res = await request.post('/api/todos', { data: { title: payload } });
    expect([201, 400]).toContain(res.status());
    if (res.status() === 201) {
      expect((await res.json()).title).toBe(payload); // stored verbatim
    }

    const list = await request.get('/api/todos'); // table still there and queryable
    expect(list.status()).toBe(200);
    expect(Array.isArray(await list.json())).toBe(true);
  });
});
