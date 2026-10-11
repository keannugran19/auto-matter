-- Migration: Add categories table and relax lessons category check constraint

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'categories' AND policyname = 'authenticated_all_categories'
  ) THEN
    CREATE POLICY "authenticated_all_categories" ON categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Seed default categories
INSERT INTO categories (id, name, slug, color) VALUES
  ('new_believers', 'New Believers', 'new_believers', '#10b981'),
  ('mentoring', 'Mentoring', 'mentoring', '#f59e0b'),
  ('leadership', 'Leadership', 'leadership', '#8b5cf6')
ON CONFLICT (id) DO NOTHING;

-- Relax lessons category constraint
ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_category_check;

