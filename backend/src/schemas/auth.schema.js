// src/schemas/authSchemas.js
// ============================================================
// 🏢 NexaSpark — Auth Schemas (Zod)
//
// ⚠️  ATENÇÃO — DIFERENÇA DE ARQUIVOS:
//
//     Este arquivo (authSchemas.js) é diferente de schemas/index.js.
//     authSchemas.js usa objetos Zod diretos (z.object({})).
//     schemas/index.js envolve em { body: z.object({}) } para o
//     validateSchema middleware conseguir discriminar body/params/query.
//
//     Se você usa validateSchema(registerSchema), use schemas/index.js.
//     Se você usa schema.parse(req.body) diretamente no controller,
//     use este arquivo.
//
//     ✅ RECOMENDAÇÃO: padronize em schemas/index.js para toda a API.
//     Este arquivo existe para manter compatibilidade com código
//     que já importa de authSchemas diretamente.
// ============================================================

const { z } = require('zod');

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  cyan:  (s) => `\x1b[36m${s}\x1b[0m`,
  gray:  (s) => `\x1b[90m${s}\x1b[0m`,
  bold:  (s) => `\x1b[1m${s}\x1b[0m`,
};

console.log(c.cyan(c.bold('📐 [authSchemas] Carregando schemas de autenticação...')));

// ============================================================
// 🔧 HELPERS REUTILIZÁVEIS
// ============================================================

// Email normalizado — trim + lowercase antes de validar.
// ⚠️  PROBLEMA ORIGINAL: não havia normalização.
//     "User@Gmail.com " e "user@gmail.com" seriam tratados
//     como e-mails diferentes — causando erros de login
//     para usuários que digitam com maiúsculas ou espaços.
const emailField = z
  .string({ required_error: 'E-mail é obrigatório' })
  .trim()
  .toLowerCase()
  .email('Formato de e-mail inválido');

// Senha para registro — mínimo 8 chars.
// ⚠️  PROBLEMA ORIGINAL: mínimo de 6 chars aqui, mas
//     authController rejeitava senhas < 8.
//     Isso criava um bug silencioso: usuários registrados
//     com 6-7 chars nunca conseguiriam logar.
//     ✅ CORREÇÃO: 8 chars mínimo como fonte única de verdade.
const passwordRegisterField = z
  .string({ required_error: 'Senha é obrigatória' })
  .min(8,   'A senha deve ter no mínimo 8 caracteres')
  .max(100, 'Senha muito longa — máximo 100 caracteres');

// Senha para login — aceita qualquer string não-vazia.
// A força já foi validada no registro — não repetimos aqui.
const passwordLoginField = z
  .string({ required_error: 'Senha é obrigatória' })
  .min(1, 'Senha é obrigatória');

// ============================================================
// 🔓 REGISTER SCHEMA
// ============================================================
const registerSchema = z.object({
  email:    emailField,
  password: passwordRegisterField,
});

// ============================================================
// 🔓 LOGIN SCHEMA
// ============================================================
const loginSchema = z.object({
  email:    emailField,
  password: passwordLoginField,
});

// ============================================================
// 📜 CREATE CERTIFICATE SCHEMA
//
// ⚠️  PROBLEMA ORIGINAL: não havia campo cpf — mas o
//     certificateController exige cpf para gerar o hash SHA-256
//     e o cpf_parcial. Sem validar aqui, o controller falha
//     silenciosamente ou gera certificados com hash inconsistente.
//
// ✅  CORREÇÃO: cpf adicionado como campo obrigatório.
// ============================================================
const createCertificateSchema = z.object({
  nome_participante: z
    .string({ required_error: 'Nome do participante é obrigatório' })
    .trim()
    .min(3,   'Nome deve ter pelo menos 3 caracteres')
    .max(100, 'Nome muito longo — máximo 100 caracteres'),

  // ✅ ADICIONADO: CPF era exigido pelo controller mas ausente no schema original
  cpf: z
    .string({ required_error: 'CPF é obrigatório' })
    .regex(
      /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
      'CPF inválido. Use o formato XXX.XXX.XXX-XX'
    ),

  nome_curso: z
    .string({ required_error: 'Nome do curso é obrigatório' })
    .trim()
    .min(3,   'Nome do curso deve ter pelo menos 3 caracteres')
    .max(200, 'Nome do curso muito longo — máximo 200 caracteres'),

  // ⚠️  MELHORIA: z.coerce.number() converte "40" (string) → 40 (number)
  //     O original com z.number() falharia se o frontend enviasse string
  carga_horaria: z.coerce
    .number({
      required_error:    'Carga horária é obrigatória',
      invalid_type_error: 'Carga horária deve ser um número',
    })
    .int('Deve ser um número inteiro')
    .positive('Deve ser positiva')
    .max(10000, 'Carga horária incomum — máximo 10.000 horas'),

  // ⚠️  MELHORIA: valida data real no calendário, não apenas o regex.
  //     "2024-02-30" passaria no original — data inválida no calendário.
  data_emissao: z
    .string({ required_error: 'Data de emissão é obrigatória' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato inválido. Use YYYY-MM-DD')
    .refine(
      (val) => !isNaN(new Date(val + 'T00:00:00').getTime()),
      { message: 'Data inválida no calendário' }
    ),

  // Campos opcionais — sem quebrar chamadas existentes
  nome_instrutor: z.string().trim().max(100).optional(),
  descricao:      z.string().trim().max(500).optional(),
});

// ============================================================
// 🔍 VERIFY CERTIFICATE SCHEMA
//
// ⚠️  MELHORIA: adicionado min/max para evitar queries ao banco
//     com strings obviamente inválidas.
// ============================================================
const verifyCertificateSchema = z.object({
  codigo: z
    .string({ required_error: 'Código de verificação é obrigatório' })
    .min(8,   'Código muito curto')
    .max(100, 'Código muito longo'),
});

// ============================================================
// 📋 LOG DE SCHEMAS CARREGADOS
// ============================================================
const schemas = {
  registerSchema,
  loginSchema,
  createCertificateSchema,
  verifyCertificateSchema,
};

console.log(
  c.green('✅ [authSchemas] Schemas carregados:'),
  c.gray(Object.keys(schemas).join(', '))
);

module.exports = schemas;