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

// obter pedido para edição/duplicação
router.get('/obter/:id', controller.buscarPorId);

// NOVO: Endereços 
router.get("/buscar-enderecos", controller.buscarEnderecos);

router.post("/criarEndereco", controller.criarEndereco);

router.get("/cadastro_cliente", (req, res) => {
    res.render("partials/cadastro_cliente", {
        layout: false
    });
});

export default router;