// src/models/User.js
// ============================================================
// 🏢 NexaSpark — User Model v2.1 ENTERPRISE DEBUG
//
// HISTÓRICO:
//   v1.0 → CRUD básico
//   v2.0 → Anti-abuse: CPF hash, device FP, IP, abuse score
//   v2.1 → 🔴 FIX CRÍTICO: c.brightWhite not a function
//           brightWhite existia em ANSI mas estava AUSENTE
//           no objeto c — derrubava o servidor no boot.
//           + Debug nível empresa global em TODOS os métodos
//
// ⚠️  LGPD Art. 46: CPF NUNCA armazenado em texto puro.
//     Apenas SHA-256 hex uppercase é persistido no banco.
// ============================================================

'use strict';

const { pool } = require('../database/db');
const crypto   = require('crypto');

// ============================================================
// 🎨 ANSI — paleta completa de cores
// ============================================================
const ANSI = {
  reset:         '\x1b[0m',
  bold:          '\x1b[1m',
  dim:           '\x1b[2m',
  red:           '\x1b[31m',
  green:         '\x1b[32m',
  yellow:        '\x1b[33m',
  blue:          '\x1b[34m',
  magenta:       '\x1b[35m',
  cyan:          '\x1b[36m',
  white:         '\x1b[37m',
  gray:          '\x1b[90m',
  brightRed:     '\x1b[91m',
  brightGreen:   '\x1b[92m',
  brightYellow:  '\x1b[93m',
  brightBlue:    '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan:    '\x1b[96m',
  brightWhite:   '\x1b[97m',  // ← estava no ANSI mas AUSENTE no objeto c — FIX v2.1
  bgRed:         '\x1b[41m',
  bgGreen:       '\x1b[42m',
  bgYellow:      '\x1b[43m',
  bgBlue:        '\x1b[44m',
  bgMagenta:     '\x1b[45m',
  bgCyan:        '\x1b[46m',
};

// ============================================================
// 🖌️  OBJETO c — funções coloridas (TODAS as cores do ANSI)
//
// v2.1 FIX: brightWhite adicionado — era a causa do crash:
//   "c.brightWhite is not a function"
// ============================================================
const c = {
  // Cores normais
  red:           (s) => `${ANSI.red}${s}${ANSI.reset}`,
  green:         (s) => `${ANSI.green}${s}${ANSI.reset}`,
  yellow:        (s) => `${ANSI.yellow}${s}${ANSI.reset}`,
  blue:          (s) => `${ANSI.blue}${s}${ANSI.reset}`,
  magenta:       (s) => `${ANSI.magenta}${s}${ANSI.reset}`,
  cyan:          (s) => `${ANSI.cyan}${s}${ANSI.reset}`,
  white:         (s) => `${ANSI.white}${s}${ANSI.reset}`,
  gray:          (s) => `${ANSI.gray}${s}${ANSI.reset}`,

  // Cores brilhantes
  brightRed:     (s) => `${ANSI.brightRed}${s}${ANSI.reset}`,
  brightGreen:   (s) => `${ANSI.brightGreen}${s}${ANSI.reset}`,
  brightYellow:  (s) => `${ANSI.brightYellow}${s}${ANSI.reset}`,
  brightBlue:    (s) => `${ANSI.brightBlue}${s}${ANSI.reset}`,
  brightMagenta: (s) => `${ANSI.brightMagenta}${s}${ANSI.reset}`,
  brightCyan:    (s) => `${ANSI.brightCyan}${s}${ANSI.reset}`,
  brightWhite:   (s) => `${ANSI.brightWhite}${s}${ANSI.reset}`, // ✅ FIX v2.1

  // Formatação
  bold:          (s) => `${ANSI.bold}${s}${ANSI.reset}`,
  dim:           (s) => `${ANSI.dim}${s}${ANSI.reset}`,

  // Badges coloridos
  danger:        (s) => `${ANSI.bgRed}${ANSI.brightWhite}${ANSI.bold} ${s} ${ANSI.reset}`,
  success:       (s) => `${ANSI.bgGreen}${ANSI.white}${ANSI.bold} ${s} ${ANSI.reset}`,
  warn:          (s) => `${ANSI.bgYellow}${ANSI.bold} ${s} ${ANSI.reset}`,
  info:          (s) => `${ANSI.bgBlue}${ANSI.brightWhite}${ANSI.bold} ${s} ${ANSI.reset}`,
  abuse:         (s) => `${ANSI.bgMagenta}${ANSI.brightWhite}${ANSI.bold} ${s} ${ANSI.reset}`,
};

// ============================================================
// 🕐 HELPERS DE LOG
// ============================================================
const ts      = () => c.gray(`[${new Date().toISOString()}]`);
const pid     = () => c.dim(`[PID:${process.pid}]`);
const fmt     = (d) => { try { return c.gray(JSON.stringify(d ?? '')); } catch { return c.gray('[não serializável]'); } };
const sep     = ()  => console.log(c.gray('─'.repeat(80)));
const sepBold = ()  => console.log(c.brightGreen('═'.repeat(80)));

// Performance semafórica — thresholds calibrados para PostgreSQL
const fmtMs = (ms) =>
  ms < 30   ? c.brightGreen(`${ms}ms ⚡ ultrarrápido`) :
  ms < 100  ? c.brightGreen(`${ms}ms ✅`) :
  ms < 300  ? c.brightYellow(`${ms}ms 🟡 atenção`) :
  ms < 1000 ? c.yellow(`${ms}ms 🟠 lento`) :
              c.brightRed(`${ms}ms 🔴 CRÍTICO — verifique EXPLAIN ANALYZE`);

// ============================================================
// 📋 LOGGER ENTERPRISE — nível empresa global
//
// Cada método tem escopo, timestamp ISO, PID, e dados ricos.
// Nunca expõe CPF, senha ou token em texto puro.
// ============================================================
const logger = {
  // ── Informativos ────────────────────────────────────────
  info: (scope, msg, data) => {
    console.log(ts(), pid(), c.brightCyan(`ℹ️  [User:${scope}]`), c.brightWhite(msg), fmt(data));
  },

  // ── Sucesso ─────────────────────────────────────────────
  ok: (scope, msg, data) => {
    console.log(ts(), pid(), c.brightGreen(`✅ [User:${scope}]`), c.brightWhite(msg), fmt(data));
  },

  // ── Aviso ───────────────────────────────────────────────
  warn: (scope, msg, data) => {
    console.warn(ts(), pid(), c.brightYellow(`⚠️  [User:${scope}]`), c.yellow(msg), fmt(data));
  },

  // ── Erro ────────────────────────────────────────────────
  error: (scope, msg, data) => {
    console.error(ts(), pid(), c.brightRed(`❌ [User:${scope}]`), c.red(c.bold(msg)), fmt(data));
  },

  // ── Performance ─────────────────────────────────────────
  perf: (scope, label, ms) => {
    console.log(ts(), pid(), c.magenta(`⏱️  [User:PERF:${scope}]`), c.brightWhite(label), '→', fmtMs(ms));
  },

  // ── Database ────────────────────────────────────────────
  db: (scope, msg, data) => {
    console.log(ts(), pid(), c.brightYellow(`🗄️  [User:DB:${scope}]`), c.brightWhite(msg), fmt(data));
  },

  // ── Segurança ────────────────────────────────────────────
  sec: (msg, data) => {
    console.warn(ts(), pid(), c.danger('🚨 SECURITY'), c.red(c.bold(msg)), fmt(data));
  },

  // ── LGPD ────────────────────────────────────────────────
  lgpd: (msg, data) => {
    console.log(ts(), pid(), c.brightGreen(`🛡️  [User:LGPD]`), c.brightWhite(msg), fmt(data));
  },

  // ── Abuso ────────────────────────────────────────────────
  abuse: (msg, data) => {
    console.warn(ts(), pid(), c.abuse('🚩 ABUSE'), c.yellow(c.bold(msg)), fmt(data));
  },

  // ── Flow (etapas de um método) ───────────────────────────
  flow: (scope, step, msg, data) => {
    console.log(ts(), pid(),
      c.brightMagenta(`🔀 [User:${scope}]`),
      c.bold(`[STEP ${step}]`),
      c.brightWhite(msg),
      fmt(data)
    );
  },

  // ── Resultado final ──────────────────────────────────────
  result: (scope, status, data) => {
    const icon  = status === 'ok' ? '✅' : status === 'warn' ? '⚠️ ' : '❌';
    const label = status === 'ok' ? c.brightGreen('SUCCESS') : status === 'warn' ? c.brightYellow('WARNING') : c.brightRed('FAILURE');
    console.log(ts(), pid(), `${icon} [User:${scope}]`, label, fmt(data));
  },

  // ── Stack trace ──────────────────────────────────────────
  stack: (scope, error) => {
    const lines = (error.stack || error.message || String(error)).split('\n').slice(0, 6);
    console.error(ts(), pid(), c.brightRed(`💥 [User:${scope}:STACK]`));
    lines.forEach(line => console.error(c.red(`   ${line}`)));
  },

  // ── Separadores ──────────────────────────────────────────
  sep:     () => console.log(c.gray('─'.repeat(80))),
  sepBold: () => console.log(c.brightGreen('═'.repeat(80))),
};

// ============================================================
// 🔐 HELPER — hashCpf (LGPD Art. 46)
// ============================================================
function hashCpf(cpf) {
  console.log(ts(), pid(), c.brightGreen(`🛡️  [User:LGPD:hashCpf]`), c.brightWhite('Iniciando hash SHA-256 do CPF...'));

  if (!cpf) {
    logger.warn('hashCpf', 'CPF nulo ou vazio — retornando null');
    return null;
  }

  const digits = String(cpf).replace(/\D/g, '');
  console.log(ts(), pid(), c.brightGreen(`🛡️  [User:LGPD:hashCpf]`), c.brightWhite('CPF normalizado'), fmt({ digits_length: digits.length, sufixo: digits.slice(-2) }));

  if (digits.length !== 11) {
    logger.warn('hashCpf', `CPF com ${digits.length} dígitos — esperado 11`, { digits_length: digits.length });
  }

  const hash = crypto.createHash('sha256').update(digits, 'utf8').digest('hex').toUpperCase();

  logger.lgpd('hashCpf — SHA-256 gerado', {
    sufixo:    digits.slice(-2),
    hash_prefix: hash.substring(0, 16) + '...[TRUNCADO]',
    algoritmo: 'SHA-256 (FIPS 180-4)',
    lgpd:      'Art. 46 — CPF original NÃO armazenado',
  });

  return hash;
}

// ============================================================
// 🔐 HELPER — validateCpf (dígitos verificadores)
// ============================================================
function validateCpf(cpf) {
  console.log(ts(), pid(), c.brightCyan(`ℹ️  [User:validateCpf]`), c.brightWhite('Validando CPF (dígitos verificadores)...'));

  const digits = String(cpf || '').replace(/\D/g, '');

  if (digits.length !== 11) {
    logger.warn('validateCpf', `Tamanho incorreto: ${digits.length} dígitos`);
    return false;
  }

  if (/^(\d)\1{10}$/.test(digits)) {
    logger.warn('validateCpf', 'CPF com sequência repetida rejeitado', { sufixo: digits.slice(-2) });
    return false;
  }

  // Primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  if (rem !== parseInt(digits[9])) {
    logger.warn('validateCpf', '1º dígito verificador inválido', { esperado: rem, recebido: digits[9] });
    return false;
  }

  // Segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  if (rem !== parseInt(digits[10])) {
    logger.warn('validateCpf', '2º dígito verificador inválido', { esperado: rem, recebido: digits[10] });
    return false;
  }

  logger.ok('validateCpf', '✅ CPF matematicamente válido', { sufixo: digits.slice(-2) });
  return true;
}

