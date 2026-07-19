# `shared/` — the single source-of-truth wire contract (AD-6)

`todo.ts` is the **one** place the `web ↔ api` contract is defined: the todo shape,
field names, camelCase casing, the `metadata` timestamp nesting, the `status` set,
request bodies, and the error envelope.

- **`web`** imports these types directly (via the `@shared/*` tsconfig path alias) so a
  divergence surfaces as a **TypeScript build error, not a runtime bug**.
- **`api`** (Go) mirrors the same shape; the wire serializer lives in
  `api/handler/wire.go`. Full both-sides enforcement **landed in Story 1.2**: a Go
  contract test (`api/handler/contract_test.go`) pins the exact JSON key set and metadata
  nesting, so a drift in `wire.go` fails the build; the Playwright integration suite
  (`assertTodoShape`) asserts the same contract against a live `POST`→`GET` round-trip.

**Never hand-maintain a second copy of this shape.** To change the contract, edit
`todo.ts` first, then update the Go mirror + its contract test in the same change.
