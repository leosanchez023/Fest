import express from "express";
import * as controller from "./fornecedores.controller.js";

const router = express.Router();

router.use((req, res, next) => {
    if (!req.isAuthenticated?.() || !req.user) {
        return res.status(401).json({ success: false, error: "Autenticação necessária." });
    }
    if (Number(res.locals.userPermissions?.fornecedor) !== 1) {
        return res.status(403).json({ success: false, error: "Você não tem permissão para esta operação." });
    }
    return next();
});

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