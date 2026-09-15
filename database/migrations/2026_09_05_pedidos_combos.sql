-- Fest: suporte seguro a itens de combo em pedidos.
-- Esta migration nao remove tabelas nem dados existentes.

ALTER TABLE pedido_itens
  ADD COLUMN IF NOT EXISTS tipo_item VARCHAR(10) NOT NULL DEFAULT 'ALUGUEL' AFTER produto_id,
  ADD COLUMN IF NOT EXISTS combo_id INT NULL AFTER tipo_item;

ALTER TABLE pedido_itens
  MODIFY COLUMN produto_id INT NULL;

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

SET @check_item_tipo_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'pedido_itens'
    AND CONSTRAINT_NAME = 'chk_pedido_item_origem'
);

SET @sql_check_item_tipo := IF(
  @check_item_tipo_exists = 0,
  'ALTER TABLE pedido_itens ADD CONSTRAINT chk_pedido_item_origem CHECK ((produto_id IS NOT NULL AND combo_id IS NULL) OR (produto_id IS NULL AND combo_id IS NOT NULL))',
  'SELECT 1'
);
PREPARE stmt_check_item_tipo FROM @sql_check_item_tipo;
EXECUTE stmt_check_item_tipo;
DEALLOCATE PREPARE stmt_check_item_tipo;

ALTER TABLE pedido_item_componentes
  ADD COLUMN IF NOT EXISTS pedido_id INT NULL AFTER pedido_item_id;

UPDATE pedido_item_componentes pic
INNER JOIN pedido_itens pi ON pi.id = pic.pedido_item_id
SET pic.pedido_id = pi.pedido_id
WHERE pic.pedido_id IS NULL;

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