// ============================================================
// 🛡️  HELPER — sanitize (nunca expõe dados sensíveis em log)
// ============================================================
function sanitize(obj) {
  if (!obj) return null;
  const clone = { ...obj };
  if (clone.senha_hash)         clone.senha_hash         = '[REDACTED]';
  if (clone.cpf_emissor_hash)   clone.cpf_emissor_hash   = clone.cpf_emissor_hash?.substring(0, 12) + '...[HASH]';
  if (clone.device_fingerprint) clone.device_fingerprint = clone.device_fingerprint?.substring(0, 8) + '...[FP]';
  return clone;
}

// ============================================================
// 🖥️  BOOT — exibido ao carregar o módulo
// ============================================================
logger.sepBold();
console.log(`${ANSI.brightGreen}👤  ${ANSI.bold}${ANSI.brightWhite}NexaSpark User Model v2.1 ENTERPRISE DEBUG${ANSI.reset}`);
console.log(`${ANSI.gray}    Fix: c.brightWhite is not a function — CORRIGIDO v2.1${ANSI.reset}`);
logger.info('BOOT', 'Módulo carregado com sucesso', {
  version:    '2.1.0',
  fix:        'c.brightWhite adicionado ao objeto c (era undefined)',
  features:   ['SHA-256 CPF hash', 'Device fingerprint', 'IP tracking', 'Abuse score', 'Plan limits'],
  lgpd:       'CPF nunca em texto puro — SHA-256 only (Art. 46)',
  plano_free: '3 certificados/mês',
  pid:        process.pid,
  node:       process.version,
  env:        process.env.NODE_ENV || 'development',
  ts:         new Date().toISOString(),
});
logger.sepBold();

