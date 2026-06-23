import express from "express";
import * as controller from "./pedidos.controller.js";

const router = express.Router();

// Página de pedidos
router.get("/", controller.listar);

// Clientes
router.get("/buscar-clientes", controller.buscarClientes);
router.post("/criarCliente", controller.criarCliente);

// Produtos
router.get("/buscar-produtos", controller.buscarProdutos);

// Pedidos
router.post("/criar", controller.criar);

// 🔥 NOVO: Endereços (agora no controller)
router.get("/buscar-enderecos", controller.buscarEnderecos);

router.post("/criarEndereco", controller.criarEndereco);

export default router;