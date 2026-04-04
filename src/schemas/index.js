const z = require('zod');

console.log('[Schemas] Iniciando o carregamento dos schemas de validação...');

// Schema para o registro de um novo usuário
const registerSchema = z.object({
  nome: z.string().min(2, { message: 'O nome deve ter pelo menos 2 caracteres.' }),
  email: z.string().email({ message: 'O formato do e-mail é inválido.' }),
  password: z.string().min(6, { message: 'A senha deve ter pelo menos 6 caracteres.' }),
});

// Schema para o login do usuário
const loginSchema = z.object({
  email: z.string().email({ message: 'O formato do e-mail é inválido.' }),
  password: z.string().min(1, { message: 'A senha é obrigatória.' }),
});

// Schema para a criação de um certificado
const createCertificateSchema = z.object({
  nome_participante: z.string().min(2, { message: 'O nome do participante é obrigatório.' }),
  nome_curso: z.string().min(2, { message: 'O nome do curso é obrigatório.' }),
  carga_horaria: z.number().int().positive({ message: 'A carga horária deve ser um número positivo.' }),
  data_emissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'A data de emissão deve estar no formato AAAA-MM-DD.' }),
});

// Schema para a verificação de um certificado (via parâmetro de rota)
const verifyCertificateSchema = z.object({
  codigo: z.string().min(1, { message: 'O código de verificação é obrigatório.' }),
});

console.log('[Schemas] Todos os schemas foram definidos e carregados com sucesso.');

module.exports = {
  registerSchema,
  loginSchema,
  createCertificateSchema,
  verifyCertificateSchema,
};