// ============================================================
// 📝 CREATE — Cria usuário com campos anti-abuse
// ============================================================
async function create({
  email,
  senha_hash,
  cpf_emissor        = null,
  nome_completo      = null,
  telefone           = null,
  device_fingerprint = null,
  ip_cadastro        = null,
}) {
  const t0 = Date.now();
  logger.sep();
  logger.flow('CREATE', 1, '🚀 Iniciando criação de usuário...');

  const emailNorm        = email?.trim().toLowerCase();
  const cpf_emissor_hash = cpf_emissor ? hashCpf(cpf_emissor) : null;

  logger.flow('CREATE', 2, '📋 Dados normalizados', {
    email:                emailNorm,
    emailMudou:           email !== emailNorm,
    hasCpf:               !!cpf_emissor_hash,
    hasDeviceFingerprint: !!device_fingerprint,
    hasNomeCompleto:      !!nome_completo,
    hasTelefone:          !!telefone,
    ip_cadastro:          ip_cadastro || null,
    ts:                   new Date().toISOString(),
  });

  logger.db('CREATE', '🗄️  Preparando INSERT INTO users...', {
    colunas: ['email','senha_hash','cpf_emissor_hash','nome_completo',
              'telefone','device_fingerprint','ip_cadastro',
              'plano','plano_limite','abuse_score','bloqueado','criado_em'],
    strategy: 'RETURNING id, email, plano — único round-trip',
  });

  try {
    logger.flow('CREATE', 3, '⏳ Executando INSERT no PostgreSQL...');
    const tDb = Date.now();

    const result = await pool.query(
      `INSERT INTO users (
         email, senha_hash, cpf_emissor_hash, nome_completo,
         telefone, device_fingerprint, ip_cadastro,
         plano, plano_limite, abuse_score, bloqueado, criado_em
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,'free',3,0,FALSE,NOW())
       RETURNING id, email, nome_completo, plano, plano_limite,
                 abuse_score, bloqueado, criado_em`,
      [
        emailNorm,
        senha_hash,
        cpf_emissor_hash,
        nome_completo      || null,
        telefone           || null,
        device_fingerprint || null,
        ip_cadastro        || null,
      ]
    );

    const dbMs = Date.now() - tDb;
    logger.perf('CREATE', 'INSERT INTO users', dbMs);

    const user = result.rows[0];

    logger.flow('CREATE', 4, '✅ Usuário persistido no banco', sanitize(user));
    logger.result('CREATE', 'ok', {
      id:          user.id,
      email:       user.email,
      plano:       user.plano,
      plano_limite: user.plano_limite,
      criado_em:   user.criado_em,
      totalMs:     Date.now() - t0,
    });
    logger.sep();

    return user;

  } catch (error) {
    logger.perf('CREATE', 'INSERT falhou em', Date.now() - t0);

    if (error.code === '23505') {
      const constraint = error.constraint || error.detail || '';
      logger.warn('CREATE', `⚠️  Unique violation detectada`, { constraint, detail: error.detail });

      if (constraint.includes('email') || constraint.includes('users_email')) {
        logger.warn('CREATE', '📧 Email duplicado', { email: emailNorm });
        const err = new Error('Email já cadastrado');
        err.code  = 'EMAIL_DUPLICATE';
        logger.sep();
        throw err;
      }

      if (constraint.includes('cpf_emissor_hash') || constraint.includes('idx_users_cpf')) {
        logger.sec('🚩 CPF já existe em outra conta — multi-account detectado', {
          hash_prefix: cpf_emissor_hash?.substring(0, 12) + '...',
          email:       emailNorm,
          ip:          ip_cadastro,
          alerta:      '🚨 POSSÍVEL ABUSO — mesmo CPF em múltiplas contas',
        });
        const err = new Error('CPF já vinculado a outra conta');
        err.code    = 'CPF_DUPLICATE';
        err.isAbuse = true;
        logger.sep();
        throw err;
      }

      if (constraint.includes('telefone') || constraint.includes('idx_users_telefone')) {
        logger.sec('📱 Telefone já existe em outra conta', { email: emailNorm, ip: ip_cadastro });
        const err = new Error('Telefone já vinculado a outra conta');
        err.code    = 'PHONE_DUPLICATE';
        err.isAbuse = true;
        logger.sep();
        throw err;
      }

      logger.error('CREATE', '❓ Unique constraint desconhecida', {
        constraint: error.constraint,
        detail:     error.detail,
        hint:       'Adicione tratamento específico para esta constraint no User.js',
      });
      const err = new Error('Dados já cadastrados no sistema');
      err.code  = 'DUPLICATE_DATA';
      logger.sep();
      throw err;
    }

    logger.error('CREATE', '💥 Erro não tratado no INSERT', {
      message:   error.message,
      pg_code:   error.code,
      pg_detail: error.detail,
      totalMs:   Date.now() - t0,
    });
    logger.stack('CREATE', error);
    logger.sep();
    throw error;
  }
}

