import express from "express"
import * as controller from "./produtos.controller.js"

const router = express.Router()

// MOSTRAR PRODUTOS
router.get("/", controller.listar)

// CRIAR PRODUTO
router.post("/criar", controller.criar)

//Excluir
router.delete("/deletar/:id", controller.deletar)

router.get("/editar/:id", controller.editar)
router.post("/editar/:id", controller.atualizar)

export default router