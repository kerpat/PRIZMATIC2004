-- Check for triggers on rentals table
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'rentals'
ORDER BY trigger_name;

-- Check for functions that might modify rental status
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND (
    routine_definition ILIKE '%rentals%'
    OR routine_definition ILIKE '%awaiting%'
)
ORDER BY routine_name;

-- Check recent rentals and their status
SELECT 
    id,
    user_id,
    bike_id,
    status,
    created_at,
    starts_at
FROM public.rentals
ORDER BY created_at DESC
LIMIT 10;
