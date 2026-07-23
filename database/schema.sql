CREATE DATABASE IF NOT EXISTS fest
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
INSERT INTO usuario (nome, email, senha)
VALUES (
    'leo',
    'leonardosanchezsilva@500@gmail.com',
    '1234'
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
  endereco_id INT,
  usuario_id INT,
  data_pedido DATETIME DEFAULT CURRENT_TIMESTAMP,
  data_evento DATE DEFAULT NULL,
  data_entrega DATE,
  data_retirada DATE,
  telefone_contato VARCHAR(20),
  tipo_pedido ENUM('ALUGUEL','VENDA','MISTO') DEFAULT 'ALUGUEL',
  status ENUM('ORCAMENTO','CONFIRMADO','EM_PREPARO','ENTREGUE','RETIRADO','FINALIZADO','CANCELADO') DEFAULT 'ORCAMENTO',
  status_documento ENUM('ORCAMENTO','PEDIDO') NOT NULL DEFAULT 'ORCAMENTO',
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
  PRIMARY KEY (id),
  FOREIGN KEY (cliente_id) REFERENCES cliente(id),
  FOREIGN KEY (endereco_id) REFERENCES endereco(id),
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
  usuario_id INT,
  data_devolucao DATETIME,
  valor_multa DECIMAL(10,2) DEFAULT 0.00,
  observacao TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (pedido_id)
    REFERENCES pedidos(id)
    ON DELETE CASCADE,
  FOREIGN KEY (usuario_id)
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
CREATE TABLE fornecedores (

    id INT NOT NULL AUTO_INCREMENT,

    nome VARCHAR(150) NOT NULL,
    cnpj VARCHAR(25) NOT NULL,
    responsavel VARCHAR(100),

    category VARCHAR(100),

    phone VARCHAR(30),
    whatsapp VARCHAR(30),

    email VARCHAR(150),
    website VARCHAR(200),

    street VARCHAR(150),
    number VARCHAR(20),
    neighborhood VARCHAR(100),
    city VARCHAR(100),
    state VARCHAR(2),
    cep VARCHAR(15),

    product TEXT,
    delivery VARCHAR(100),
    payment VARCHAR(100),

    notes TEXT,

    status ENUM('Ativo','Inativo') DEFAULT 'Ativo',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY(id)
INSERT INTO usuario (nome, email, senha)
VALUES (
  'leo',
  'leo@gmail.com',
  '1234'
);

);

