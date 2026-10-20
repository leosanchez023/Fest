import assert from "node:assert/strict";
import { calcularSaldoPendente } from "../src/modules/pedidos/financeiro.js";

assert.equal(calcularSaldoPendente(0, 0, 0), 0, "Saldo de pedido zerado deve permanecer zero");
assert.equal(calcularSaldoPendente(1000, 400, 0), 600, "Pagamento parcial deve reduzir o saldo");
assert.equal(calcularSaldoPendente(1000, 400, 100), 700, "Restituição aumenta o saldo porque reduz o valor retido");
assert.equal(calcularSaldoPendente(1000, 1000, 50), 50, "Restituição parcial após quitação reabre o saldo");
assert.equal(calcularSaldoPendente(1000, 1200, 50), 0, "Saldo não pode ficar negativo quando há crédito excedente");
assert.throws(() => calcularSaldoPendente(100, -1, 0), /Valores financeiros inválidos/);

console.log("Testes de saldo financeiro ok");
