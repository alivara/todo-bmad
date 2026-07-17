# Adversary Review — ARCHITECTURE-SPINE.md (todo-app)

**Method:** For each finding, two independently-built units (`web`, `api`, `db`) each obey *every*
AD and convention to the letter, yet produce mutually incompatible behavior. Every finding names
the two concrete conflicting behaviors and the AD to add/tighten.

Verdict: the spine pins the *single-resource* wire shape well (AD-6) but leaves the **collection
envelope, the write-request bodies, success status codes, the error-code vocabulary, the proxy's
failure behavior, and the char-counting unit** unpinned — and AD-5 contains an internal
self-contradiction that lets a deleted row resurrect. Multiple near-certain divergences.

---

## SEV-1 — AD-5 self-contradiction: reload mid-window resurrects the "deleted" todo

**Where:** AD-5.

**The two rules that collide, both inside AD-5:**
1. "delete removes the row from the UI immediately … **No network call during the window.**"
2. "Reload/close mid-window = committed (the `DELETE` is treated as sent) — **the todo does not
   reappear.**"

**Concrete failure:** User deletes todo T. Client hides it, starts the ~5s timer, sends nothing
(rule 1). At t+2s the user reloads. Per rule 1 no `DELETE` ever reached `api`, so the row is still
in Postgres. On reload, `web` issues `GET /todos`; `api`/`db`, both perfectly obeying their rules,
return T. **T reappears** — directly violating rule 2. `web` believes T is gone; `db` believes T
exists. Two owners of one piece of state with no agreed reconciliation.

