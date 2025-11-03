-- ============================================
-- Verify All Tables Exist
-- ============================================

-- Check if all required tables exist
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_settings') 
        THEN '✓' ELSE '✗' 
    END as app_settings,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'batteries') 
        THEN '✓' ELSE '✗' 
    END as batteries,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bikes') 
        THEN '✓' ELSE '✗' 
    END as bikes,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') 
        THEN '✓' ELSE '✗' 
    END as bookings,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clients') 
        THEN '✓' ELSE '✗' 
    END as clients,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contract_templates') 
        THEN '✓' ELSE '✗' 
    END as contract_templates,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') 
        THEN '✓' ELSE '✗' 
    END as payments,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rental_batteries') 
        THEN '✓' ELSE '✗' 
    END as rental_batteries,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rentals') 
        THEN '✓' ELSE '✗' 
    END as rentals,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'support_messages') 
        THEN '✓' ELSE '✗' 
    END as support_messages,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tariffs') 
        THEN '✓' ELSE '✗' 
    END as tariffs;

-- List all tables in public schema
SELECT table_name, table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check RPC functions
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('add_to_balance', 'assign_bike_to_rental', 'get_anonymous_chats', 'get_client_chats')
ORDER BY routine_name;
