# Tech Verification Review — todo-app Architecture Spine

**Reviewer role:** Verify that every committed technology decision in the spine is current and correct as of July 2026, confirmed by web search — not asserted from stale training data.

**Spine reviewed:** `ARCHITECTURE-SPINE.md` (Stack table + AD-1..AD-12, Consistency Conventions, Structural Seed).

**Date of verification:** 2026-07-17

**Verdict: All seven stack entries are current, actively maintained, sensibly pinned, and well-fit to their stated roles. No stale versions, no mismatches, no unsound fits found.**

---

## Per-technology findings

### 1. Next.js 16.2 LTS — CONFIRMED current & well-fit

- **Exists / maintained:** Yes. Next.js 16 is in **Active LTS**. Latest patch is **16.2.10** (released 01 Jul 2026), so the spine's minor-line pin "16.2 LTS" is real and current. Next.js 15 reaches end-of-support 21 Oct 2026; 16 is the right line to be on.
- **Version sensible:** Yes. Pinning to the `16.2` LTS minor line (rather than a bleeding-edge major) is the correct conservative choice for a build substrate. Each major gets ~2 years of maintenance LTS.
- **Fits its role (dumb BFF proxy, AD-3):** Yes. A Next.js route handler / rewrite forwarding `/api/*` same-origin to the internal `api` service is a standard, well-supported pattern and needs none of the heavier v16 features (Cache Components, Turbopack, React Compiler). The "no business logic in the proxy" rule is fully achievable.
- **Note:** The `LTS` label the spine attaches is accurate for v16 — Next.js formalized an LTS support policy and v16 is currently the Active LTS line.
- Sources: https://nextjs.org/support-policy · https://eosl.date/eol/product/nextjs/ · https://nextjs.org/blog/next-16

### 2. TanStack Query (`@tanstack/react-query`) 5.x — CONFIRMED current & well-fit

- **Exists / maintained:** Yes. Latest is **5.101.1** (as of mid-2026); v5 is the current major line and actively released.
- **Version sensible:** Yes. `5.x` (caret range on the current major) is the right pin. v5 is the stable, non-deprecated line; v4 is legacy.
- **Fits its role (AD-4 — sole owner of server state, optimistic mutations with rollback):** Yes, precisely. v5 documents exactly the pattern the spine mandates: `useMutation` with `onMutate` (apply optimistic update + snapshot previous cache), `onError` (roll back to the snapshot), and `onSettled` (reconcile against the server). This directly supports AD-4 and AD-7's temp-id-swap-on-settle. The newer "UI-level" optimistic approach (via returned `variables`) also exists but the cache-level approach the spine implies is the documented, robust one.
- Sources: https://tanstack.com/query/v5/docs/react/guides/optimistic-updates · https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5

### 3. Go 1.26 — CONFIRMED current & well-fit

- **Exists / maintained:** Yes. Go 1.26 was released **Feb 2026**; latest patch is **1.26.5** (07 Jul 2026). It is the current stable major on Go's 6-month cadence (1.25 → Aug 2025, 1.26 → Feb 2026).
- **Version sensible:** Yes. 1.26 is the newest stable line and within the supported window (Go supports the two most recent majors).
- **Fits its role:** Yes. Standard choice for the layered REST service.
- Sources: https://go.dev/doc/go1.26 · https://go.dev/doc/devel/release

### 4. Gin (`gin-gonic/gin`) 1.12 — CONFIRMED current, compatible with Go 1.26

- **Exists / maintained:** Yes. **v1.12.0** is the latest release and the current line; v1.11 was the prior release.
- **Version sensible:** Yes.
- **Compatible with Go 1.26 (explicit check):** Yes. Independent 2026 material references Gin v1.12.0 running on **Go 1.26** (a production REST tutorial) and Gin v1.12.0 benchmarked on Go 1.25.8 — so the Gin 1.12 + Go 1.26 pairing in the spine is confirmed compatible, not just assumed.
- **Fits its role (handler layer of the layered service, AD-1):** Yes. Gin is confined to the `handler/` layer per AD-1; nothing about 1.12 conflicts with keeping Gin out of the service/repository layers.
- Sources: https://github.com/gin-gonic/gin/releases · https://pkg.go.dev/github.com/gin-gonic/gin · https://tech-insider.org/gin-golang-tutorial-rest-api-2026/

### 5. golang-migrate 4.x — CONFIRMED current & well-fit for embed-and-run-on-boot

