// __tests__/unit/schemas.test.js
// ============================================================
// 🧪 NexaSpark — Testes Unitários: Schemas de Validação
//
// ⚠️  CORREÇÕES em relação ao arquivo original:
//
//   1. Path correto: '../../src/schemas' (não '../../backend/docs/...')
//      O arquivo real é src/schemas/index.js
//
//   2. Estrutura correta dos schemas:
//      Os schemas são objetos { body: z.object({}) } — não schemas
//      Zod diretos. O validateSchema middleware acessa schema.body,
//      schema.params, schema.query.
//      Logo: schema.body.safeParse(data) — não schema.safeParse(data)
//
//   3. Testes unitários puros — sem banco, sem servidor.
//      Rodamos apenas .safeParse() do Zod e verificamos
//      success:true/false + estrutura dos erros.
// ============================================================

const {
  registerSchema,
  loginSchema,
  certificateSchema,
  verifySchema,
  getByIdSchema,
} = require('../../src/schemas');

// ============================================================
// 🔐 registerSchema
// ============================================================
describe('registerSchema — validação de registro', () => {

  it('aceita email e senha válidos', () => {
    const result = registerSchema.body.safeParse({
      email:    'usuario@nexaspark.com',
      password: 'Senha1234!',
    });
    expect(result.success).toBe(true);
  });

  it('normaliza email para lowercase', () => {
    const result = registerSchema.body.safeParse({
      email:    'USUARIO@NEXASPARK.COM',
      password: 'Senha1234!',
    });
    expect(result.success).toBe(true);
    expect(result.data.email).toBe('usuario@nexaspark.com');
  });

  it('rejeita email inválido', () => {
    const result = registerSchema.body.safeParse({
      email:    'nao-e-um-email',
      password: 'Senha1234!',
    });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toContain('email');
  });

  it('rejeita senha com menos de 8 caracteres', () => {
    const result = registerSchema.body.safeParse({
      email:    'usuario@nexaspark.com',
      password: '123',
    });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toContain('password');
  });

  it('rejeita body vazio', () => {
    const result = registerSchema.body.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error.issues.length).toBeGreaterThan(0);
  });

  it('rejeita sem email', () => {
    const result = registerSchema.body.safeParse({ password: 'Senha1234!' });
    expect(result.success).toBe(false);
  });

});

// ============================================================
// 🔑 loginSchema
// ============================================================
describe('loginSchema — validação de login', () => {

  it('aceita credenciais válidas', () => {
    const result = loginSchema.body.safeParse({
      email:    'usuario@nexaspark.com',
      password: 'qualquersenha',
    });
    expect(result.success).toBe(true);
  });

  it('aceita senha de 1 char no login (validação de força é no register)', () => {
    const result = loginSchema.body.safeParse({
      email:    'usuario@nexaspark.com',
      password: 'x',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita senha vazia', () => {
    const result = loginSchema.body.safeParse({
      email:    'usuario@nexaspark.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita email inválido', () => {
    const result = loginSchema.body.safeParse({
      email:    'invalido',
      password: 'Senha1234!',
    });
    expect(result.success).toBe(false);
  });

});

// ============================================================
// 📜 certificateSchema
// ============================================================
describe('certificateSchema — validação de emissão', () => {

  const dadosValidos = {
    nome_participante: 'João da Silva',
    cpf:              '123.456.789-09',
    nome_curso:       'Curso de Node.js Enterprise',
    carga_horaria:    40,
    data_emissao:     '2026-05-01',
  };

  it('aceita dados completos válidos', () => {
    const result = certificateSchema.body.safeParse(dadosValidos);
    expect(result.success).toBe(true);
  });

  it('aceita carga_horaria como string numérica (coerce)', () => {
    const result = certificateSchema.body.safeParse({
      ...dadosValidos,
      carga_horaria: '40', // frontend pode enviar string
    });
    expect(result.success).toBe(true);
    expect(result.data.carga_horaria).toBe(40); // convertido para number
  });

  it('rejeita nome_participante vazio', () => {
    const result = certificateSchema.body.safeParse({
      ...dadosValidos,
      nome_participante: '',
    });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toContain('nome_participante');
  });

  it('rejeita CPF com formato errado', () => {
    const result = certificateSchema.body.safeParse({
      ...dadosValidos,
      cpf: '12345678909', // sem formatação
    });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toContain('cpf');
  });

  it('rejeita carga_horaria negativa', () => {
    const result = certificateSchema.body.safeParse({
      ...dadosValidos,
      carga_horaria: -10,
    });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toContain('carga_horaria');
  });

  it('rejeita data com formato inválido', () => {
    const result = certificateSchema.body.safeParse({
      ...dadosValidos,
      data_emissao: '01/05/2026', // formato BR — deve ser YYYY-MM-DD
    });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toContain('data_emissao');
  });

  it('aceita campos opcionais (nome_instrutor)', () => {
    const result = certificateSchema.body.safeParse({
      ...dadosValidos,
      nome_instrutor: 'Prof. Carlos Silva',
    });
    expect(result.success).toBe(true);
    expect(result.data.nome_instrutor).toBe('Prof. Carlos Silva');
  });

});

// ============================================================
// 🔍 verifySchema
// ============================================================
describe('verifySchema — validação de verificação pública', () => {

  it('aceita código válido nos params', () => {
    const result = verifySchema.params.safeParse({
      codigo: 'ABC123456789',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita código muito curto (menos de 8 chars)', () => {
    const result = verifySchema.params.safeParse({
      codigo: 'AB',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita código ausente', () => {
    const result = verifySchema.params.safeParse({});
    expect(result.success).toBe(false);
  });

});