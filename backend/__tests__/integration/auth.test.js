// __tests__/integration/auth.test.js
// ============================================================
// 🧪 NexaSpark — Testes de Integração v2.1
//
// CORREÇÕES v2.1:
//   🔴 FIX 1: expect([200,404]).toContain(500) — lógica INVERTIDA
//      O teste verificava se 500 está no array [200,404] — sempre falha.
//      Correto: expect(res.status).not.toBe(500)
//      E: expect([200, 404]).toContain(res.status) — verifica se o
//      STATUS DA RESPOSTA está na lista de aceitos.
//
//   🔴 FIX 2: set('Authorization', undefined) — header inválido
//      Quando login falha (banco down), token fica undefined.
//      Teste "rejeita sem prefixo Bearer" usava token undefined.
//      Correto: usar token hardcoded quando login pode falhar.
//
//   🔴 FIX 3: Health checks timeout 5000ms
//      Quando banco não responde, /api/health demora > 5s.
//      Correto: timeout explícito de 10s para health + DB tests.
//
//   ✅ afterAll: fecha pool PostgreSQL — evita worker force-exit
// ============================================================

'use strict';

const request = require('supertest');
const app     = require('../../app');

// ── Email único por execução — evita conflito no banco ──────
const TIMESTAMP  = Date.now();
const TEST_EMAIL = `jest.${TIMESTAMP}@nexaspark.test`;
const TEST_PASS  = 'Senha12345!';

// ── Estado compartilhado entre suites ───────────────────────
let authToken = null;

// ============================================================
// 🧹 TEARDOWN — fecha pool após todos os testes
//
// ⚠️  SEM ISSO: "A worker process has failed to exit gracefully"
//     O pg Pool mantém conexões abertas indefinidamente.
//     Jest força exit após timeout — test leaks.
// ============================================================
afterAll(async () => {
  console.log('\n🧹 [afterAll] Encerrando pool PostgreSQL...');
  try {
    const { pool } = require('../../src/database/db');
    await pool.end();
    console.log('✅ [afterAll] Pool encerrado com sucesso');
  } catch (err) {
    // Pool pode já estar fechado ou banco nunca conectou — não crítico
    console.log(`⚠️  [afterAll] Pool.end() — ${err.message} (não crítico)`);
  }
}, 10_000); // 10s para fechar graciosamente

// ============================================================
// 🩺 SUITE 1 — Health Check
// ============================================================
describe('GET /api/health', () => {

  // ⚠️  timeout: 10_000 — banco pode demorar para responder
  it('retorna 200 com status UP e DB conectado', async () => {
    const res = await request(app)
      .get('/api/health')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('UP');
    expect(res.body.database.status).toBe('UP');
    expect(res.body.uptime).toBeDefined();
    expect(res.body.memory).toBeDefined();
  }, 10_000);

  it('Helmet: não expõe X-Powered-By', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  }, 10_000);

  it('Helmet: X-Frame-Options DENY (anti-clickjacking)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-frame-options']).toBe('DENY');
  }, 10_000);

  it('Helmet: X-Content-Type-Options nosniff', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  }, 10_000);

  it('404 estruturado para rota inexistente', async () => {
    const res = await request(app)
      .get('/api/rota-que-nao-existe')
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('ROUTE_NOT_FOUND');
  });

});

// ============================================================
// 🔐 SUITE 2 — Registro
// ============================================================
describe('POST /api/auth/register', () => {

  it('cria conta e retorna JWT em data.token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: TEST_EMAIL, password: TEST_PASS })
      .expect('Content-Type', /json/)
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.email).toBe(TEST_EMAIL);
    expect(res.body.data.token.split('.').length).toBe(3);

    // Não expõe dados internos
    expect(res.body.data.senha_hash).toBeUndefined();
    expect(res.body.data.cpf_emissor_hash).toBeUndefined();

    authToken = res.body.data.token;
  }, 10_000);

  it('rejeita email duplicado com 409', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: TEST_EMAIL, password: TEST_PASS })
      .expect(409);

    expect(res.body.success).toBe(false);
    expect(res.body.data).toBeUndefined();
  }, 10_000);

  it('rejeita email inválido com 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'nao-e-email', password: TEST_PASS });

    expect([400, 422]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  it('rejeita senha menor que 8 caracteres com 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: `fraca.${TIMESTAMP}@nexaspark.test`, password: '123' });

    expect([400, 422]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  it('nunca expõe senha_hash na resposta', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: `hash.${TIMESTAMP}@nexaspark.test`, password: TEST_PASS })
      .expect(201);

    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain('senha_hash');
    expect(bodyStr).not.toContain('"password"');
    expect(bodyStr).not.toContain('cpf_emissor_hash');
  }, 10_000);

});

