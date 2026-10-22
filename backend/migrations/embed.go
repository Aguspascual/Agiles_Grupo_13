package migrations

import "embed"

// Files embeds all SQL migrations so binaries do not depend on their working directory.
//
//go:embed *.sql
var Files embed.FS
