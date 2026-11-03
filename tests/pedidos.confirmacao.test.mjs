import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import db from "../database/connection.js";
import * as model from "../src/modules/pedidos/pedidos.model.js";

const originalConnect = db.connect;
const statements = [];

db.connect = async () => ({
  release() {},
  async query(sql, params = []) {
    statements.push({ sql, params });
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [], rowCount: null };
    if (sql.includes("SELECT id FROM endereco")) return { rows: [], rowCount: 0 };
    if (sql.includes("INSERT INTO endereco")) return { rows: [{ id: 8 }], rowCount: 1 };
    if (sql.includes("INSERT INTO pedidos")) return { rows: [{ id: 41 }], rowCount: 1 };
    if (sql.includes("INSERT INTO pedido_itens")) return { rows: [{ id: 63 }], rowCount: 1 };
    if (sql.includes("SELECT produto_id, quantidade FROM combo_itens")) {
      return { rows: [{ produto_id: 12, quantidade: 2 }], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  }
});

try {
  const result = await model.criarPedido({
    cliente_id: 5,
    usuario_id: 2,
    endereco: {
      rua: "Rua Teste",
      numero: "10",
      bairro: "Centro",
      cidade: "São Paulo",
      estado: "SP",
      cep: "01000-000",
      referencia: "Salão"
    },
    data_evento: "2027-01-20",
    data_entrega: "2027-01-19",
    data_retirada: "2027-01-21",
    local_evento: "Espaço Fest",
    observacao_entrega: "Entregar na entrada",
    observacao_retirada: "Retirar após o evento",
    telefone_contato: "11999999999",
    endereco_origem: "Rua de origem",
    tipo_pedido: "ALUGUEL",
    status: "ORCAMENTO",
    status_documento: "ORCAMENTO",
    distancia_km: 3,
    distancia_retorno_km: 3,
    distancia_cobrada_km: 6,
    frete_formula: "Teste",
    origem_lat: -23.5,
    origem_lon: -46.6,
    destino_lat: -23.6,
    destino_lon: -46.7,
    valor_produtos: 120,
    valor_frete: 15,
    valor_desconto: 5,
    valor_total: 130,
    valor_pago: 30,
    forma_pagamento: "PIX",
    observacao_pagamento: "Sinal",
    observacoes: "Observação do pedido",
    itens: [{
      produto_id: null,
      combo_id: 9,
      tipo_item: "ALUGUEL",
      quantidade: 2,
      preco_unitario: 60,
      subtotal: 120
    }]
  });

  assert.equal(result.pedidoId, 41);
  const insertPedido = statements.find(({ sql }) => sql.includes("INSERT INTO pedidos"));
  assert.doesNotMatch(insertPedido.sql, /data_entrega_hora|data_retirada_hora/);
  assert.match(insertPedido.sql, /local_evento/);
  assert.match(insertPedido.sql, /observacao_entrega/);
  assert.match(insertPedido.sql, /observacao_retirada/);
  assert.equal(insertPedido.params.length, 29);
  assert.equal(insertPedido.params[25], "Espaço Fest");

  const insertItem = statements.find(({ sql }) => sql.includes("INSERT INTO pedido_itens"));
  assert.deepEqual(insertItem.params.slice(0, 7), [41, null, "ALUGUEL", 9, 2, 60, 120]);
  const component = statements.find(({ sql }) => sql.includes("INSERT INTO pedido_item_componentes"));
  assert.deepEqual(component.params, [63, 41, 12, 2, 4]);
  const payment = statements.find(({ sql }) => sql.includes("INSERT INTO pagamentos"));
  assert.deepEqual(payment.params, [41, 2, 30, "PIX", "Sinal"]);
  assert.equal(statements.some(({ sql }) => sql.includes("INSERT INTO reservas_estoque")), false);
  assert.equal(statements.at(-1).sql, "COMMIT");

  statements.length = 0;
  db.connect = async () => ({
    release() {},
    async query(sql, params = []) {
      statements.push({ sql, params });
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [], rowCount: null };
      if (sql.includes("SELECT p.*, e.rua AS endereco_rua")) {
        return {
          rows: [{
            id: 41,
            status: "ORCAMENTO",
            status_documento: "ORCAMENTO",
            tipo_pedido: "ALUGUEL",
            data_evento: "2027-01-20",
            endereco_rua: "Rua Teste",
            endereco_numero: "10",
            endereco_bairro: "Centro",
            endereco_cidade: "São Paulo",
            endereco_estado: "SP",
            endereco_cep: "01000-000",
            endereco_referencia: "Salão",
            origem_lat: -23.5,
            origem_lon: -46.6,
            destino_lat: -23.6,
            destino_lon: -46.7,
            distancia_km: 3,
            distancia_retorno_km: 3,
            distancia_cobrada_km: 6,
            valor_frete: 15
          }],
          rowCount: 1
        };
      }
      if (sql.includes("SELECT id FROM cliente")) return { rows: [{ id: 5 }], rowCount: 1 };
      if (sql.includes("SELECT id FROM endereco WHERE rua")) return { rows: [], rowCount: 0 };
      if (sql.includes("INSERT INTO endereco")) return { rows: [{ id: 8 }], rowCount: 1 };
      if (sql.includes("SELECT id, ativo, preco_venda, preco_aluguel")) {
        return { rows: [{ id: 12, ativo: 1, preco_venda: 80, preco_aluguel: 60 }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO pedido_itens")) return { rows: [{ id: 64 }], rowCount: 1 };
      if (sql.includes("SELECT COALESCE(SUM(subtotal)")) {
        return { rows: [{ valor_produtos: 120 }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    }
  });

  const updated = await model.atualizarPedido(41, {
    cliente_id: 5,
    endereco: {
      rua: "Rua Teste",
      numero: "10",
      bairro: "Centro",
      cidade: "São Paulo",
      estado: "SP",
      cep: "01000-000",
      referencia: "Salão"
    },
    data_evento: "2027-01-20",
    data_entrega: "2027-01-19",
    data_retirada: "2027-01-21",
    local_evento: "Espaço Atualizado",
    observacao_entrega: "Nova instrução de entrega",
    observacao_retirada: "Nova instrução de retirada",
    observacoes: "Orçamento atualizado",
    itens: [{
      produto_id: 12,
      combo_id: null,
      tipo_item: "ALUGUEL",
      quantidade: 2
    }],
    valor_desconto: 5,
    valor_pago: 20,
    forma_pagamento: "PIX",
    observacao_pagamento: "Entrada",
    rota: {
      distanciaKm: 3,
      distanciaRetornoKm: 3,
      distanciaCobradaKm: 6,
      valorFrete: 15,
      origemLatitude: -23.5,
      origemLongitude: -46.6,
      destinoLatitude: -23.6,
      destinoLongitude: -46.7,
      formula: "Teste"
    }
  });
  assert.equal(updated.pedidoId, 41);
  const updateFields = statements.find(({ sql }) => sql.includes("UPDATE pedidos SET"));
  assert.doesNotMatch(updateFields.sql, /data_entrega_hora|data_retirada_hora/);
  assert.equal(updateFields.params[18], "Espaço Atualizado");
  assert.equal(updateFields.params[19], "Nova instrução de entrega");
  assert.equal(updateFields.params[20], "Nova instrução de retirada");
  const insertedPayment = statements.find(({ sql }) => sql.includes("INSERT INTO pagamentos"));
  assert.deepEqual(insertedPayment.params, [41, null, 20, "PIX", "Entrada"]);
  assert.equal(statements.at(-1).sql, "COMMIT");

  const template = await readFile(new URL("../views/pages/pedidos.handlebars", import.meta.url), "utf8");
  const frontend = await readFile(new URL("../public/js/pedidos/pedido.js", import.meta.url), "utf8");
  const service = await readFile(new URL("../src/modules/pedidos/pedidos.service.js", import.meta.url), "utf8");
  assert.match(template, /id="btn-confirmar-modal"/);
  assert.match(template, /id="btn-gerar-orcamento-modal"/);
  assert.doesNotMatch(template, /hora-entrega|hora-retirada|Horário de entrega|Horário de retirada/);
  assert.doesNotMatch(frontend, /data_entrega_hora|data_retirada_hora|hora-entrega|hora-retirada/);
  assert.doesNotMatch(template, /Regra aplicada|Pagamento Parcial|Frete Calculado|id="mp-status"/);
  assert.doesNotMatch(frontend, /Salvando\.\.\./);
  assert.match(frontend, /\/orcamentos\/\$\{pedidoId\}\/convert/);
  assert.match(frontend, /window\.location\.href = eOrcamento/);
  assert.match(frontend, /eOrcamento\s*\?\s*"\/orcamentos"\s*:\s*`\/entregas\?pedido=\$\{encodeURIComponent\(pedidoId\)\}`/);
  assert.match(service, /status_documento/);
  assert.match(service, /ORCAMENTO:\s*"ORCAMENTO"[\s\S]*CONFIRMADO:\s*"PEDIDO"/);

  console.log("Testes de confirmação, gravação de orçamento, itens, pagamentos e campos de entrega ok");
} finally {
  db.connect = originalConnect;
  await db.end();
}
