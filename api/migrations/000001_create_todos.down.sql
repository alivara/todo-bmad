-- 000001_create_todos.down.sql — reverses 000001_create_todos.up.sql.
DROP INDEX IF EXISTS todos_created_at_id_desc_idx;
DROP TABLE IF EXISTS todos;
-- pgcrypto is left installed; it is harmless and may be shared by future migrations.
