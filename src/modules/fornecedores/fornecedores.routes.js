import express from "express";
import * as controller from "./fornecedores.controller.js";

const router = express.Router();

// Página
router.get("/", controller.listar);

// API JSON
router.get("/data", controller.listarJSON);

// Buscar por ID
router.get("/:id", controller.buscar);

// Criar
router.post("/criar", controller.criar);

// Atualizar
router.put("/:id", controller.atualizar);

// Excluir
router.delete("/:id", controller.excluir);

export default router;