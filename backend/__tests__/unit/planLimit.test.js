// __tests__/unit/planLimit.test.js
// ============================================================
// 🧪 NexaSpark — Testes Unitários: planLimitMiddleware
//
// Por que esses testes existem:
//   O planLimitMiddleware é a única barreira que impede
//   usuários free de emitirem certificados ilimitados.
//   Já ficou fora da chain por semanas sem ninguém perceber
//   porque não tinha teste cobrindo esse comportamento.
//
//   Esses testes usam "mocks" — objetos falsos que simulam
//   req, res e next sem precisar de banco ou servidor.
//   Assim testamos todos os cenários em milissegundos.
//
// O que é um mock:
//   Em vez de fazer uma requisição HTTP real, criamos um
//   objeto falso que tem as mesmas propriedades que o Express
//   passaria. O middleware não sabe a diferença.
// ============================================================

'use strict';

// Importa o middleware que vamos testar
const planLimitMiddleware = require('../../src/middlewares/planLimitMiddleware');

// Jest.mock substitui o módulo real por uma versão controlada.
// Fazemos isso com Certificate e AuditLog porque não queremos
// que os testes conectem no banco — são testes unitários.
jest.mock('../../src/models/Certificate');
jest.mock('../../src/models/AuditLog');

const Certificate = require('../../src/models/Certificate');
const AuditLog    = require('../../src/models/AuditLog');

// ============================================================
// 🔧 HELPERS — cria objetos falsos de req, res, next
// ============================================================

// Cria um req falso com os campos que o middleware usa
function criaReq(plano = 'free', plano_limite = 2, usuario_id = 42) {
  return {
    user: { id: usuario_id, plano, plano_limite },
    ip:   '127.0.0.1',
    requestId: 'test-request-id',
    get: () => 'jest-test-agent', // simula req.get('User-Agent')
  };
}

