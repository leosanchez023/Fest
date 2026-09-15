-- =====================================================
-- FEST - ESTOQUE E COMBOS (migração segura)
-- =====================================================
-- Evita destruição de dados e respeita estruturas existentes.

-- Produtos: campos de estoque profissional
ALTER TABLE user_permissions
  ADD COLUMN IF NOT EXISTS estoque TINYINT(1) NOT NULL DEFAULT 0 AFTER pagamentos;

ALTER TABLE pedido_itens
  ADD COLUMN IF NOT EXISTS tipo_item VARCHAR(10) NOT NULL DEFAULT 'ALUGUEL' AFTER produto_id;

ALTER TABLE pedido_itens
  ADD COLUMN IF NOT EXISTS combo_id INT NULL AFTER tipo_item;

ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS estoque_em_uso INT NOT NULL DEFAULT 0 AFTER estoque_reservado,
  ADD COLUMN IF NOT EXISTS estoque_minimo INT NOT NULL DEFAULT 0 AFTER estoque_danificado,
  ADD COLUMN IF NOT EXISTS tipo_produto VARCHAR(20) NOT NULL DEFAULT 'PRODUTO' AFTER tipo;

-- Ajusta movimentação de estoque para suportar novos tipos.
ALTER TABLE movimentacao_estoque
  ADD COLUMN IF NOT EXISTS usuario_id INT NULL AFTER produto_id,
  ADD COLUMN IF NOT EXISTS tipo_movimento VARCHAR(40) NULL AFTER tipo,
  ADD COLUMN IF NOT EXISTS createdAt DATETIME NULL DEFAULT CURRENT_TIMESTAMP AFTER data_movimentacao;

UPDATE movimentacao_estoque
SET tipo_movimento = tipo
WHERE tipo_movimento IS NULL;

ALTER TABLE movimentacao_estoque
  MODIFY tipo VARCHAR(40) NOT NULL,
  MODIFY tipo_movimento VARCHAR(40) NOT NULL DEFAULT 'AJUSTE';

-- Mantém compatibilidade com o banco atual sem duplicar tabela.
CREATE TABLE IF NOT EXISTS reservas_estoque (
  id INT NOT NULL AUTO_INCREMENT,
  pedido_id INT NOT NULL,
  produto_id INT NOT NULL,
  quantidade INT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ATIVA',
  data_reserva DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_liberacao DATETIME NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_reservas_pedido (pedido_id),
  KEY idx_reservas_produto (produto_id),
  KEY idx_reservas_status (status),
  CONSTRAINT fk_reserva_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
  CONSTRAINT fk_reserva_produto FOREIGN KEY (produto_id) REFERENCES produtos(id)
);

CREATE TABLE IF NOT EXISTS combos (
  id INT NOT NULL AUTO_INCREMENT,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT NULL,
  codigo VARCHAR(50) NULL,
  preco_venda DECIMAL(10,2) DEFAULT 0.00,
  preco_aluguel DECIMAL(10,2) DEFAULT 0.00,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_combo_codigo (codigo)
);

CREATE TABLE IF NOT EXISTS combo_itens (
  id INT NOT NULL AUTO_INCREMENT,
  combo_id INT NOT NULL,
  produto_id INT NOT NULL,
  quantidade INT NOT NULL DEFAULT 1,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_combo_id (combo_id),
  KEY idx_produto_combo (produto_id),
  CONSTRAINT fk_combo_item_combo FOREIGN KEY (combo_id) REFERENCES combos(id) ON DELETE CASCADE,
  CONSTRAINT fk_combo_item_produto FOREIGN KEY (produto_id) REFERENCES produtos(id)
);

CREATE TABLE IF NOT EXISTS pedido_item_componentes (
  id INT NOT NULL AUTO_INCREMENT,
  pedido_item_id INT NOT NULL,
  produto_id INT NOT NULL,
  quantidade_por_unidade INT NOT NULL DEFAULT 1,
  quantidade_total INT NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_composicao_pedido_item (pedido_item_id),
  KEY idx_composicao_produto (produto_id),
  CONSTRAINT fk_componentes_pedido_item FOREIGN KEY (pedido_item_id) REFERENCES pedido_itens(id) ON DELETE CASCADE,
  CONSTRAINT fk_componentes_produto FOREIGN KEY (produto_id) REFERENCES produtos(id)
);

-- Garante que o histórico de movimentações preserve o que já existe.
CREATE TABLE IF NOT EXISTS estoque_historico (
  id INT NOT NULL AUTO_INCREMENT,
  produto_id INT NOT NULL,
  pedido_id INT NULL,
  usuario_id INT NULL,
  tipo VARCHAR(40) NOT NULL,
  quantidade INT NOT NULL,
  observacao TEXT NULL,
  data_movimentacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_historico_produto (produto_id),
  KEY idx_historico_pedido (pedido_id),
  FOREIGN KEY (produto_id) REFERENCES produtos(id),
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
  FOREIGN KEY (usuario_id) REFERENCES usuario(id)
);

-- Ajusta campos de status para o controle de disponibilidade.
ALTER TABLE produtos
  MODIFY estoque INT NOT NULL DEFAULT 0,
  MODIFY estoque_reservado INT NOT NULL DEFAULT 0,
  MODIFY estoque_em_uso INT NOT NULL DEFAULT 0,
  MODIFY estoque_manutencao INT NOT NULL DEFAULT 0,
  MODIFY estoque_danificado INT NOT NULL DEFAULT 0,
  MODIFY estoque_minimo INT NOT NULL DEFAULT 0;

-- Atualiza registros antigos para manter consistência mínima.
UPDATE produtos
SET estoque_em_uso = 0
WHERE estoque_em_uso IS NULL;

UPDATE produtos
SET estoque_minimo = 0
WHERE estoque_minimo IS NULL;

UPDATE produtos
SET tipo_produto = CASE WHEN tipo IS NOT NULL AND tipo <> '' THEN tipo ELSE 'PRODUTO' END
WHERE tipo_produto IS NULL OR tipo_produto = '';

-- Garante que movimentações futuras usem o mesmo padrão de histórico e rastreabilidade.
ALTER TABLE movimentacao_estoque
  ADD CONSTRAINT fk_mov_estoque_usuario
  FOREIGN KEY (usuario_id) REFERENCES usuario(id)
  ON DELETE SET NULL;
