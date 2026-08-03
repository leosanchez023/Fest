SET FOREIGN_KEY_CHECKS = 0;

/* ==========================================================
   USUÁRIOS
========================================================== */

INSERT INTO usuario (
    id,
    nome,
    email,
    senha
)
VALUES
    (
        1,
        'Administrador',
        'admin@fest.com',
        '$2b$10$YFGJYHADCB0DcLzZWfewUu9Q78BVogEDhomCODn1rPKx0KCnbfZBe'
    ),
    (
        2,
        'João Silva',
        'joao@fest.com',
        '$2b$10$YFGJYHADCB0DcLzZWfewUu9Q78BVogEDhomCODn1rPKx0KCnbfZBe'
    ),
    (
        3,
        'Maria Oliveira',
        'maria@fest.com',
        '$2b$10$YFGJYHADCB0DcLzZWfewUu9Q78BVogEDhomCODn1rPKx0KCnbfZBe'
    ),
    (
        4,
        'Leo',
        'leo@gmail.com',
        '$2b$10$YFGJYHADCB0DcLzZWfewUu9Q78BVogEDhomCODn1rPKx0KCnbfZBe'
    );

/* ==========================================================
   PERMISSÕES
========================================================== */

INSERT INTO user_permissions (
    id,
    usuario_id,
    dashboard,
    clientes,
    produtos,
    pedidos,
    relatorios,
    funcionarios,
    entregas,
    retiradas,
    pagamentos,
    fornecedor,
    cadastro_admin
)
VALUES
    (1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1),
    (2, 2, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0),
    (3, 3, 1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0),
    (4, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1);

/* ==========================================================
   ENDEREÇOS
========================================================== */

INSERT INTO endereco (
    id,
    rua,
    numero,
    bairro,
    cidade,
    estado,
    cep
)
VALUES
    (1, 'Rua das Flores', '120', 'Centro', 'Tupã', 'SP', '17600-001'),
    (2, 'Rua Brasil', '85', 'Vila Independência', 'Tupã', 'SP', '17600-020'),
    (3, 'Av. Tamoios', '1500', 'Centro', 'Tupã', 'SP', '17600-040'),
    (4, 'Rua Aimorés', '44', 'Jardim América', 'Tupã', 'SP', '17600-055'),
    (5, 'Rua Guaicurus', '305', 'Centro', 'Tupã', 'SP', '17600-070'),
    (6, 'Rua Marília', '95', 'Centro', 'Tupã', 'SP', '17600-080'),
    (7, 'Rua Caetés', '100', 'Vila Marajoara', 'Tupã', 'SP', '17600-090'),
    (8, 'Rua dos Lírios', '455', 'Jardim Santa Adélia', 'Tupã', 'SP', '17600-120'),
    (9, 'Rua Paraná', '600', 'Centro', 'Tupã', 'SP', '17600-140'),
    (10, 'Rua São Paulo', '710', 'Vila Abarca', 'Tupã', 'SP', '17600-160');


/* ==========================================================
   CLIENTES
========================================================== */

INSERT INTO cliente (
    id,
    nome,
    email,
    telefone,
    id_endereco,
    cpf,
    nascimento
)
VALUES
    (1, 'Carlos Henrique', 'carlos@email.com', '14999990001', 1, '11111111111', '1990-05-12'),
    (2, 'Fernanda Souza', 'fernanda@email.com', '14999990002', 2, '22222222222', '1992-09-20'),
    (3, 'Ricardo Lima', 'ricardo@email.com', '14999990003', 3, '33333333333', '1988-11-02'),
    (4, 'Juliana Martins', 'juliana@email.com', '14999990004', 4, '44444444444', '1994-04-17'),
    (5, 'Paulo Henrique', 'paulo@email.com', '14999990005', 5, '55555555555', '1998-01-25'),
    (6, 'Camila Rocha', 'camila@email.com', '14999990006', 6, '66666666666', '1995-07-30'),
    (7, 'Lucas Almeida', 'lucas@email.com', '14999990007', 7, '77777777777', '2000-08-10'),
    (8, 'Patrícia Gomes', 'patricia@email.com', '14999990008', 8, '88888888888', '1989-02-13'),
    (9, 'Eduardo Santos', 'eduardo@email.com', '14999990009', 9, '99999999999', '1996-10-05'),
    (10, 'Ana Beatriz', 'ana@email.com', '14999990010', 10, '12312312312', '1993-03-15');

