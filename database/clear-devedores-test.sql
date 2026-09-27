START TRANSACTION;

DELETE FROM pagamentos
WHERE pedido_id IN (
  SELECT id FROM (
    SELECT id FROM pedidos WHERE observacoes LIKE 'TESTE DEVEDORES - %'
  ) AS test_orders
);

DELETE FROM ocorrencias
WHERE pedido_id IN (
  SELECT id FROM (
    SELECT id FROM pedidos WHERE observacoes LIKE 'TESTE DEVEDORES - %'
  ) AS test_orders
);

DELETE FROM devolucoes
WHERE pedido_id IN (
  SELECT id FROM (
    SELECT id FROM pedidos WHERE observacoes LIKE 'TESTE DEVEDORES - %'
  ) AS test_orders
);

DELETE FROM reservas_estoque
WHERE pedido_id IN (
  SELECT id FROM (
    SELECT id FROM pedidos WHERE observacoes LIKE 'TESTE DEVEDORES - %'
  ) AS test_orders
);

DELETE FROM movimentacao_estoque
WHERE pedido_id IN (
  SELECT id FROM (
    SELECT id FROM pedidos WHERE observacoes LIKE 'TESTE DEVEDORES - %'
  ) AS test_orders
);

DELETE FROM estoque_historico
WHERE pedido_id IN (
  SELECT id FROM (
    SELECT id FROM pedidos WHERE observacoes LIKE 'TESTE DEVEDORES - %'
  ) AS test_orders
);

DELETE FROM pedido_itens
WHERE pedido_id IN (
  SELECT id FROM (
    SELECT id FROM pedidos WHERE observacoes LIKE 'TESTE DEVEDORES - %'
  ) AS test_orders
);

DELETE FROM pedidos
WHERE observacoes LIKE 'TESTE DEVEDORES - %';

DELETE FROM cliente
WHERE nome LIKE 'CLIENTE TESTE - %';

DELETE FROM endereco
WHERE rua LIKE 'Rua TESTE DEVEDORES - %';

DELETE FROM produtos
WHERE nome LIKE 'PRODUTO TESTE - Devedores%';

COMMIT;
