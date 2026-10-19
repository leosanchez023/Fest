import assert from "node:assert/strict";
import { calcularSaldoPendente } from "../src/modules/pedidos/financeiro.js";

assert.equal(calcularSaldoPendente(0, 0, 0), 0, "Saldo de pedido zerado deve permanecer zero");
assert.equal(calcularSaldoPendente(1000, 400, 0), 600, "Pagamento parcial deve reduzir o saldo");
assert.equal(calcularSaldoPendente(1000, 400, 100), 500, "Restituição deve abater o saldo sem ser somada aos pagamentos");
assert.equal(calcularSaldoPendente(1000, 1000, 50), 0, "Restituição não pode gerar saldo negativo");
assert.throws(() => calcularSaldoPendente(100, -1, 0), /Valores financeiros inválidos/);

console.log("Testes de saldo financeiro ok");
