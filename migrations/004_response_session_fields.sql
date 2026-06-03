-- Add dedicated session metadata columns to responses
-- Replaces encoding session data as JSON inside the comments field.
-- New rows will use these columns; existing rows retain their JSON-encoded
-- comments for backward-compatible reading (see toResponse in database.ts).

ALTER TABLE responses
  ADD COLUMN IF NOT EXISTS session_type text,
  ADD COLUMN IF NOT EXISTS sample_code text,
  ADD COLUMN IF NOT EXISTS different_sample text,
  ADD COLUMN IF NOT EXISTS ranking text[];
