import { test, expect } from '../support/fixtures';
import { assertTodoShape, assertCollectionShape } from '../support/contract';

/**
 * Contract tests at the api boundary [R3]. No browser — request context only.
 * Covers 1.2-INT-001/002, 1.3-INT-001/002 from the QA doc.
 */
test.describe('@integration @contract todos wire contract (AD-6)', () => {
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
    await request.delete(`/api/todos/${todo.id}`);
  });

  test('1.2-INT-002 empty title -> 400 validation_error, no row @p0', async ({ request }) => {
    const res = await request.post('/api/todos', { data: { title: '   ' } });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('validation_error'); // AD-9 uniform error contract
  });

  test('2.3-INT-001 commit DELETE -> 204; deleting a gone id -> 404 as success @p0', async ({ request }) => {
    const created = await (await request.post('/api/todos', { data: { title: 'temp' } })).json();
    expect((await request.delete(`/api/todos/${created.id}`)).status()).toBe(204);
    // 404 on already-gone is treated as success by the client (AD-6)
    expect((await request.delete(`/api/todos/${created.id}`)).status()).toBe(404);
  });
});
