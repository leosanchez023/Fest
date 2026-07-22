import express from 'express';
import * as controller from './orcamentos.controller.js';

const router = express.Router();

router.get('/', controller.listar);
router.get('/list', controller.listarJSON);
router.post('/:id/convert', controller.converter);
router.post('/:id/delete', controller.excluir);
router.post('/:id/duplicate', controller.duplicar);

export default router;
