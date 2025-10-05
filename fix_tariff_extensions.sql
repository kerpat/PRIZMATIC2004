-- ============================================
-- Fix Tariff Extensions Structure
-- Convert 'cost' field to 'price_rub' in extensions
-- ============================================

-- This script will update all tariff extensions to use 'price_rub' instead of 'cost'

DO $$
DECLARE
    tariff_record RECORD;
    new_extensions jsonb;
BEGIN
    -- Loop through all tariffs that have extensions
    FOR tariff_record IN 
        SELECT id, title, extensions 
        FROM public.tariffs 
        WHERE extensions IS NOT NULL 
        AND jsonb_typeof(extensions) = 'array'
    LOOP
        -- Build new extensions array with price_rub field
        SELECT jsonb_agg(
            jsonb_build_object(
                'days', (ext.value->>'days')::int,
                'price_rub', COALESCE(
                    (ext.value->>'price_rub')::numeric,  -- Use price_rub if exists
                    (ext.value->>'cost')::numeric         -- Otherwise use cost
                )
            )
        )
        INTO new_extensions
        FROM jsonb_array_elements(tariff_record.extensions) ext;

        -- Update the tariff with new extensions structure
        UPDATE public.tariffs
        SET extensions = new_extensions
        WHERE id = tariff_record.id;

        RAISE NOTICE 'Updated tariff % (%) - % extensions', 
            tariff_record.id, 
            tariff_record.title,
            jsonb_array_length(new_extensions);
    END LOOP;

    RAISE NOTICE 'All tariff extensions updated successfully!';
END $$;

-- Verify the changes
SELECT 
    id,
    title,
    extensions
FROM public.tariffs
WHERE extensions IS NOT NULL
ORDER BY id;

-- Check that no 'cost' fields remain
SELECT 
    COUNT(*) as tariffs_with_old_cost_field
FROM public.tariffs t,
     jsonb_array_elements(t.extensions) ext
WHERE ext.value->>'cost' IS NOT NULL
  AND ext.value->>'price_rub' IS NULL;

SELECT 'Migration completed! All extensions now use price_rub field.' as status;