// ============================================================
// 🔍 FIND BY EMAIL
// ============================================================
async function findByEmail(email) {
  const t0        = Date.now();
  const emailNorm = email?.trim().toLowerCase();

  logger.sep();
  logger.flow('FIND_EMAIL', 1, '🔍 Buscando usuário por email...', { email: emailNorm });
  logger.db('FIND_EMAIL', 'SELECT users WHERE email = $1', {
    email:    emailNorm,
    campos:   'id, email, senha_hash, plano, plano_limite, abuse_score, bloqueado...',
    excluido: 'senha_hash será verificado pelo bcrypt no controller',
  });

  try {
    const tDb    = Date.now();
    const result = await pool.query(
      `SELECT id, email, senha_hash, nome_completo,
              plano, plano_limite, abuse_score, bloqueado, bloqueado_motivo,
              auth_provider, nome, avatar, criado_em, atualizado_em
       FROM users WHERE email = $1`,
      [emailNorm]
    );

    logger.perf('FIND_EMAIL', 'SELECT WHERE email', Date.now() - tDb);

    const user = result.rows[0] || null;

    if (user) {
      logger.flow('FIND_EMAIL', 2, '✅ Usuário encontrado no banco', {
        id:           user.id,
        email:        user.email,
        plano:        user.plano,
        plano_limite: user.plano_limite,
        auth_provider: user.auth_provider,
        bloqueado:    user.bloqueado,
        abuse_score:  user.abuse_score,
        tem_senha:    !!user.senha_hash,
        criado_em:    user.criado_em,
        totalMs:      Date.now() - t0,
      });

      if (user.bloqueado) {
        logger.sec('⛔ Conta bloqueada detectada no findByEmail', {
          userId: user.id,
          email:  user.email,
          motivo: user.bloqueado_motivo,
          alerta: 'Controller deve verificar este campo e retornar 403',
        });
      }

      if (user.abuse_score >= 6) {
        logger.abuse(`🚨 Usuário com abuse_score CRÍTICO (${user.abuse_score}) fez login`, {
          userId:     user.id,
          email:      user.email,
          score:      user.abuse_score,
          recomendacao: 'Considerar bloqueio automático ou revisão manual',
        });
      }
    } else {
      logger.flow('FIND_EMAIL', 2, '⚪ Usuário não encontrado', { email: emailNorm, totalMs: Date.now() - t0 });
    }

    logger.result('FIND_EMAIL', user ? 'ok' : 'warn', { encontrado: !!user, totalMs: Date.now() - t0 });
    logger.sep();
    return user;

  } catch (error) {
    logger.error('FIND_EMAIL', '💥 Erro na query SELECT', {
      message: error.message,
      pg_code: error.code,
      email:   emailNorm,
      totalMs: Date.now() - t0,
    });
    logger.stack('FIND_EMAIL', error);
    logger.sep();
    throw error;
  }
}

