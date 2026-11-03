import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import db from '../database/connection.js';
import {
  alterarControleEstoqueProduto,
  calcularDisponibilidadeCombo,
  calcularDisponibilidade,
  controlaEstoque,
  registrarEntrada,
  reservarItensPedido,
  registrarVendaNaTransacao,
  resumoEstoque,
  statusEstoque,
  validarDisponibilidade
} from '../src/modules/estoque/estoque.service.js';
import { atualizarStatus, findAll } from '../src/modules/produtos/produtos.model.js';

const originalQuery = db.query;
const originalConnect = db.connect;

function fakeClient({ product, activeReservations = 0, pendingOrders = 0 }) {
  const statements = [];
  return {
    statements,
    release() {},
    async query(sql, params = []) {
      statements.push({ sql, params });
      if (sql.includes('SELECT * FROM produtos')) return { rows: [product], rowCount: 1 };
      if (sql.includes('SELECT COALESCE(SUM(quantidade), 0)')) {
        return { rows: [{ quantidade: activeReservations }], rowCount: 1 };
      }
      if (sql.includes('FROM pedido_itens i')) {
        return { rows: [{ quantidade: pendingOrders }], rowCount: 1 };
      }
      if (sql.includes('SELECT controla_estoque FROM produtos')) {
        return { rows: [{ controla_estoque: true }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    }
  };
}

try {
  const produtoSemControle = {
    controla_estoque: false,
    estoque: 18,
    estoque_reservado: 0,
    estoque_em_uso: 0,
    estoque_manutencao: 0,
    estoque_danificado: 0
  };
  assert.equal(controlaEstoque(produtoSemControle), false);
  assert.equal(calcularDisponibilidade(produtoSemControle), null);
  assert.equal(validarDisponibilidade(produtoSemControle), true);
  assert.equal(statusEstoque(produtoSemControle), 'NAO_CONTROLADO');

  const venda = fakeClient({ product: produtoSemControle });
  await registrarVendaNaTransacao(venda, { produtoId: 1, quantidade: 2 });
  assert.equal(venda.statements.some(({ sql }) => /UPDATE produtos|INSERT INTO (movimentacao_estoque|estoque_historico)/.test(sql)), false);

  const reserva = fakeClient({ product: produtoSemControle });
  await reservarItensPedido({
    conn: reserva,
    itens: [{ produto_id: 1, quantidade: 2 }],
    pedidoId: 10
  });
  assert.equal(reserva.statements.some(({ sql }) => /UPDATE produtos|INSERT INTO (reservas_estoque|movimentacao_estoque|estoque_historico)/.test(sql)), false);

  db.query = async () => ({
    rows: [{
      produto_id: 1,
      controla_estoque: false,
      estoque: 0,
      estoque_reservado: 0,
      estoque_em_uso: 0,
      estoque_manutencao: 0,
      estoque_danificado: 0,
      quantidade: 2,
      produto_nome: 'Sem controle'
    }],
    rowCount: 1
  });
  assert.equal((await calcularDisponibilidadeCombo(4)).disponivel, null);

  const entrada = fakeClient({ product: produtoSemControle });
  db.connect = async () => entrada;
  await assert.rejects(registrarEntrada({ produtoId: 1, quantidade: 2 }), /controle de estoque está desativado/);
  assert.equal(entrada.statements.some(({ sql }) => sql.includes('INSERT INTO movimentacao_estoque')), false);

  const pendente = fakeClient({
    product: { ...produtoSemControle, controla_estoque: true, estoque: 8, estoque_reservado: 2 },
    activeReservations: 2
  });
  db.connect = async () => pendente;
  await assert.rejects(
    alterarControleEstoqueProduto({ produtoId: 1, controlaEstoque: false }),
    /reservas ou operações pendentes/
  );
  assert.equal(pendente.statements.some(({ sql }) => /SET controla_estoque = FALSE/.test(sql)), false);

  const pedidoPendente = fakeClient({
    product: { ...produtoSemControle, controla_estoque: true, estoque: 8 },
    pendingOrders: 1
  });
  db.connect = async () => pedidoPendente;
  await assert.rejects(
    alterarControleEstoqueProduto({ produtoId: 1, controlaEstoque: false }),
    /reservas ou operações pendentes/
  );

  const reativar = fakeClient({
    product: { ...produtoSemControle, id: 1, controla_estoque: false, estoque: 4 },
    activeReservations: 0
  });
  db.connect = async () => reativar;
  await alterarControleEstoqueProduto({
    produtoId: 1,
    controlaEstoque: true,
    estoqueInicial: 9,
    usuarioId: 3
  });
  const ativacao = reativar.statements.find(({ sql }) => sql.includes('SET controla_estoque = TRUE'));
  assert.deepEqual(ativacao.params, [9, 1]);
  assert.equal(
    reativar.statements.filter(({ sql }) => sql.includes('INSERT INTO movimentacao_estoque') || sql.includes('INSERT INTO estoque_historico')).length,
    2
  );
  assert.ok(reativar.statements.some(({ sql, params }) => sql.includes('INSERT INTO movimentacao_estoque') && params[3] === 'ENTRADA' && params[4] === 9));

  const desativar = fakeClient({
    product: { ...produtoSemControle, id: 1, controla_estoque: true, estoque: 12 },
    activeReservations: 0
  });
  db.connect = async () => desativar;
  await alterarControleEstoqueProduto({ produtoId: 1, controlaEstoque: false });
  const desativacao = desativar.statements.find(({ sql }) => sql.includes('SET controla_estoque = FALSE'));
  assert.match(desativacao.sql, /SET controla_estoque = FALSE/);
  assert.doesNotMatch(desativacao.sql, /SET\s+estoque\s*=/i);
  assert.equal(desativar.statements.some(({ sql }) => sql.includes('INSERT INTO movimentacao_estoque')), false);

  const listQueries = [];
  db.query = async (sql, params = []) => {
    listQueries.push({ sql, params });
    return { rows: [], rowCount: 0 };
  };
  await findAll({ status: 'NAO_CONTROLADO', disponivelMinimo: '1' });
  assert.match(listQueries[0].sql, /controla_estoque/);
  assert.match(listQueries[0].sql, /THEN 'NAO_CONTROLADO'/);
  assert.match(listQueries[0].sql, /ELSE NULL END/);
  await atualizarStatus(1, false);
  assert.deepEqual(listQueries[1].params, [0, 1]);
  assert.match(listQueries[1].sql, /UPDATE produtos SET ativo = \$1/);
  await resumoEstoque();
  assert.match(listQueries[2].sql, /COUNT\(\*\) FILTER \(WHERE ativo = 1\) AS produtos_ativos/);
  assert.match(listQueries[2].sql, /COUNT\(\*\) FILTER \(WHERE ativo = 0\) AS produtos_inativos/);
  assert.match(listQueries[2].sql, /FILTER \(WHERE ativo = 1 AND controla_estoque\)/);

  const schema = await readFile(new URL('../database/schema.postgresql.sql', import.meta.url), 'utf8');
  const migration = await readFile(new URL('../database/migrations/postgresql/002_product_stock_tracking.sql', import.meta.url), 'utf8');
  const productsPage = await readFile(new URL('../views/pages/produtos/index.handlebars', import.meta.url), 'utf8');
  const productsScript = await readFile(new URL('../public/js/produtos-controle.js', import.meta.url), 'utf8');
  const historyStyle = await readFile(new URL('../public/css/pages/historico-movimentacoes.css', import.meta.url), 'utf8');
  assert.match(schema, /controla_estoque boolean NOT NULL DEFAULT TRUE/);
  assert.match(migration, /ALTER TABLE public\.produtos[\s\S]*ADD COLUMN IF NOT EXISTS controla_estoque boolean NOT NULL DEFAULT TRUE/);
  assert.match(productsPage, /name="controla_estoque"/);
  assert.match(productsScript, /data-stock-edit/);
  assert.match(productsScript, /FestAlert\?\.confirm/);
  assert.doesNotMatch(productsScript, /data-product-status|\/status/);
  assert.match(productsScript, /Confirma \$\{acao\} este produto/);
  assert.match(productsPage, /name="ativo" id="produto-ativo"/);
  assert.match(productsPage, /data-product-list-menu/);
  assert.match(productsPage, /data-product-list-delete/);
  assert.match(productsScript, /quantidade inicial de estoque/);
  assert.match(productsScript, /kpi-ativos/);
  assert.doesNotMatch(productsPage, /id="kpi-disponivel"/);
  assert.match(historyStyle, /grid-template-columns: minmax\(180px/);
  console.log('Testes de controle de estoque opcional, movimentos e histórico responsivo ok');
} finally {
  db.query = originalQuery;
  db.connect = originalConnect;
  await db.end();
}
