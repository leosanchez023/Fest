import assert from 'node:assert/strict';
import db from '../database/connection.js';
import { calcularDisponibilidade, validarDisponibilidade } from '../src/modules/estoque/estoque.service.js';

const disponivel = calcularDisponibilidade({ estoque: 100, estoque_reservado: 20, estoque_em_uso: 10, estoque_manutencao: 5, estoque_danificado: 5 });
assert.equal(disponivel, 60, 'Disponibilidade deve seguir a regra física menos reservados/uso/manutenção/danificados');
assert.equal(validarDisponibilidade({ estoque: -1 }), false, 'Estoque negativo deve ser rejeitado');
console.log('Teste de regras de estoque ok');
await db.end();
