// __tests__/unit/crypto.test.js
// ============================================================
// 🧪 NexaSpark — Testes Unitários: Funções de Criptografia
//
// Por que esses testes existem:
//   generateHash() é o coração do sistema. É ela que garante
//   que um certificado é imutável. Se alguém mudar qualquer
//   detalhe da normalização (trim, uppercase, join com |),
//   todos os certificados antigos param de verificar.
//   Esse teste captura isso antes de chegar em produção.
//
//   hashCpf() e validateCpf() protegem LGPD — se quebrarem,
//   CPFs podem ser armazenados em texto puro sem ninguém notar.
//
// Esses testes não precisam de banco, servidor ou internet.
// Rodam em milissegundos e cobrem o que mais importa.
// ============================================================

'use strict';

// Importa as funções diretamente — sem subir o servidor
const { generateHash, maskCPF }   = require('../../src/services/certificateService');
const { hashCpf, validateCpf }    = require('../../src/models/User');

// ============================================================
// 🔐 generateHash — assinatura digital SHA-256
// ============================================================
describe('generateHash — assinatura digital SHA-256', () => {

  // Payload base que usamos em vários testes
  const payloadBase = {
    nome_participante: 'João da Silva',
    cpf:               '123.456.789-09',
    nome_curso:        'Curso de Node.js',
    carga_horaria:     40,
    data_emissao:      '2026-05-01',
    codigo_verificacao:'ABC123456789',
  };

  it('retorna objeto com hash e hashPreview', () => {
    const resultado = generateHash(payloadBase);

    // Garante que o retorno tem os dois campos que o controller usa
    expect(resultado).toHaveProperty('hash');
    expect(resultado).toHaveProperty('hashPreview');
  });

  it('hash tem 64 caracteres — SHA-256 em hex sempre tem 64', () => {
    const { hash } = generateHash(payloadBase);
    expect(hash).toHaveLength(64);
  });

  it('hashPreview tem 32 caracteres — primeiros 32 do hash em uppercase', () => {
    const { hash, hashPreview } = generateHash(payloadBase);

    expect(hashPreview).toHaveLength(32);
    // hashPreview deve ser o início do hash em uppercase
    expect(hash.slice(0, 32).toUpperCase()).toBe(hashPreview);
  });

  it('mesmo payload sempre gera mesmo hash — determinismo', () => {
    // Isso é fundamental: verificação pública depende disso
    // Se o hash mudar entre chamadas, o certificado nunca verifica
    const { hash: hash1 } = generateHash(payloadBase);
    const { hash: hash2 } = generateHash(payloadBase);

    expect(hash1).toBe(hash2);
  });

  it('payloads diferentes geram hashes diferentes', () => {
    const { hash: hash1 } = generateHash(payloadBase);
    const { hash: hash2 } = generateHash({
      ...payloadBase,
      nome_participante: 'Maria da Silva', // só o nome mudou
    });

    expect(hash1).not.toBe(hash2);
  });

  it('normaliza nome em uppercase — espaços extras ignorados', () => {
    // "joão  da  silva" e "JOÃO DA SILVA" devem gerar o mesmo hash
    // porque a função faz trim().toUpperCase().replace(/\s+/g, ' ')
    const { hash: hash1 } = generateHash({
      ...payloadBase,
      nome_participante: 'JOÃO DA SILVA',
    });
    const { hash: hash2 } = generateHash({
      ...payloadBase,
      nome_participante: '  joão   da   silva  ',
    });

    expect(hash1).toBe(hash2);
  });

  it('normaliza curso em uppercase — espaços extras ignorados', () => {
    const { hash: hash1 } = generateHash({
      ...payloadBase,
      nome_curso: 'CURSO DE NODE.JS',
    });
    const { hash: hash2 } = generateHash({
      ...payloadBase,
      nome_curso: '  curso  de  node.js  ',
    });

    expect(hash1).toBe(hash2);
  });

  it('CPF com ou sem pontuação gera mesmo hash', () => {
    // A função extrai só os dígitos do CPF
    // Então "123.456.789-09" e "12345678909" são equivalentes
    const { hash: hash1 } = generateHash({
      ...payloadBase,
      cpf: '123.456.789-09',
    });
    const { hash: hash2 } = generateHash({
      ...payloadBase,
      cpf: '12345678909',
    });

    expect(hash1).toBe(hash2);
  });

  it('carga_horaria como number e string geram mesmo hash', () => {
    // O frontend pode enviar "40" (string) ou 40 (number)
    // A função converte para string com String(), então são equivalentes
    const { hash: hash1 } = generateHash({ ...payloadBase, carga_horaria: 40 });
    const { hash: hash2 } = generateHash({ ...payloadBase, carga_horaria: '40' });

    expect(hash1).toBe(hash2);
  });

});

