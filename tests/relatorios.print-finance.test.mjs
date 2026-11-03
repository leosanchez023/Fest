import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import db from "../database/connection.js";
import { construirFiltros, montarDadosImpressao, montarDadosRelatorio } from "../src/modules/relatorios/relatorios.routes.js";

const originalQuery = db.query;

try {
  const filtros = construirFiltros({ tab: "financeiro", status: "Pago" });
  assert.match(filtros.pedidosSql, /- COALESCE\(pg\.total_pago, 0\) \+ COALESCE\(pg\.reembolsos, 0\)/);

  db.query = async (sql) => {
    if (sql.includes("FROM pedidos p")) {
      const rows = [
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
      ];
      return { rows, rowCount: rows.length };
    }
    if (sql.includes("FROM produtos")) return { rows: [], rowCount: 0 };
    throw new Error(`Unexpected report SQL: ${sql}`);
  };
  const report = await montarDadosRelatorio({ tab: "financeiro" });
  assert.equal(report.pedidos[0].saldo, 65);
  assert.equal(report.pedidos[0].fin, "Parcial");
  assert.equal(report.pedidos[1].saldo, 100);
  assert.equal(report.pedidos[1].fin, "Pendente");

  const printable = await montarDadosImpressao({
    tab: "pedidos",
    from: "2026-10-01",
    to: "2026-10-02",
    q: "60,00"
  }, "Ana Teste");
  assert.equal(printable.rows.length, 1);
  assert.equal(printable.responsible, "Ana Teste");
  assert.equal(printable.period, "01/10/2026 a 02/10/2026");
  assert.equal(printable.rows[0].cells.find((cell) => cell.label === "Nº").value, "1");
  assert.equal(printable.rows[0].cells.find((cell) => cell.label === "Valor").value.replace(/\u00a0/g, " "), "R$ 100,00");
  assert.equal(printable.summary.find((item) => item.label === "Pedidos").value, 1);
  assert.deepEqual(printable.selectedFilters, ["Busca: 60,00"]);

  const script = await readFile(new URL("../public/js/relatorios.js", import.meta.url), "utf8");
  const printCss = await readFile(new URL("../public/css/pages/relatorios-impressao.css", import.meta.url), "utf8");
  const printView = await readFile(new URL("../views/pages/relatorios_impressao.handlebars", import.meta.url), "utf8");
  assert.match(script, /window\.open\(`\/relatorios\/imprimir\?/);
  assert.doesNotMatch(script, /beforeprint|window\.print\(\)/);
  assert.match(printCss, /@page[\s\S]*size:\s*A4/);
  assert.match(printCss, /@media print/);
  assert.match(printCss, /display:\s*table-header-group/);
  assert.match(printCss, /break-inside:\s*avoid/);
  assert.match(printCss, /counter\(page\)/);
  assert.match(printView, /LOCAGEST/);
  assert.match(printView, /Responsável/);
  assert.match(printView, /Período selecionado/);

  console.log("Testes de saldo líquido, impressão dedicada e filtros do relatório ok");
} finally {
  db.query = originalQuery;
  await db.end();
}