/* ==========================================================
   FORNECEDORES
========================================================== */

INSERT INTO fornecedores (
    id,
    nome,
    cnpj,
    responsavel,
    categoria,
    telefone,
    whatsapp,
    email,
    site,
    rua,
    numero,
    bairro,
    cidade,
    estado,
    cep,
    produtos,
    entrega,
    pagamento,
    observacoes,
    status,
    criado_em,
    atualizado_em
)
VALUES
    (
        1,
        'Fornecedor Festas LTDA',
        '11.111.111/0001-11',
        'Carlos Roberto',
        'Mesas e Cadeiras',
        '(14)99999-1001',
        '(14)99999-1001',
        'contato@fornecedorfestas.com',
        'www.fornecedorfestas.com.br',
        'Rua Industrial',
        '120',
        'Distrito Industrial',
        'Tupã',
        'SP',
        '17600-300',
        'Mesas, Cadeiras',
        'Entrega Própria',
        'PIX',
        'Fornecedor principal',
        'Ativo',
        NOW(),
        NOW()
    ),
    (
        2,
        'Decor Fest',
        '22.222.222/0001-22',
        'Marcos Paulo',
        'Decoração',
        '(14)99999-1002',
        '(14)99999-1002',
        'decor@fest.com',
        'www.decorfest.com.br',
        'Rua Flores',
        '50',
        'Centro',
        'Tupã',
        'SP',
        '17600-310',
        'Painéis, Arcos',
        'Entrega Própria',
        'Boleto',
        '',
        'Ativo',
        NOW(),
        NOW()
    ),
    (
        3,
        'Louças Brasil',
        '33.333.333/0001-33',
        'Fernanda Lima',
        'Louças',
        '(14)99999-1003',
        '(14)99999-1003',
        'contato@loucas.com',
        'www.loucas.com.br',
        'Rua Paraná',
        '89',
        'Centro',
        'Tupã',
        'SP',
        '17600-320',
        'Pratos e Copos',
        'Transportadora',
        'PIX',
        '',
        'Ativo',
        NOW(),
        NOW()
    ),
    (
        4,
        'Som & Luz Eventos',
        '44.444.444/0001-44',
        'João Pedro',
        'Som',
        '(14)99999-1004',
        '(14)99999-1004',
        'contato@somluz.com',
        'www.somluz.com.br',
        'Rua XV',
        '215',
        'Centro',
        'Tupã',
        'SP',
        '17600-330',
        'Caixas e Iluminação',
        'Entrega Própria',
        'Transferência',
        '',
        'Ativo',
        NOW(),
        NOW()
    ),
    (
        5,
        'Mega Eventos',
        '55.555.555/0001-55',
        'Pedro Augusto',
        'Diversos',
        '(14)99999-1005',
        '(14)99999-1005',
        'contato@megaeventos.com',
        'www.megaeventos.com.br',
        'Av. Tamoios',
        '900',
        'Centro',
        'Tupã',
        'SP',
        '17600-340',
        'Diversos',
        'Entrega Própria',
        'PIX',
        '',
        'Ativo',
        NOW(),
        NOW()
    );

/* ==========================================================
   PRODUTOS
========================================================== */

