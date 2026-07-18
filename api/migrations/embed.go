package migrations

import "embed"

// FS embeds the versioned golang-migrate SQL files into the api binary so schema
// migrations travel with the executable and apply on startup — no hand-run SQL,
// no separate migration step in compose (AD-11).
//
//go:embed *.sql
var FS embed.FS
