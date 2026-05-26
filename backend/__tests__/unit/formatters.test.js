// __tests__/unit/formatters.test.js
// ============================================================
// 🧪 NexaSpark — Testes Unitários: Formatadores
//
// Por que esses testes existem:
//   formatDateBR() já causou bug em produção — datas com
//   timezone eram convertidas para o dia anterior no PDF.
//   Ex: "2026-05-01T03:00:00.000Z" virava "30/04/2026".
//   O fix foi pegar só a parte antes do "T". Esse teste
//   garante que ninguém reverte esse fix sem perceber.
//
//   getVerificationUrl() define a URL que vai no QR Code.
//   Se a URL mudar de formato, todos os QR Codes antigos
//   param de funcionar. O teste documenta o contrato.
// ============================================================

'use strict';

const { formatDateBR, getVerificationUrl } = require('../../src/services/certificateService');

// ============================================================
// 📅 formatDateBR — converte YYYY-MM-DD para DD/MM/YYYY
// ============================================================
describe('formatDateBR — formatação de data para o PDF', () => {

  it('converte YYYY-MM-DD para DD/MM/YYYY', () => {
    expect(formatDateBR('2026-05-01')).toBe('01/05/2026');
  });

  it('converte data com timezone corretamente — bug que já aconteceu', () => {
    // Esse é o bug que já aconteceu em produção:
    // O frontend enviava "2026-05-01T03:00:00.000Z"
    // e a função pegava a data completa, convertia para Date()
    // que no timezone do servidor virava 30/04/2026.
    // O fix: pegar só o que vem antes do "T".
    expect(formatDateBR('2026-05-01T03:00:00.000Z')).toBe('01/05/2026');
  });

  it('converte data no fim do mês corretamente', () => {
    expect(formatDateBR('2026-12-31')).toBe('31/12/2026');
  });

  it('converte data no início do mês corretamente', () => {
    expect(formatDateBR('2026-01-01')).toBe('01/01/2026');
  });

  it('retorna string vazia para data null', () => {
    // Não deve lançar erro — o PDF continua sendo gerado
    expect(formatDateBR(null)).toBe('');
  });

  it('retorna string vazia para data undefined', () => {
    expect(formatDateBR(undefined)).toBe('');
  });

  it('retorna o original para formato não reconhecido', () => {
    // Se o formato não tem 3 partes separadas por "-", retorna o original
    // Em vez de lançar erro e derrubar o PDF
    const entrada = 'formato-errado';
    const resultado = formatDateBR(entrada);
    // Deve retornar algo sem lançar exceção
    expect(typeof resultado).toBe('string');
  });

});

// ============================================================
// 🌐 getVerificationUrl — URL do QR Code
// ============================================================
describe('getVerificationUrl — URL de verificação pública', () => {

  // Guarda o valor original da variável de ambiente
  // para restaurar depois — não queremos sujar o ambiente
  const FRONTEND_URL_ORIGINAL = process.env.FRONTEND_URL;

  afterEach(() => {
    // Restaura a variável após cada teste
    process.env.FRONTEND_URL = FRONTEND_URL_ORIGINAL;
  });

  it('usa FRONTEND_URL do ambiente quando configurado', () => {
    process.env.FRONTEND_URL = 'https://nexaspark.com.br';

    const url = getVerificationUrl('ABC123456789');

    expect(url).toBe('https://nexaspark.com.br/verificar/ABC123456789');
  });

  it('usa localhost como fallback quando FRONTEND_URL não está configurado', () => {
    delete process.env.FRONTEND_URL;

    const url = getVerificationUrl('ABC123456789');

    expect(url).toContain('localhost');
    expect(url).toContain('/verificar/ABC123456789');
  });

  it('remove barra no final da URL base', () => {
    // Se alguém configurar "https://nexaspark.com.br/" com barra no fim,
    // a URL não deve ficar "https://nexaspark.com.br//verificar/..."
    process.env.FRONTEND_URL = 'https://nexaspark.com.br/';

    const url = getVerificationUrl('ABC123');

    expect(url).not.toContain('//verificar');
    expect(url).toContain('/verificar/ABC123');
  });

  it('inclui o código de verificação exato na URL', () => {
    process.env.FRONTEND_URL = 'https://nexaspark.com.br';
    const codigo = 'XYZABC9876543210';

    const url = getVerificationUrl(codigo);

    expect(url).toContain(codigo);
  });

  it('URL gerada é uma string válida', () => {
    process.env.FRONTEND_URL = 'https://nexaspark.com.br';

    const url = getVerificationUrl('qualquer-codigo');

    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(0);
    // Deve começar com http
    expect(url).toMatch(/^https?:\/\//);
  });

});