// Cria um res falso que grava o que o middleware respondeu
function criaRes() {
  const res = {
    statusCode: null,
    body:       null,
    // status() retorna o próprio res para permitir res.status(403).json(...)
    status: jest.fn().mockImplementation(function(code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn().mockImplementation(function(data) {
      this.body = data;
      return this;
    }),
  };
  return res;
}

// ============================================================
// 🧹 LIMPEZA — reseta os mocks entre testes
// ============================================================
beforeEach(() => {
  // Limpa o histórico de chamadas dos mocks antes de cada teste
  // Sem isso, um teste poderia ser influenciado pelo anterior
  jest.clearAllMocks();

  // AuditLog.create nunca deve lançar erro nos testes
  // — é uma operação não-crítica que não deve travar o fluxo
  AuditLog.create = jest.fn().mockResolvedValue({ id: 1 });
});

// ============================================================
// 🧪 CENÁRIO 1 — Usuário dentro do limite
// ============================================================
describe('planLimitMiddleware — dentro do limite', () => {

  it('chama next() quando usuário free emitiu 0 certificados este mês', async () => {
    // Simula banco retornando 0 emissões este mês
    Certificate.countThisMonthByUserId = jest.fn().mockResolvedValue(0);

    const req  = criaReq('free', 2);
    const res  = criaRes();
    const next = jest.fn(); // next é uma função — jest.fn() cria uma simulada

    await planLimitMiddleware(req, res, next);

    // next() deve ter sido chamado — deixou passar
    expect(next).toHaveBeenCalledTimes(1);
    // res.status() não deve ter sido chamado — não bloqueou
    expect(res.status).not.toHaveBeenCalled();
  });

  it('chama next() quando usuário free emitiu 1 de 2 certificados', async () => {
    Certificate.countThisMonthByUserId = jest.fn().mockResolvedValue(1);

    const req  = criaReq('free', 2);
    const res  = criaRes();
    const next = jest.fn();

    await planLimitMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('injeta req.planStatus com informações corretas', async () => {
    Certificate.countThisMonthByUserId = jest.fn().mockResolvedValue(1);

    const req  = criaReq('free', 2);
    const res  = criaRes();
    const next = jest.fn();

    await planLimitMiddleware(req, res, next);

    // O middleware deve injetar o status do plano no req
    // para que o controller possa usar se quiser
    expect(req.planStatus).toBeDefined();
    expect(req.planStatus.remaining).toBe(1);
    expect(req.planStatus.used_this_month).toBe(1);
    expect(req.planStatus.plano_limite).toBe(2);
  });

  it('marca isLastFree quando é o último certificado disponível', async () => {
    // Usuário tem limite 2 e já emitiu 1 — esse é o último
    Certificate.countThisMonthByUserId = jest.fn().mockResolvedValue(1);

    const req  = criaReq('free', 2);
    const res  = criaRes();
    const next = jest.fn();

    await planLimitMiddleware(req, res, next);

    expect(req.planStatus.isLastFree).toBe(true);
  });

});

// ============================================================
// 🧪 CENÁRIO 2 — Limite atingido
// ============================================================
describe('planLimitMiddleware — limite atingido', () => {

  it('retorna 403 quando usuário free já emitiu o limite', async () => {
    // Usuário já emitiu 2 certificados — limite é 2
    Certificate.countThisMonthByUserId = jest.fn().mockResolvedValue(2);

    const req  = criaReq('free', 2);
    const res  = criaRes();
    const next = jest.fn();

    await planLimitMiddleware(req, res, next);

    // Deve ter bloqueado com 403
    expect(res.status).toHaveBeenCalledWith(403);
    // next() NÃO deve ter sido chamado — bloqueou
    expect(next).not.toHaveBeenCalled();
  });

  it('resposta 403 tem code PLAN_LIMIT_REACHED', async () => {
    Certificate.countThisMonthByUserId = jest.fn().mockResolvedValue(2);

    const req  = criaReq('free', 2);
    const res  = criaRes();
    const next = jest.fn();

    await planLimitMiddleware(req, res, next);

    // O frontend depende desse code para mostrar a mensagem certa
    expect(res.body.code).toBe('PLAN_LIMIT_REACHED');
    expect(res.body.success).toBe(false);
  });

  it('resposta 403 inclui dados do plano', async () => {
    Certificate.countThisMonthByUserId = jest.fn().mockResolvedValue(2);

    const req  = criaReq('free', 2);
    const res  = criaRes();
    const next = jest.fn();

    await planLimitMiddleware(req, res, next);

    // O frontend usa esses dados para mostrar o modal de upgrade
    expect(res.body.data).toBeDefined();
    expect(res.body.data.plano_limite).toBe(2);
    expect(res.body.data.used_this_month).toBe(2);
    expect(res.body.data.remaining).toBe(0);
  });

  it('registra no AuditLog quando bloqueia — dado valioso para pricing', async () => {
    Certificate.countThisMonthByUserId = jest.fn().mockResolvedValue(2);

    const req  = criaReq('free', 2);
    const res  = criaRes();
    const next = jest.fn();

    await planLimitMiddleware(req, res, next);

    // AuditLog deve ter sido chamado — registra quantas vezes
    // usuários atingem o limite (funil de conversão para plano pago)
    expect(AuditLog.create).toHaveBeenCalledTimes(1);
    expect(AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        usuario_id: 42,
        metadata:   expect.objectContaining({
          event_type: 'PLAN_LIMIT_REACHED',
        }),
      })
    );
  });

  it('bloqueia mesmo quando emitiu mais do que o limite', async () => {
    // Cobre o caso onde o banco tem mais registros que o esperado
    Certificate.countThisMonthByUserId = jest.fn().mockResolvedValue(10);

    const req  = criaReq('free', 2);
    const res  = criaRes();
    const next = jest.fn();

    await planLimitMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

});

// ============================================================
// 🧪 CENÁRIO 3 — Planos ilimitados
// ============================================================
describe('planLimitMiddleware — planos ilimitados', () => {

  it('plano pro passa direto sem consultar o banco', async () => {
    // Plano pro não deve consultar o banco — economiza query
    const contarMock = jest.fn();
    Certificate.countThisMonthByUserId = contarMock;

    const req  = criaReq('pro', 9999);
    const res  = criaRes();
    const next = jest.fn();

    await planLimitMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    // O banco NÃO deve ter sido consultado para plano pro
    expect(contarMock).not.toHaveBeenCalled();
  });

  it('plano_limite 9999 passa direto sem consultar o banco', async () => {
    const contarMock = jest.fn();
    Certificate.countThisMonthByUserId = contarMock;

    const req  = criaReq('free', 9999); // plano_limite alto = ilimitado
    const res  = criaRes();
    const next = jest.fn();

    await planLimitMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(contarMock).not.toHaveBeenCalled();
  });

});

// ============================================================
// 🧪 CENÁRIO 4 — Falha no banco (fail-open)
// ============================================================
describe('planLimitMiddleware — falha no banco', () => {

  it('chama next() quando banco falha — não bloqueia usuário legítimo', async () => {
    // Simula banco inacessível
    Certificate.countThisMonthByUserId = jest.fn().mockRejectedValue(
      new Error('ENOTFOUND — banco inacessível')
    );

    const req  = criaReq('free', 2);
    const res  = criaRes();
    const next = jest.fn();

    await planLimitMiddleware(req, res, next);

    // Fail-open: prefere emitir sem checar do que bloquear
    // um usuário legítimo por falha técnica
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('injeta planStatus com error quando banco falha', async () => {
    Certificate.countThisMonthByUserId = jest.fn().mockRejectedValue(
      new Error('conexão recusada')
    );

    const req  = criaReq('free', 2);
    const res  = criaRes();
    const next = jest.fn();

    await planLimitMiddleware(req, res, next);

    // O controller pode verificar se o check falhou
    expect(req.planStatus).toBeDefined();
    expect(req.planStatus.checked).toBe(false);
    expect(req.planStatus.error).toBeDefined();
  });

  it('nunca retorna 500 — erros internos viram fail-open', async () => {
    Certificate.countThisMonthByUserId = jest.fn().mockRejectedValue(
      new Error('erro inesperado')
    );

    const req  = criaReq('free', 2);
    const res  = criaRes();
    const next = jest.fn();

    await planLimitMiddleware(req, res, next);

    // 500 nunca deve aparecer — ou passa (next) ou bloqueia (403)
    expect(res.statusCode).not.toBe(500);
  });

});