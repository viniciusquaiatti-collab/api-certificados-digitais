const { registerSchema, loginSchema, createCertificateSchema } = require('../../backend/docs/src/schemas/auth.schema');

describe('Schemas de Validação', () => {
  describe('registerSchema', () => {
    it('deve validar dados válidos', () => {
      const validData = {
        nome: 'João Silva',
        email: 'joao@example.com',
        password: 'senha123'
      };
      // Correção: Passar os dados diretamente, não dentro de { body: ... }
      expect(() => registerSchema.parse(validData)).not.toThrow();
    });

    it('deve rejeitar dados inválidos', () => {
      const invalidData = {
        nome: 'J', // Nome muito curto
        email: 'invalido-email', // Email inválido
        password: '123' // Senha muito curta
      };
      // Correção: Passar os dados diretamente
      expect(() => registerSchema.parse(invalidData)).toThrow();
    });
  });

  describe('loginSchema', () => {
    it('deve validar dados válidos', () => {
      const validData = {
        email: 'joao@example.com',
        password: 'senha123'
      };
      // Correção: Passar os dados diretamente
      expect(() => loginSchema.parse(validData)).not.toThrow();
    });
  });

  describe('createCertificateSchema', () => {
    it('deve validar dados válidos', () => {
      const validData = {
        nome_participante: 'João Silva',
        nome_curso: 'Curso de Node.js',
        carga_horaria: 40,
        data_emissao: '2023-10-27'
      };
      // Correção: Passar os dados diretamente
      expect(() => createCertificateSchema.parse(validData)).not.toThrow();
    });
  });
});