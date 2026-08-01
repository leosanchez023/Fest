import express from "express";
import * as controller from "./clientes.controller.js";
const router = express.Router();

/* LISTAR CLIENTES */
router.get("/", controller.listar);

/* API CLIENTES */
router.get( "/data", controller.apiList);

/* CRIAR CLIENTE */
router.post("/criar", controller.criar);

/* EDITAR CLIENTE */
router.get("/editar/:id", controller.editar);

/* ATUALIZAR CLIENTE */
router.post("/editar/:id", controller.atualizar);

/* EXCLUIR CLIENTE */
router.post("/excluir/:id", controller.deletar);

export default router;