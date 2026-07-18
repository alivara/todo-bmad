-- 000001_create_todos.up.sql
-- Creates the todos table (AD-6 resource shape, AD-8 status enum-as-text+CHECK).
-- Applied automatically on api startup via golang-migrate before it serves (AD-11).

-- gen_random_uuid() lives in pgcrypto (bundled with Postgres). Enable it so the
-- server, not the client, mints ids (AD-7).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE todos (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    title       text        NOT NULL,
    -- "" when empty, never NULL (AD-6). Enforced with NOT NULL + default.
    description text        NOT NULL DEFAULT '',
    -- AD-8: text + CHECK, NOT a native PG enum type. Adding a state edits this list.
    status      text        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'completed')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Matches the server-side list ordering (AD conventions: ORDER BY created_at DESC, id DESC).
CREATE INDEX todos_created_at_id_desc_idx ON todos (created_at DESC, id DESC);
