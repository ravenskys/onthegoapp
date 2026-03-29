-- DEBUG: Temporarily disable RLS on jobs table to test connectivity
-- RUN THIS ONLY FOR TESTING, THEN RE-ENABLE RLS

ALTER TABLE public.jobs DISABLE ROW LEVEL SECURITY;

-- Optional: If you want to see the current policies
-- SELECT * FROM pg_policies WHERE tablename = 'jobs';