import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import db from "../database/connection.js";

const originalGetConnection = db.getConnection;

function createConnection({ pedidoItem, componentes = [] }) {
  let quantidadeDevolvida = Number(pedidoItem.quantidade_devolvida || 0);
  const inventoryUpdates = [];
  const movementRecords = [];
  const returnRecords = [];
  const orderStatusUpdates = [];
  const devolucoes = [];
  let rolledBack = false;
  let committed = false;

  return {
    inventoryUpdates,
    movementRecords,
    returnRecords,
    orderStatusUpdates,
    get rolledBack() {
      return rolledBack;
    },
    get committed() {
      return committed;
    },
    async beginTransaction() {},
    async commit() {
      committed = true;
    },
    async rollback() {
      rolledBack = true;
    },
    release() {},
    async query(sql, params = []) {
      if (sql.includes("SELECT id, status, status_documento FROM pedidos")) {
        return [[{ id: 1, status: "ENTREGUE", status_documento: "PEDIDO" }]];
      }
      if (sql.includes("SELECT id, hash_requisicao FROM devolucoes")) {
        const devolucao = devolucoes.find((entry) => entry.chave === params[1]);
        return [devolucao ? [{ id: devolucao.id, hash_requisicao: devolucao.hash }] : []];
      }
      if (sql.includes("INSERT INTO devolucoes")) {
        devolucoes.push({ id: 50 + devolucoes.length, chave: params[3], hash: params[4] });
        return [{ insertId: devolucoes.at(-1).id }];
      }
      if (sql.includes("SELECT id, pedido_id, produto_id, combo_id, tipo_item")) {
        return [[{ ...pedidoItem, quantidade_devolvida: quantidadeDevolvida }]];
      }
      if (sql.includes("SELECT produto_id, quantidade_por_unidade, quantidade_total")) {
        return [componentes.map((componente) => ({ ...componente }))];
      }
      if (sql.includes("SELECT produto_id, quantidade_por_unidade") &&
          sql.includes("pedido_item_componentes")) {
        return [componentes.map(({ produto_id, quantidade_por_unidade }) => ({
          produto_id,
          quantidade_por_unidade
        }))];
      }
      if (sql.includes("SELECT * FROM produtos WHERE id = ?")) {
        return [[{ id: params[0], estoque_em_uso: 10 }]];
      }
      if (sql.includes("UPDATE produtos") && sql.includes("estoque_em_uso = estoque_em_uso - ?")) {
        inventoryUpdates.push({ sql, params: [...params] });
        return [{ affectedRows: 1 }];
      }
      if (sql.includes("INSERT INTO movimentacao_estoque") ||
          sql.includes("INSERT INTO estoque_historico")) {
        movementRecords.push({ sql, params: [...params] });
        return [{ affectedRows: 1 }];
      }
      if (sql.includes("UPDATE pedido_itens SET quantidade_devolvida")) {
        quantidadeDevolvida += Number(params[0]);
        return [{ affectedRows: 1 }];
      }
      if (sql.includes("UPDATE pedidos") && sql.includes("status")) {
        orderStatusUpdates.push({ sql, params: [...params] });
        return [{ affectedRows: 1 }];
      }
      if (sql.includes("INSERT INTO devolucao_itens")) {
        returnRecords.push([...params]);
        return [{ affectedRows: 1 }];
      }
      if (sql.includes("INSERT INTO ocorrencias")) {
        return [{ affectedRows: 1 }];
      }
      if (sql.includes("SELECT") && sql.includes("AS qtd_total") && sql.includes("FROM pedido_itens")) {
        return [[{
          qtd_total: Number(pedidoItem.quantidade),
          qtd_devolvida: quantidadeDevolvida
        }]];
      }
      throw new Error(`Unexpected test SQL: ${sql}`);
    }
  };
}

const { registrarDevolucao } = await import("../src/modules/entregas/entregas.model.js");
let requestSequence = 0;
const enviarDevolucao = (pedidoId, dados, chave = `test-return-${++requestSequence}`) =>
  registrarDevolucao(pedidoId, { ...dados, idempotency_key: chave });

