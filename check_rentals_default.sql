-- Check default value for status column in rentals table
SELECT 
    column_name,
    column_default,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'rentals'
AND column_name = 'status';

-- Check if there's a constraint on status
SELECT 
    constraint_name,
    constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
AND table_name = 'rentals';
