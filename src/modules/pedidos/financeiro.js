export function calcularSaldoPendente(total, pagamentos, restituicoes) {
  const valores = [total, pagamentos, restituicoes].map(Number);
  if (valores.some((valor) => !Number.isFinite(valor) || valor < 0)) {
    throw new Error("Valores financeiros inválidos.");
  }

  const [valorTotal, totalPago, totalRestituido] = valores;
  return Math.max(0, valorTotal - totalPago - totalRestituido);
}
