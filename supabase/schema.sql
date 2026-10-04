-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- lessons table
CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('new_believers', 'mentoring', 'leadership')),
  series TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  original_docx_url TEXT,
  original_file_name TEXT,
  file_size_bytes INTEGER DEFAULT 0,
  formatted_docx_url TEXT,
  pdf_url TEXT,  -- Supabase Storage public URL of the final PDF
  format_status TEXT NOT NULL DEFAULT 'needs_transfer' CHECK (format_status IN ('formatted', 'needs_transfer')),
  latest_run_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- transfer_runs table
CREATE TABLE IF NOT EXISTS transfer_runs (
  id TEXT PRIMARY KEY,
  lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL,
  target_file TEXT NOT NULL,
  reference_template_id TEXT NOT NULL,
  reference_file_name TEXT,
  classifier TEXT NOT NULL DEFAULT 'gemini',
  status TEXT NOT NULL DEFAULT 'complete',
  stats JSONB NOT NULL DEFAULT '{}',
  warnings JSONB NOT NULL DEFAULT '[]',
  role_map JSONB NOT NULL DEFAULT '[]',
  duration_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: enable but allow service role full access
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_runs ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can read/write (admin team only)
CREATE POLICY "authenticated_all" ON lessons FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON transfer_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage: create 'pdfs' bucket via Supabase dashboard or:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('pdfs', 'pdfs', false);
-- Policy: authenticated users can read pdfs
-- CREATE POLICY "authenticated read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'pdfs');
-- Policy: service role can insert pdfs (done server-side via service key)
