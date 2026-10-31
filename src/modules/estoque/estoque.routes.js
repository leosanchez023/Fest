import express from 'express';
import * as controller from './estoque.controller.js';

const router = express.Router();

router.get('/', controller.index);
router.get('/movimentacoes', controller.paginaHistorico);
router.get('/resumo', controller.resumo);
router.get('/historico', controller.historico);
router.post('/ajuste', controller.ajustar);

export default router;