INSERT INTO produtos (
    id,
    nome,
    tipo,
    estoque,
    preco_venda,
    preco_aluguel,
    codigo,
    categoria,
    fornecedor_id,
    imagem,
    localizacao,
    estoque_reservado,
    estoque_manutencao,
    estoque_danificado,
    ativo
)
VALUES
    (1, 'Mesa Plástica Branca', 'Mesa', 50, 90, 15, 'MES001', 'Mesas', 1, NULL, 'A1', 0, 0, 0, 1),
    (2, 'Mesa Redonda', 'Mesa', 20, 150, 25, 'MES002', 'Mesas', 1, NULL, 'A1', 0, 0, 0, 1),
    (3, 'Mesa Infantil', 'Mesa', 15, 120, 20, 'MES003', 'Mesas', 1, NULL, 'A1', 0, 0, 0, 1),
    (4, 'Cadeira Branca', 'Cadeira', 200, 35, 5, 'CAD001', 'Cadeiras', 1, NULL, 'A2', 0, 0, 0, 1),
    (5, 'Cadeira Tiffany', 'Cadeira', 80, 90, 18, 'CAD002', 'Cadeiras', 1, NULL, 'A2', 0, 0, 0, 1),
    (6, 'Banqueta', 'Cadeira', 30, 120, 25, 'CAD003', 'Cadeiras', 1, NULL, 'A2', 0, 0, 0, 1),
    (7, 'Toalha Branca', 'Toalha', 60, 40, 8, 'TOA001', 'Toalhas', 2, NULL, 'B1', 0, 0, 0, 1),
    (8, 'Toalha Preta', 'Toalha', 50, 45, 8, 'TOA002', 'Toalhas', 2, NULL, 'B1', 0, 0, 0, 1),
    (9, 'Toalha Vermelha', 'Toalha', 40, 45, 8, 'TOA003', 'Toalhas', 2, NULL, 'B1', 0, 0, 0, 1),
    (10, 'Painel Luxo', 'Painel', 8, 450, 120, 'DEC001', 'Decoração', 2, NULL, 'B2', 0, 0, 0, 1),
    (11, 'Arco Desconstruído', 'Painel', 10, 350, 80, 'DEC002', 'Decoração', 2, NULL, 'B2', 0, 0, 0, 1),
    (12, 'Tapete Vermelho', 'Decoração', 10, 200, 40, 'DEC003', 'Decoração', 2, NULL, 'B2', 0, 0, 0, 1),
    (13, 'Prato Branco', 'Louça', 300, 12, 2, 'LOU001', 'Louças', 3, NULL, 'C1', 0, 0, 0, 1),
    (14, 'Prato Fundo', 'Louça', 200, 15, 2.5, 'LOU002', 'Louças', 3, NULL, 'C1', 0, 0, 0, 1),
    (15, 'Taça Vidro', 'Louça', 180, 18, 3, 'LOU003', 'Louças', 3, NULL, 'C1', 0, 0, 0, 1),
    (16, 'Copo Long Drink', 'Louça', 250, 10, 2, 'LOU004', 'Louças', 3, NULL, 'C1', 0, 0, 0, 1),
    (17, 'Jarra Vidro', 'Louça', 40, 40, 8, 'LOU005', 'Louças', 3, NULL, 'C1', 0, 0, 0, 1),
    (18, 'Caixa de Som JBL', 'Som', 6, 1800, 180, 'SOM001', 'Som', 4, NULL, 'D1', 0, 0, 0, 1),
    (19, 'Microfone Sem Fio', 'Som', 10, 450, 50, 'SOM002', 'Som', 4, NULL, 'D1', 0, 0, 0, 1),
    (20, 'Mesa de Som', 'Som', 4, 1200, 120, 'SOM003', 'Som', 4, NULL, 'D1', 0, 0, 0, 1),
    (21, 'Refletor LED', 'Iluminação', 15, 180, 35, 'LUZ001', 'Iluminação', 4, NULL, 'D2', 0, 0, 0, 1),
    (22, 'Canhão de LED', 'Iluminação', 12, 350, 70, 'LUZ002', 'Iluminação', 4, NULL, 'D2', 0, 0, 0, 1),
    (23, 'Máquina de Fumaça', 'Iluminação', 5, 700, 120, 'LUZ003', 'Iluminação', 4, NULL, 'D2', 0, 0, 0, 1),
    (24, 'Pula Pula', 'Brinquedo', 3, 2500, 350, 'BRI001', 'Brinquedos', 5, NULL, 'E1', 0, 0, 0, 1),
    (25, 'Piscina de Bolinhas', 'Brinquedo', 2, 1800, 250, 'BRI002', 'Brinquedos', 5, NULL, 'E1', 0, 0, 0, 1);


