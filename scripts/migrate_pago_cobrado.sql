-- MIGRACIÓN: Sistema de Control de Cobros del Parquero
-- Versión: v2.6
-- Fecha: 2026-05-17
-- Descripción: Agrega campo pago_cobrado a vehiculos_pase para registrar
--              si el parquero cobró el puesto al momento del ingreso físico.

ALTER TABLE vehiculos_pase 
ADD COLUMN IF NOT EXISTS pago_cobrado BOOLEAN NOT NULL DEFAULT FALSE;

-- Verificar la migración
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'vehiculos_pase' AND column_name = 'pago_cobrado';
