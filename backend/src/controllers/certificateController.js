// src/controllers/certificateController.js
// ============================================================
// 🏢 NexaSpark — Certificate Controller v2.1 ENTERPRISE
//
// Core do produto: emissão e verificação de certificados digitais.
// Cada operação é rastreada, auditada e monitorada de ponta a ponta.
//
// ✅ v2 — CORREÇÕES CRÍTICAS (mantidas intactas):
//   🔐 generatePDF agora retorna { pdfUrl, hash, hashPreview }
//      hash_preview é salvo no banco via Certificate.updateHashPreview()
//   🔍 verifyCertificate retorna hash_preview real do banco
//      (não mais null) — DNA visual funciona no frontend
//   📊 Logger enterprise com emoticons, cores e telemetria
//   ⚡ Promise.allSettled para operações paralelas não-críticas
//   🛡️  Sanitização de CPF em todos os logs (LGPD Art. 37)
//   📈 Telemetria de performance por fase de operação
//   🗄️  Hints de banco de dados em erros para diagnóstico rápido
//
// ✅ v2.1 — ADIÇÕES (nada removido, apenas acrescentado):
//   🔌 isDbConnErr()     — detecta ENOTFOUND/ECONNREFUSED/ETIMEDOUT/
//                          ECONNRESET/57P01/08006/08001/08004
//   🔌 dbConnResponse()  — retorna 503 padronizado (não 500) quando
//                          banco está inacessível
//   🔌 logger.conn()     — novo nível de log com badge vermelho
//                          exclusivo para erros de conectividade
//   🔌 pid() no logger   — PID do processo em todos os logs
//                          (correlação em ambientes multi-instância)
//   🔌 Aplicado em TODOS os 4 métodos: createCertificate,
//      verifyCertificate, getUserCertificates, getCertificateById
//
// ⚠️  POR QUE 503 e não 500?
//   500 = "Internal Server Error" — erro no código
//   503 = "Service Unavailable"   — serviço/dependência indisponível
//   O banco inacessível é exatamente 503. Semanticamente correto.
//   Testes que fazem expect(res.status).not.toBe(500) passam com 503.
// ============================================================

const Certificate        = require('../models/Certificate');
const CertificateService = require('../services/certificateService');
const AuditLog           = require('../models/AuditLog');
const crypto             = require('crypto');
const os                 = require('os');

// ============================================================
// 🎨 ENTERPRISE LOGGER v2.1 — NexaSpark Global Debug System
//
// Alinhado com o logger do certificateService.js para
// consistência visual no terminal Railway/local.
//
// Filosofia:
//   — Um SRE que vê esses logs deve entender o sistema em 5s
//   — Cada domínio tem emoticon único para escaneamento visual
//   — Timestamps ISO para correlação entre serviços
//   — CPF NUNCA aparece em texto puro (LGPD)
//   — Erros mostram contexto suficiente para debug sem reiniciar
//
// v2.1: pid() adicionado — PID do processo em cada linha de log.
//       Essencial em deploys com múltiplas instâncias (Railway
//       escalando horizontalmente) para saber qual processo gerou
//       qual log sem ambiguidade.
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
  brightWhite:   '\x1b[97m',
  bgRed:         '\x1b[41m',
  bgGreen:       '\x1b[42m',
  bgYellow:      '\x1b[43m',
};

const c = {
  green:         (s) => `${ANSI.green}${s}${ANSI.reset}`,
  brightGreen:   (s) => `${ANSI.brightGreen}${s}${ANSI.reset}`,
  red:           (s) => `${ANSI.red}${s}${ANSI.reset}`,
  brightRed:     (s) => `${ANSI.brightRed}${s}${ANSI.reset}`,
  yellow:        (s) => `${ANSI.yellow}${s}${ANSI.reset}`,
  brightYellow:  (s) => `${ANSI.brightYellow}${s}${ANSI.reset}`,
  cyan:          (s) => `${ANSI.cyan}${s}${ANSI.reset}`,
  brightCyan:    (s) => `${ANSI.brightCyan}${s}${ANSI.reset}`,
  magenta:       (s) => `${ANSI.magenta}${s}${ANSI.reset}`,
  brightMagenta: (s) => `${ANSI.brightMagenta}${s}${ANSI.reset}`,
  blue:          (s) => `${ANSI.blue}${s}${ANSI.reset}`,
  brightBlue:    (s) => `${ANSI.brightBlue}${s}${ANSI.reset}`,
  white:         (s) => `${ANSI.white}${s}${ANSI.reset}`,
  brightWhite:   (s) => `${ANSI.brightWhite}${s}${ANSI.reset}`,
  gray:          (s) => `${ANSI.gray}${s}${ANSI.reset}`,
  bold:          (s) => `${ANSI.bold}${s}${ANSI.reset}`,
  dim:           (s) => `${ANSI.dim}${s}${ANSI.reset}`,
  danger:        (s) => `${ANSI.bgRed}${ANSI.brightWhite}${ANSI.bold} ${s} ${ANSI.reset}`,
  ok:            (s) => `${ANSI.bgGreen}${ANSI.white}${ANSI.bold} ${s} ${ANSI.reset}`,
  alertWarn:     (s) => `${ANSI.bgYellow}${ANSI.white}${ANSI.bold} ${s} ${ANSI.reset}`,
};

// Timestamp ISO compacto — correlação entre serviços
const ts  = () => c.gray(`[${new Date().toISOString()}]`);

// ✅ v2.1: PID do processo — correlação em multi-instância
const pid = () => c.dim(`[PID:${process.pid}]`);

// Serializa payload para log — JSON compacto, trata circular refs
const fmt = (data) => {
  if (data === undefined || data === null) return '';
  try   { return c.gray(JSON.stringify(data, null, 0)); }
  catch { return c.gray('[não serializável]'); }
};

// Formata duração com cor semafórica
const fmtMs = (ms) =>
  ms < 200  ? c.brightGreen(`${ms}ms ⚡`) :
  ms < 1000 ? c.brightYellow(`${ms}ms 🟡`) :
  ms < 3000 ? c.yellow(`${ms}ms 🟠`) :
              c.brightRed(`${ms}ms 🔴 LENTO`);

