CREATE DATABASE fest
CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

USE fest;

CREATE TABLE endereco (
  id INT NOT NULL AUTO_INCREMENT,
  rua VARCHAR(150),
  numero VARCHAR(10),
  bairro VARCHAR(100),
  cidade VARCHAR(100),
  estado VARCHAR(2),
  cep VARCHAR(12),
  PRIMARY KEY (id)
);
CREATE TABLE usuario (
  id INT NOT NULL AUTO_INCREMENT,
  nome VARCHAR(100),
  email VARCHAR(100),
  senha VARCHAR(255),
  PRIMARY KEY (id),
  UNIQUE KEY email (email)
);
CREATE TABLE produtos (
  id INT NOT NULL AUTO_INCREMENT,
  nome VARCHAR(255) NOT NULL,
  tipo VARCHAR(255) DEFAULT NULL,
  estoque INT DEFAULT 0,
  preco_venda FLOAT DEFAULT NULL,
  preco_aluguel FLOAT DEFAULT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      ON UPDATE CURRENT_TIMESTAMP,
  codigo VARCHAR(50) DEFAULT NULL,
  categoria VARCHAR(100) DEFAULT NULL,
  fornecedor_id INT DEFAULT NULL,
  imagem VARCHAR(255) DEFAULT NULL,
  localizacao VARCHAR(100) DEFAULT NULL,
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
  PRIMARY KEY (id),
  KEY(id_endereco),
  CONSTRAINT fk_cliente_endereco
    FOREIGN KEY (id_endereco)
    REFERENCES endereco(id)
);
CREATE TABLE pedidos (
  id INT NOT NULL AUTO_INCREMENT,
  cliente_id INT NOT NULL,
  endereco_id INT DEFAULT NULL,
  usuario_id INT DEFAULT NULL,
  data_pedido DATETIME DEFAULT CURRENT_TIMESTAMP,
  data_evento DATE DEFAULT NULL,
  data_entrega DATE DEFAULT NULL,
  data_retirada DATE DEFAULT NULL,
  telefone_contato VARCHAR(20),
  tipo_pedido ENUM(
    'ALUGUEL',
    'VENDA',
    'MISTO'
  ) DEFAULT 'ALUGUEL',
  status ENUM(
    'ORCAMENTO',
    'CONFIRMADO',
    'EM_PREPARO',
    'ENTREGUE',
    'RETIRADO',
    'CONFERENCIA',
    'PENDENTE',
    'FINALIZADO',
    'CANCELADO'
  ) DEFAULT 'ORCAMENTO',
  valor_produtos DECIMAL(10,2) DEFAULT 0.00,
  valor_frete DECIMAL(10,2) DEFAULT 0.00,
  valor_desconto DECIMAL(10,2) DEFAULT 0.00,
  valor_total DECIMAL(10,2) DEFAULT 0.00,
  local_evento VARCHAR(255),
  motorista VARCHAR(100),
  veiculo VARCHAR(100),
  responsavel_entrega VARCHAR(100),
  responsavel_retirada VARCHAR(100),
  observacao_entrega TEXT,
  observacao_retirada TEXT,
  observacoes TEXT,
  status_documento ENUM(
    'ORCAMENTO',
    'PEDIDO'
  ) NOT NULL DEFAULT 'ORCAMENTO',
  data_entrega_hora DATETIME DEFAULT NULL,
  data_retirada_hora DATETIME DEFAULT NULL,
  conferencia_finalizada TINYINT(1)
  NOT NULL DEFAULT 0,
  PRIMARY KEY(id),
  FOREIGN KEY(cliente_id)
  REFERENCES cliente(id),
  FOREIGN KEY(endereco_id)
  REFERENCES endereco(id),
  FOREIGN KEY(usuario_id)
  REFERENCES usuario(id)
);

