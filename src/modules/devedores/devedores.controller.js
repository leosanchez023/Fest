import * as service from "./devedores.service.js";

export function listar(req, res) {
  return res.render("pages/devedores");
}

export async function dados(req, res) {
  try {
    return res.json(await service.listar(req.query));
  } catch (error) {
    console.error("Erro ao listar devedores:", error);
    return res.status(500).json({ message: "Erro ao consultar devedores." });
  }
}

export async function registrarPagamento(req, res) {
  try {
    await service.registrarPagamento(req.params.id, req.body, req.user?.id);
    return res.json({ sucesso: true });
  } catch (error) {
    console.error("Erro ao registrar pagamento de devedor:", error);
    return res.status(400).json({ message: error.message });
  }
}

function csvValue(value) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function exportar(req, res) {
  try {
    const data = await service.listar(req.query);
    const header = ["Cliente", "Telefone", "Pedido", "Tipo", "Data do evento", "Vencimento", "Valor total", "Total pago", "Pendente", "Dias em atraso", "Status"];
    const lines = data.devedores.map((row) => [
      row.cliente_nome,
      row.telefone,
      row.pedido_id,
      row.tipo_pedido,
      row.data_evento,
      row.data_evento,
      Number(row.valor_total).toFixed(2),
      Number(row.total_pago).toFixed(2),
      Number(row.saldo_pendente).toFixed(2),
      row.dias_em_atraso,
      row.status
    ].map(csvValue).join(";"));

    const csv = [header.map(csvValue).join(";"), ...lines].join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=clientes-devedores.csv");
    return res.send(`\ufeff${csv}`);
  } catch (error) {
    console.error("Erro ao exportar devedores:", error);
    return res.status(500).json({ message: "Erro ao exportar devedores." });
  }
}