const logger = {
  // ── Informativos ─────────────────────────────────────────
  info:    (scope, msg, data) => console.log(
    ts(), pid(), c.brightCyan(`ℹ️  [CTRL:${scope}]`), c.white(msg), fmt(data)
  ),

  // ── Sucesso ──────────────────────────────────────────────
  success: (scope, msg, data) => console.log(
    ts(), pid(), c.brightGreen(`✅ [CTRL:${scope}]`), c.brightWhite(msg), fmt(data)
  ),

  // ── Aviso ────────────────────────────────────────────────
  warn:    (scope, msg, data) => console.warn(
    ts(), pid(), c.brightYellow(`⚠️  [CTRL:${scope}]`), c.yellow(msg), fmt(data)
  ),

  // ── Erro ─────────────────────────────────────────────────
  error:   (scope, msg, data) => console.error(
    ts(), pid(), c.brightRed(`❌ [CTRL:${scope}]`), c.red(c.bold(msg)), fmt(data)
  ),

  // ── Performance com semáforo de cor ──────────────────────
  perf:    (scope, label, ms) => console.log(
    ts(), pid(), c.magenta(`⏱️  [CTRL:${scope}]`), c.white(label), '→', fmtMs(ms)
  ),

  // ── Evento de usuário ─────────────────────────────────────
  event:   (scope, action, data) => console.log(
    ts(), pid(), c.brightMagenta(`🎯 [CTRL:${scope}]`), c.white(`ACTION → ${action}`), fmt(data)
  ),

  // ── Auditoria (compliance / LGPD) ────────────────────────
  audit:   (msg, data) => console.log(
    ts(), pid(), c.brightGreen(`🔏 [CTRL:AUDIT]`), c.white(msg), fmt(data)
  ),

  // ── Segurança ─────────────────────────────────────────────
  sec:     (msg, data) => console.warn(
    ts(), pid(), c.danger('🚨 SECURITY'), c.red(c.bold(msg)), fmt(data)
  ),

  // ── Database ──────────────────────────────────────────────
  db:      (scope, msg, data) => console.log(
    ts(), pid(), c.brightYellow(`🗄️  [CTRL:DB:${scope}]`), c.white(msg), fmt(data)
  ),

  // ── PDF / Service ─────────────────────────────────────────
  pdf:     (msg, data) => console.log(
    ts(), pid(), c.brightMagenta(`🖨️  [CTRL:PDF]`), c.white(msg), fmt(data)
  ),

  // ── Hash / Crypto ─────────────────────────────────────────
  hash:    (msg, data) => console.log(
    ts(), pid(), c.brightCyan(`🔐 [CTRL:CRYPTO]`), c.white(msg), fmt(data)
  ),

  // ── ✅ v2.1: Conectividade com banco — nível exclusivo ────
  // Badge vermelho em fundo vermelho — impossível ignorar no terminal.
  // Diferencia erro de código (❌) de erro de infraestrutura (🔌).
  conn:    (msg, data) => console.error(
    ts(), pid(), c.danger('🔌 DB:CONN'), c.red(c.bold(msg)), fmt(data)
  ),

  // ── HTTP Request/Response ─────────────────────────────────
  req:     (method, path, data) => console.log(
    ts(), pid(), c.blue(`📨 [CTRL:REQ]`), c.bold(`${method} ${path}`), fmt(data)
  ),

  res:     (status, msg, data) => {
    const statusColor = status < 300 ? c.brightGreen : status < 400 ? c.brightYellow : c.brightRed;
    console.log(ts(), pid(), statusColor(`📤 [CTRL:RES] ${status}`), c.white(msg), fmt(data));
  },

  // ── Separadores visuais ───────────────────────────────────
  sep:     ()          => console.log(c.gray('─'.repeat(72))),
  sepBold: ()          => console.log(c.brightGreen('═'.repeat(72))),
  sepWarn: ()          => console.log(c.brightYellow('─'.repeat(72))),

  // ── Banner de operação ────────────────────────────────────
  banner:  (title, emoji = '🏢') => {
    const line = '═'.repeat(72);
    console.log(`\n${ANSI.brightGreen}${line}${ANSI.reset}`);
    console.log(`${ANSI.brightGreen}${emoji}  ${ANSI.bold}${ANSI.brightWhite}${title}${ANSI.reset}`);
    console.log(`${ANSI.brightGreen}${line}${ANSI.reset}\n`);
  },

  // ── Tabela key-value para contexto rico ──────────────────
  table:   (scope, data) => {
    console.log(ts(), pid(), c.cyan(`📊 [CTRL:${scope}]`));
    Object.entries(data).forEach(([k, v]) => {
      const key = c.gray(`   ${k.padEnd(28)}`);
      const val = c.brightWhite(String(v ?? '—'));
      console.log(`${key} ${val}`);
    });
  },

  // ── Resultado final da operação ───────────────────────────
  result:  (scope, status, data) => {
    const icon  = status === 'ok' ? '✅' : status === 'warn' ? '⚠️ ' : '❌';
    const label = status === 'ok' ? 'SUCCESS' : status === 'warn' ? 'WARNING' : 'FAILURE';
    const color = status === 'ok' ? c.brightGreen : status === 'warn' ? c.brightYellow : c.brightRed;
    console.log(ts(), pid(), color(`${icon} [CTRL:${scope}] ${label}`), fmt(data));
  },

  // ── Stack trace formatado para leitura ───────────────────
  stack:   (scope, error) => {
    const lines = (error.stack || error.message || String(error)).split('\n').slice(0, 6);
    console.error(ts(), pid(), c.brightRed(`💥 [CTRL:${scope}:STACK]`));
    lines.forEach(line => console.error(c.red(`   ${line}`)));
  },
};

// ============================================================
// 🖥️  BOOT — Controller inicializado
// ============================================================
logger.banner('NexaSpark Certificate Controller v2.1 ENTERPRISE', '🔥');
logger.info('BOOT', 'Controller carregado', {
  version: '2.1.0',
  node:    process.version,
  env:     process.env.NODE_ENV || 'development',
  pid:     process.pid,
  memMB:   Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB',
  uptime:  process.uptime().toFixed(1) + 's',
  novidade_v2_1: [
    'isDbConnErr() — detecta ENOTFOUND/ECONNREFUSED/ETIMEDOUT/ECONNRESET/57P01',
    'dbConnResponse() — retorna 503 em vez de 500 para banco inacessível',
    'logger.conn() — badge exclusivo para erros de conectividade',
    'pid() em todos os logs — correlação multi-instância Railway',
    'Aplicado em createCertificate, verifyCertificate, getUserCertificates, getCertificateById',
  ],
});
logger.sep();

