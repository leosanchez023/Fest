import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
const service = await import("../src/modules/entregas/entregas.service.js");
const { default: db } = await import("../database/connection.js");

assert.equal(
  service.calcularSaldoPendente(100, [60, -25]),
  15,
  "Refund credits reduce pending balance without reducing the received total"
);
assert.equal(service.calcularSaldoPendente(100, [110]), 0, "Pending balance cannot be negative");
assert.equal(service.calcularSaldoPendente(100, []), 100, "No transactions leave the full amount pending");

await assert.rejects(
  () => service.marcarEntregue(1, { data_entrega: "2026-10-18T12:30", responsavel_entrega: " " }),
  /responsável pela entrega/i
);

await assert.rejects(
  () => service.marcarEntregue(1, { data_entrega: "data inválida", responsavel_entrega: "Motorista" }),
  /data e hora válidas/i
);

await assert.rejects(
  () => service.registrarOcorrencia(1, { tipo: "COBRANCA", descricao: "   ", valor: 10 }),
  /observação para a cobrança/i
);

console.log("Testes de validação de entregas ok");
await db.end();
