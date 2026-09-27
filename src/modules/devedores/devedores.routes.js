import express from "express";
import * as controller from "./devedores.controller.js";

const router = express.Router();

router.get("/", controller.listar);
router.get("/dados", controller.dados);
router.get("/exportar", controller.exportar);
router.post("/:id/pagamento", controller.registrarPagamento);

export default router;