// ============================================================
// 🛡️  hashCpf — SHA-256 do CPF (LGPD Art. 46)
// ============================================================
describe('hashCpf — proteção LGPD do CPF', () => {

  it('retorna string de 64 caracteres em uppercase', () => {
    const hash = hashCpf('123.456.789-09');

    expect(typeof hash).toBe('string');
    expect(hash).toHaveLength(64);
    // SHA-256 em hex uppercase — só letras A-F e números
    expect(hash).toMatch(/^[0-9A-F]+$/);
  });

  it('CPF com e sem pontuação gera mesmo hash', () => {
    // Fundamental: o mesmo CPF deve ter o mesmo hash
    // independente de como foi digitado
    const hash1 = hashCpf('123.456.789-09');
    const hash2 = hashCpf('12345678909');

    expect(hash1).toBe(hash2);
  });

  it('CPFs diferentes geram hashes diferentes', () => {
    const hash1 = hashCpf('123.456.789-09');
    const hash2 = hashCpf('987.654.321-00');

    expect(hash1).not.toBe(hash2);
  });

  it('mesmo CPF sempre gera mesmo hash — determinismo', () => {
    const hash1 = hashCpf('111.222.333-44');
    const hash2 = hashCpf('111.222.333-44');

    expect(hash1).toBe(hash2);
  });

  it('retorna null para CPF vazio', () => {
    // A função deve retornar null, não lançar erro
    const hash = hashCpf('');
    expect(hash).toBeNull();
  });

  it('retorna null para CPF null/undefined', () => {
    const hash = hashCpf(null);
    expect(hash).toBeNull();
  });

  it('hash nunca expõe o CPF original', () => {
    const cpf  = '123.456.789-09';
    const hash = hashCpf(cpf);

    // O hash não deve conter o CPF nem os dígitos em sequência
    expect(hash).not.toContain('123456789');
    expect(hash).not.toContain('123.456');
  });

});

// ============================================================
// ✅ validateCpf — dígitos verificadores
// ============================================================
describe('validateCpf — validação matemática do CPF', () => {

  it('aceita CPF válido com pontuação', () => {
    // CPF matematicamente válido
    expect(validateCpf('529.982.247-25')).toBe(true);
  });

  it('aceita CPF válido sem pontuação', () => {
    expect(validateCpf('52998224725')).toBe(true);
  });

  it('rejeita CPF com dígito verificador errado', () => {
    // Mudamos o último dígito — dígito verificador inválido
    expect(validateCpf('529.982.247-26')).toBe(false);
  });

  it('rejeita CPF com todos os dígitos iguais', () => {
    // CPFs como 111.111.111-11 são matematicamente válidos
    // mas são conhecidos como CPFs inválidos por convenção
    expect(validateCpf('111.111.111-11')).toBe(false);
    expect(validateCpf('000.000.000-00')).toBe(false);
    expect(validateCpf('999.999.999-99')).toBe(false);
  });

  it('rejeita CPF com menos de 11 dígitos', () => {
    expect(validateCpf('123.456.789')).toBe(false);
  });

  it('rejeita CPF vazio', () => {
    expect(validateCpf('')).toBe(false);
  });

  it('rejeita CPF null/undefined', () => {
    expect(validateCpf(null)).toBe(false);
    expect(validateCpf(undefined)).toBe(false);
  });

});

// ============================================================
// 📱 maskCPF — proteção LGPD para exibição
// ============================================================
describe('maskCPF — máscara para exibição pública', () => {

  it('retorna formato ***.***.***-XX com os 2 últimos dígitos', () => {
    const resultado = maskCPF('123.456.789-09');

    expect(resultado).toBe('***.***.***-09');
  });

  it('funciona com CPF sem pontuação', () => {
    const resultado = maskCPF('12345678909');

    // Os 2 últimos dígitos de 12345678909 são "09"
    expect(resultado).toBe('***.***.***-09');
  });

  it('não expõe os dígitos do meio', () => {
    const resultado = maskCPF('529.982.247-25');

    expect(resultado).not.toContain('529');
    expect(resultado).not.toContain('982');
    expect(resultado).not.toContain('247');
    // Só os 2 últimos são visíveis
    expect(resultado).toContain('25');
  });

  it('retorna máscara padrão para CPF vazio', () => {
    const resultado = maskCPF('');
    expect(resultado).toBe('***.***.***-**');
  });

  it('retorna máscara padrão para CPF null', () => {
    const resultado = maskCPF(null);
    expect(resultado).toBe('***.***.***-**');
  });

});