The only ways to honor rule 2 (fire the `DELETE` synchronously on `beforeunload`/`pagehide` via
`fetch(..., {keepalive:true})` or `sendBeacon`) *violate* rule 1 ("no network call during the
window"), and the spine never says a beacon path exists, never says what HTTP method/route the
beacon uses, and never says the proxy must forward keepalive/beacon requests.

**Close it:** Add/rewrite AD-5 to make the unload path explicit and self-consistent — e.g. "on
`pagehide`/`beforeunload` while a delete is pending, the client **flushes** the pending `DELETE`
synchronously (keepalive fetch / beacon) through the same `/api/todos/:id` route; the 'no network
call during the window' rule applies only while the tab stays open." Pin that the proxy forwards
keepalive/beacon requests unbuffered.

---

## SEV-2 — `GET /todos` collection shape is unpinned; Go emits `null`, client expects `[]`

**Where:** AD-6 (fixes only the single-resource shape), ordering convention, Feature B.

**Two conforming behaviors that don't compose:**
- `api`: the repository finds no rows and returns a `nil` `[]Todo`. `json.Marshal(nil slice)`
  produces the literal `null` (Go's documented behavior), so `GET /todos` on an empty list returns
  `null` with 200. Nothing in the spine forbids this.
- `web`: TanStack Query holds "todos" and components `.map()` over the array. `null.map` throws →
  React error boundary / blank screen on the *empty* (first-run) state — the most common state.

**Second half of the same hole — envelope shape.** AD-6 pins the *element* shape but never says
whether the collection is a **bare array** `[ {...}, {...} ]` or a **wrapped object**
`{ "todos": [ ... ] }` (or paginated `{ "data": [...], "total": n }`). Two teams reading AD-6 to the
letter can each pick a different envelope and both be "compliant." Client and API then disagree on
where the array even lives.

**Close it:** Extend AD-6 (or add AD-6a) to pin the collection response exactly: bare JSON array,
and **empty list serializes as `[]`, never `null`** (api must initialize the slice to non-nil).
Pin the same for future pagination so it isn't retrofitted incompatibly.

---

## SEV-3 — 500-char cap uses different counting units on client vs server (AD-10)

**Where:** AD-10 ("the 500-char cap … enforced server-side (authoritative) and mirrored
client-side").

**Two conforming behaviors:**
- `web` mirror: JavaScript `description.length` counts **UTF-16 code units**.
- `api` authority: idiomatic Go validation uses `len(s)` (**bytes**) or `utf8.RuneCountInString`
  (**runes/code points**). All three are defensible "character" counts.

**Concrete divergence at the boundary:** a description of 300 emoji (`😀`, each = 1 code point =
2 UTF-16 units = 4 UTF-8 bytes). Client `.length` = 600 → client rejects (>500). Server rune count
= 300 → server would accept. Or the reverse near 500 mixed-script text: client passes, server
byte-length rejects → the client showed the input as valid but the authoritative `POST` returns 400,
and (per AD-9) the client "maps any non-2xx to the error state + retry" — an unfixable retry loop on
text the mirror called valid. AD-10's whole promise ("client and server disagreeing on what is
valid" is *prevented*) is broken because the *unit* is unpinned.

**Close it:** Tighten AD-10 to name the counting unit identically on both sides — recommend
**Unicode code points (runes)**: server `utf8.RuneCountInString`, client
`[...description].length` (spread counts code points, not UTF-16 units). Also pin whether the cap
is measured **before or after trimming** (see SEV-8).

---

## SEV-4 — PATCH partial-body semantics are ambiguous: absent vs empty vs clobber

**Where:** Endpoints convention ("`PATCH /todos/:id` (partial: description and/or status)"),
Features C & D.

**The unpinned questions the two units answer differently:**
1. Does an **omitted** field mean "leave unchanged"? The convention implies yes but never says it.
2. How does `api` distinguish *absent* from *present-but-empty*? If the handler unmarshals into a
   struct with value types (`Description string`), an omitted `description` unmarshals to `""` —
   indistinguishable from an explicit `""`. The service then either (a) rejects the PATCH as
   empty-description (AD-10) even though the client only wanted to toggle status, or (b) overwrites
   the description with `""`. A client that sends `{ "status":"completed" }` for a toggle (Feature
   D) hits exactly this.
3. Can `description` **and** `status` change in one call? The convention says "and/or" — so yes —
   but never pins that a combined PATCH is atomic, nor the order of validation.

**Concrete failure:** Feature D toggle sends `PATCH {"status":"completed"}`. `api` team A used
`*string` pointers → description untouched (correct). `api` team B used value types → description
now `""` and validation 400s the toggle. Both "obey" the convention. `web`, obeying AD-4, applied
the toggle optimistically and now must roll back a *status* change because of a *description* error
it never touched.

**Close it:** Add an AD (or tighten the Endpoints row) stating: PATCH bodies use optional/nullable
fields; **absent field = leave unchanged**; `api` MUST use pointer/`omitempty`-aware decoding to
distinguish absent from empty; an explicitly-present `description` is validated by AD-10, an absent
one is not; both fields may be updated in one atomic call; `updatedAt` bumps once.

---

## SEV-5 — Proxy (AD-3) has no defined behavior for upstream errors, down-api, or timeouts

**Where:** AD-3 ("pure pass-through"), AD-9 (error contract), Structural Seed (`web → api:8080`).

**The gap:** AD-9 guarantees the *client* that "every non-2xx response is
`{error:{code,message}}`" and that it "maps any non-2xx to the error state + retry." But AD-9's
guarantee is authored by `api`/Gin. When `api` is **down** (connection refused), **slow**
(timeout), or returns a **non-Gin 502/413**, there is no Gin response to pass through — the proxy
(a Next route handler) must synthesize one. A "pure pass-through" proxy that obeys AD-3 literally
will surface Next's default **HTML** 500 page, or let `fetch` throw, or return an empty body.

**Concrete failure:** `api` container is restarting (healthcheck-gated boot, AD-12). `web` is up.
Browser calls `/api/todos`. Proxy's upstream `fetch` rejects (ECONNREFUSED). The client's AD-9
parser does `res.json()` expecting `{error:{code,message}}` and gets an HTML body or a thrown
fetch → **unhandled**, violating AD-9's "no raw exception surfaces to the user" and NFR9. `web` and
`api` each obeyed their rules; the seam between them was never specified.

Related unpinned sub-questions, all cross-unit:
- **Who owns the timeout budget?** Proxy fetch timeout? Client TanStack timeout? Gin write
  timeout? If none is pinned, a slow query hangs the browser indefinitely or three layers time out
  at conflicting thresholds.
- **Does the proxy pass through the upstream status code verbatim** (so a Gin 400 stays 400) or
  collapse everything to 200/500? AD-3 "no reshaping" implies verbatim, but then it must also pass
  the body and content-type verbatim — unstated.

**Close it:** Tighten AD-3: the proxy forwards upstream status + JSON body + content-type verbatim
for any received response, **and** maps transport failures (refused/timeout/upstream non-JSON) to
the AD-9 envelope itself — e.g. `502 {error:{code:"upstream_unavailable",...}}`,
`504 {error:{code:"upstream_timeout",...}}`. Add an AD pinning one timeout budget (proxy→api) as
the authoritative deadline. This keeps AD-3 "dumb" on the happy path while guaranteeing AD-9 holds
for the client on every path.

---

## SEV-6 — AD-9 error `code` vocabulary is unspecified, and "retry any non-2xx" fights validation

**Where:** AD-9, AD-10, FR22.

**Problem A — no closed set of `code` strings.** AD-9 mandates `{error:{code,message}}` but never
enumerates the allowed `code` values. `api` team invents `VALIDATION_ERROR`; `web` team branches on
`invalid_description` / `not_found`. Both "comply" with AD-9; neither can interoperate on `code`.
The client cannot reliably branch (inline field error vs global banner vs retry) because the
vocabulary isn't a contract.

**Problem B — "map any non-2xx to error state + retry" contradicts validation UX.** AD-9 says the
client "maps **any** non-2xx to the error state + retry path (FR22)." A **400** validation error
(AD-10) is not retryable — the same body will 400 again. Offering "retry" on a 400 is a dead loop;
the correct behavior is an inline field message with no auto-retry. So AD-9 (retry everything) and
AD-10 (mirror validation → inline feedback) prescribe conflicting client behavior for the 400 case.

**Concrete failure:** `POST` with a 501-char description → `api` returns `400
{error:{code:"...",...}}`. Client, obeying AD-9 literally, shows the global non-disruptive error
banner with a Retry button; user clicks Retry, same 400, forever. Meanwhile AD-10 wanted an inline
"too long" message.

**Close it:** Enumerate a closed `code` set in AD-9 (e.g. `validation_error`, `not_found`,
`internal_error`, `upstream_unavailable`, `upstream_timeout`) and pin the code↔status mapping.
Split the client contract: **4xx (esp. 400) → inline/validation, no auto-retry; 5xx + transport →
retryable error state.** This reconciles AD-9 with AD-10.

---

## SEV-7 — Optimistic-add insertion position vs server newest-first is unpinned

**Where:** AD-4 (`onMutate` applies optimistically), AD-7 (temp-id), ordering convention
(`created_at DESC`, "client **never** re-sorts — one source of order").

**The conflict:** the ordering convention forbids the client from *sorting*, and mandates
newest-first from the server. But AD-4's `onMutate` must place the optimistic todo *somewhere* in
the cached array before the server responds. The spine never says **where**. A client that appends
(end of array) is not "re-sorting" — it obeys the letter — yet the server truth is newest-**first**
(index 0). On settle/refetch the new todo jumps from bottom to top: a visible reorder flicker, and
if the user adds several quickly, optimistic order (append: oldest-optimistic-first) is the exact
reverse of server order (newest-first).

**Close it:** Add to AD-4/ordering: optimistic add **prepends** (index 0) to match server
`created_at DESC`, so optimistic and settled order agree.

---

## SEV-8 — Whitespace trimming ownership unpinned → optimistic text mutates on settle

**Where:** AD-10 ("non-empty/non-whitespace `description` … sanitized server-side"), AD-4.

**The conflict:** AD-10 says input is "sanitized server-side (authoritative)" and rejects
whitespace-only, but doesn't say whether the server **trims** surrounding whitespace before storing.
If `api` trims `"  buy milk  "` → `"buy milk"`, the stored/returned value differs from what `web`
rendered optimistically (AD-4 showed the untrimmed string). On settle/refetch the visible text
silently changes. If `api` does *not* trim, `web`'s mirror (which might trim for its non-empty
check) and the server disagree on the char count and on the stored value.

**Close it:** Pin in AD-10: whether the server trims leading/trailing whitespace, that the client
mirror trims identically before its non-empty + length check, and that the 500-cap is measured
**after** trim on both sides. Client optimistic value must equal the trimmed value it will send.

---

## SEV-9 — DELETE idempotency: 404 on commit surfaces as a user-facing error

**Where:** AD-9 (`404` unknown id → error state), AD-5 (delete commits after window), Feature E.

**The conflict:** AD-5's committed `DELETE` fires at t+5s. If the row is already gone (double-fire,
a retried beacon, or a prior commit), `api` correctly returns `404` per AD-9. The client, obeying
AD-9 ("maps **any** non-2xx to the error state"), shows the user an error for a delete that
*succeeded from the user's standpoint*. DELETE is not defined as idempotent.

**Close it:** Pin that DELETE is idempotent — `api` returns `204` for both present and
already-absent ids (or the client treats DELETE `404` as success). State it in the Endpoints row.

---

## SEV-10 — Success status codes and response bodies are unpinned (POST/PATCH/DELETE)

**Where:** Endpoints convention, AD-6, AD-7.

**The conflicts, each a cross-unit divergence:**
- **POST create:** `201` vs `200`, and — critically — **does the body return the full created
  resource?** AD-7 requires the client to "swap [the temp id] on settle" and to render relative
  time from `createdAt`; both are impossible unless the `POST` response body carries the full AD-6
  resource (real `id`, `metadata.createdAt`). The spine never says `POST` returns the resource. A
  compliant `api` returning `201` with empty body, or just `{"id":"..."}`, breaks AD-7's swap and
  the relative-time render.
- **PATCH:** `200`+resource vs `204`. If `204` no-body, the client can't reconcile the authoritative
  `updatedAt`.
- **DELETE:** `200` vs `204` (see SEV-9).

**Close it:** Pin success codes and bodies: `POST → 201` **with the full AD-6 resource**,
`PATCH → 200` with the full updated resource, `DELETE → 204` no body. AD-7's temp-id swap depends
on the POST-returns-resource guarantee — make it explicit.

---

## SEV-11 — `created_at DESC` has no stable tiebreak → order nondeterministic across refetches

**Where:** Ordering convention (`created_at DESC`), AD-7 (server sets `createdAt`).

**The conflict:** two todos created in the same timestamp tick (rapid adds, or coarse
timestamptz resolution) share `created_at`. `ORDER BY created_at DESC` alone leaves their relative
order **undefined** — Postgres may return them in different orders across queries. The client
"never re-sorts" and trusts server order, so two successive `GET /todos` can present the same two
todos in swapped positions → visible flicker, and the optimistic-add position (SEV-7) can't be made
to agree deterministically.

**Close it:** Pin a total order in the ordering convention: `ORDER BY created_at DESC, id DESC`
(stable tiebreak). Ensure the optimistic-add position rule (SEV-7) matches it.

---

## SEV-12 — Write-request bodies undefined: is `status` settable on create? are unknown fields rejected?

**Where:** AD-6 (defines the *resource*, not the *request*), AD-7 (server owns id/timestamps),
AD-8.

**Two conflicting reads:**
- **`status` on POST:** AD-6's example always shows `status:"active"`. May the client `POST
  {"description":"x","status":"completed"}`? A compliant `api` might honor it (creating a completed
  todo) or ignore/reject it (all new todos `active`). Two teams differ.
- **Server-owned fields / unknown fields on write:** the client's optimistic object (AD-4/AD-7)
  holds a temp `id` and `metadata`. If the client echoes the resource shape on `POST`, a strict
  `api` (Gin `DisallowUnknownFields` / rejecting client `id`) returns `400`, while a lenient one
  strips them. AD-7 forbids client ids reaching persistence but doesn't say the request *body* must
  omit them or that the server *rejects vs strips* them.

**Close it:** Add an AD defining the **request** bodies separately from the response resource:
`POST` accepts only `{description}` (status defaults to `active` server-side; client-sent `id`,
`status`, `metadata` are ignored or rejected — pick one and pin it); `PATCH` accepts only
`{description?, status?}`.

---

## SEV-13 — Timestamp serialization: `Z` vs offset vs fractional seconds (AD-7)

**Where:** AD-7 / IDs & dates convention (RFC3339 UTC, example `2026-07-17T14:03:11Z`).

**The conflict (lower severity):** Go `time.Format(time.RFC3339)` yields `...Z`; but a pgx/driver
path or `RFC3339Nano` can yield `2026-07-17T14:03:11.123456+00:00`. Both are valid RFC3339 UTC.
JS `Date`/relative-time libs parse both, so risk is low — but a client using a strict custom parser
(or asserting the trailing `Z`) breaks on the offset/fractional form. Since the client only renders
relative time from `createdAt`, impact is cosmetic, but it's an unpinned wire detail.

**Close it:** Pin the exact serialization in AD-7: RFC3339 with trailing `Z` (UTC), and a fixed
fractional-second precision (e.g. seconds, no fraction) so the byte-level format is deterministic.

---

## Summary table

| # | Severity | Hole | AD to add/tighten |
|---|---|---|---|
| SEV-1 | Critical | AD-5 reload mid-window resurrects "deleted" todo (no call fired, DB still has it) | AD-5: define unload-flush (beacon/keepalive) path; reconcile with "no network call" |
| SEV-2 | Critical | `GET /todos` empty list → Go `null` vs client `[]`; array-vs-wrapped envelope unpinned | AD-6: pin collection shape + empty=`[]` |
| SEV-3 | High | 500-char cap: JS UTF-16 units vs Go bytes vs runes → client/server disagree | AD-10: pin counting unit (code points) both sides |
| SEV-4 | High | PATCH absent-vs-empty field; value-type decode clobbers/rejects on status toggle | New AD: absent=unchanged, pointer decode, atomic combined update |
| SEV-5 | High | Proxy has no defined behavior for down-api/timeout/non-JSON upstream; no timeout owner | AD-3: verbatim passthrough + map transport failures to AD-9; pin timeout budget |
| SEV-6 | High | AD-9 `code` set unspecified; "retry any non-2xx" contradicts 400 validation UX | AD-9: enumerate codes; split 4xx-inline vs 5xx-retry |
| SEV-7 | Med-High | Optimistic add position unpinned vs server newest-first → jump/flicker | AD-4/ordering: optimistic add prepends |
| SEV-8 | Medium | Whitespace trim ownership unpinned → optimistic text mutates on settle | AD-10: pin trim behavior + cap-after-trim, mirrored |
| SEV-9 | Medium | DELETE not idempotent; 404 on commit shows user an error | Endpoints: DELETE idempotent (204 or client treats 404 as success) |
| SEV-10 | Medium | Success codes/bodies unpinned; POST-returns-resource (AD-7 swap depends on it) not stated | Endpoints/AD-7: POST 201+resource, PATCH 200+resource, DELETE 204 |
| SEV-11 | Medium | `created_at DESC` no tiebreak → nondeterministic order across refetches | Ordering: `created_at DESC, id DESC` |
| SEV-12 | Low-Med | Request bodies undefined: status-on-create? unknown/id fields rejected or stripped? | New AD: define request bodies vs response resource |
| SEV-13 | Low | Timestamp `Z` vs offset vs fractional seconds unpinned | AD-7: pin exact RFC3339 form + precision |
