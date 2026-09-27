-- Dados ficticios para testar a pagina Clientes Devedores.
-- Este arquivo remove e recria somente registros identificados como TESTE DEVEDORES.

START TRANSACTION;

DELETE FROM pagamentos WHERE pedido_id IN (SELECT id FROM (SELECT id FROM pedidos WHERE observacoes LIKE 'TESTE DEVEDORES - %') AS x);
DELETE FROM ocorrencias WHERE pedido_id IN (SELECT id FROM (SELECT id FROM pedidos WHERE observacoes LIKE 'TESTE DEVEDORES - %') AS x);
DELETE FROM devolucoes WHERE pedido_id IN (SELECT id FROM (SELECT id FROM pedidos WHERE observacoes LIKE 'TESTE DEVEDORES - %') AS x);
DELETE FROM reservas_estoque WHERE pedido_id IN (SELECT id FROM (SELECT id FROM pedidos WHERE observacoes LIKE 'TESTE DEVEDORES - %') AS x);
DELETE FROM movimentacao_estoque WHERE pedido_id IN (SELECT id FROM (SELECT id FROM pedidos WHERE observacoes LIKE 'TESTE DEVEDORES - %') AS x);
DELETE FROM estoque_historico WHERE pedido_id IN (SELECT id FROM (SELECT id FROM pedidos WHERE observacoes LIKE 'TESTE DEVEDORES - %') AS x);
DELETE FROM pedido_itens WHERE pedido_id IN (SELECT id FROM (SELECT id FROM pedidos WHERE observacoes LIKE 'TESTE DEVEDORES - %') AS x);
DELETE FROM pedidos WHERE observacoes LIKE 'TESTE DEVEDORES - %';
DELETE FROM cliente WHERE nome LIKE 'CLIENTE TESTE - %';
DELETE FROM endereco WHERE rua LIKE 'Rua TESTE DEVEDORES - %';
DELETE FROM produtos WHERE nome LIKE 'PRODUTO TESTE - Devedores%';

INSERT INTO endereco (rua, numero, bairro, cidade, estado, cep) VALUES
  ('Rua TESTE DEVEDORES - 01', '101', 'Bairro Teste', 'Cidade Teste', 'SP', '00000-101'),
  ('Rua TESTE DEVEDORES - 02', '102', 'Bairro Teste', 'Cidade Teste', 'SP', '00000-102'),
  ('Rua TESTE DEVEDORES - 03', '103', 'Bairro Teste', 'Cidade Teste', 'SP', '00000-103'),
  ('Rua TESTE DEVEDORES - 04', '104', 'Bairro Teste', 'Cidade Teste', 'SP', '00000-104'),
  ('Rua TESTE DEVEDORES - 05', '105', 'Bairro Teste', 'Cidade Teste', 'SP', '00000-105'),
  ('Rua TESTE DEVEDORES - 06', '106', 'Bairro Teste', 'Cidade Teste', 'SP', '00000-106'),
  ('Rua TESTE DEVEDORES - 07', '107', 'Bairro Teste', 'Cidade Teste', 'SP', '00000-107'),
  ('Rua TESTE DEVEDORES - 08', '108', 'Bairro Teste', 'Cidade Teste', 'SP', '00000-108');

SET @e1 = (SELECT id FROM endereco WHERE rua = 'Rua TESTE DEVEDORES - 01' ORDER BY id DESC LIMIT 1);
SET @e2 = (SELECT id FROM endereco WHERE rua = 'Rua TESTE DEVEDORES - 02' ORDER BY id DESC LIMIT 1);
SET @e3 = (SELECT id FROM endereco WHERE rua = 'Rua TESTE DEVEDORES - 03' ORDER BY id DESC LIMIT 1);
SET @e4 = (SELECT id FROM endereco WHERE rua = 'Rua TESTE DEVEDORES - 04' ORDER BY id DESC LIMIT 1);
SET @e5 = (SELECT id FROM endereco WHERE rua = 'Rua TESTE DEVEDORES - 05' ORDER BY id DESC LIMIT 1);
SET @e6 = (SELECT id FROM endereco WHERE rua = 'Rua TESTE DEVEDORES - 06' ORDER BY id DESC LIMIT 1);
SET @e7 = (SELECT id FROM endereco WHERE rua = 'Rua TESTE DEVEDORES - 07' ORDER BY id DESC LIMIT 1);
SET @e8 = (SELECT id FROM endereco WHERE rua = 'Rua TESTE DEVEDORES - 08' ORDER BY id DESC LIMIT 1);