/* ==========================================================
   MOVIMENTAÇÃO INICIAL DE ESTOQUE
========================================================== */

INSERT INTO movimentacao_estoque
(
    produto_id,
    tipo,
    quantidade,
    observacao
)
VALUES
    (1, 'ENTRADA', 50, 'Estoque inicial'),
    (2, 'ENTRADA', 20, 'Estoque inicial'),
    (3, 'ENTRADA', 15, 'Estoque inicial'),
    (4, 'ENTRADA', 200, 'Estoque inicial'),
    (5, 'ENTRADA', 80, 'Estoque inicial'),
    (6, 'ENTRADA', 30, 'Estoque inicial'),
    (7, 'ENTRADA', 60, 'Estoque inicial'),
    (8, 'ENTRADA', 50, 'Estoque inicial'),
    (9, 'ENTRADA', 40, 'Estoque inicial'),
    (10, 'ENTRADA', 8, 'Estoque inicial'),
    (11, 'ENTRADA', 10, 'Estoque inicial'),
    (12, 'ENTRADA', 10, 'Estoque inicial'),
    (13, 'ENTRADA', 300, 'Estoque inicial'),
    (14, 'ENTRADA', 200, 'Estoque inicial'),
    (15, 'ENTRADA', 180, 'Estoque inicial'),
    (16, 'ENTRADA', 250, 'Estoque inicial'),
    (17, 'ENTRADA', 40, 'Estoque inicial'),
    (18, 'ENTRADA', 6, 'Estoque inicial'),
    (19, 'ENTRADA', 10, 'Estoque inicial'),
    (20, 'ENTRADA', 4, 'Estoque inicial'),
    (21, 'ENTRADA', 15, 'Estoque inicial'),
    (22, 'ENTRADA', 12, 'Estoque inicial'),
    (23, 'ENTRADA', 5, 'Estoque inicial'),
    (24, 'ENTRADA', 3, 'Estoque inicial'),
    (25, 'ENTRADA', 2, 'Estoque inicial');


/* ==========================================================
   PEDIDOS
========================================================== */

INSERT INTO pedidos
(
    cliente_id,
    endereco_id,
    usuario_id,
    data_evento,
    data_entrega,
    data_retirada,
    telefone_contato,
    tipo_pedido,
    status,
    status_documento,
    valor_produtos,
    valor_frete,
    valor_desconto,
    valor_total,
    local_evento,
    motorista,
    veiculo,
    responsavel_entrega,
    responsavel_retirada,
    observacoes,
    conferencia_finalizada
)
VALUES
(
    1,
    1,
    1,
    '2026-08-10',
    '2026-08-09',
    '2026-08-11',
    '14999990001',
    'ALUGUEL',
    'CONFIRMADO',
    'PEDIDO',
    300.00,
    30.00,
    0.00,
    330.00,
    'Salão Primavera',
    'Carlos',
    'Fiorino',
    'Carlos',
    'João',
    'Aniversário',
    0
),

(
    2,
    2,
    2,
    '2026-08-15',
    '2026-08-14',
    '2026-08-16',
    '14999990002',
    'ALUGUEL',
    'ENTREGUE',
    'PEDIDO',
    600.00,
    40.00,
    20.00,
    620.00,
    'Chácara Verde',
    'Paulo',
    'HR',
    'Paulo',
    'Marcos',
    'Casamento',
    0
),

(
    3,
    3,
    1,
    '2026-08-20',
    '2026-08-19',
    '2026-08-21',
    '14999990003',
    'VENDA',
    'FINALIZADO',
    'PEDIDO',
    150.00,
    0.00,
    0.00,
    150.00,
    'Loja',
    NULL,
    NULL,
    NULL,
    NULL,
    'Venda balcão',
    1
);


/* ==========================================================
   ITENS DOS PEDIDOS
========================================================== */

