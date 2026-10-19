import assert from 'node:assert/strict';
import request from 'supertest';
import { criarUsuario } from '../src/modules/usuarios/usuarios.service.js';

process.env.NODE_ENV = 'test';
const { default: app } = await import('../app.js');

async function runSecurityChecks() {
  const protectedResponse = await request(app).get('/dashboard');
  assert.equal(protectedResponse.status, 302, 'Usuário não autenticado deve ser redirecionado');

  await assert.rejects(
    () => criarUsuario({
      nome: 'Teste Security',
      email: 'security@test.com',
      senha: '1234567',
      senha2: '1234567'
    }),
    /pelo menos 8 caracteres/i,
    'Senha curta deve ser rejeitada'
  );

  const invalidLoginResponse = await request(app)
    .post('/login')
    .type('form')
    .send({
      email: 'naoexiste@example.com',
      senha: 'qualquer'
    });

  assert.ok(
    invalidLoginResponse.status === 302 || invalidLoginResponse.status === 401 || invalidLoginResponse.status === 429,
    'Login inválido deve falhar sem expor detalhes'
  );

  console.log('Teste de segurança ok');
}

await runSecurityChecks();
