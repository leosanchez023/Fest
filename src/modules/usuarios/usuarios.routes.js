// usuarios.routes.js
import express from "express";
import * as controller from "./usuarios.controller.js";

const router = express.Router();

router.get("/", controller.listarUsuarios);
router.post("/registro", controller.criarUsuario);

router.get("/api/funcionarios", controller.listarFuncionarios);
router.post("/api/funcionarios", controller.criarFuncionario);
router.get("/api/funcionarios/:id", controller.obterFuncionario);
router.put("/api/funcionarios/:id", controller.atualizarFuncionario);
router.patch("/api/funcionarios/:id/status", controller.atualizarStatusFuncionario);
router.delete("/api/funcionarios/:id", controller.inativarFuncionario);

router.get("/api/auditoria", controller.listarAuditoria);
router.get("/api/seguranca", controller.listarSeguranca);
router.get("/api/modelos-permissoes", controller.listarModelosPermissoes);
router.put("/api/modelos-permissoes", controller.salvarModeloPermissoes);

export default router;