- **Exists / maintained:** Yes. Latest is **v4.19.1** (29 Nov 2025). The `/v4` module line is current.
- **Version sensible:** Yes. `4.x` matches the module's major (`github.com/golang-migrate/migrate/v4`).
- **Fits its role (AD-11 — versioned up/down SQL, embedded in the binary, applied on startup before serving):** Yes, exactly. golang-migrate ships both a CLI **and a Go library**. The documented library pattern is: `//go:embed migrations/*.sql` → `iofs.New(...)` source driver → `migrate.NewWithSourceInstance(...)` → `.Up()` called at process start. This produces a self-contained binary with no external migration files at runtime — precisely AD-11's "embedded in the `api` binary and applied automatically on startup." This is a mainstream, recommended containerized-deployment approach. Sound fit, no caveats.
- Sources: https://pkg.go.dev/github.com/golang-migrate/migrate/v4 · https://github.com/golang-migrate/migrate · https://pkg.go.dev/github.com/golang-migrate/migrate/v4/source/iofs

### 6. PostgreSQL 18 — CONFIRMED current & well-fit; text+CHECK enum pattern is sound

- **Exists / maintained:** Yes. PostgreSQL 18 was released **25 Sep 2025**; current minor is **18.4** (14 May 2026). It is the current major line (major upgrades happen ~yearly).
- **Version sensible:** Yes. 18 is the current GA major; a fresh project should target it.
- **Fits its role, and the AD-8 pattern is sound:** Yes. Storing `status` as `text` + a `CHECK (status IN ('active','completed'))` constraint is a well-established, genuinely more-extensible alternative to a native `ENUM`. Rationale confirmed sound: native PG enums can only be extended with `ALTER TYPE ... ADD VALUE` (which historically could not run inside a transaction block and cannot easily remove/reorder values), whereas a `CHECK` constraint can be dropped and recreated inside an ordinary transactional migration. AD-8's "add a state = edit the CHECK list + the Go validation list" is accurate and avoids the `ALTER TYPE` rewrite the spine warns against. The two-places-in-sync tradeoff (DB CHECK + Go service validation) is correctly called out.
- Sources: https://www.postgresql.org/about/news/postgresql-18-released-3142/ · https://www.postgresql.org/docs/release/18.0/ · https://endoflife.date/postgresql

### 7. Docker Compose ("current") — CONFIRMED current & well-fit

- **Exists / maintained:** Yes. Compose **v2** (the `docker compose` plugin, v2.24+ in 2026) is the actively maintained standard. The legacy v1 `docker-compose` binary reached EOL in July 2023.
- **Version sensible:** Yes. "current" resolving to Compose v2 is correct; the spine wisely does not over-pin a tool that ships with Docker.
- **Fits its role (AD-12 — three services, only `web` host-exposed, healthcheck-gated startup, named volume):** Yes. All of these are first-class Compose v2 features: `depends_on` with `condition: service_healthy`, per-service `healthcheck`, named volumes, and per-service port publishing. Note (informational, not a defect): Compose v2 treats the top-level `version:` field as obsolete — the spine does not mention a `version:` field, so there is nothing to fix; just don't add one when the file is written.
- Sources: https://docs.docker.com/compose/release-notes/ · https://www.docker.com/blog/new-docker-compose-v2-and-v1-deprecation/

---

## Cross-cutting fit checks (from the task)

| Claim in spine | Verified |
| --- | --- |
| golang-migrate embeddable as a Go library, run on boot | Yes — `iofs` + `//go:embed` + `NewWithSourceInstance` is the documented pattern |
| TanStack Query supports optimistic mutations with rollback | Yes — `onMutate`/`onError`/`onSettled` documented in v5 |
| Gin 1.12 compatible with Go 1.26 | Yes — confirmed by independent 2026 usage on Go 1.26 |
| PostgreSQL text+CHECK is a sound extensible-enum pattern | Yes — avoids `ALTER TYPE`, transactional, correct rationale |
| Next.js 16.2 is a real current LTS suitable for a dumb proxy | Yes — Active LTS line, latest 16.2.10 |

## Summary

Every named technology and version in the Stack table and in the AD rules is a **real, current, actively-maintained, sensibly-pinned** choice as of July 2026, and each genuinely fits the role the spine assigns it. Nothing is out of date, mismatched, or an unsound fit. The seed's own caveat ("verified current at authoring (Jul 2026); the code owns these once it exists") is accurate.
