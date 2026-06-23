import express from "express";
import * as controller from "./entregas.controller.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.render("pages/entregas");
});

router.get("/pedidos", controller.listarPedidos);
router.get("/pedidos/:id", controller.buscarPedido);
router.get("/kpis", controller.kpis);

export default router;
