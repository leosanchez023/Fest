-- Armazena a origem informada no pedido, as coordenadas selecionadas e a
-- distancia da rota. A migration pode ser aplicada mais de uma vez.

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'endereco_origem'
);
SET @sql_add := IF(@column_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN endereco_origem VARCHAR(255) NULL AFTER telefone_contato',
  'SELECT 1');
PREPARE stmt_add FROM @sql_add;
EXECUTE stmt_add;
DEALLOCATE PREPARE stmt_add;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'origem_lat'
);
SET @sql_add := IF(@column_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN origem_lat DECIMAL(10,7) NULL AFTER endereco_origem',
  'SELECT 1');
PREPARE stmt_add FROM @sql_add;
EXECUTE stmt_add;
DEALLOCATE PREPARE stmt_add;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'origem_lon'
);
SET @sql_add := IF(@column_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN origem_lon DECIMAL(10,7) NULL AFTER origem_lat',
  'SELECT 1');
PREPARE stmt_add FROM @sql_add;
EXECUTE stmt_add;
DEALLOCATE PREPARE stmt_add;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'destino_lat'
);
SET @sql_add := IF(@column_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN destino_lat DECIMAL(10,7) NULL AFTER origem_lon',
  'SELECT 1');
PREPARE stmt_add FROM @sql_add;
EXECUTE stmt_add;
DEALLOCATE PREPARE stmt_add;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'destino_lon'
);
SET @sql_add := IF(@column_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN destino_lon DECIMAL(10,7) NULL AFTER destino_lat',
  'SELECT 1');
PREPARE stmt_add FROM @sql_add;
EXECUTE stmt_add;
DEALLOCATE PREPARE stmt_add;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pedidos' AND COLUMN_NAME = 'distancia_km'
);
SET @sql_add := IF(@column_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN distancia_km DECIMAL(8,2) NOT NULL DEFAULT 0.00 AFTER destino_lon',
  'SELECT 1');
PREPARE stmt_add FROM @sql_add;
EXECUTE stmt_add;
DEALLOCATE PREPARE stmt_add;
