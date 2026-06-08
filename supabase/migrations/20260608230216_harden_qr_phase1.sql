-- ============================================================================
-- FASE 1: Endurecimiento del acceso por QR (cambios sin riesgo para el cliente)
--
-- Esta fase corrige lo que se puede cerrar SIN tocar el flujo público del
-- navegador (carrito, pedido, comensal). No rompe la app.
--
-- Cubre:
--   - CRÍTICO #3: elimina la sobrecarga antigua create_public_order(bigint, jsonb).
--   - Alarga los tokens qr_code de 8 a 32 chars de alta entropía + CHECK.
--   - Revoca permisos innecesarios de anon sobre las secuencias de IDs.
--
-- NO toca (eso es Fase 2, requiere cambios de frontend y pruebas):
--   - El SELECT anónimo sobre tables / table_qr_codes.
--   - El EXECUTE de anon sobre las RPC por table_id.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Regenerar tokens cortos a 32 caracteres de alta entropía.
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE public.table_qr_codes
SET qr_code = translate(
                encode(extensions.gen_random_bytes(24), 'base64'),
                '+/=', 'xyz'
              )
WHERE length(qr_code) < 32;

-- Impedir que se vuelvan a crear tokens débiles.
ALTER TABLE public.table_qr_codes
  DROP CONSTRAINT IF EXISTS qr_code_min_length;
ALTER TABLE public.table_qr_codes
  ADD CONSTRAINT qr_code_min_length CHECK (length(qr_code) >= 32);

-- ----------------------------------------------------------------------------
-- 2) Revocar permisos de anon sobre las secuencias (no necesita generar IDs).
-- ----------------------------------------------------------------------------
REVOKE ALL ON SEQUENCE public.qr_codes_id_seq FROM anon;
REVOKE ALL ON SEQUENCE public.tables_id_seq   FROM anon;

-- ----------------------------------------------------------------------------
-- 3) CRÍTICO #3: eliminar la sobrecarga antigua de create_public_order.
--    La versión nueva de 3 argumentos (con p_diner_token) permanece intacta.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_public_order(bigint, jsonb);