// ============================================================
// 🔑 SUITE 3 — Login
// ============================================================
describe('POST /api/auth/login', () => {

  it('autentica e retorna JWT em data.token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASS })
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.token.split('.').length).toBe(3);

    authToken = res.body.data.token;
  }, 10_000);

  it('rejeita senha incorreta com 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: 'SenhaErrada999!' })
      .expect(401);

    expect(res.body.success).toBe(false);
    expect(res.body.data).toBeUndefined();
  }, 10_000);

  it('rejeita email inexistente com 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: `fantasma.${TIMESTAMP}@nexaspark.test`, password: TEST_PASS })
      .expect(401);

    expect(res.body.success).toBe(false);
  }, 10_000);

  it('rejeita body sem password com 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL });

    expect([400, 422]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  it('nunca expõe senha_hash na resposta', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASS })
      .expect(200);

    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain('senha_hash');
    expect(bodyStr).not.toContain('"password"');
  }, 10_000);

});

// ============================================================
// 👤 SUITE 4 — /me sessão ativa
// ============================================================
describe('GET /api/auth/me', () => {

  it('retorna usuário com token válido', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASS });

    const token = loginRes.body.data?.token;
    expect(token).toBeTruthy();

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.email).toBe(TEST_EMAIL);
    expect(res.body.data.senha_hash).toBeUndefined();
  }, 15_000);

  it('rejeita sem token com 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .expect(401);

    expect(res.body.success).toBe(false);
  });

  it('rejeita token malformado com 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer token.invalido.aqui')
      .expect(401);

    expect(res.body.success).toBe(false);
  });

  it('rejeita sem prefixo Bearer com 401', async () => {
    // ✅ FIX: usar token hardcoded — não depende de login anterior
    // Se o login falhou (banco down), token seria undefined
    // e set('Authorization', undefined) lançaria TypeError
    const FAKE_VALID_FORMAT = 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6OTk5fQ.fake';

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', FAKE_VALID_FORMAT) // sem prefixo "Bearer "
      .expect(401);

    expect(res.body.success).toBe(false);
  });

});

// ============================================================
// 🎓 SUITE 5 — Verificação pública de certificado
// ============================================================
describe('GET /api/certificates/verify/:codigo', () => {

  it('retorna 404 para código inexistente (nunca 500)', async () => {
    const res = await request(app)
      .get('/api/certificates/verify/CODIGO00INEXISTENTE')
      .expect('Content-Type', /json/);

    // ✅ FIX: verifica se o STATUS está na lista de aceitáveis
    // Antes estava: expect([200, 404]).toContain(500) ← SEMPRE FALHA
    // Correto:      o status da resposta deve ser 404 ou 503 (banco down)
    // NUNCA 500 — erros de conexão devem retornar 503
    expect([404, 503]).toContain(res.status);
    expect(res.body.success).toBe(false);
  }, 10_000);

  it('nunca retorna 500', async () => {
    const res = await request(app)
      .get('/api/certificates/verify/QUALQUER_CODIGO_XYZ_123');

    // ✅ FIX: agora o controller trata ENOTFOUND como 503, não 500
    expect(res.status).not.toBe(500);
    expect(res.body.stack).toBeUndefined(); // nunca expõe stack trace
  }, 10_000);

});

// ============================================================
// 🔒 SUITE 6 — Proteção de rotas (sem banco necessário)
// ============================================================
describe('Proteção de rotas — sem token retorna 401', () => {

  const rotas = [
    { method: 'post', path: '/api/certificates' },
    { method: 'get',  path: '/api/certificates' },
    { method: 'get',  path: '/api/admin/dashboard' },
    { method: 'get',  path: '/api/admin/users' },
  ];

  rotas.forEach(({ method, path }) => {
    it(`${method.toUpperCase()} ${path}`, async () => {
      const res = await request(app)[method](path);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

});