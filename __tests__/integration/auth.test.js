// __tests__/integration/auth.test.js
const request = require('supertest');
const app = require('../../app');

describe('API de Autenticação', () => {
  describe('POST /api/auth/register', () => {
    it('deve registrar um novo usuário com dados válidos', async () => {
      const userData = {
        nome: 'Teste Jest',
        email: `teste.jest.${Date.now()}@example.com`,
        password: 'senha123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Usuário registrado com sucesso.');
    });
  });
});