INSERT INTO cliente (nome, email, telefone, id_endereco, cpf, nascimento) VALUES
  ('CLIENTE TESTE - Joao Silva', 'teste.devedores.joao@example.test', '551499000001', @e1, 'TESTE-0001', '1990-01-01'),
  ('CLIENTE TESTE - Maria Santos', 'teste.devedores.maria@example.test', '551499000002', @e2, 'TESTE-0002', '1991-02-02'),
  ('CLIENTE TESTE - Carlos Oliveira', 'teste.devedores.carlos@example.test', '551499000003', @e3, 'TESTE-0003', '1992-03-03'),
  ('CLIENTE TESTE - Ana Souza', 'teste.devedores.ana@example.test', '551499000004', @e4, 'TESTE-0004', '1993-04-04'),
  ('CLIENTE TESTE - Empresa Eventos', 'teste.devedores.empresa@example.test', '551499000005', @e5, 'TESTE-0005', '1994-05-05'),
  ('CLIENTE TESTE - Pedro Costa', 'teste.devedores.pedro@example.test', '551499000006', @e6, 'TESTE-0006', '1995-06-06'),
  ('CLIENTE TESTE - Fernanda Lima', 'teste.devedores.fernanda@example.test', '551499000007', @e7, 'TESTE-0007', '1996-07-07'),
  ('CLIENTE TESTE - Marcos Almeida', 'teste.devedores.marcos@example.test', '551499000008', @e8, 'TESTE-0008', '1997-08-08');

SET @c1 = (SELECT id FROM cliente WHERE email = 'teste.devedores.joao@example.test');
SET @c2 = (SELECT id FROM cliente WHERE email = 'teste.devedores.maria@example.test');
SET @c3 = (SELECT id FROM cliente WHERE email = 'teste.devedores.carlos@example.test');
SET @c4 = (SELECT id FROM cliente WHERE email = 'teste.devedores.ana@example.test');
SET @c5 = (SELECT id FROM cliente WHERE email = 'teste.devedores.empresa@example.test');
SET @c6 = (SELECT id FROM cliente WHERE email = 'teste.devedores.pedro@example.test');
SET @c7 = (SELECT id FROM cliente WHERE email = 'teste.devedores.fernanda@example.test');
SET @c8 = (SELECT id FROM cliente WHERE email = 'teste.devedores.marcos@example.test');

INSERT INTO produtos (nome, tipo, tipo_produto, estoque, ativo) VALUES
  ('PRODUTO TESTE - Devedores', 'Item para seed financeiro', 'PRODUTO', 100, 1);
SET @produto = (SELECT id FROM produtos WHERE nome = 'PRODUTO TESTE - Devedores' ORDER BY id DESC LIMIT 1);

INSERT INTO pedidos (
  cliente_id, endereco_id, usuario_id, data_pedido, data_evento,
  telefone_contato, tipo_pedido, status, valor_produtos, valor_total,
  observacoes, status_documento
) VALUES
  (@c1, @e1, NULL, NOW(), DATE_ADD(CURDATE(), INTERVAL 7 DAY), '551499000001', 'ALUGUEL', 'CONFIRMADO', 1000.00, 1000.00, 'TESTE DEVEDORES - TOTALMENTE PAGO', 'PEDIDO'),
  (@c2, @e2, NULL, NOW(), DATE_ADD(CURDATE(), INTERVAL 14 DAY), '551499000002', 'ALUGUEL', 'CONFIRMADO', 1500.00, 1500.00, 'TESTE DEVEDORES - PARCIALMENTE PAGO', 'PEDIDO'),
  (@c3, @e3, NULL, NOW(), DATE_ADD(CURDATE(), INTERVAL 21 DAY), '551499000003', 'VENDA', 'CONFIRMADO', 2000.00, 2000.00, 'TESTE DEVEDORES - SEM PAGAMENTO', 'PEDIDO'),
  (@c4, @e4, NULL, NOW(), DATE_SUB(CURDATE(), INTERVAL 3 DAY), '551499000004', 'ALUGUEL', 'CONFIRMADO', 900.00, 900.00, 'TESTE DEVEDORES - ATRASO 3 DIAS', 'PEDIDO'),
  (@c5, @e5, NULL, NOW(), DATE_SUB(CURDATE(), INTERVAL 10 DAY), '551499000005', 'MISTO', 'CONFIRMADO', 1200.00, 1200.00, 'TESTE DEVEDORES - ATRASO 10 DIAS', 'PEDIDO'),
  (@c6, @e6, NULL, NOW(), DATE_SUB(CURDATE(), INTERVAL 30 DAY), '551499000006', 'ALUGUEL', 'CONFIRMADO', 1800.00, 1800.00, 'TESTE DEVEDORES - ATRASO 30 DIAS', 'PEDIDO'),
  (@c7, @e7, NULL, NOW(), DATE_SUB(CURDATE(), INTERVAL 60 DAY), '551499000007', 'ALUGUEL', 'CONFIRMADO', 2500.00, 2500.00, 'TESTE DEVEDORES - ATRASO 60 DIAS', 'PEDIDO'),
  (@c8, @e8, NULL, NOW(), DATE_ADD(CURDATE(), INTERVAL 5 DAY), '551499000008', 'ALUGUEL', 'CONFIRMADO', 1000.00, 1000.00, 'TESTE DEVEDORES - MULTIPLOS PEDIDOS A', 'PEDIDO'),
  (@c8, @e8, NULL, NOW(), DATE_SUB(CURDATE(), INTERVAL 20 DAY), '551499000008', 'ALUGUEL', 'CONFIRMADO', 2000.00, 2000.00, 'TESTE DEVEDORES - MULTIPLOS PEDIDOS B', 'PEDIDO');