try {
  const rentalItem = {
    id: 7,
    pedido_id: 1,
    produto_id: 22,
    combo_id: null,
    tipo_item: "ALUGUEL",
    quantidade: 3,
    quantidade_entregue: 3,
    quantidade_devolvida: 0
  };
  const rentalConnection = createConnection({ pedidoItem: rentalItem });
  db.getConnection = async () => rentalConnection;

  await enviarDevolucao(1, {
    itens: [{ id: 7, quantidade_boa: 1 }],
    usuario_id: 4
  });
  assert.equal(rentalConnection.committed, true, "Aluguel deve concluir a transação");
  assert.equal(rentalConnection.inventoryUpdates.length, 1, "Aluguel deve atualizar estoque em uso");
  assert.equal(Number(rentalConnection.inventoryUpdates[0].params[0]), 1);
  assert.match(rentalConnection.inventoryUpdates[0].sql, /estoque_em_uso = estoque_em_uso -/);
  assert.doesNotMatch(rentalConnection.inventoryUpdates[0].sql, /estoque = estoque \+/);
  assert.equal(rentalConnection.movementRecords.length, 2, "Aluguel deve registrar movimentos e histórico");

  const missingItem = { ...rentalItem, id: 10, quantidade: 3, quantidade_entregue: 3 };
  const missingConnection = createConnection({ pedidoItem: missingItem });
  db.getConnection = async () => missingConnection;
  await enviarDevolucao(1, {
    itens: [{ id: 10, quantidade_boa: 1, quantidade_faltando: 2 }],
    usuario_id: 4
  });
  assert.equal(missingConnection.inventoryUpdates.length, 1, "Somente a unidade recebida pode alterar o estoque");
  assert.equal(Number(missingConnection.inventoryUpdates[0].params[0]), 1);
  assert.equal(missingConnection.returnRecords[0][2], 1, "O histórico deve contar somente unidades recebidas");
  assert.equal(missingConnection.returnRecords[0][3], 2, "As unidades faltantes devem permanecer registradas");
  assert.match(missingConnection.orderStatusUpdates[0].sql, /status = 'PENDENTE'/, "A devolução parcial deve manter o pedido pendente");

  const missingOnlyConnection = createConnection({ pedidoItem: missingItem });
  db.getConnection = async () => missingOnlyConnection;
  await enviarDevolucao(1, {
    itens: [{ id: 10, quantidade_faltando: 3 }],
    usuario_id: 4
  });
  assert.equal(missingOnlyConnection.inventoryUpdates.length, 0, "Item faltante não pode reduzir o estoque em uso");
  assert.equal(missingOnlyConnection.movementRecords.length, 0, "Item faltante não gera movimento de retorno ou perda");
  assert.equal(missingOnlyConnection.returnRecords[0][2], 0);
  assert.equal(missingOnlyConnection.returnRecords[0][3], 3);

  const duplicateConnection = createConnection({ pedidoItem: missingItem });
  db.getConnection = async () => duplicateConnection;
  const requisicaoDuplicada = { itens: [{ id: 10, quantidade_boa: 1, quantidade_faltando: 2 }] };
  await enviarDevolucao(1, requisicaoDuplicada, "repeated-partial-return");
  const repetida = await enviarDevolucao(1, requisicaoDuplicada, "repeated-partial-return");
  assert.equal(repetida.duplicate, true, "Uma repetição idêntica deve ser idempotente");
  await assert.rejects(
    enviarDevolucao(1, { itens: [{ id: 10, quantidade_boa: 2 }] }, "repeated-partial-return"),
    /já foi utilizado com outros dados/
  );
  assert.equal(duplicateConnection.inventoryUpdates.length, 1, "A mesma devolução integral não pode ser processada duas vezes");

  const comboItem = {
    ...rentalItem,
    id: 8,
    produto_id: null,
    combo_id: 5,
    quantidade: 2,
    quantidade_entregue: 2
  };
  const comboConnection = createConnection({
    pedidoItem: comboItem,
    componentes: [{
      produto_id: 31,
      quantidade_por_unidade: 2,
      quantidade_total: 4
    }]
  });
  db.getConnection = async () => comboConnection;
  await enviarDevolucao(1, { itens: [{ id: 8, quantidade_boa: 1 }] });
  assert.equal(comboConnection.inventoryUpdates.length, 1, "Combo alugado deve devolver seus componentes");
  assert.equal(Number(comboConnection.inventoryUpdates[0].params[0]), 2, "Deve aplicar o fator do componente");

  const saleItem = { ...rentalItem, id: 9, tipo_item: "VENDA" };
  const saleConnection = createConnection({ pedidoItem: saleItem });
  db.getConnection = async () => saleConnection;
  await assert.rejects(
    enviarDevolucao(1, { itens: [{ id: 9, quantidade_boa: 1 }] }),
    /Itens de venda não podem ser registrados como devolução de estoque alugado/
  );
  assert.equal(saleConnection.inventoryUpdates.length, 0, "Venda não deve atualizar estoque de aluguel");
  assert.equal(saleConnection.rolledBack, true, "A tentativa de devolver venda deve ser revertida");

  const source = await readFile(new URL("../public/js/entregas.js", import.meta.url), "utf8");
  let resolveFetch;
  let fetchCount = 0;
  const returnInput = { dataset: { index: "0" }, value: "1" };
  const confirmButton = { disabled: false };
  let lastFetchOptions;
  const elements = {
    "return-responsavel": { value: "Responsável" },
    "return-observacao": { value: "" },
    "return-confirm-btn": confirmButton,
    "m-timeline": { innerHTML: "" }
  };
  const browser = {
    console: { error() {}, log() {} },
    document: {
      getElementById(id) {
        return elements[id] || null;
      },
      querySelectorAll() {
        return [returnInput];
      }
    },
    window: {
      addEventListener() {},
      FestAlert: {
        async warning() {},
        async error() {}
      }
    },
    crypto: {
      randomUUID() {
        return "browser-return-key";
      }
    },
    fetch(_url, options) {
      fetchCount += 1;
      lastFetchOptions = options;
      return new Promise((resolve) => {
        resolveFetch = resolve;
      });
    }
  };
  vm.runInNewContext(source, browser);

  const returnable = vm.runInContext(`buildReturnItems([
    { id: 1, tipo_item: "ALUGUEL", produto_id: 22, quantidade: 2 },
    { id: 2, tipo_item: "VENDA", produto_id: 23, quantidade: 1 },
    { id: 3, tipo_item: "ALUGUEL", combo_id: 5, combo_nome: "Combo", quantidade: 1 },
    { id: 4, tipo_item: "VENDA", combo_id: 6, combo_nome: "Combo vendido", quantidade: 1 }
  ])`, browser);
  assert.deepEqual(
    JSON.parse(JSON.stringify(returnable.map((item) => item.item_id))),
    [1, 3],
    "A modal deve incluir apenas itens alugados, inclusive combos alugados"
  );

  vm.runInContext(`renderTimeline({
    status: "ENTREGUE",
    valor_total: 100,
    valor_creditado: 60,
    itens: [
      { tipo_item: "ALUGUEL", quantidade: 2, quantidade_devolvida: 1 },
      { tipo_item: "VENDA", quantidade: 5, quantidade_devolvida: 0 }
    ],
    pagamentos: [],
    devolucoes: [{}]
  })`, browser);
  assert.match(elements["m-timeline"].innerHTML, /1 item ainda não foi devolvido/);
  vm.runInContext(`renderTimeline({
    status: "ENTREGUE",
    valor_total: 100,
    valor_creditado: 100,
    itens: [{ tipo_item: "VENDA", quantidade: 5, quantidade_devolvida: 0 }],
    pagamentos: [],
    devolucoes: []
  })`, browser);
  assert.match(elements["m-timeline"].innerHTML, /Este pedido não contém itens alugados/);

  vm.runInContext(`currentOrderContext = { id: 1 }; currentReturnItems = [{
    item_id: 7, produto_id: 22, combo_id: null, quantidade: 1
  }];`, browser);
  const firstSubmission = browser.window.submitReturn();
  const secondSubmission = browser.window.submitReturn();
  assert.equal(fetchCount, 1, "Cliques concorrentes devem gerar somente uma requisição");
  const submittedReturn = JSON.parse(lastFetchOptions.body);
  assert.equal(submittedReturn.idempotency_key, "browser-return-key");
  assert.equal(submittedReturn.itens[0].quantidade_boa, 1);
  assert.equal(submittedReturn.itens[0].quantidade_faltando, 0);
  assert.equal(confirmButton.disabled, true, "O botão deve ficar bloqueado durante o envio");
  resolveFetch({
    ok: false,
    async json() {
      return { message: "Falha simulada" };
    }
  });
  await Promise.all([firstSubmission, secondSubmission]);
  assert.equal(confirmButton.disabled, false, "O botão deve ser liberado após a resposta");

  console.log("Testes simulados de devolução de aluguel, venda, combo e envio único ok");
} finally {
  db.getConnection = originalGetConnection;
  await db.end();
}
