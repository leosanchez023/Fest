import express from 'express';
import * as controller from './combos.controller.js';

const router = express.Router();

router.get('/', controller.index);
router.get('/api', controller.listar);
router.get('/:id', controller.buscar);
router.post('/', controller.criar);
router.put('/:id', controller.atualizar);
router.delete('/:id', controller.desativar);
router.post('/:id/itens', controller.adicionarItem);
router.get('/:id/disponibilidade', controller.calcularDisponibilidade);

export default router;
