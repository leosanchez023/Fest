-- Mantem user_permissions compativel com as consultas de autorizacao do app.
-- O valor inicial zero preserva o principio de negar acesso por padrao.
SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'user_permissions'
    AND COLUMN_NAME = 'estoque'
);

SET @sql_add := IF(
  @column_exists = 0,
  'ALTER TABLE user_permissions ADD COLUMN estoque TINYINT(1) NOT NULL DEFAULT 0 AFTER pagamentos',
  'SELECT 1'
);

PREPARE stmt_add_estoque_permission FROM @sql_add;
EXECUTE stmt_add_estoque_permission;
DEALLOCATE PREPARE stmt_add_estoque_permission;
