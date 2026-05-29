-- 1. Confirmar que la columna existe
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name = 'setup_completed';

-- 2. Confirmar que las cuentas existentes quedaron marcadas
SELECT setup_completed, count(*)
FROM public.users
GROUP BY setup_completed;

-- 3. Confirmar que la función se creó
SELECT proname, prosecdef
FROM pg_proc
WHERE proname = 'complete_restaurant_setup';