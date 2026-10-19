import * as service from "./dashboard.service.js";

export async function listar(req, res) {
  try {
    const periodo = req.query.periodo || "30";
    const resumo = await service.montarDadosDashboard(periodo);
    res.render("pages/dashboard", {
      dashboardDataJson: JSON.stringify(resumo).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026"),
      usuario: req.user || { nome: "Usuário" }
    });
  } catch (err) {
    console.error("Erro ao montar dashboard:", err);
    res.status(500).render("pages/dashboard", {
      dashboardDataJson: JSON.stringify({
        periodo: { de: null, ate: null },
        kpis: [],
        faturamento: [],
        statusPedidos: [],
        agenda: [],
        alertas: [],
        ultimosPedidos: [],
        topProdutos: []
      }),
      usuario: req.user || { nome: "Usuário" },
      error: "Não foi possível carregar os dados do dashboard."
    });
  }
}

export async function resumo(req, res) {
  try {
    const data = await service.montarDadosDashboard(req.query.periodo || "30");
    res.json(data);
  } catch (err) {
    console.error("Erro ao consultar resumo do dashboard:", err);
    res.status(500).json({ error: "Não foi possível consultar o resumo do dashboard." });
  }
}