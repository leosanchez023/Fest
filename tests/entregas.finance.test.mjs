import assert from "node:assert/strict";
import db from "../database/connection.js";
import { calcularSaldoPendente } from "../src/modules/entregas/entregas.service.js";
import {
  buscarPedidos,
  inserirPagamento,
  inserirReembolso
} from "../src/modules/entregas/entregas.model.js";

const originalQuery = db.query;
const statements = [];

try {
  assert.equal(calcularSaldoPendente(100, [60, -25]), 65);
  assert.equal(calcularSaldoPendente(100, [100, -25]), 25);
  assert.equal(calcularSaldoPendente(100, [125, -25]), 0);
  await assert.rejects(
    inserirPagamento(1, { valor: 0.001 }),
    /Valor de pagamento inválido/
  );
  await assert.rejects(
    inserirReembolso(1, { valor: 0.001 }),
    /Valor de reembolso inválido/
  );

  db.query = async (sql, params = []) => {
      statements.push({ sql, params });
    if (sql.includes("COUNT(*) AS total")) return [[{ total: 1 }]];
    return [[{
      id: 1,
      valor_pago: 100,
      valor_creditado: 75
    }]];
  };
  const result = await buscarPedidos({
    pay: "Parcialmente Pago",
    page: 1,
    limit: 25
  });

  assert.equal(result.rows[0].valor_creditado, 75);
  const countQuery = statements[0];
  const rowsQuery = statements[1];
  assert.match(countQuery.sql, / - COALESCE\(/, "Payment filters must subtract refunds from receipts");
  assert.match(rowsQuery.sql, / - COALESCE\(/, "Displayed credited amount must be net of refunds");
  assert.match(rowsQuery.sql, /AS valor_creditado/);
  assert.match(rowsQuery.sql, /pi\.tipo_item = 'ALUGUEL'/, "Return actions must only be exposed for rental items");

  statements.length = 0;
  await buscarPedidos({
    search: "Ana",
    from: "2026-10-01",
    to: "2026-10-31",
    status: "CONFIRMADO",
    delivery: "Entrega Atrasada",
    sort: "event_asc",
    kpi: "late",
    page: 2,
    limit: 50
  });
  assert.match(statements[0].sql, /p\.data_entrega < CURDATE\(\)/);
  assert.match(statements[0].sql, /p\.status = \?/);
  assert.deepEqual(statements[0].params, [
    "%Ana%", "%Ana%", "%Ana%", "%Ana%",
    "2026-10-01", "2026-10-31", "CONFIRMADO"
  ]);
  assert.match(statements[1].sql, /ORDER BY p\.data_evento ASC, p\.id ASC/);
  assert.deepEqual(statements[1].params.slice(-2), [50, 50]);

  console.log("Testes de saldo líquido e valores pagos após restituições ok");
} finally {
  db.query = originalQuery;
  await db.end();
}
