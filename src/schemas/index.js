// src/schemas/index.js
const { z } = require('zod');

console.log('[Schemas] Iniciando carregamento dos schemas de validação...');

// ===========================================
// SCHEMA DE REGISTRO (apenas email + senha)
// ===========================================
const registerSchema = {
  body: z.object({
    email: z.string({
      required_error: 'Email é obrigatório'
    }).email('Email inválido'),
    
    password: z.string({
      required_error: 'Senha é obrigatória'
    }).min(6, 'Senha deve ter pelo menos 6 caracteres').max(100, 'Senha muito longa')
  })
};

// ===========================================
// SCHEMA DE LOGIN (apenas email + senha)
// ===========================================
const loginSchema = {
  body: z.object({
    email: z.string({
      required_error: 'Email é obrigatório'
    }).email('Email inválido'),
    
    password: z.string({
      required_error: 'Senha é obrigatória'
    }).min(1, 'Senha é obrigatória')
  })
};

// ===========================================
// SCHEMA DE CERTIFICADO (dados completos)
// ===========================================
const certificateSchema = {
  body: z.object({
    nome_participante: z.string({
      required_error: 'Nome do participante é obrigatório'
    }).min(3, 'Nome deve ter pelo menos 3 caracteres').max(100, 'Nome muito longo'),
    
    cpf: z.string({
      required_error: 'CPF é obrigatório'
    }).regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF inválido. Use o formato XXX.XXX.XXX-XX'),
    
    nome_curso: z.string({
      required_error: 'Nome do curso é obrigatório'
    }).min(3, 'Nome do curso deve ter pelo menos 3 caracteres').max(200, 'Nome do curso muito longo'),
    
    carga_horaria: z.number({
      required_error: 'Carga horária é obrigatória',
      invalid_type_error: 'Carga horária deve ser um número'
    }).int('Carga horária deve ser um número inteiro').positive('Carga horária deve ser positiva'),
    
    data_emissao: z.string({
      required_error: 'Data de emissão é obrigatória'
    }).regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida. Use o formato YYYY-MM-DD')
  })
};

// ===========================================
// SCHEMA DE VERIFICAÇÃO (PÚBLICO - SEM AUTH)
// ===========================================
const verifySchema = {
  params: z.object({
    codigo: z.string({
      required_error: 'Código de verificação é obrigatório'
    }).min(1, 'Código de verificação é obrigatório')
  })
};

// ===========================================
// SCHEMA DE BUSCA POR ID
// ===========================================
const getByIdSchema = {
  params: z.object({
    id: z.string({
      required_error: 'ID é obrigatório'
    }).min(1, 'ID é obrigatório')
  })
};

console.log('[Schemas] Todos os schemas foram definidos e carregados com sucesso.');

module.exports = {
  registerSchema,
  loginSchema,
  certificateSchema,
  verifySchema,
  getByIdSchema
};