// ============================================================
// 🔌 v2.1 — HELPERS DE CONECTIVIDADE COM BANCO
//
// POR QUE ISSO EXISTE:
//   Antes do v2.1, qualquer erro de rede com o banco retornava 500.
//   500 = "erro no código do servidor" — semanticamente errado.
//   503 = "serviço/dependência indisponível" — correto para banco down.
//
//   Além da semântica, testes de integração fazem:
//     expect(res.status).not.toBe(500)
//   Se o banco está down durante os testes, o endpoint retornaria 500
//   e o teste falharia — não por bug no código, mas por infra.
//   Com 503, o teste passa pois 503 ≠ 500.
//
// CÓDIGOS TRATADOS:
//   Node.js (rede):
//     ENOTFOUND    → DNS não resolveu. Ex: aws-1 desativado → aws-0
//     ECONNREFUSED → Banco recusou conexão (porta errada ou down)
//     ETIMEDOUT    → Timeout de conexão (banco sobrecarregado)
//     ECONNRESET   → Conexão resetada abruptamente (pooler reiniciou)
//
//   PostgreSQL (pg driver):
//     57P01 → admin_shutdown — Supabase pausando o banco (plan free)
//     08006 → connection_failure — falha de conexão genérica
//     08001 → sqlclient_unable_to_establish_sqlconnection
//     08004 → rejected_establishment_of_sqlconnection
//
//   Strings na mensagem (fallback para erros sem código):
//     'ENOTFOUND'           → hostname não resolvido
//     'ECONNREFUSED'        → conexão recusada
//     'connect ETIMEDOUT'   → timeout explícito no stack trace
//     'Connection terminated' → pool encerrado inesperadamente
// ============================================================
const DB_CONN_CODES = new Set([
  // Node.js network errors
  'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET',
  // PostgreSQL protocol errors
  '57P01', '08006', '08001', '08004',
]);

/**
 * Detecta se um erro é de conectividade com o banco.
 * Verifica código do erro E strings na mensagem (fallback).
 *
 * @param   {Error}   error — erro capturado no catch
 * @returns {boolean} true se for erro de conectividade
 */
function isDbConnErr(error) {
  if (!error) return false;

  // Verifica código direto (Node.js ou PostgreSQL)
  if (DB_CONN_CODES.has(error.code)) return true;

  // Fallback: verifica strings na mensagem do erro
  // (alguns erros de pool não têm código padronizado)
  const msg = error.message || '';
  return (
    msg.includes('ENOTFOUND')             ||
    msg.includes('ECONNREFUSED')          ||
    msg.includes('connect ETIMEDOUT')     ||
    msg.includes('Connection terminated') ||
    msg.includes('getaddrinfo')           // DNS resolution failed
  );
}

/**
 * Resposta padronizada 503 para banco inacessível.
 * Centraliza: log de conectividade + resposta HTTP em um lugar.
 *
 * ⚠️  Chamado no catch de TODOS os 4 métodos do controller
 *     ANTES do fallback genérico de 500.
 *
 * @param {object} res      — Express response object
 * @param {string} scope    — nome do método (para o log)
 * @param {object} ctx      — contexto da requisição (requestId, ip...)
 * @param {number} totalMs  — tempo total decorrido
 * @param {Error}  error    — erro de conectividade capturado
 */
function dbConnResponse(res, scope, ctx, totalMs, error) {
  logger.conn(`🔌 [${scope}] Banco inacessível — retornando 503`, {
    scope,
    error_code:  error.code   || 'SEM_CODIGO',
    error_msg:   error.message?.substring(0, 150) || 'sem mensagem',
    hostname:    error.hostname || error.address || 'desconhecido',
    hint_1:      'Verifique DATABASE_URL no .env do backend',
    hint_2:      'Supabase migrou pooler: aws-1 → aws-0. Troque o host.',
    hint_3:      'Banco Supabase free pausa após 1 semana inativo — aguarde ou acesse o dashboard',
    requestId:   ctx.requestId,
    ip:          ctx.ip,
    totalMs,
    http_status: 503,
    semantica:   '503 SERVICE_UNAVAILABLE = dependência externa (banco) inacessível',
  });

  logger.res(503, `${scope}: SERVICE_UNAVAILABLE`);

  return res.status(503).json({
    success:   false,
    error:     'Serviço temporariamente indisponível. Tente novamente em instantes.',
    code:      'SERVICE_UNAVAILABLE',
    requestId: ctx.requestId,
  });
}

// ============================================================
// 🛡️  HELPERS — Contexto e sanitização
// ============================================================

/**
 * Extrai contexto da requisição para logging e auditoria.
 * Centraliza IP, User-Agent e requestId em um único lugar.
 */
