-- Check what columns exist in bookings table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'bookings'
ORDER BY ordinal_position;

-- Check if expires_at exists
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema='public' 
            AND table_name='bookings' 
            AND column_name='expires_at'
        ) 
        THEN '✓ expires_at EXISTS' 
        ELSE '✗ expires_at MISSING - Run add_missing_columns.sql' 
    END as status;
