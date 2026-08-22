import express from 'express';
import * as controller from './estoque.controller.js';

const router = express.Router();

router.get('/', controller.index);
router.get('/resumo', controller.resumo);
router.post('/ajuste', controller.ajustar);

export default router;