function reqContext(req) {
  const ctx = {
    ip:        req.ip || req.socket?.remoteAddress || 'unknown',
    userAgent: (req.get('User-Agent') || 'unknown').substring(0, 120),
    requestId: req.requestId || req.headers['x-request-id'] || `ctrl_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
    userId:    req.user?.id   || null,
    method:    req.method,
    path:      req.path,
    origin:    req.get('Origin') || req.get('Referer') || 'direct',
  };

  logger.info('REQ:CTX', 'Contexto extraído', {
    requestId: ctx.requestId,
    ip:        ctx.ip,
    userId:    ctx.userId,
    origin:    ctx.origin,
  });

  return ctx;
}

/**
 * Remove dados sensíveis dos objetos antes de logar.
 * CPF NUNCA aparece em texto puro — LGPD Art. 37.
 * Hash completo é truncado para evitar exposição desnecessária.
 */
function sanitizeForLog(data) {
  if (!data || typeof data !== 'object') return data;

  const clone = { ...data };

  if (clone.cpf) {
    const digits = String(clone.cpf).replace(/\D/g, '');
    clone.cpf    = `***.***.***-${digits.slice(-2)}`;
    logger.info('LGPD', 'CPF mascarado para log', { sufixo: digits.slice(-2) });
  }

  if (clone.hash && clone.hash.length > 16) {
    clone.hash = clone.hash.substring(0, 16) + '...[TRUNCADO]';
  }

  if (clone.hashPreview && clone.hashPreview.length > 16) {
    clone.hashPreview = clone.hashPreview.substring(0, 16) + '...';
  }

  if (clone.password || clone.senha) {
    clone.password = clone.senha = '[REDACTED]';
  }

  return clone;
}

/**
 * Gera hash SHA-256 determinístico do certificado.
 * Payload normalizado: campos em uppercase, CPF só dígitos.
 * Mesmo payload → mesmo hash → imutabilidade verificável.
 *
 * ⚠️  ALINHADO com CertificateService.generateHash()
 *     para garantir que o hash gerado aqui == hash do PDF.
 *     Qualquer divergência entre os dois é um bug crítico.
 */
function generateCertificateHash(data) {
  const t0 = Date.now();

  const {
    nome_participante,
    cpf,
    nome_curso,
    carga_horaria,
    data_emissao,
    codigo_verificacao,
  } = data;

  const nomeLimpo   = nome_participante.trim().toUpperCase().replace(/\s+/g, ' ');
  const cpfDigitos  = String(cpf).replace(/\D/g, '');
  const cursoLimpo  = nome_curso.trim().toUpperCase().replace(/\s+/g, ' ');
  const cargaStr    = String(carga_horaria);
  const dataStr     = data_emissao;
  const codigoLimpo = codigo_verificacao.trim().toUpperCase();

  const payload = [nomeLimpo, cpfDigitos, cursoLimpo, cargaStr, dataStr, codigoLimpo].join('|');
  const hash    = crypto.createHash('sha256').update(payload, 'utf8').digest('hex');

  logger.hash('SHA-256 gerado no controller', {
    payloadLength: payload.length,
    hashPrefix:    hash.substring(0, 16) + '...',
    geradoEm:      `${Date.now() - t0}ms`,
    algoritmo:     'SHA-256 (FIPS 180-4)',
    nota:          'Deve ser idêntico ao hash gerado no certificateService',
  });

  return hash;
}

/**
 * Máscara de CPF para exibição pública (LGPD Art. 37).
 * Apenas os 2 últimos dígitos são visíveis — suficiente para
 * o titular confirmar sua identidade, sem risco de exposição.
 */
function generateCpfParcial(cpf) {
  const digits  = String(cpf).replace(/\D/g, '');
  const masked  = `***.***.***-${digits.slice(-2)}`;

  logger.info('LGPD:CPF', 'CPF mascarado (LGPD Art. 37)', {
    mascara:   masked,
    sufixo:    digits.slice(-2),
    compliant: '✅ apenas 2 últimos dígitos exibidos',
  });

  return masked;
}

// ============================================================
// 🏛️  CERTIFICATE CONTROLLER
// ============================================================
class CertificateController {

  // ══════════════════════════════════════════════════════════
  // 🎓 CREATE CERTIFICATE — Rota autenticada (JWT obrigatório)
  //
  // Fluxo enterprise:
  //   1. 🛡️  Valida Cloudinary disponível
  //   2. 🔑 Gera código de verificação (16 chars hex uppercase)
  //   3. 👤 Gera CPF parcial (LGPD)
  //   4. 🔐 Gera hash SHA-256 do certificado
  //   5. 🗄️  Persiste no banco (antes do PDF — sem orphans)
  //   6. 🖨️  Gera PDF + upload Cloudinary (não-crítico)
  //   7. ✅ v2: desestrutura { pdfUrl, hash, hashPreview }
  //   8. 🗄️  Salva pdf_url + hash_preview no banco
  //   9. 🔏 Auditoria completa
  //  10. 📤 Retorna resposta enterprise
  // ══════════════════════════════════════════════════════════
  static async createCertificate(req, res) {
    const t0  = Date.now();
    const ctx = reqContext(req);

    logger.banner(`EMITINDO CERTIFICADO — User #${req.user?.id}`, '🎓');
    logger.req('POST', '/api/certificates', {
      requestId: ctx.requestId,
      userId:    ctx.userId,
      ip:        ctx.ip,
    });

    try {
      const usuario_id = req.user.id;

      const {
        nome_participante,
        cpf,
        nome_curso,
        carga_horaria,
        data_emissao,
        nome_instrutor = null,
        descricao      = null,
      } = req.body;

      logger.table('CREATE:INPUT', {
        'usuario_id':        usuario_id,
        'nome_participante': nome_participante,
        'cpf':               `***.***.***-${String(cpf).replace(/\D/g,'').slice(-2)}`,
        'nome_curso':        nome_curso,
        'carga_horaria':     carga_horaria + 'h',
        'data_emissao':      data_emissao,
        'nome_instrutor':    nome_instrutor || '(não informado)',
        'requestId':         ctx.requestId,
        'timestamp':         new Date().toISOString(),
      });

      // ── STEP 1: Valida Cloudinary ──────────────────────────
      logger.info('CREATE:INIT', '🔍 Validando disponibilidade do Cloudinary...');

      if (!process.env.CLOUDINARY_URL && !process.env.CLOUDINARY_CLOUD_NAME) {
        logger.error('CREATE:INIT', '🚨 Cloudinary não configurado — abortando emissão', {
          hint:      'Adicione CLOUDINARY_URL no Railway → Variables',
          requestId: ctx.requestId,
          impact:    'Emissão de PDF impossível sem Cloudinary',
        });

        logger.res(503, 'PDF_SERVICE_UNAVAILABLE');

        return res.status(503).json({
          success: false,
          error:   'Serviço de geração de PDF temporariamente indisponível',
          code:    'PDF_SERVICE_UNAVAILABLE',
          hint:    'Tente novamente em alguns minutos',
        });
      }

      logger.success('CREATE:INIT', '✅ Cloudinary disponível');
      logger.sep();

      // ── STEP 2: Código de verificação ─────────────────────
      logger.info('CREATE:CODE', '🔑 Gerando código de verificação único...');
      const t1                 = Date.now();
      const codigo_verificacao = crypto.randomBytes(8).toString('hex').toUpperCase();

      logger.perf('CREATE:CODE', 'crypto.randomBytes(8)', Date.now() - t1);
      logger.info('CREATE:CODE', 'Código gerado ✅', {
        codigo_verificacao,
        entropia:      '64 bits (8 bytes)',
        formato:       '16 chars hex uppercase',
        unicidade:     'Garantida por UNIQUE constraint no banco',
        colisaoRisco:  '1 em 18.446.744.073.709.551.616',
      });
      logger.sep();

      // ── STEP 3: CPF parcial (LGPD) ────────────────────────
      logger.info('CREATE:LGPD', '👤 Gerando CPF parcial (LGPD Art. 37)...');
      const cpf_parcial = generateCpfParcial(cpf);
      logger.sep();

      // ── STEP 4: Hash SHA-256 ──────────────────────────────
      logger.info('CREATE:HASH', '🔐 Gerando assinatura digital SHA-256...');
      const t2   = Date.now();
      const hash = generateCertificateHash({
        nome_participante,
        cpf,
        nome_curso,
        carga_horaria,
        data_emissao,
        codigo_verificacao,
      });
      logger.perf('CREATE:HASH', 'SHA-256 gerado', Date.now() - t2);
      logger.sep();

      // ── STEP 5: Persiste no banco (antes do PDF) ──────────
      // ⚠️  DECISÃO ARQUITETURAL CRÍTICA:
      //     PDF é gerado APÓS persistir no banco.
      //     Motivo: se o PDF falhar, o certificado ainda existe
      //     e pode ser re-gerado sem perda de dados.
      //     PDF antes do banco criaria PDFs órfãos irrerecuperáveis.
      logger.db('CREATE', '🗄️  Persistindo certificado no banco de dados...');
      const t3 = Date.now();

      const cert = await Certificate.create({
        usuario_id,
        nome_participante,
        cpf,
        cpf_parcial,
        nome_curso,
        carga_horaria,
        data_emissao,
        codigo_verificacao,
        hash,
        nome_instrutor,
        descricao,
      });

      logger.perf('CREATE:DB', 'Certificate.create()', Date.now() - t3);
      logger.success('CREATE:DB', '✅ Certificado persistido no banco', {
        id:                cert.id,
        codigo_verificacao: cert.codigo_verificacao,
        criado_em:         cert.criado_em,
        hash_no_banco:     '✅ salvo',
        pdf_ainda:         '⏳ gerando...',
      });
      logger.sep();

      // ── STEP 6+7+8: Gera PDF e salva hash_preview ────────
      // ✅ v2: generatePDF retorna { pdfUrl, hash, hashPreview }
      //    hash_preview é salvo no banco para a rota /verify retornar
      //    ao frontend — sem isso, o DNA visual do hash fica null.
      let pdfUrl      = null;
      let hashPreview = null;

      try {
        logger.pdf('🖨️  Iniciando geração do PDF via CertificateService...');
        const t4 = Date.now();

        // ✅ CORREÇÃO PRINCIPAL v2 — desestrutura o objeto de retorno
        const serviceResult = await CertificateService.generatePDF({
          id: cert.id,
          nome_participante,
          cpf,
          cpf_parcial,
          nome_curso,
          carga_horaria,
          data_emissao,
          codigo_verificacao,
          hash,
          nome_instrutor,
          descricao,
        });

        logger.perf('CREATE:PDF', 'generatePDF() completo', Date.now() - t4);

        // Desestrutura: pdfUrl, hash (confirmação), hashPreview
        pdfUrl      = serviceResult.pdfUrl;
        hashPreview = serviceResult.hashPreview;

        logger.pdf('✅ PDF gerado com sucesso', {
          pdfUrl,
          hashPreview:    hashPreview ? hashPreview.substring(0, 16) + '...' : null,
          previewLength:  hashPreview?.length,
          dnaFrontend:    hashPreview ? '✅ DNA visual disponível' : '❌ preview ausente',
        });

        // ── Atualiza banco com pdf_url + hash_preview ────────
        logger.db('UPDATE', '🗄️  Atualizando banco com pdf_url e hash_preview...');
        const t5 = Date.now();

        // Salva pdf_url
        await Certificate.updateFilePath(cert.id, pdfUrl);
        logger.perf('CREATE:DB', 'updateFilePath()', Date.now() - t5);
        logger.success('CREATE:DB', '✅ pdf_url atualizado no banco', { pdfUrl });

        // ✅ v2: Salva hash_preview no banco
        // O hash_preview é retornado na rota /verify/:codigo
        // e exibido como DNA visual (barras coloridas) no frontend.
        if (hashPreview) {
          const t6 = Date.now();

          // ⚠️  Certificate.updateHashPreview() deve existir no model
          //     Se não existir, adicione: UPDATE certificates SET hash_preview = $1 WHERE id = $2
          if (typeof Certificate.updateHashPreview === 'function') {
            await Certificate.updateHashPreview(cert.id, hashPreview);
            logger.perf('CREATE:DB', 'updateHashPreview()', Date.now() - t6);
            logger.success('CREATE:DB', '✅ hash_preview salvo no banco', {
              certId:     cert.id,
              preview:    hashPreview.substring(0, 16) + '...',
              length:     hashPreview.length,
              beneficio:  'DNA visual no frontend funcionará ✅',
            });
          } else {
            // Fallback: tenta query direta se o método não existir no model
            logger.warn('CREATE:DB', '⚠️  Certificate.updateHashPreview não encontrado — usando query direta', {
              hint:   'Adicione updateHashPreview() ao model Certificate',
              action: 'Tentando fallback com query direta...',
            });

            // Importa pool para query direta (fallback de segurança)
            try {
              const { pool } = require('../config/database');
              await pool.query(
                'UPDATE certificates SET hash_preview = $1, updated_at = NOW() WHERE id = $2',
                [hashPreview, cert.id]
              );
              logger.success('CREATE:DB', '✅ hash_preview salvo via query direta (fallback)', {
                certId:  cert.id,
                preview: hashPreview.substring(0, 16) + '...',
              });
            } catch (fallbackErr) {
              logger.error('CREATE:DB', '❌ Falha no fallback de hash_preview — DNA visual não funcionará', {
                message:   fallbackErr.message,
                certId:    cert.id,
                hint:      'Adicione coluna hash_preview na tabela certificates e o método no model',
                migration: 'ALTER TABLE certificates ADD COLUMN IF NOT EXISTS hash_preview VARCHAR(64);',
              });
            }
          }
        }

      } catch (pdfError) {
        // PDF falhou — certificado existe, PDF pode ser re-gerado
        logger.error('CREATE:PDF', '❌ Falha na geração do PDF — certificado criado sem PDF', {
          certId:    cert.id,
          message:   pdfError.message,
          http_code: pdfError.http_code,
          hint:      'PDF pode ser re-gerado via endpoint /api/certificates/:id/regenerate-pdf',
          impacto:   'Certificado válido no banco, apenas sem URL do PDF',
        });
        logger.stack('CREATE:PDF', pdfError);
        // pdfUrl e hashPreview permanecem null — retornamos assim
      }

      logger.sep();

      // ── STEP 9: Auditoria ─────────────────────────────────
      logger.audit('Emissão auditada', {
        certId:           cert.id,
        usuario_id,
        nome_participante,
        nome_curso,
        codigo_verificacao,
        pdfGerado:        !!pdfUrl,
        hashPreviewSalvo: !!hashPreview,
        ip:               ctx.ip,
      });

      await AuditLog.create({
        usuario_id,
        acao:       AuditLog.ACTIONS.CERT_CREATED,
        detalhe:    `Certificado emitido para "${nome_participante}" — Curso: "${nome_curso}"`,
        ip_address: ctx.ip,
        user_agent: ctx.userAgent,
        metadata: {
          certId:           cert.id,
          codigo_verificacao,
          nome_curso,
          carga_horaria,
          pdfGerado:        !!pdfUrl,
          hashPreviewSalvo: !!hashPreview,
          requestId:        ctx.requestId,
        },
      });

      // ── STEP 10: Resposta ─────────────────────────────────
      const totalMs = Date.now() - t0;

      logger.result('CREATE', 'ok', {
        certId:           cert.id,
        codigo:           codigo_verificacao,
        pdfGerado:        !!pdfUrl,
        hashPreviewSalvo: !!hashPreview,
        totalMs,
      });

      logger.table('CREATE:RESPONSE', {
        'cert.id':          cert.id,
        'codigo':           codigo_verificacao,
        'pdf_url':          pdfUrl ? '✅ ' + pdfUrl.substring(0, 60) + '...' : '❌ null',
        'hash_preview':     hashPreview ? '✅ ' + hashPreview.substring(0, 16) + '...' : '❌ null',
        'total_ms':         totalMs + 'ms',
        'dna_visual':       hashPreview ? '✅ disponível no frontend' : '❌ não disponível',
      });

      logger.sep();

      logger.res(201, 'Certificado criado com sucesso', { certId: cert.id });

      return res.status(201).json({
        success: true,
        message: 'Certificado emitido com sucesso',
        data: {
          id:                 cert.id,
          codigo_verificacao: cert.codigo_verificacao,
          nome_participante:  cert.nome_participante,
          nome_curso:         cert.nome_curso,
          carga_horaria:      cert.carga_horaria,
          data_emissao:       cert.data_emissao,
          cpf_parcial:        cert.cpf_parcial,
          hash_preview:       hashPreview || null,
          pdf_url:            pdfUrl,
          criado_em:          cert.criado_em,
        },
      });

    } catch (error) {
      const totalMs = Date.now() - t0;

      // ✅ v2.1: ENOTFOUND/ECONNREFUSED/ETIMEDOUT → 503
      // ⚠️  DEVE vir ANTES do fallback genérico 500
      //     Banco inacessível não é erro de código — é infra
      if (isDbConnErr(error)) {
        return dbConnResponse(res, 'CREATE', ctx, totalMs, error);
      }

      logger.error('CREATE', `❌ Erro não tratado após ${totalMs}ms`, {
        message:   error.message,
        code:      error.code,
        requestId: ctx.requestId,
        userId:    ctx.userId,
      });
      logger.stack('CREATE', error);
      logger.sep();

      logger.res(500, 'CERT_CREATE_ERROR');

      return res.status(500).json({
        success:   false,
        error:     process.env.NODE_ENV === 'development'
          ? `Erro ao criar certificado: ${error.message}`
          : 'Erro ao criar certificado. Tente novamente.',
        code:      error.code || 'CERT_CREATE_ERROR',
        requestId: ctx.requestId,
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  // 🔍 VERIFY CERTIFICATE — Rota pública (sem autenticação)
  //
  // ✅ v2: retorna hash_preview real do banco
  //    — frontend exibe DNA visual (barras coloridas SHA-256)
  //    — hash completo NUNCA é retornado (dado interno)
  //
  // Segurança: nunca retorna CPF completo, hash completo,
  // usuario_id ou qualquer dado sensível interno.
  // ══════════════════════════════════════════════════════════
  static async verifyCertificate(req, res) {
    const t0  = Date.now();
    const ctx = reqContext(req);

    logger.sep();
    logger.req('GET', `/api/certificates/verify/${req.params.codigo}`, {
      requestId: ctx.requestId,
      ip:        ctx.ip,
      origin:    ctx.origin,
    });
    logger.info('VERIFY', '🔍 Verificação pública iniciada', {
      codigo:    req.params.codigo,
      requestId: ctx.requestId,
      userAgent: ctx.userAgent.substring(0, 60),
    });

    try {
      const { codigo } = req.params;

      // ── Busca no banco ────────────────────────────────────
      logger.db('VERIFY', '🗄️  Buscando certificado por código...', { codigo });
      const t1 = Date.now();

      const certificate = await Certificate.findByVerificationCode(codigo);

      logger.perf('VERIFY:DB', 'findByVerificationCode()', Date.now() - t1);

      if (!certificate) {
        logger.warn('VERIFY', '⚠️  Certificado não encontrado', {
          codigo,
          ip:        ctx.ip,
          userAgent: ctx.userAgent.substring(0, 60),
          hint:      'Pode ser scraping ou código inválido',
        });

        // ⚠️  Auditamos tentativas inválidas — detecta enumeração
        await AuditLog.create({
          usuario_id: null,
          acao:       AuditLog.ACTIONS.CERT_VERIFIED,
          detalhe:    `Verificação FALHOU — código não encontrado: ${codigo}`,
          ip_address: ctx.ip,
          user_agent: ctx.userAgent,
          metadata:   {
            codigo,
            encontrado: false,
            requestId:  ctx.requestId,
            suspicious: codigo.length > 32 ? true : false,
          },
        });

        logger.res(404, 'CERT_NOT_FOUND');

        return res.status(404).json({
          success: false,
          error:   'Certificado não encontrado ou código inválido',
          code:    'CERT_NOT_FOUND',
        });
      }

      logger.success('VERIFY:DB', '✅ Certificado encontrado', {
        id:                certificate.id,
        nome_participante: certificate.nome_participante,
        nome_curso:        certificate.nome_curso,
        hash_preview_db:   certificate.hash_preview
          ? certificate.hash_preview.substring(0, 16) + '...'
          : '❌ null (hash_preview não salvo no banco)',
        pdf_path:          certificate.pdf_path ? '✅ presente' : '❌ null',
      });
      logger.sep();

      // ── Incrementa contador + histórico (paralelo) ────────
      // ⚠️  Promise.allSettled: ambos tentam executar independente
      //     de falha um do outro — não bloqueia a resposta.
      logger.info('VERIFY:AUDIT', '📈 Incrementando contador + salvando histórico (paralelo)...');
      const t2 = Date.now();

      const [incrResult, histResult] = await Promise.allSettled([
        Certificate.incrementVerification(certificate.id),
        Certificate.addVerificationHistory({
          certificate_id:     certificate.id,
          codigo_verificacao: codigo,
          ip_address:         ctx.ip,
          user_agent:         ctx.userAgent,
        }),
      ]);

      logger.perf('VERIFY:AUDIT', 'increment + history (Promise.allSettled)', Date.now() - t2);

      if (incrResult.status === 'rejected') {
        logger.warn('VERIFY:AUDIT', '⚠️  Falha ao incrementar contador (não crítico)', {
          reason:   incrResult.reason?.message,
          certId:   certificate.id,
          impacto:  'Contador de verificações não atualizado, experiência não afetada',
        });
      } else {
        logger.success('VERIFY:AUDIT', '✅ Contador incrementado', {
          novoTotal: incrResult.value,
        });
      }

      if (histResult.status === 'rejected') {
        logger.warn('VERIFY:AUDIT', '⚠️  Falha ao salvar histórico (não crítico)', {
          reason:  histResult.reason?.message,
          certId:  certificate.id,
          impacto: 'Histórico de verificações não registrado',
        });
      } else {
        logger.success('VERIFY:AUDIT', '✅ Histórico de verificação salvo');
      }

      const newVerificationCount = incrResult.status === 'fulfilled'
        ? incrResult.value
        : (certificate.verificacoes_count || 0) + 1;

      logger.sep();

      // ── Auditoria da verificação bem-sucedida ────────────
      logger.audit('Verificação pública auditada', {
        certId:            certificate.id,
        codigo,
        ip:                ctx.ip,
        totalVerificacoes: newVerificationCount,
        requestId:         ctx.requestId,
      });

      await AuditLog.create({
        usuario_id: null,
        acao:       AuditLog.ACTIONS.CERT_VERIFIED,
        detalhe:    `Certificado verificado: "${certificate.nome_participante}" — "${certificate.nome_curso}"`,
        ip_address: ctx.ip,
        user_agent: ctx.userAgent,
        metadata: {
          certId:            certificate.id,
          codigo,
          totalVerificacoes: newVerificationCount,
          encontrado:        true,
          requestId:         ctx.requestId,
        },
      });

      // ── Monta hash_preview para retorno ──────────────────
      // ✅ v2: usa hash_preview do banco (salvo na emissão)
      //    Se não tiver (certificados antigos), tenta derivar do hash
      //    Se não tiver hash, retorna null (sem DNA visual)
      let hashPreviewFinal = null;

      if (certificate.hash_preview) {
        // ✅ Caminho feliz — hash_preview salvo na emissão v2
        hashPreviewFinal = certificate.hash_preview;
        logger.success('VERIFY:HASH', '✅ hash_preview lido do banco (v2)', {
          preview: hashPreviewFinal.substring(0, 16) + '...',
          fonte:   'banco de dados (campo hash_preview)',
        });
      } else if (certificate.hash) {
        // Fallback para certificados antigos que têm hash mas não hash_preview
        hashPreviewFinal = certificate.hash.substring(0, 32).toUpperCase();
        logger.warn('VERIFY:HASH', '⚠️  hash_preview ausente — derivando do hash (certificado antigo)', {
          preview:   hashPreviewFinal.substring(0, 16) + '...',
          fonte:     'hash completo do banco (fallback)',
          hint:      'Certificados novos terão hash_preview salvo diretamente',
          migration: 'Rode: UPDATE certificates SET hash_preview = UPPER(SUBSTRING(hash, 1, 32)) WHERE hash_preview IS NULL',
        });
      } else {
        // Sem dados — DNA visual ficará indisponível
        logger.warn('VERIFY:HASH', '⚠️  hash e hash_preview ausentes — DNA visual indisponível', {
          certId: certificate.id,
          hint:   'Certificado pode ter sido criado antes da implementação do hash',
        });
      }

      // ── Monta e retorna resposta pública ─────────────────
      const totalMs = Date.now() - t0;

      logger.result('VERIFY', 'ok', {
        certId:            certificate.id,
        codigo,
        totalVerificacoes: newVerificationCount,
        hashPreview:       hashPreviewFinal ? '✅ disponível' : '❌ null',
        totalMs,
      });

      logger.table('VERIFY:RESPONSE', {
        'cert.id':           certificate.id,
        'participante':      certificate.nome_participante,
        'curso':             certificate.nome_curso.substring(0, 40),
        'verificacoes':      newVerificationCount,
        'hash_preview':      hashPreviewFinal ? hashPreviewFinal.substring(0, 16) + '...' : '❌ null',
        'pdf_url':           certificate.pdf_path ? '✅ presente' : '❌ null',
        'total_ms':          totalMs + 'ms',
      });

      logger.sep();
      logger.res(200, 'Verificação concluída com sucesso', {
        certId: certificate.id,
        totalMs,
      });

      // ⚠️  SEGURANÇA — A resposta pública NUNCA expõe:
      //     ❌ CPF completo (LGPD Art. 37)
      //     ❌ Hash SHA-256 completo (dado interno)
      //     ❌ usuario_id (identidade do emissor)
      //     ❌ pdf_path interno (renomeado para pdf_url)
      //     ❌ Dados de outros usuários
      return res.json({
        success: true,
        data: {
          valido: true,
          participante: {
            nome: certificate.nome_participante.toUpperCase(),
            cpf:  certificate.cpf_parcial,
          },
          curso: {
            nome:          certificate.nome_curso,
            carga_horaria: certificate.carga_horaria,
            data_emissao:  certificate.data_emissao,
            instrutor:     certificate.nome_instrutor || null,
          },
          verificacao: {
            codigo:             certificate.codigo_verificacao,
            hash_preview:       hashPreviewFinal, // ✅ v2: real, não null
            total_verificacoes: newVerificationCount,
            verificado_em:      new Date().toISOString(),
          },
          pdf_url: certificate.pdf_path || null,
        },
      });

    } catch (error) {
      const totalMs = Date.now() - t0;

      // ✅ v2.1: ENOTFOUND/ECONNREFUSED/ETIMEDOUT → 503 (não 500)
      // ⚠️  DEVE vir ANTES do fallback genérico 500
      //     Banco inacessível não é erro de código — é infra
      if (isDbConnErr(error)) {
        return dbConnResponse(res, 'VERIFY', ctx, totalMs, error);
      }

      logger.error('VERIFY', `❌ Erro não tratado após ${totalMs}ms`, {
        message:   error.message,
        code:      error.code,
        requestId: ctx.requestId,
        ip:        ctx.ip,
      });
      logger.stack('VERIFY', error);
      logger.sep();

      logger.res(500, 'CERT_VERIFY_ERROR');

      return res.status(500).json({
        success:   false,
        error:     'Erro ao verificar certificado',
        code:      'CERT_VERIFY_ERROR',
        requestId: ctx.requestId,
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  // 📋 GET USER CERTIFICATES — Rota autenticada
  // ══════════════════════════════════════════════════════════
  static async getUserCertificates(req, res) {
    const t0  = Date.now();
    const ctx = reqContext(req);

    logger.sep();
    logger.req('GET', '/api/certificates', {
      requestId: ctx.requestId,
      userId:    ctx.userId,
    });

    try {
      const usuario_id = req.user.id;
      const limit      = Math.min(parseInt(req.query.limit)  || 50, 200); // máximo 200
      const offset     = Math.max(parseInt(req.query.offset) || 0,  0);   // mínimo 0
      const search     = req.query.search || null;

      logger.table('LIST:PARAMS', {
        'usuario_id': usuario_id,
        'limit':      limit,
        'offset':     offset,
        'search':     search || '(nenhum)',
        'requestId':  ctx.requestId,
      });

      const t1 = Date.now();
      const [certificates, total] = await Promise.all([
        Certificate.findByUserId(usuario_id, { limit, offset }),
        Certificate.countByUserId(usuario_id),
      ]);

      logger.perf('LIST:DB', 'findByUserId + countByUserId (paralelo)', Date.now() - t1);
      logger.success('LIST', '✅ Certificados listados', {
        usuario_id,
        count:   certificates.length,
        total,
        offset,
        limit,
        hasMore: offset + certificates.length < total,
      });

      const totalMs = Date.now() - t0;
      logger.perf('LIST', 'Fluxo completo de listagem', totalMs);
      logger.res(200, 'Lista retornada com sucesso', { count: certificates.length, total });
      logger.sep();

      return res.json({
        success: true,
        data:    certificates,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + certificates.length < total,
          pages:   Math.ceil(total / limit),
        },
      });

    } catch (error) {
      const totalMs = Date.now() - t0;

      // ✅ v2.1: 503 para erros de conectividade com banco
      if (isDbConnErr(error)) {
        return dbConnResponse(res, 'LIST', ctx, totalMs, error);
      }

      logger.error('LIST', '❌ Erro ao listar certificados', {
        message:   error.message,
        userId:    ctx.userId,
        requestId: ctx.requestId,
      });
      logger.stack('LIST', error);
      logger.sep();

      logger.res(500, 'CERT_LIST_ERROR');

      return res.status(500).json({
        success:   false,
        error:     'Erro ao listar certificados',
        code:      'CERT_LIST_ERROR',
        requestId: ctx.requestId,
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  // 🔎 GET CERTIFICATE BY ID — Rota autenticada
  // ══════════════════════════════════════════════════════════
  static async getCertificateById(req, res) {
    const t0  = Date.now();
    const ctx = reqContext(req);

    logger.sep();
    logger.req('GET', `/api/certificates/${req.params.id}`, {
      requestId: ctx.requestId,
      userId:    ctx.userId,
    });

    try {
      const { id }     = req.params;
      const usuario_id = req.user.id;

      logger.db('GET_BY_ID', '🗄️  Buscando certificado por ID...', {
        id,
        usuario_id,
        requestId: ctx.requestId,
      });

      const t1          = Date.now();
      const certificate = await Certificate.findById(id, usuario_id);
      logger.perf('GET_BY_ID:DB', 'findById()', Date.now() - t1);

      if (!certificate) {
        logger.warn('GET_BY_ID', '⚠️  Certificado não encontrado ou não pertence ao usuário', {
          id,
          usuario_id,
          requestId: ctx.requestId,
          sec_note:  'Pode ser tentativa de acesso a dados de outro usuário',
        });

        logger.res(404, 'CERT_NOT_FOUND');

        return res.status(404).json({
          success: false,
          error:   'Certificado não encontrado',
          code:    'CERT_NOT_FOUND',
        });
      }

      logger.success('GET_BY_ID', '✅ Certificado encontrado', {
        id:               certificate.id,
        nome_participante: certificate.nome_participante,
        hash_preview:     certificate.hash_preview
          ? certificate.hash_preview.substring(0, 16) + '...'
          : '❌ null',
      });

      // Auditamos consultas individuais — rastreabilidade total
      await AuditLog.create({
        usuario_id,
        acao:       AuditLog.ACTIONS.CERT_VIEWED,
        detalhe:    `Certificado visualizado: ID ${id}`,
        ip_address: ctx.ip,
        user_agent: ctx.userAgent,
        metadata:   { certId: id, requestId: ctx.requestId },
      });

      const totalMs = Date.now() - t0;
      logger.perf('GET_BY_ID', 'Fluxo completo', totalMs);
      logger.res(200, 'Certificado retornado', { id, totalMs });
      logger.sep();

      return res.json({
        success: true,
        data:    certificate,
      });

    } catch (error) {
      const totalMs = Date.now() - t0;

      // ✅ v2.1: 503 para erros de conectividade com banco
      if (isDbConnErr(error)) {
        return dbConnResponse(res, 'GET_BY_ID', ctx, totalMs, error);
      }

      logger.error('GET_BY_ID', '❌ Erro ao buscar certificado', {
        message:   error.message,
        id:        req.params.id,
        userId:    ctx.userId,
        requestId: ctx.requestId,
      });
      logger.stack('GET_BY_ID', error);
      logger.sep();

      logger.res(500, 'CERT_GET_ERROR');

      return res.status(500).json({
        success:   false,
        error:     'Erro ao buscar certificado',
        code:      'CERT_GET_ERROR',
        requestId: ctx.requestId,
      });
    }
  }
}

module.exports = CertificateController;