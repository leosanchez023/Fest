SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'distancia_retorno_km'
);
SET @sql_add := IF(@column_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN distancia_retorno_km DECIMAL(8,2) NOT NULL DEFAULT 0.00 AFTER distancia_km',
  'SELECT 1');
PREPARE stmt_add FROM @sql_add;
EXECUTE stmt_add;
DEALLOCATE PREPARE stmt_add;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'distancia_cobrada_km'
);
SET @sql_add := IF(@column_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN distancia_cobrada_km DECIMAL(8,2) NOT NULL DEFAULT 0.00 AFTER distancia_retorno_km',
  'SELECT 1');
PREPARE stmt_add FROM @sql_add;
EXECUTE stmt_add;
DEALLOCATE PREPARE stmt_add;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'frete_formula'
);
SET @sql_add := IF(@column_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN frete_formula VARCHAR(500) NULL AFTER distancia_cobrada_km',
  'SELECT 1');
PREPARE stmt_add FROM @sql_add;
EXECUTE stmt_add;
DEALLOCATE PREPARE stmt_add;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'origem_aproximada'
);
SET @sql_add := IF(@column_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN origem_aproximada TINYINT(1) NOT NULL DEFAULT 0 AFTER frete_formula',
  'SELECT 1');
PREPARE stmt_add FROM @sql_add;
EXECUTE stmt_add;
DEALLOCATE PREPARE stmt_add;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'destino_aproximado'
);
SET @sql_add := IF(@column_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN destino_aproximado TINYINT(1) NOT NULL DEFAULT 0 AFTER origem_aproximada',
  'SELECT 1');
PREPARE stmt_add FROM @sql_add;
EXECUTE stmt_add;
DEALLOCATE PREPARE stmt_add;
