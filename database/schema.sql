CREATE DATABASE IF NOT EXISTS fest
CHARACTER SET utf8mb4
COLLATE utf8mb4_0900_ai_ci;

USE fest;

CREATE TABLE endereco (
  id INT NOT NULL AUTO_INCREMENT,
  rua VARCHAR(150),
  numero VARCHAR(10),
  cidade VARCHAR(100),
  estado VARCHAR(2),
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
  tipo VARCHAR(255),
  estoque INT DEFAULT 0,
  preco_venda FLOAT,
  preco_aluguel FLOAT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
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
  usuario_id INT,
  data_pedido DATETIME DEFAULT CURRENT_TIMESTAMP,
  data_evento DATE NOT NULL,
  data_entrega DATE,
  data_retirada DATE,
  telefone_contato VARCHAR(20),
  tipo_pedido ENUM('ALUGUEL','VENDA','MISTO') DEFAULT 'ALUGUEL',
  status ENUM('ORCAMENTO','CONFIRMADO','EM_PREPARO','ENTREGUE','RETIRADO','FINALIZADO','CANCELADO') DEFAULT 'ORCAMENTO',
  valor_produtos DECIMAL(10,2) DEFAULT 0.00,
  valor_frete DECIMAL(10,2) DEFAULT 0.00,
  valor_desconto DECIMAL(10,2) DEFAULT 0.00,
  valor_total DECIMAL(10,2) DEFAULT 0.00,
  observacoes TEXT,
  PRIMARY KEY (id),
  FOREIGN KEY (cliente_id) REFERENCES cliente(id),
  FOREIGN KEY (usuario_id) REFERENCES usuario(id)
);
CREATE TABLE pedido_itens (
  id INT NOT NULL AUTO_INCREMENT,
  pedido_id INT NOT NULL,
  produto_id INT NOT NULL,
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
  data_pagamento DATETIME DEFAULT CURRENT_TIMESTAMP,
  valor DECIMAL(10,2) NOT NULL,
  forma_pagamento ENUM('DINHEIRO','PIX','CARTAO_DEBITO','CARTAO_CREDITO','TRANSFERENCIA') NOT NULL,
  observacao TEXT,
  PRIMARY KEY (id),
  FOREIGN KEY (pedido_id)
    REFERENCES pedidos(id)
    ON DELETE CASCADE
);
CREATE TABLE devolucoes (
  id INT NOT NULL AUTO_INCREMENT,
  pedido_id INT NOT NULL,
  data_devolucao DATETIME,
  valor_multa DECIMAL(10,2) DEFAULT 0.00,
  observacao TEXT,
  PRIMARY KEY (id),
  FOREIGN KEY (pedido_id)
    REFERENCES pedidos(id)
    ON DELETE CASCADE
);
CREATE TABLE devolucao_itens (
  id INT NOT NULL AUTO_INCREMENT,
  devolucao_id INT NOT NULL,
  produto_id INT NOT NULL,
  quantidade_recebida INT DEFAULT 0,
  quantidade_faltando INT DEFAULT 0,
  quantidade_danificada INT DEFAULT 0,
  valor_cobranca DECIMAL(10,2) DEFAULT 0.00,
  PRIMARY KEY (id),
  FOREIGN KEY (devolucao_id)
    REFERENCES devolucoes(id)
    ON DELETE CASCADE,
  FOREIGN KEY (produto_id)
    REFERENCES produtos(id)
);
CREATE TABLE movimentacao_estoque (
  id INT NOT NULL AUTO_INCREMENT,
  produto_id INT NOT NULL,
  pedido_id INT,
  tipo ENUM('ENTRADA','SAIDA','RETORNO','VENDA','AJUSTE') NOT NULL,
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
  fornecedor TINYINT(1) DEFAULT 0,
  cadastro_admin TINYINT(1) DEFAULT 0,
  PRIMARY KEY (id),
  FOREIGN KEY (usuario_id)
    REFERENCES usuario(id)
    ON DELETE CASCADE
);