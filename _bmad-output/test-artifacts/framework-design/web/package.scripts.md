# Scripts + dev-deps to merge into `web/package.json`

Add once Story 1.1 has created `web/package.json`.

```jsonc
{
  "scripts": {
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "PWDEBUG=1 playwright test",
    "test:e2e:p0": "playwright test --grep @p0",
    "test:contract": "playwright test --project=integration --grep @contract",
    "test": "npm run test:unit && npm run test:e2e"
  },
  "devDependencies": {
    "@playwright/test": "^1.x",
    "vitest": "^2.x",
    "@vitejs/plugin-react": "^4.x",
    "@testing-library/react": "^16.x",
    "@testing-library/jest-dom": "^6.x",
    "@faker-js/faker": "^9.x",
    "jsdom": "^25.x"
  }
}
```

Post-install: `npx playwright install --with-deps chromium`.

## `api/` (Go) invocation

```bash
cd api
go test ./...                 # unit + integration (compose test profile up)
go test -run TestCreateTodo   # focused
go test -tags testseed ./...  # include the seed/reset helper build [TC1]
```

Add `github.com/stretchr/testify` to `go.mod`: `go get github.com/stretchr/testify`.