// ============================================================
// 🔍 FIND BY ID
// ============================================================
async function findById(id) {
  const t0 = Date.now();

  logger.sep();
  logger.flow('FIND_ID', 1, '🔍 Buscando usuário por ID...', { id });
  logger.db('FIND_ID', 'SELECT users WHERE id = $1', {
    id,
    excluido: 'senha_hash — não necessário aqui',
  });

  try {
    const tDb    = Date.now();
    const result = await pool.query(
      `SELECT id, email, nome_completo, nome, avatar,
              plano, plano_limite, abuse_score, bloqueado, bloqueado_motivo,
              auth_provider, criado_em, atualizado_em
       FROM users WHERE id = $1`,
      [id]
    );

    logger.perf('FIND_ID', 'SELECT WHERE id', Date.now() - tDb);

    const user = result.rows[0] || null;

    if (user) {
      logger.flow('FIND_ID', 2, '✅ Usuário encontrado', {
        id:           user.id,
        email:        user.email,
        plano:        user.plano,
        plano_limite: user.plano_limite,
        bloqueado:    user.bloqueado,
        abuse_score:  user.abuse_score,
        totalMs:      Date.now() - t0,
      });

      if (user.bloqueado) {
        logger.sec('⛔ findById retornou conta bloqueada', {
          userId: user.id,
          email:  user.email,
          motivo: user.bloqueado_motivo,
        });
      }
    } else {
      logger.flow('FIND_ID', 2, '⚪ Usuário não encontrado', { id, totalMs: Date.now() - t0 });
    }

    logger.result('FIND_ID', user ? 'ok' : 'warn', { encontrado: !!user, totalMs: Date.now() - t0 });
    logger.sep();
    return user;

  } catch (error) {
    logger.error('FIND_ID', '💥 Erro na query SELECT', {
      message: error.message,
      pg_code: error.code,
      id,
      totalMs: Date.now() - t0,
    });
    logger.stack('FIND_ID', error);
    logger.sep();
    throw error;
  }
}

// ============================================================
// 🔒 FIND BY CPF HASH — lock primário anti-abuse
// ============================================================
async function findByCpfHash(cpf) {
  const t0 = Date.now();

  logger.sep();
  logger.flow('FIND_CPF', 1, '🔒 Iniciando verificação de CPF duplicado (lock primário)...');

  if (!cpf) {
    logger.warn('FIND_CPF', '⚠️  CPF não informado — retornando null sem consultar banco');
    logger.sep();
    return null;
  }

  const cpf_hash = hashCpf(cpf);

  logger.flow('FIND_CPF', 2, '🗄️  Consultando banco por cpf_emissor_hash...', {
    hash_prefix: cpf_hash.substring(0, 12) + '...',
    finalidade:  '🚫 Impedir mesmo CPF em múltiplas contas (anti multi-account)',
  });

  try {
    const tDb    = Date.now();
    const result = await pool.query(
      `SELECT id, email, plano, bloqueado, abuse_score, criado_em
       FROM users WHERE cpf_emissor_hash = $1 LIMIT 1`,
      [cpf_hash]
    );

    logger.perf('FIND_CPF', 'SELECT WHERE cpf_emissor_hash', Date.now() - tDb);

    const existing = result.rows[0] || null;

    if (existing) {
      logger.abuse('🚨 CPF JÁ CADASTRADO — tentativa de multi-account bloqueada', {
        conta_existente_id:    existing.id,
        conta_existente_email: existing.email,
        conta_existente_plano: existing.plano,
        conta_existente_score: existing.abuse_score,
        hash_prefix:           cpf_hash.substring(0, 12) + '...',
        alerta:                '⛔ Este CPF já criou uma conta free — BLOQUEAR registro novo',
        acao_recomendada:      'Retornar REGISTRATION_BLOCKED sem revelar qual dado foi detectado',
        totalMs:               Date.now() - t0,
      });
    } else {
      logger.flow('FIND_CPF', 3, '✅ CPF disponível — não encontrado no sistema', {
        hash_prefix: cpf_hash.substring(0, 12) + '...',
        totalMs:     Date.now() - t0,
      });
    }

    logger.result('FIND_CPF', existing ? 'warn' : 'ok', {
      duplicado: !!existing,
      totalMs:   Date.now() - t0,
    });
    logger.sep();
    return existing;

  } catch (error) {
    logger.error('FIND_CPF', '💥 Erro ao buscar CPF hash (fail-open: não bloqueia o registro)', {
      message: error.message,
      pg_code: error.code,
      hint:    'Verifique se coluna cpf_emissor_hash existe — rode migration_consolidada_v2.sql',
      totalMs: Date.now() - t0,
    });
    logger.stack('FIND_CPF', error);
    logger.sep();
    return null; // fail-open — não bloqueia o cadastro por erro técnico
  }
}

