# syntax=docker/dockerfile:1

# --- build stage ---
FROM golang:1.26-alpine AS build
WORKDIR /src

# Cache module downloads first.
COPY go.mod go.sum ./
RUN go mod download

# Build tags. Empty by default → the production binary is built WITHOUT the `testseed`
# tag, so the test-only seed/reset seam (api/testhelpers + the reset route) is never
# compiled into the shipped image [TC1]. The test compose sets GO_BUILD_TAGS=testseed.
ARG GO_BUILD_TAGS=""
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -tags "$GO_BUILD_TAGS" -o /out/api .

# --- runtime stage ---
FROM alpine:3.20
RUN adduser -D -u 10001 appuser
COPY --from=build /out/api /usr/local/bin/api
USER appuser
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/api"]
