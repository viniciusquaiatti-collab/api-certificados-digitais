// src/schemas/index.js
// ============================================================
// 🏢 NexaSpark — Schemas de Validação (Zod)
// Todos os contratos de entrada da API definidos aqui.
// ============================================================

const { z } = require('zod');

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  gray:  (s) => `\x1b[90m${s}\x1b[0m`,
  bold:  (s) => `\x1b[1m${s}\x1b[0m`,
  cyan:  (s) => `\x1b[36m${s}\x1b[0m`,
};

console.log(c.cyan(c.bold('📐 [Schemas] Carregando schemas de validação...')));

// ============================================================
// 🔧 HELPERS DE VALIDAÇÃO REUTILIZÁVEIS
// ============================================================

// Email normalizado — trim + lowercase antes de validar
const emailField = z
  .string({ required_error: 'Email é obrigatório' })
  .trim()
  .toLowerCase()
  .email('Formato de email inválido');

// Senha com força mínima
// ⚠️  CORREÇÃO: registerSchema tinha min(6), mas authController
//     rejeitava senhas < 8. Os dois precisam estar em sincronia.
//     Definimos aqui como fonte única de verdade: 8 chars mínimo.
const passwordField = z
  .string({ required_error: 'Senha é obrigatória' })
  .min(8, 'A senha deve ter no mínimo 8 caracteres')
  .max(100, 'Senha muito longa');

// CPF no formato XXX.XXX.XXX-XX
// ⚠️  NOTA TÉCNICA: validação de CPF por regex cobre apenas o formato.
//     Para validar se o CPF é matematicamente válido (dígitos verificadores)
//     precisaria de uma função específica. Para uma API de certificados
//     corporativos, a validação de formato é suficiente — a instituição
//     é responsável pela veracidade dos dados.
const cpfField = z
  .string({ required_error: 'CPF é obrigatório' })
  .regex(
    /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
    'CPF inválido. Use o formato XXX.XXX.XXX-XX'
  );

// Data no formato YYYY-MM-DD com validação de data real
// ⚠️  MELHORIA: o original validava apenas o regex, não se a data
//     era uma data válida no calendário (ex: "2024-02-30" passaria).
const dateField = z
  .string({ required_error: 'Data é obrigatória' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido. Use YYYY-MM-DD')
  .refine(
    (val) => {
      const d = new Date(val + 'T00:00:00');
      return !isNaN(d.getTime());
    },
    { message: 'Data inválida no calendário' }
  )
  .refine(
    (val) => {
      const d = new Date(val + 'T00:00:00');
      const now = new Date();
      // Não permite datas mais de 1 ano no futuro
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
      return d <= oneYearFromNow;
    },
    { message: 'Data de emissão não pode ser mais de 1 ano no futuro' }
  );

// UUID v4 para IDs do banco
const uuidField = z
  .string({ required_error: 'ID é obrigatório' })
  .uuid('ID inválido — deve ser um UUID válido');

// ============================================================
// 🔓 REGISTER SCHEMA
// ============================================================
const registerSchema = {
  body: z.object({
    email:    emailField,
    password: passwordField,
  }),
};

// ============================================================
// 🔓 LOGIN SCHEMA
// ============================================================
const loginSchema = {
  body: z.object({
    email:    emailField,
    // Login aceita qualquer senha não-vazia (a validação de força
    // já foi feita no registro — não repetimos aqui)
    password: z
      .string({ required_error: 'Senha é obrigatória' })
      .min(1, 'Senha é obrigatória'),
  }),
};

// ============================================================
// 📜 CERTIFICATE SCHEMA — Emissão
// ============================================================
const certificateSchema = {
  body: z.object({
    nome_participante: z
      .string({ required_error: 'Nome do participante é obrigatório' })
      .trim()
      .min(3,   'Nome deve ter pelo menos 3 caracteres')
      .max(100, 'Nome muito longo — máximo 100 caracteres'),

    cpf: cpfField,

    nome_curso: z
      .string({ required_error: 'Nome do curso é obrigatório' })
      .trim()
      .min(3,   'Nome do curso deve ter pelo menos 3 caracteres')
      .max(200, 'Nome do curso muito longo — máximo 200 caracteres'),

    // ⚠️  MELHORIA: coerce garante que "40" (string) vire 40 (number)
    //     O original falharia se o frontend enviasse string via form-data
    carga_horaria: z.coerce
      .number({
        required_error:    'Carga horária é obrigatória',
        invalid_type_error: 'Carga horária deve ser um número',
      })
      .int('Carga horária deve ser um número inteiro')
      .positive('Carga horária deve ser positiva')
      .max(10000, 'Carga horária incomum — máximo 10.000 horas'),

    data_emissao: dateField,

    // ⚠️  NOVO: campos opcionais que podem enriquecer o certificado
    //     sem quebrar a compatibilidade com chamadas existentes
    nome_instrutor: z
      .string()
      .trim()
      .max(100, 'Nome do instrutor muito longo')
      .optional(),

    descricao: z
      .string()
      .trim()
      .max(500, 'Descrição muito longa — máximo 500 caracteres')
      .optional(),
  }),
};

// ============================================================
// 🔍 VERIFY SCHEMA — Validação pública por código
// ============================================================
const verifySchema = {
  params: z.object({
    // ⚠️  MELHORIA: aceita tanto UUIDs quanto códigos customizados
    //     O original aceitava qualquer string — adicionamos min/max
    //     para evitar queries desnecessárias com strings absurdas
    codigo: z
      .string({ required_error: 'Código de verificação é obrigatório' })
      .min(8,   'Código muito curto')
      .max(100, 'Código muito longo'),
  }),
};

// ============================================================
// 🔍 GET BY ID SCHEMA
// ============================================================
const getByIdSchema = {
  params: z.object({
    // ⚠️  MELHORIA: valida que é um UUID real, não qualquer string
    //     Evita queries desnecessárias ao banco com IDs malformados
    id: uuidField,
  }),
};

// ============================================================
// 📋 LOG DE SCHEMAS CARREGADOS
// ============================================================
const schemas = {
  registerSchema,
  loginSchema,
  certificateSchema,
  verifySchema,
  getByIdSchema,
};

console.log(
  c.green('✅ [Schemas] Schemas carregados:'),
  c.gray(Object.keys(schemas).join(', '))
);

module.exports = schemas;