// ============================================================
// 🖥️  FIND BY DEVICE FINGERPRINT — flag silenciosa
// ============================================================
async function findByDeviceFingerprint(fingerprint) {
  const t0 = Date.now();

  logger.sep();
  logger.flow('FIND_FP', 1, '🖥️  Verificando device fingerprint...', {
    fp_prefix:  fingerprint ? fingerprint.substring(0, 8) + '...' : 'NULL',
    finalidade: 'Detectar mesmo dispositivo em múltiplas contas (flag — não bloqueia sozinha)',
  });

  if (!fingerprint) {
    logger.warn('FIND_FP', '⚠️  Fingerprint não informado — retornando [] sem consultar banco');
    logger.sep();
    return [];
  }

  logger.db('FIND_FP', '🗄️  SELECT WHERE device_fingerprint = $1 LIMIT 5', {
    fp_prefix: fingerprint.substring(0, 8) + '...',
  });

  try {
    const tDb    = Date.now();
    const result = await pool.query(
      `SELECT id, email, plano, abuse_score, criado_em
       FROM users WHERE device_fingerprint = $1
       ORDER BY criado_em DESC LIMIT 5`,
      [fingerprint]
    );

    logger.perf('FIND_FP', 'SELECT WHERE device_fingerprint', Date.now() - tDb);

    const accounts = result.rows;

    if (accounts.length === 0) {
      logger.flow('FIND_FP', 2, '✅ Device nunca visto — primeira conta neste dispositivo', {
        fp_prefix: fingerprint.substring(0, 8) + '...',
        totalMs:   Date.now() - t0,
      });
    } else {
      logger.abuse(`⚠️  Device fingerprint encontrado em ${accounts.length} conta(s)`, {
        fp_prefix:    fingerprint.substring(0, 8) + '...',
        contas_count: accounts.length,
        emails:       accounts.map(a => a.email),
        scores:       accounts.map(a => a.abuse_score),
        alerta:       accounts.length >= 2
          ? '🚨 FORTE INDICADOR DE MULTI-ACCOUNT — incrementar abuse_score'
          : '⚠️  Monitorar — pode ser conta legítima (ex: computador compartilhado)',
        acao:         'Não bloqueia sozinha — aumenta abuse_score para análise',
        totalMs:      Date.now() - t0,
      });
    }

    logger.result('FIND_FP', accounts.length > 0 ? 'warn' : 'ok', {
      contas_encontradas: accounts.length,
      totalMs:            Date.now() - t0,
    });
    logger.sep();
    return accounts;

  } catch (error) {
    logger.error('FIND_FP', '💥 Erro ao buscar fingerprint (fail-open)', {
      message: error.message,
      pg_code: error.code,
      totalMs: Date.now() - t0,
    });
    logger.stack('FIND_FP', error);
    logger.sep();
    return [];
  }
}

// ============================================================
// 🌐 COUNT BY IP LAST 7 DAYS
// ============================================================
async function countByIpLast7Days(ip) {
  const t0 = Date.now();

  logger.sep();
  logger.flow('COUNT_IP', 1, '🌐 Contando contas criadas no mesmo IP (últimos 7 dias)...', { ip });

  if (!ip || ip === 'unknown') {
    logger.warn('COUNT_IP', '⚠️  IP não disponível — retornando 0 sem consultar banco', { ip });
    logger.sep();
    return 0;
  }

  logger.db('COUNT_IP', '🗄️  COUNT(*) WHERE ip_cadastro = $1 AND criado_em >= NOW()-7d', { ip });

  try {
    const tDb    = Date.now();
    const result = await pool.query(
      `SELECT COUNT(*)::int AS total FROM users
       WHERE ip_cadastro = $1 AND criado_em >= NOW() - INTERVAL '7 days'`,
      [ip]
    );

    logger.perf('COUNT_IP', 'COUNT WHERE ip_cadastro (7 dias)', Date.now() - tDb);

    const total = result.rows[0]?.total ?? 0;

    logger.flow('COUNT_IP', 2, `📊 Total de contas no IP nos últimos 7 dias: ${total}`, {
      ip,
      total,
      status:           total === 0 ? '✅ Primeiro cadastro neste IP'
                      : total === 1 ? '✅ Segunda conta — dentro do tolerável'
                      : total >= 2  ? '⚠️  Múltiplas contas — suspeito'
                      : '🚨 ALTO VOLUME — possível farm de contas',
      limite_alerta:    2,
      acao_recomendada: total >= 2 ? 'Incrementar abuse_score — IP_MULTI_ACCOUNT' : 'Nenhuma ação necessária',
      totalMs:          Date.now() - t0,
    });

    if (total >= 3) {
      logger.abuse(`🚨 IP com ${total} contas em 7 dias — possível farm`, {
        ip,
        total,
        recomendacao: 'Considerar bloqueio temporário de registro para este IP',
      });
    }

    logger.result('COUNT_IP', total >= 2 ? 'warn' : 'ok', { total, totalMs: Date.now() - t0 });
    logger.sep();
    return total;

  } catch (error) {
    logger.error('COUNT_IP', '💥 Erro ao contar IPs (fail-open: retorna 0)', {
      message: error.message,
      pg_code: error.code,
      ip,
      totalMs: Date.now() - t0,
    });
    logger.stack('COUNT_IP', error);
    logger.sep();
    return 0;
  }
}