SET @p1 = (SELECT id FROM pedidos WHERE observacoes = 'TESTE DEVEDORES - TOTALMENTE PAGO');
SET @p2 = (SELECT id FROM pedidos WHERE observacoes = 'TESTE DEVEDORES - PARCIALMENTE PAGO');
SET @p3 = (SELECT id FROM pedidos WHERE observacoes = 'TESTE DEVEDORES - SEM PAGAMENTO');
SET @p4 = (SELECT id FROM pedidos WHERE observacoes = 'TESTE DEVEDORES - ATRASO 3 DIAS');
SET @p5 = (SELECT id FROM pedidos WHERE observacoes = 'TESTE DEVEDORES - ATRASO 10 DIAS');
SET @p6 = (SELECT id FROM pedidos WHERE observacoes = 'TESTE DEVEDORES - ATRASO 30 DIAS');
SET @p7 = (SELECT id FROM pedidos WHERE observacoes = 'TESTE DEVEDORES - ATRASO 60 DIAS');
SET @p8 = (SELECT id FROM pedidos WHERE observacoes = 'TESTE DEVEDORES - MULTIPLOS PEDIDOS A');
SET @p9 = (SELECT id FROM pedidos WHERE observacoes = 'TESTE DEVEDORES - MULTIPLOS PEDIDOS B');

INSERT INTO pedido_itens (pedido_id, produto_id, tipo_item, quantidade, valor_unitario, subtotal) VALUES
  (@p1, @produto, 'ALUGUEL', 1, 1000.00, 1000.00),
  (@p2, @produto, 'ALUGUEL', 1, 1500.00, 1500.00),
  (@p3, @produto, 'VENDA', 1, 2000.00, 2000.00),
  (@p4, @produto, 'ALUGUEL', 1, 900.00, 900.00),
  (@p5, @produto, 'ALUGUEL', 1, 1200.00, 1200.00),
  (@p6, @produto, 'ALUGUEL', 1, 1800.00, 1800.00),
  (@p7, @produto, 'ALUGUEL', 1, 2500.00, 2500.00),
  (@p8, @produto, 'ALUGUEL', 1, 1000.00, 1000.00),
  (@p9, @produto, 'ALUGUEL', 1, 2000.00, 2000.00);

INSERT INTO pagamentos (pedido_id, usuario_id, valor, forma_pagamento, observacao) VALUES
  (@p1, NULL, 1000.00, 'PIX', 'TESTE DEVEDORES - pagamento total'),
  (@p2, NULL, 300.00, 'PIX', 'TESTE DEVEDORES - pagamento parcial 1'),
  (@p2, NULL, 200.00, 'TRANSFERENCIA', 'TESTE DEVEDORES - pagamento parcial 2'),
  (@p8, NULL, 200.00, 'PIX', 'TESTE DEVEDORES - multiplo A pagamento parcial'),
  (@p9, NULL, 1000.00, 'PIX', 'TESTE DEVEDORES - multiplo B pagamento parcial');

COMMIT;