INSERT INTO pedido_itens
(
    pedido_id,
    produto_id,
    quantidade,
    valor_unitario,
    subtotal,
    quantidade_entregue,
    quantidade_devolvida
)
VALUES
    (1, 1, 50, 2.50, 125.00, 50, 0),
    (1, 2, 50, 3.50, 175.00, 50, 0),
    (2, 3, 20, 20.00, 400.00, 20, 0),
    (2, 4, 10, 20.00, 200.00, 10, 0),
    (3, 5, 30, 5.00, 150.00, 30, 30);


/* ==========================================================
   PAGAMENTOS
========================================================== */

INSERT INTO pagamentos
(
    pedido_id,
    usuario_id,
    valor,
    forma_pagamento,
    observacao
)
VALUES
    (1, 1, 100.00, 'PIX', 'Entrada'),
    (1, 1, 230.00, 'DINHEIRO', 'Quitação'),
    (2, 2, 620.00, 'TRANSFERENCIA', 'Pagamento integral'),
    (3, 1, 150.00, 'CARTAO_CREDITO', 'Venda balcão');


/* ==========================================================
   DEVOLUÇÕES
========================================================== */

INSERT INTO devolucoes
(
    pedido_id,
    usuario_id,
    data_devolucao,
    valor_multa,
    observacao
)
VALUES
    (2, 2, NOW(), 0.00, 'Devolução completa');


/* ==========================================================
   ITENS DEVOLVIDOS
========================================================== */

INSERT INTO devolucao_itens
(
    devolucao_id,
    produto_id,
    quantidade_recebida,
    quantidade_faltando,
    quantidade_danificada,
    valor_cobranca,
    observacao
)
VALUES
    (1, 3, 20, 0, 0, 0.00, 'Tudo correto'),
    (1, 4, 10, 0, 0, 0.00, 'Tudo correto');


/* ==========================================================
   OCORRÊNCIAS
========================================================== */

INSERT INTO ocorrencias
(
    pedido_id,
    usuario_id,
    tipo,
    descricao,
    valor,
    status
)
VALUES
(
    2,
    2,
    'Cobrança',
    'Cliente solicitou hora extra.',
    50.00,
    'EM_ANDAMENTO'
);


/* ==========================================================
   MOVIMENTAÇÃO DE ESTOQUE
========================================================== */

INSERT INTO movimentacao_estoque
(
    produto_id,
    pedido_id,
    tipo,
    quantidade,
    observacao
)
VALUES
    (1, 1, 'SAIDA', 50, 'Entrega Pedido 1'),
    (2, 1, 'SAIDA', 50, 'Entrega Pedido 1'),
    (3, 2, 'SAIDA', 20, 'Entrega Pedido 2'),
    (4, 2, 'SAIDA', 10, 'Entrega Pedido 2'),
    (3, 2, 'RETORNO', 20, 'Retorno Pedido 2'),
    (4, 2, 'RETORNO', 10, 'Retorno Pedido 2'),
    (5, 3, 'VENDA', 30, 'Venda definitiva');


/* ==========================================================
   AUTO_INCREMENT
========================================================== */

ALTER TABLE usuario AUTO_INCREMENT = 5;
ALTER TABLE endereco AUTO_INCREMENT = 11;
ALTER TABLE cliente AUTO_INCREMENT = 11;
ALTER TABLE fornecedores AUTO_INCREMENT = 6;
ALTER TABLE produtos AUTO_INCREMENT = 26;
ALTER TABLE pedidos AUTO_INCREMENT = 4;
ALTER TABLE pagamentos AUTO_INCREMENT = 5;
ALTER TABLE devolucoes AUTO_INCREMENT = 2;
ALTER TABLE devolucao_itens AUTO_INCREMENT = 3;
ALTER TABLE ocorrencias AUTO_INCREMENT = 2;
ALTER TABLE movimentacao_estoque AUTO_INCREMENT = 33;
ALTER TABLE user_permissions AUTO_INCREMENT = 5;


SET FOREIGN_KEY_CHECKS = 1;