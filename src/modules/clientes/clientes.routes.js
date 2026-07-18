import express from "express"
import * as controller from "./clientes.controller.js"

const router = express.Router()

router.get("/", controller.listar)

// rota que retorna JSON com filtro/paginação
router.get("/data", controller.apiList)

router.post("/criar", controller.criar)

router.get("/editar/:id", controller.editar);
router.post("/editar/:id", controller.atualizar);

router.post("/excluir/:id",controller.deletar);

export default router