CREATE TABLE pedido_itens (
  id INT NOT NULL AUTO_INCREMENT,
  pedido_id INT NOT NULL,
  produto_id INT NOT NULL,
  tipo_item VARCHAR(10) NOT NULL DEFAULT 'ALUGUEL',
  combo_id INT DEFAULT NULL,
  quantidade INT NOT NULL,
  valor_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  quantidade_entregue INT DEFAULT 0,
  quantidade_devolvida INT DEFAULT 0,
  PRIMARY KEY (id),
  FOREIGN KEY (pedido_id)
    REFERENCES pedidos(id)
    ON DELETE CASCADE,
  FOREIGN KEY (produto_id)
    REFERENCES produtos(id)
);
CREATE TABLE pagamentos (
  id INT NOT NULL AUTO_INCREMENT,
  pedido_id INT NOT NULL,
  usuario_id INT,
  data_pagamento DATETIME DEFAULT CURRENT_TIMESTAMP,
  valor DECIMAL(10,2) NOT NULL,
  forma_pagamento ENUM('DINHEIRO','PIX','CARTAO_DEBITO','CARTAO_CREDITO','TRANSFERENCIA') NOT NULL,
  observacao TEXT,
  PRIMARY KEY (id),
  FOREIGN KEY (pedido_id)
    REFERENCES pedidos(id)
    ON DELETE CASCADE,
  FOREIGN KEY (usuario_id)
    REFERENCES usuario(id)
);

CREATE TABLE devolucoes (
id INT NOT NULL AUTO_INCREMENT,
pedido_id INT NOT NULL,
usuario_id INT DEFAULT NULL,
data_devolucao DATETIME DEFAULT NULL,
valor_multa DECIMAL(10,2)
DEFAULT 0.00,
observacao TEXT,
created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
PRIMARY KEY(id),
FOREIGN KEY(pedido_id)
REFERENCES pedidos(id)
ON DELETE CASCADE,
FOREIGN KEY(usuario_id)
REFERENCES usuario(id)
);

CREATE TABLE devolucao_itens (
  id INT NOT NULL AUTO_INCREMENT,
  devolucao_id INT NOT NULL,
  produto_id INT NOT NULL,
  quantidade_recebida INT DEFAULT 0,
  quantidade_faltando INT DEFAULT 0,
  quantidade_danificada INT DEFAULT 0,
  valor_cobranca DECIMAL(10,2) DEFAULT 0.00,
  observacao TEXT,
  PRIMARY KEY (id),
  FOREIGN KEY (devolucao_id)
    REFERENCES devolucoes(id)
    ON DELETE CASCADE,
  FOREIGN KEY (produto_id)
    REFERENCES produtos(id)
);
CREATE TABLE ocorrencias (
  id INT NOT NULL AUTO_INCREMENT,
  pedido_id INT NOT NULL,
  usuario_id INT,
  tipo VARCHAR(100) NOT NULL,
  descricao TEXT NOT NULL,
  valor DECIMAL(10,2) DEFAULT 0.00,
  status ENUM('ABERTO','EM_ANDAMENTO','RESOLVIDO','CANCELADO') DEFAULT 'ABERTO',
  data_ocorrencia DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (pedido_id)
    REFERENCES pedidos(id)
    ON DELETE CASCADE,
  FOREIGN KEY (usuario_id)
    REFERENCES usuario(id)
);
CREATE TABLE movimentacao_estoque (
  id INT NOT NULL AUTO_INCREMENT,
  produto_id INT NOT NULL,
  pedido_id INT,
  usuario_id INT DEFAULT NULL,
  tipo VARCHAR(40) NOT NULL,
  tipo_movimento VARCHAR(40) NOT NULL DEFAULT 'AJUSTE',
  quantidade INT NOT NULL,
  data_movimentacao DATETIME DEFAULT CURRENT_TIMESTAMP,
  observacao TEXT,
  PRIMARY KEY (id),
  FOREIGN KEY (produto_id)
    REFERENCES produtos(id),
  FOREIGN KEY (pedido_id)
    REFERENCES pedidos(id)
);
CREATE TABLE user_permissions (
  id INT NOT NULL AUTO_INCREMENT,
  usuario_id INT,
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
  FOREIGN KEY (usuario_id)
    REFERENCES usuario(id)
    ON DELETE CASCADE
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