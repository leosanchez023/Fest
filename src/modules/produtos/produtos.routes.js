import express from "express";
import * as controller from "./produtos.controller.js";

const router = express.Router();


// ==============================
// PÁGINA
// ==============================

router.get(
  "/",
  controller.listar
);



// ==============================
// API PRODUTOS
// ==============================


// Listar produtos com filtros
router.get(
  "/api",
  controller.listarAPI
);


// Buscar produto por ID
router.get(
  "/api/:id",
  controller.buscar
);


// Dashboard estoque
router.get(
  "/api/dashboard",
  controller.dashboard
);


// Histórico estoque
router.get(
  "/api/historico",
  controller.historico
);




// ==============================
// CRUD
// ==============================


// Criar produto
router.post(
  "/criar",
  controller.criar
);


// Tela editar
router.get(
  "/editar/:id",
  controller.editar
);


// Atualizar produto
router.post(
  "/editar/:id",
  controller.atualizar
);


// Excluir (soft delete)
router.delete(
  "/deletar/:id",
  controller.deletar
);





// ==============================
// CONTROLE DE ESTOQUE
// ==============================


// Entrada de estoque
router.post(
  "/:id/entrada",
  controller.entradaEstoque
);


// Saída de estoque
router.post(
  "/:id/saida",
  controller.saidaEstoque
);


// Reservar produto
router.post(
  "/:id/reservar",
  controller.reservar
);


// Retornar reserva
router.post(
  "/:id/devolver",
  controller.devolver
);


// Enviar para manutenção
router.post(
  "/:id/manutencao",
  controller.manutencao
);


// Finalizar manutenção
router.post(
  "/:id/finalizar-manutencao",
  controller.finalizarManutencao
);



export default router;