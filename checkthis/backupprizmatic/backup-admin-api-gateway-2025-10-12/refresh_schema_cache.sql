-- ============================================
-- Refresh Supabase Schema Cache
-- Run this after creating new tables or functions
-- ============================================

-- Method 1: NOTIFY command
NOTIFY pgrst, 'reload schema';

-- Method 2: If above doesn't work, try reloading config
NOTIFY pgrst, 'reload config';

SELECT 'Schema cache refresh requested. Wait 10-30 seconds for changes to take effect.' as status;

-- You can also verify tables are visible:
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