// ============================================================
// 🚩 UPDATE ABUSE SCORE — atômico
// ============================================================
async function updateAbuseScore(userId, {
  increment = 1,
  tipo      = 'UNKNOWN',
  detalhe   = null,
  ip        = null,
  metadata  = null,
} = {}) {
  const t0 = Date.now();

  logger.sep();
  logger.flow('ABUSE_SCORE', 1, `🚩 Incrementando abuse_score (+${increment})...`, {
    userId,
    increment,
    tipo,
    detalhe: detalhe?.substring(0, 80),
    ip,
  });

  try {
    // STEP 1: Atualiza score atomicamente
    logger.flow('ABUSE_SCORE', 2, '🗄️  UPDATE abuse_score + abuse_flags_count (atômico)...');
    const tScore = Date.now();

    const scoreResult = await pool.query(
      `UPDATE users
       SET abuse_score       = abuse_score + $1,
           abuse_flags_count = abuse_flags_count + 1,
           atualizado_em     = NOW()
       WHERE id = $2
       RETURNING id, email, abuse_score, abuse_flags_count`,
      [increment, userId]
    );

    logger.perf('ABUSE_SCORE', 'UPDATE abuse_score', Date.now() - tScore);

    const updated = scoreResult.rows[0];

    if (updated) {
      const scoreStatus =
        updated.abuse_score >= 10 ? '🔴 CRÍTICO — bloqueio automático recomendado' :
        updated.abuse_score >= 6  ? '🟠 ALTO — revisão manual urgente' :
        updated.abuse_score >= 3  ? '🟡 MODERADO — monitorar' :
                                    '🟢 BAIXO';

      logger.flow('ABUSE_SCORE', 3, '✅ Score atualizado no banco', {
        userId,
        email:        updated.email,
        novo_score:   updated.abuse_score,
        flags_total:  updated.abuse_flags_count,
        status:       scoreStatus,
        tipo_flag:    tipo,
      });

      if (updated.abuse_score >= 10) {
        logger.sec('🔴 ABUSE SCORE CRÍTICO — conta em alto risco', {
          userId:       updated.id,
          email:        updated.email,
          score:        updated.abuse_score,
          flags:        updated.abuse_flags_count,
          recomendacao: 'Chamar blockAccount() ou revisar manualmente via painel admin',
        });
      }
    } else {
      logger.warn('ABUSE_SCORE', '⚠️  UPDATE não afetou nenhuma linha — userId não encontrado?', { userId });
    }

    // STEP 2: Registra em abuse_flags (auditoria imutável)
    logger.flow('ABUSE_SCORE', 4, '🗄️  INSERT em abuse_flags (auditoria imutável)...');
    const tFlag = Date.now();

    try {
      const severidade = increment >= 3 ? 3 : increment >= 2 ? 2 : 1;

      await pool.query(
        `INSERT INTO abuse_flags
           (usuario_id, tipo, detalhe, ip_address, severidade, metadata, criado_em)
         VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
        [userId, tipo, detalhe || null, ip || null, severidade, metadata ? JSON.stringify(metadata) : null]
      );

      logger.perf('ABUSE_SCORE', 'INSERT INTO abuse_flags', Date.now() - tFlag);
      logger.flow('ABUSE_SCORE', 5, '✅ Flag registrada em abuse_flags', {
        usuario_id: userId,
        tipo,
        severidade,
        ip,
      });

    } catch (flagErr) {
      logger.warn('ABUSE_SCORE', '⚠️  Falha ao registrar abuse_flag (não crítico — score principal OK)', {
        message: flagErr.message,
        pg_code: flagErr.code,
        hint:    'Verifique se tabela abuse_flags existe com usuario_id INTEGER — rode migration',
      });
    }

    logger.result('ABUSE_SCORE', 'ok', { userId, novo_score: updated?.abuse_score, totalMs: Date.now() - t0 });
    logger.sep();
    return updated;

  } catch (error) {
    logger.error('ABUSE_SCORE', '💥 Erro ao atualizar abuse_score (fail-open: retorna null)', {
      message: error.message,
      pg_code: error.code,
      userId,
      totalMs: Date.now() - t0,
    });
    logger.stack('ABUSE_SCORE', error);
    logger.sep();
    return null;
  }
}

// ============================================================
// ⛔ BLOCK ACCOUNT
// ============================================================
async function blockAccount(userId, motivo = 'Abuso detectado pelo sistema') {
  const t0 = Date.now();

  logger.sep();
  logger.sec('⛔ Iniciando bloqueio de conta...', { userId, motivo });
  logger.flow('BLOCK', 1, '🗄️  UPDATE users SET bloqueado = TRUE...', { userId, motivo });

  try {
    const tDb    = Date.now();
    const result = await pool.query(
      `UPDATE users
       SET bloqueado        = TRUE,
           bloqueado_motivo = $1,
           atualizado_em    = NOW()
       WHERE id = $2
       RETURNING id, email, bloqueado, bloqueado_motivo`,
      [motivo, userId]
    );

    logger.perf('BLOCK', 'UPDATE bloqueado = TRUE', Date.now() - tDb);

    const blocked = result.rows[0];

    if (blocked) {
      logger.sec('⛔ CONTA BLOQUEADA COM SUCESSO', {
        userId:   blocked.id,
        email:    blocked.email,
        motivo:   blocked.bloqueado_motivo,
        bloqueado: blocked.bloqueado,
        totalMs:  Date.now() - t0,
        alerta:   'Próximas tentativas de login retornarão 403 ACCOUNT_BLOCKED',
      });
    } else {
      logger.warn('BLOCK', '⚠️  UPDATE não afetou linhas — userId não existe?', { userId });
    }

    logger.result('BLOCK', blocked ? 'ok' : 'warn', { userId, bloqueado: !!blocked, totalMs: Date.now() - t0 });
    logger.sep();
    return blocked;

  } catch (error) {
    logger.error('BLOCK', '💥 Erro ao bloquear conta', {
      message: error.message,
      pg_code: error.code,
      userId,
      totalMs: Date.now() - t0,
    });
    logger.stack('BLOCK', error);
    logger.sep();
    return null;
  }
}

// ============================================================
// 🔑 UPDATE PASSWORD
// ============================================================
async function updatePassword(id, senha_hash) {
  const t0 = Date.now();

  logger.sep();
  logger.flow('UPDATE_PWD', 1, '🔑 Atualizando senha do usuário...', { id });
  logger.db('UPDATE_PWD', '🗄️  UPDATE users SET senha_hash = $1 WHERE id = $2', { id });

  try {
    const tDb    = Date.now();
    const result = await pool.query(
      `UPDATE users SET senha_hash = $1, atualizado_em = NOW() WHERE id = $2`,
      [senha_hash, id]
    );

    logger.perf('UPDATE_PWD', 'UPDATE senha_hash', Date.now() - tDb);

    if (result.rowCount === 0) {
      logger.warn('UPDATE_PWD', '⚠️  Nenhuma linha atualizada — usuário não encontrado', { id });
      logger.sep();
      return false;
    }

    logger.result('UPDATE_PWD', 'ok', { id, rowsAffected: result.rowCount, totalMs: Date.now() - t0 });
    logger.sep();
    return true;

  } catch (error) {
    logger.error('UPDATE_PWD', '💥 Erro ao atualizar senha', {
      message: error.message,
      pg_code: error.code,
      id,
      totalMs: Date.now() - t0,
    });
    logger.stack('UPDATE_PWD', error);
    logger.sep();
    throw error;
  }
}

// ============================================================
// 🗑️  DELETE BY ID
// ============================================================
async function deleteById(id) {
  const t0 = Date.now();

  logger.sep();
  logger.flow('DELETE', 1, '🗑️  Deletando usuário...', { id });
  logger.db('DELETE', '🗄️  DELETE FROM users WHERE id = $1', { id });

  try {
    const tDb    = Date.now();
    const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);

    logger.perf('DELETE', 'DELETE WHERE id', Date.now() - tDb);

    if (result.rowCount === 0) {
      logger.warn('DELETE', '⚠️  Usuário não encontrado para deletar', { id });
      logger.sep();
      return false;
    }

    logger.result('DELETE', 'ok', { id, rowsAffected: result.rowCount, totalMs: Date.now() - t0 });
    logger.sep();
    return true;

  } catch (error) {
    logger.error('DELETE', '💥 Erro ao deletar usuário', {
      message: error.message,
      pg_code: error.code,
      id,
      totalMs: Date.now() - t0,
    });
    logger.stack('DELETE', error);
    logger.sep();
    throw error;
  }
}

// ============================================================
// 📤 EXPORTS
// ============================================================
module.exports = {
  create,
  findByEmail,
  findById,
  updatePassword,
  deleteById,
  findByCpfHash,
  findByDeviceFingerprint,
  countByIpLast7Days,
  updateAbuseScore,
  blockAccount,
  hashCpf,
  validateCpf,
};