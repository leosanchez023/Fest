import express from "express";
import * as controller from "./entregas.controller.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.render("pages/entregas");
});

router.get("/pedidos", controller.listarPedidos);
router.get("/pedidos/:id", controller.buscarPedido);
router.get("/kpis", controller.kpis);
router.get('/relatorio', controller.relatorio);

// Ações sobre pedido
router.post("/pedidos/:id/pagamentos", controller.adicionarPagamento);
router.post("/pedidos/:id/marcar-entregue", controller.marcarEntregue);
router.post("/pedidos/:id/devolucoes", controller.registrarDevolucao);
router.post("/pedidos/:id/reembolso", controller.registrarReembolso);
router.post("/pedidos/:id/marcar-retirado", controller.marcarRetirado);
router.post(
  "/pedidos/:id/marcar-conferencia",
  controller.marcarConferencia
);
router.post("/pedidos/:id/finalizar-conferencia", controller.finalizarConferencia);
router.post("/pedidos/:id/ocorrencias", controller.registrarOcorrencia);


export default router;
