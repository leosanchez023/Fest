<<<<<<< HEAD
=======
-- =====================================================
-- FEST - SCHEMA FINAL PARA INSTALAÇÃO NOVA
-- =====================================================
-- Este arquivo representa a estrutura atual do sistema.
-- As migrações históricas em database/migrations continuam preservadas,
-- mas não são necessárias para criar um banco novo com a estrutura final.
-- =====================================================

DROP DATABASE IF EXISTS fest;
>>>>>>> 361100f430d8e6af4a77c44b631fa9a485f7964a
CREATE DATABASE fest
CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;
USE fest;

CREATE TABLE endereco (
  id INT NOT NULL AUTO_INCREMENT,
  rua VARCHAR(150) DEFAULT NULL,
  numero VARCHAR(10) DEFAULT NULL,
  bairro VARCHAR(100) DEFAULT NULL,
  cidade VARCHAR(100) DEFAULT NULL,
  estado VARCHAR(2) DEFAULT NULL,
  cep VARCHAR(12) DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE usuario (
  id INT NOT NULL AUTO_INCREMENT,
  nome VARCHAR(100) DEFAULT NULL,
  email VARCHAR(100) DEFAULT NULL,
  senha VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_usuario_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE fornecedores (
  id INT NOT NULL AUTO_INCREMENT,
  nome VARCHAR(150) NOT NULL,
  cnpj VARCHAR(25) NOT NULL,
  responsavel VARCHAR(100) DEFAULT NULL,
  categoria VARCHAR(100) DEFAULT NULL,
  telefone VARCHAR(30) DEFAULT NULL,
  whatsapp VARCHAR(30) DEFAULT NULL,
  email VARCHAR(150) DEFAULT NULL,
  site VARCHAR(200) DEFAULT NULL,
  rua VARCHAR(150) DEFAULT NULL,
  numero VARCHAR(20) DEFAULT NULL,
  bairro VARCHAR(100) DEFAULT NULL,
  cidade VARCHAR(100) DEFAULT NULL,
  estado VARCHAR(2) DEFAULT NULL,
  cep VARCHAR(15) DEFAULT NULL,
  produtos TEXT DEFAULT NULL,
  entrega VARCHAR(100) DEFAULT NULL,
  pagamento VARCHAR(100) DEFAULT NULL,
  observacoes TEXT DEFAULT NULL,
  status ENUM('Ativo', 'Inativo') DEFAULT NULL,
  criado_em DATETIME DEFAULT NULL,
  atualizado_em DATETIME DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cliente (
  id INT NOT NULL AUTO_INCREMENT,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  telefone VARCHAR(20) DEFAULT NULL,
  id_endereco INT DEFAULT NULL,
  cpf VARCHAR(20) DEFAULT NULL,
  nascimento DATE DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_cliente_endereco (id_endereco),
  CONSTRAINT fk_cliente_endereco
    FOREIGN KEY (id_endereco) REFERENCES endereco(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE produtos (
  id INT NOT NULL AUTO_INCREMENT,
  nome VARCHAR(255) NOT NULL,
  tipo VARCHAR(255) DEFAULT NULL,
  tipo_produto VARCHAR(20) NOT NULL DEFAULT 'PRODUTO',
  estoque INT NOT NULL DEFAULT 0,
  estoque_reservado INT NOT NULL DEFAULT 0,
  estoque_em_uso INT NOT NULL DEFAULT 0,
  estoque_manutencao INT NOT NULL DEFAULT 0,
  estoque_danificado INT NOT NULL DEFAULT 0,
  estoque_minimo INT NOT NULL DEFAULT 0,
  preco_venda DECIMAL(10,2) DEFAULT 0.00,
  preco_aluguel DECIMAL(10,2) DEFAULT 0.00,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  codigo VARCHAR(50) DEFAULT NULL,
  categoria VARCHAR(100) DEFAULT NULL,
  fornecedor_id INT DEFAULT NULL,
  imagem VARCHAR(255) DEFAULT NULL,
  localizacao VARCHAR(100) DEFAULT NULL,
<<<<<<< HEAD
  estoque_reservado INT DEFAULT 0,
  estoque_em_uso INT NOT NULL DEFAULT 0,
  estoque_manutencao INT DEFAULT 0,
  estoque_danificado INT DEFAULT 0,
  estoque_minimo INT NOT NULL DEFAULT 0,
  tipo_produto VARCHAR(20) NOT NULL DEFAULT 'PRODUTO',
  ativo TINYINT(1) DEFAULT 1,
  PRIMARY KEY(id)
);
CREATE TABLE cliente (
  id INT NOT NULL AUTO_INCREMENT,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  telefone VARCHAR(20),
  id_endereco INT,
  cpf VARCHAR(20),
  nascimento DATE,
=======
  ativo TINYINT(1) NOT NULL DEFAULT 1,
>>>>>>> 361100f430d8e6af4a77c44b631fa9a485f7964a
  PRIMARY KEY (id),
  UNIQUE KEY uk_produtos_codigo (codigo),
  KEY idx_produtos_fornecedor (fornecedor_id),
  KEY idx_produtos_categoria (categoria),
  KEY idx_produtos_ativo (ativo),
  CONSTRAINT fk_produto_fornecedor
    FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE combos (
  id INT NOT NULL AUTO_INCREMENT,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT DEFAULT NULL,
  codigo VARCHAR(50) DEFAULT NULL,
  preco_venda DECIMAL(10,2) DEFAULT 0.00,
  preco_aluguel DECIMAL(10,2) DEFAULT 0.00,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_combo_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE combo_itens (
  id INT NOT NULL AUTO_INCREMENT,
  combo_id INT NOT NULL,
  produto_id INT NOT NULL,
  quantidade INT NOT NULL DEFAULT 1,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_combo_id (combo_id),
  KEY idx_produto_combo (produto_id),
  CONSTRAINT fk_combo_item_combo
    FOREIGN KEY (combo_id) REFERENCES combos(id) ON DELETE CASCADE,
  CONSTRAINT fk_combo_item_produto
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE pedidos (
  id INT NOT NULL AUTO_INCREMENT,
  cliente_id INT NOT NULL,
  endereco_id INT DEFAULT NULL,
  usuario_id INT DEFAULT NULL,
  data_pedido DATETIME DEFAULT CURRENT_TIMESTAMP,
  data_evento DATE DEFAULT NULL,
  data_entrega DATE DEFAULT NULL,
  data_retirada DATE DEFAULT NULL,
  telefone_contato VARCHAR(20) DEFAULT NULL,
  tipo_pedido ENUM('ALUGUEL', 'VENDA', 'MISTO') NOT NULL DEFAULT 'ALUGUEL',
  status ENUM('ORCAMENTO', 'CONFIRMADO', 'EM_PREPARO', 'ENTREGUE', 'RETIRADO', 'CONFERENCIA', 'PENDENTE', 'FINALIZADO', 'CANCELADO') NOT NULL DEFAULT 'ORCAMENTO',
  valor_produtos DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  valor_frete DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  valor_desconto DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  valor_total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  local_evento VARCHAR(255) DEFAULT NULL,
  motorista VARCHAR(100) DEFAULT NULL,
  veiculo VARCHAR(100) DEFAULT NULL,
  responsavel_entrega VARCHAR(100) DEFAULT NULL,
  responsavel_retirada VARCHAR(100) DEFAULT NULL,
  observacao_entrega TEXT DEFAULT NULL,
  observacao_retirada TEXT DEFAULT NULL,
  observacoes TEXT DEFAULT NULL,
  status_documento ENUM('ORCAMENTO', 'PEDIDO') NOT NULL DEFAULT 'ORCAMENTO',
  data_entrega_hora DATETIME DEFAULT NULL,
  data_retirada_hora DATETIME DEFAULT NULL,
  conferencia_finalizada TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_pedidos_cliente (cliente_id),
  KEY idx_pedidos_endereco (endereco_id),
  KEY idx_pedidos_usuario (usuario_id),
  KEY idx_pedidos_status (status),
  KEY idx_pedidos_status_documento (status_documento),
  KEY idx_pedidos_data_evento (data_evento),
  CONSTRAINT fk_pedido_cliente
    FOREIGN KEY (cliente_id) REFERENCES cliente(id),
  CONSTRAINT fk_pedido_endereco
    FOREIGN KEY (endereco_id) REFERENCES endereco(id) ON DELETE SET NULL,
  CONSTRAINT fk_pedido_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE pedido_itens (
  id INT NOT NULL AUTO_INCREMENT,
  pedido_id INT NOT NULL,
  produto_id INT NOT NULL,
  tipo_item VARCHAR(10) NOT NULL DEFAULT 'ALUGUEL',
  combo_id INT DEFAULT NULL,
  quantidade INT NOT NULL,
  valor_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  quantidade_entregue INT NOT NULL DEFAULT 0,
  quantidade_devolvida INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_pedido_itens_pedido (pedido_id),
  KEY idx_pedido_itens_produto (produto_id),
  CONSTRAINT fk_pedido_item_pedido
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
  CONSTRAINT fk_pedido_item_produto
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE pedido_item_componentes (
  id INT NOT NULL AUTO_INCREMENT,
  pedido_item_id INT NOT NULL,
  produto_id INT NOT NULL,
  quantidade_por_unidade INT NOT NULL DEFAULT 1,
  quantidade_total INT NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_componentes_pedido_item (pedido_item_id),
  KEY idx_componentes_produto (produto_id),
  CONSTRAINT fk_componentes_pedido_item
    FOREIGN KEY (pedido_item_id) REFERENCES pedido_itens(id) ON DELETE CASCADE,
  CONSTRAINT fk_componentes_produto
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE pagamentos (
  id INT NOT NULL AUTO_INCREMENT,
  pedido_id INT NOT NULL,
  usuario_id INT DEFAULT NULL,
  data_pagamento DATETIME DEFAULT CURRENT_TIMESTAMP,
  valor DECIMAL(10,2) NOT NULL,
  forma_pagamento ENUM('DINHEIRO','PIX','CARTAO_DEBITO','CARTAO_CREDITO','TRANSFERENCIA') NOT NULL,
  observacao TEXT DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_pagamentos_pedido (pedido_id),
  KEY idx_pagamentos_usuario (usuario_id),
  CONSTRAINT fk_pagamento_pedido
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
  CONSTRAINT fk_pagamento_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE devolucoes (
  id INT NOT NULL AUTO_INCREMENT,
  pedido_id INT NOT NULL,
  usuario_id INT DEFAULT NULL,
  data_devolucao DATETIME DEFAULT NULL,
  valor_multa DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  observacao TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_devolucoes_pedido (pedido_id),
  KEY idx_devolucoes_usuario (usuario_id),
  CONSTRAINT fk_devolucao_pedido
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
  CONSTRAINT fk_devolucao_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE devolucao_itens (
  id INT NOT NULL AUTO_INCREMENT,
  devolucao_id INT NOT NULL,
  produto_id INT NOT NULL,
  quantidade_recebida INT NOT NULL DEFAULT 0,
  quantidade_faltando INT NOT NULL DEFAULT 0,
  quantidade_danificada INT NOT NULL DEFAULT 0,
  valor_cobranca DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  observacao TEXT DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_devolucao_itens_devolucao (devolucao_id),
  KEY idx_devolucao_itens_produto (produto_id),
  CONSTRAINT fk_devolucao_item_devolucao
    FOREIGN KEY (devolucao_id) REFERENCES devolucoes(id) ON DELETE CASCADE,
  CONSTRAINT fk_devolucao_item_produto
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ocorrencias (
  id INT NOT NULL AUTO_INCREMENT,
  pedido_id INT NOT NULL,
  usuario_id INT DEFAULT NULL,
  tipo VARCHAR(100) NOT NULL,
  descricao TEXT NOT NULL,
  valor DECIMAL(10,2) DEFAULT 0.00,
  status ENUM('ABERTO','EM_ANDAMENTO','RESOLVIDO','CANCELADO') NOT NULL DEFAULT 'ABERTO',
  data_ocorrencia DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ocorrencias_pedido (pedido_id),
  KEY idx_ocorrencias_usuario (usuario_id),
  CONSTRAINT fk_ocorrencia_pedido
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
  CONSTRAINT fk_ocorrencia_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE reservas_estoque (
  id INT NOT NULL AUTO_INCREMENT,
  pedido_id INT NOT NULL,
  produto_id INT NOT NULL,
  quantidade INT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ATIVA',
  data_reserva DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_liberacao DATETIME DEFAULT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_reservas_pedido (pedido_id),
  KEY idx_reservas_produto (produto_id),
  KEY idx_reservas_status (status),
  CONSTRAINT fk_reserva_pedido
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
  CONSTRAINT fk_reserva_produto
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE movimentacao_estoque (
  id INT NOT NULL AUTO_INCREMENT,
  produto_id INT NOT NULL,
<<<<<<< HEAD
  pedido_id INT,
=======
  pedido_id INT DEFAULT NULL,
>>>>>>> 361100f430d8e6af4a77c44b631fa9a485f7964a
  usuario_id INT DEFAULT NULL,
  tipo VARCHAR(40) NOT NULL,
  tipo_movimento VARCHAR(40) NOT NULL DEFAULT 'AJUSTE',
  quantidade INT NOT NULL,
  data_movimentacao DATETIME DEFAULT CURRENT_TIMESTAMP,
  observacao TEXT DEFAULT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mov_estoque_produto (produto_id),
  KEY idx_mov_estoque_pedido (pedido_id),
  KEY idx_mov_estoque_usuario (usuario_id),
  KEY idx_mov_estoque_tipo (tipo),
  CONSTRAINT fk_mov_estoque_produto
    FOREIGN KEY (produto_id) REFERENCES produtos(id),
  CONSTRAINT fk_mov_estoque_pedido
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE SET NULL,
  CONSTRAINT fk_mov_estoque_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE estoque_historico (
  id INT NOT NULL AUTO_INCREMENT,
  produto_id INT NOT NULL,
  pedido_id INT DEFAULT NULL,
  usuario_id INT DEFAULT NULL,
  tipo VARCHAR(40) NOT NULL,
  quantidade INT NOT NULL,
  observacao TEXT DEFAULT NULL,
  data_movimentacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_historico_produto (produto_id),
  KEY idx_historico_pedido (pedido_id),
  KEY idx_historico_usuario (usuario_id),
  CONSTRAINT fk_historico_produto
    FOREIGN KEY (produto_id) REFERENCES produtos(id),
  CONSTRAINT fk_historico_pedido
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE SET NULL,
  CONSTRAINT fk_historico_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_permissions (
  id INT NOT NULL AUTO_INCREMENT,
  usuario_id INT DEFAULT NULL,
  dashboard TINYINT(1) DEFAULT 0,
  clientes TINYINT(1) DEFAULT 0,
  produtos TINYINT(1) DEFAULT 0,
  pedidos TINYINT(1) DEFAULT 0,
  relatorios TINYINT(1) DEFAULT 0,
  funcionarios TINYINT(1) DEFAULT 0,
  entregas TINYINT(1) DEFAULT 0,
  retiradas TINYINT(1) DEFAULT 0,
  pagamentos TINYINT(1) DEFAULT 0,
  estoque TINYINT(1) DEFAULT 0,
  fornecedor TINYINT(1) DEFAULT 0,
  cadastro_admin TINYINT(1) DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_user_permissions_usuario (usuario_id),
  CONSTRAINT fk_user_permissions_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuario(id)
    ON DELETE CASCADE
<<<<<<< HEAD
);
CREATE TABLE fornecedores (
id INT NOT NULL AUTO_INCREMENT,
nome VARCHAR(150) NOT NULL,
cnpj VARCHAR(25) NOT NULL,
responsavel VARCHAR(100),
categoria VARCHAR(100),
telefone VARCHAR(30),
whatsapp VARCHAR(30),
email VARCHAR(150),
site VARCHAR(200),
rua VARCHAR(150),
numero VARCHAR(20),
bairro VARCHAR(100),
cidade VARCHAR(100),
estado VARCHAR(2),
cep VARCHAR(15),
produtos TEXT,
entrega VARCHAR(100),
pagamento VARCHAR(100),
observacoes TEXT,
status ENUM(
'Ativo',
'Inativo'
)
DEFAULT NULL,
criado_em DATETIME DEFAULT NULL,
atualizado_em DATETIME DEFAULT NULL,
PRIMARY KEY(id)
);
ALTER TABLE produtos
  ADD KEY fk_produto_fornecedor(fornecedor_id),
  ADD CONSTRAINT fk_produto_fornecedor
    FOREIGN KEY(fornecedor_id) REFERENCES fornecedores(id);

CREATE TABLE reservas_estoque (
  id INT NOT NULL AUTO_INCREMENT,
  pedido_id INT NOT NULL,
  produto_id INT NOT NULL,
  quantidade INT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ATIVA',
  data_reserva DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_liberacao DATETIME DEFAULT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_reservas_pedido (pedido_id),
  KEY idx_reservas_produto (produto_id),
  KEY idx_reservas_status (status),
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
  FOREIGN KEY (produto_id) REFERENCES produtos(id)
);

CREATE TABLE estoque_historico (
  id INT NOT NULL AUTO_INCREMENT,
  produto_id INT NOT NULL,
  pedido_id INT DEFAULT NULL,
  usuario_id INT DEFAULT NULL,
  tipo VARCHAR(40) NOT NULL,
  quantidade INT NOT NULL,
  observacao TEXT DEFAULT NULL,
  data_movimentacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_historico_produto (produto_id),
  KEY idx_historico_pedido (pedido_id),
  FOREIGN KEY (produto_id) REFERENCES produtos(id),
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
  FOREIGN KEY (usuario_id) REFERENCES usuario(id)
);

CREATE TABLE combos (
  id INT NOT NULL AUTO_INCREMENT,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  codigo VARCHAR(50),
  preco_venda DECIMAL(10,2) DEFAULT 0.00,
  preco_aluguel DECIMAL(10,2) DEFAULT 0.00,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_combo_codigo (codigo)
);

CREATE TABLE combo_itens (
  id INT NOT NULL AUTO_INCREMENT,
  combo_id INT NOT NULL,
  produto_id INT NOT NULL,
  quantidade INT NOT NULL DEFAULT 1,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_combo_id (combo_id),
  KEY idx_produto_combo (produto_id),
  FOREIGN KEY (combo_id) REFERENCES combos(id) ON DELETE CASCADE,
  FOREIGN KEY (produto_id) REFERENCES produtos(id)
);

CREATE TABLE pedido_item_componentes (
  id INT NOT NULL AUTO_INCREMENT,
  pedido_item_id INT NOT NULL,
  produto_id INT NOT NULL,
  quantidade_por_unidade INT NOT NULL DEFAULT 1,
  quantidade_total INT NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_composicao_pedido_item (pedido_item_id),
  KEY idx_composicao_produto (produto_id),
  FOREIGN KEY (pedido_item_id) REFERENCES pedido_itens(id) ON DELETE CASCADE,
  FOREIGN KEY (produto_id) REFERENCES produtos(id)
);
=======
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
>>>>>>> 361100f430d8e6af4a77c44b631fa9a485f7964a
