-- Fest: compatibilidade da base existente com itens de produto e combo.
-- Nao remove dados nem recria tabelas.
-- As verificacoes via information_schema mantem compatibilidade com MySQL
-- que nao aceita ADD COLUMN IF NOT EXISTS.

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'pedido_itens'
    AND COLUMN_NAME = 'tipo_item'
);
SET @sql_tipo_item := IF(
  @column_exists = 0,
  "ALTER TABLE pedido_itens ADD COLUMN tipo_item VARCHAR(10) NOT NULL DEFAULT 'ALUGUEL' AFTER produto_id",
  'SELECT 1'
);
PREPARE stmt_tipo_item FROM @sql_tipo_item;
EXECUTE stmt_tipo_item;
DEALLOCATE PREPARE stmt_tipo_item;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'pedido_itens'
    AND COLUMN_NAME = 'combo_id'
);
SET @sql_combo_id := IF(
  @column_exists = 0,
  'ALTER TABLE pedido_itens ADD COLUMN combo_id INT NULL AFTER tipo_item',
  'SELECT 1'
);
PREPARE stmt_combo_id FROM @sql_combo_id;
EXECUTE stmt_combo_id;
DEALLOCATE PREPARE stmt_combo_id;

ALTER TABLE pedido_itens
  MODIFY COLUMN produto_id INT NULL;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'pedido_item_componentes'
    AND COLUMN_NAME = 'pedido_id'
);
SET @sql_pedido_id := IF(
  @column_exists = 0,
  'ALTER TABLE pedido_item_componentes ADD COLUMN pedido_id INT NULL AFTER pedido_item_id',
  'SELECT 1'
);
PREPARE stmt_pedido_id FROM @sql_pedido_id;
EXECUTE stmt_pedido_id;
DEALLOCATE PREPARE stmt_pedido_id;

UPDATE pedido_item_componentes pic
INNER JOIN pedido_itens pi ON pi.id = pic.pedido_item_id
SET pic.pedido_id = pi.pedido_id
WHERE pic.pedido_id IS NULL;

SET @fk_combo_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'pedido_itens'
    AND CONSTRAINT_NAME = 'fk_pedido_item_combo'
);

SET @sql_fk_combo := IF(
  @fk_combo_exists = 0,
  'ALTER TABLE pedido_itens ADD CONSTRAINT fk_pedido_item_combo FOREIGN KEY (combo_id) REFERENCES combos(id)',
  'SELECT 1'
);
PREPARE stmt_fk_combo FROM @sql_fk_combo;
EXECUTE stmt_fk_combo;
DEALLOCATE PREPARE stmt_fk_combo;

SET @fk_componente_pedido_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'pedido_item_componentes'
    AND CONSTRAINT_NAME = 'fk_componente_pedido'
);

SET @sql_fk_componente_pedido := IF(
  @fk_componente_pedido_exists = 0,
  'ALTER TABLE pedido_item_componentes ADD CONSTRAINT fk_componente_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt_fk_componente_pedido FROM @sql_fk_componente_pedido;
EXECUTE stmt_fk_componente_pedido;
DEALLOCATE PREPARE stmt_fk_componente_pedido;
