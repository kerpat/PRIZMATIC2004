-- ============================================
-- Check Tariff Data Structure
-- Verify extensions field format
-- ============================================

-- 1. Check all tariffs and their extensions
SELECT 
    id,
    title,
    price_rub,
    duration_days,
    extensions,
    jsonb_typeof(extensions) as extensions_type
FROM public.tariffs
ORDER BY id;

-- 2. Check if extensions have correct structure
SELECT 
    id,
    title,
    jsonb_array_length(extensions) as extension_count,
    extensions
FROM public.tariffs
WHERE extensions IS NOT NULL
ORDER BY id;

-- 3. Check individual extension items
SELECT 
    t.id,
    t.title,
    ext.value as extension_item,
    ext.value->>'days' as days,
    ext.value->>'price_rub' as price_rub,
    ext.value->>'cost' as cost_old_field
FROM public.tariffs t,
     jsonb_array_elements(t.extensions) ext
WHERE t.extensions IS NOT NULL
ORDER BY t.id;

-- 4. Find tariffs with old 'cost' field instead of 'price_rub'
SELECT 
    t.id,
    t.title,
    'Has old cost field' as issue
FROM public.tariffs t,
     jsonb_array_elements(t.extensions) ext
WHERE ext.value->>'cost' IS NOT NULL
  AND ext.value->>'price_rub' IS NULL;

-- 5. Suggest fix for tariffs with old structure
SELECT 
    id,
    title,
    'UPDATE public.tariffs SET extensions = ''' || 
    (
        SELECT jsonb_agg(
            jsonb_build_object(
                'days', (ext.value->>'days')::int,
                'price_rub', COALESCE((ext.value->>'price_rub')::numeric, (ext.value->>'cost')::numeric)
            )
        )
        FROM jsonb_array_elements(extensions) ext
    )::text || 
    ''' WHERE id = ' || id || ';' as fix_query
FROM public.tariffs
WHERE extensions IS NOT NULL;
