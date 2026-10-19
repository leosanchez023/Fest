import express from "express";
import rateLimit from "express-rate-limit";
import * as controller from "./pedidos.controller.js";

const router = express.Router();
const addressSearchLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas buscas de endereço. Aguarde um instante e tente novamente." }
});
const routeCalculationLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitos cálculos de rota. Aguarde um instante e tente novamente." }
});

// Página de pedidos
router.get("/", controller.listar);

// Clientes
router.get("/buscar-clientes", controller.buscarClientes);
router.post("/criarCliente", controller.criarCliente);

// Produtos
router.get("/buscar-produtos", controller.buscarProdutos);
router.get("/buscar-itens", controller.buscarItens);

// Pedidos
router.post("/criar", controller.criar);

// obter pedido para edição/duplicação
router.get('/obter/:id', controller.buscarPorId);
router.get("/configuracoes-entrega", controller.obterConfiguracaoEntrega);
router.put("/configuracoes-entrega", controller.atualizarConfiguracaoEntrega);
// atualizar pedido existente
router.put('/:id', controller.atualizar);
router.post('/:id/cancelar', controller.cancelar);
router.put('/:id/itens/:produtoId', controller.alterarQuantidadeItem);

// NOVO: Endereços
router.get("/buscar-enderecos", controller.buscarEnderecos);
router.get("/buscar-enderecos-osm", addressSearchLimit, controller.buscarSugestoesEndereco);
router.post("/calcular-rota", routeCalculationLimit, controller.calcularRota);

router.post("/criarEndereco", controller.criarEndereco);

router.get("/cadastro_cliente", (req, res) => {
    res.render("partials/cadastro_cliente", {
        layout: false
    });
});

export default router;