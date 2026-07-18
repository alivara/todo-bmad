# `shared/` — the single source-of-truth wire contract (AD-6)

`todo.ts` is the **one** place the `web ↔ api` contract is defined: the todo shape,
field names, camelCase casing, the `metadata` timestamp nesting, the `status` set,
request bodies, and the error envelope.

- **`web`** imports these types directly (via the `@shared/*` tsconfig path alias) so a
  divergence surfaces as a **TypeScript build error, not a runtime bug**.
- **`api`** (Go) mirrors the same shape in `api/model/todo.go`. Full both-sides
  derivation/enforcement (a contract test that fails on drift) is completed in
  **Story 1.2**, when `POST` is introduced and the client first consumes server-minted
  fields. In Story 1.1 the type exists and `web` uses it; the Go struct carries `json`
  tags matching this file exactly.

**Never hand-maintain a second copy of this shape.** To change the contract, edit
`todo.ts` first, then update the Go mirror + its contract test in the same change.
