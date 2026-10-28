SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'devolucoes'
    AND COLUMN_NAME = 'chave_idempotencia'
);
SET @sql_add := IF(@column_exists = 0,
  'ALTER TABLE devolucoes ADD COLUMN chave_idempotencia VARCHAR(64) NULL AFTER observacao',
  'SELECT 1');
PREPARE stmt_add FROM @sql_add;
EXECUTE stmt_add;
DEALLOCATE PREPARE stmt_add;

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'devolucoes'
    AND COLUMN_NAME = 'hash_requisicao'
);
SET @sql_add := IF(@column_exists = 0,
  'ALTER TABLE devolucoes ADD COLUMN hash_requisicao CHAR(64) NULL AFTER chave_idempotencia',
  'SELECT 1');
PREPARE stmt_add FROM @sql_add;
EXECUTE stmt_add;
DEALLOCATE PREPARE stmt_add;

SET @index_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'devolucoes'
    AND INDEX_NAME = 'uk_devolucoes_pedido_idempotencia'
);
SET @sql_add_index := IF(@index_exists = 0,
  'ALTER TABLE devolucoes ADD UNIQUE KEY uk_devolucoes_pedido_idempotencia (pedido_id, chave_idempotencia)',
  'SELECT 1');
PREPARE stmt_add_index FROM @sql_add_index;
EXECUTE stmt_add_index;
DEALLOCATE PREPARE stmt_add_index;
