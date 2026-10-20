import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import db from "../database/connection.js";
import { construirFiltros, montarDadosRelatorio } from "../src/modules/relatorios/relatorios.routes.js";

const originalExecute = db.execute;

try {
  const filtros = construirFiltros({ tab: "financeiro", status: "Pago" });
  assert.match(filtros.pedidosSql, /- COALESCE\(pg\.total_pago, 0\) \+ COALESCE\(pg\.reembolsos, 0\)/);

  db.execute = async (sql) => {
    if (sql.includes("FROM pedidos p")) {
      return [[
        {
          id: 1,
          cliente_id: 2,
          data_pedido: new Date("2026-10-01T12:00:00Z"),
          data_evento: new Date("2099-10-01T12:00:00Z"),
          status: "CONFIRMADO",
          status_documento: "PEDIDO",
          valor_total: 100,
          total_pago: 60,
          reembolsos: 25
        },
        {
          id: 2,
          cliente_id: 3,
          data_pedido: new Date("2026-10-02T12:00:00Z"),
          data_evento: new Date("2099-10-02T12:00:00Z"),
          status: "CONFIRMADO",
          status_documento: "PEDIDO",
          valor_total: 100,
          total_pago: 100,
          reembolsos: 100
        }
      ]];
    }
    if (sql.includes("FROM produtos")) return [[]];
    throw new Error(`Unexpected report SQL: ${sql}`);
  };
  const report = await montarDadosRelatorio({ tab: "financeiro" });
  assert.equal(report.pedidos[0].saldo, 65);
  assert.equal(report.pedidos[0].fin, "Parcial");
  assert.equal(report.pedidos[1].saldo, 100);
  assert.equal(report.pedidos[1].fin, "Pendente");

  const script = await readFile(new URL("../public/js/relatorios.js", import.meta.url), "utf8");
  const printCss = await readFile(new URL("../public/css/pages/relatorios.css", import.meta.url), "utf8");
  assert.match(script, /beforeprint[\s\S]*state\.printing=true/);
  assert.match(script, /state\.printing\?sorted:sorted\.slice/);
  assert.match(printCss, /@media print/);
  assert.match(printCss, /\.app-sidebar[\s\S]*display:\s*none/);

  console.log("Testes de saldo líquido, situação financeira e impressão integral de relatórios ok");
} finally {
  db.execute = originalExecute;
  await db.end();
}
