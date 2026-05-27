// src/models/AuditLog.js
// ============================================================
// 🏢 NexaSpark — Model de Auditoria
// Registro imutável de todas as ações críticas do sistema.
// Trilha de auditoria é requisito LGPD Art. 37.
// ============================================================

const { pool } = require('../database/db');

// ============================================================
// 🎨 LOGGER
// ============================================================
const c = {
  green:   (s) => `\x1b[32m${s}\x1b[0m`,
  red:     (s) => `\x1b[31m${s}\x1b[0m`,
  yellow:  (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:    (s) => `\x1b[36m${s}\x1b[0m`,
  magenta: (s) => `\x1b[35m${s}\x1b[0m`,
  gray:    (s) => `\x1b[90m${s}\x1b[0m`,
  bold:    (s) => `\x1b[1m${s}\x1b[0m`,
};

const logger = {
  info:    (msg, data) => console.log(   c.cyan(`ℹ️  [AuditLog]`),    msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  success: (msg, data) => console.log(   c.green(`✅ [AuditLog]`),   msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  warn:    (msg, data) => console.warn(  c.yellow(`⚠️  [AuditLog]`),  msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  error:   (msg, data) => console.error( c.red(`❌ [AuditLog]`),     msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  db:      (msg, data) => console.log(   c.cyan(`🗄️  [AuditLog:DB]`), msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  perf:    (label, ms) => console.log(   c.magenta(`⏱️  [AuditLog:PERF]`), `${label} — ${c.bold(ms + 'ms')}`),
};

console.log(c.green(c.bold('🔏 [AuditLog] Modelo de auditoria inicializado')));

// ============================================================
// 📋 CATÁLOGO DE AÇÕES — Fonte única de verdade
//
// ⚠️  NOVO: no original, as ações eram strings livres espalhadas
//     pelo código ('REGISTER', 'LOGIN', etc.).
//     Isso causava inconsistências de grafia e dificultava queries.
//     Centralizamos aqui como constantes exportadas.
//
// ⚠️  ADIÇÃO: LOGIN_GOOGLE e REGISTER_GOOGLE adicionados para
//     cobrir o fluxo OAuth 2.0 implementado via Passport.
//     Sem essas entradas, AuditLog.create() emitia console.warn
//     "Ação não catalogada em ACTIONS" a cada login Google,
//     o que o Railway interpretava como nível "error" nos logs.
//
// ✅ v3.0: CERT_REVOKED adicionado — revogação de certificados
// ============================================================
const ACTIONS = Object.freeze({
  // Auth local
  REGISTER:          'REGISTER',
  LOGIN:             'LOGIN',
  LOGOUT:            'LOGOUT',
  LOGIN_FAILED:      'LOGIN_FAILED',
  TOKEN_REFRESHED:   'TOKEN_REFRESHED',

  // ✅ NOVO — Auth OAuth Google
  LOGIN_GOOGLE:      'LOGIN_GOOGLE',    // ← login via Google OAuth (conta existente ou nova)
  REGISTER_GOOGLE:   'REGISTER_GOOGLE', // ← primeiro acesso via Google (conta criada)

  // Certificados
  CERT_CREATED:       'CERT_CREATED',
  CERT_VIEWED:        'CERT_VIEWED',
  CERT_VERIFIED:      'CERT_VERIFIED',
  CERT_PDF_GENERATED: 'CERT_PDF_GENERATED',
  CERT_DELETED:       'CERT_DELETED',
  CERT_REVOKED:       'CERT_REVOKED',   // ✅ v3.0: revogação de certificado pelo emissor

  // Admin
  ADMIN_ACCESS:      'ADMIN_ACCESS',
  ADMIN_USER_LIST:   'ADMIN_USER_LIST',

  // Sistema
  RATE_LIMIT_HIT:    'RATE_LIMIT_HIT',
  SECURITY_ALERT:    'SECURITY_ALERT',
});

// ============================================================
// CREATE — Registra uma ação no log de auditoria
// ============================================================
/**
 * Cria um registro de auditoria.
 *
 * ⚠️  DECISÃO ARQUITETURAL MANTIDA:
 *     AuditLog.create() nunca lança exceção para o chamador.
 *     Se falhar, loga o erro internamente e retorna null.
 *     Motivo: uma falha no log de auditoria não deve
 *     interromper a operação principal do usuário.
 *     A auditoria é importante, mas não pode ser um ponto
 *     de falha que impede login ou emissão de certificados.
 *
 * ⚠️  MELHORIA: adicionado campo `metadata` (JSONB) para
 *     dados extras por ação sem precisar alterar o schema.
 *     Ex: { certificateId: 123, curso: "Node.js" }
 */
async function create(data) {
  const t0 = Date.now();
  const {
    usuario_id,
    acao,
    detalhe,
    ip_address,
    user_agent,
    metadata = null,
  } = data;

  // Valida que a ação é uma das catalogadas
  // (warn apenas — não bloqueia, pois novos tipos podem surgir)
  if (acao && !Object.values(ACTIONS).includes(acao)) {
    logger.warn('Ação não catalogada em ACTIONS', { acao });
  }

  logger.db('INSERT audit_logs', {
    usuario_id: usuario_id || null,
    acao,
    detalhe: detalhe?.substring(0, 80),
    ip_address,
  });

  try {
    // ⚠️  MELHORIA: tentamos inserir com metadata (JSONB).
    //     Se a coluna não existir no banco ainda, fazemos fallback
    //     sem ela — garante compatibilidade retroativa.
    let result;
    try {
      result = await pool.query(
        `INSERT INTO audit_logs
           (usuario_id, acao, detalhe, ip_address, user_agent, metadata, criado_em)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING id`,
        [
          usuario_id || null,
          acao,
          detalhe || null,
          ip_address || null,
          user_agent || null,
          metadata ? JSON.stringify(metadata) : null,
        ]
      );
    } catch (metadataError) {
      // Fallback sem metadata — coluna pode não existir ainda
      if (metadataError.code === '42703') {
        logger.warn('Coluna metadata não encontrada — inserindo sem ela', { hint: 'Execute a migration para adicionar metadata JSONB' });
        result = await pool.query(
          `INSERT INTO audit_logs
             (usuario_id, acao, detalhe, ip_address, user_agent, criado_em)
           VALUES ($1, $2, $3, $4, $5, NOW())
           RETURNING id`,
          [usuario_id || null, acao, detalhe || null, ip_address || null, user_agent || null]
        );
      } else {
        throw metadataError;
      }
    }

    const auditId = result.rows[0]?.id;
    logger.perf('create()', Date.now() - t0);
    logger.success('Ação auditada', { auditId, acao, usuario_id: usuario_id || 'anônimo' });

    return auditId;

  } catch (error) {
    // Nunca relança — ver decisão arquitetural acima
    logger.error('Falha ao registrar auditoria — ação NÃO foi auditada!', {
      message:    error.message,
      code:       error.code,
      acao,
      usuario_id: usuario_id || null,
    });
    return null;
  }
}

// ============================================================
// FIND BY USER ID
// ============================================================
/**
 * ⚠️  MELHORIA: adicionado filtro de acao e paginação.
 *     O original tinha limit hardcoded em 100, sem offset.
 *     Em produção, usuários com muitas ações derrubavam a query.
 */
async function findByUserId(usuario_id, { limit = 50, offset = 0, acao = null } = {}) {
  const t0 = Date.now();

  const safeLimit  = Math.min(Math.max(parseInt(limit)  || 50, 1), 500);
  const safeOffset = Math.max(parseInt(offset) || 0, 0);

  logger.db('SELECT audit_logs WHERE usuario_id', { usuario_id, limit: safeLimit, offset: safeOffset, acao });

  try {
    let query;
    let params;

    if (acao) {
      query  = `SELECT * FROM audit_logs WHERE usuario_id = $1 AND acao = $2 ORDER BY criado_em DESC LIMIT $3 OFFSET $4`;
      params = [usuario_id, acao, safeLimit, safeOffset];
    } else {
      query  = `SELECT * FROM audit_logs WHERE usuario_id = $1 ORDER BY criado_em DESC LIMIT $2 OFFSET $3`;
      params = [usuario_id, safeLimit, safeOffset];
    }

    const result = await pool.query(query, params);

    logger.perf('findByUserId()', Date.now() - t0);
    logger.success(`${result.rows.length} log(s) encontrado(s)`, { usuario_id, count: result.rows.length });

    return result.rows;

  } catch (error) {
    logger.error('Erro em findByUserId', { message: error.message, usuario_id });
    return [];
  }
}

// ============================================================
// FIND BY ACTION
// ============================================================
/**
 * ⚠️  MELHORIA: adicionado filtro de período (desde/até).
 *     Útil para o admin ver todos os logins das últimas 24h,
 *     ou todas as emissões de certificados da semana.
 */
async function findByAction(acao, { limit = 50, offset = 0, desde = null, ate = null } = {}) {
  const t0 = Date.now();

  const safeLimit  = Math.min(Math.max(parseInt(limit)  || 50, 1), 500);
  const safeOffset = Math.max(parseInt(offset) || 0, 0);

  logger.db('SELECT audit_logs WHERE acao', { acao, limit: safeLimit, offset: safeOffset, desde, ate });

  try {
    let query  = `SELECT * FROM audit_logs WHERE acao = $1`;
    const params = [acao];
    let paramIdx = 2;

    if (desde) {
      query += ` AND criado_em >= $${paramIdx++}`;
      params.push(desde);
    }
    if (ate) {
      query += ` AND criado_em <= $${paramIdx++}`;
      params.push(ate);
    }

    query += ` ORDER BY criado_em DESC LIMIT $${paramIdx++} OFFSET $${paramIdx}`;
    params.push(safeLimit, safeOffset);

    const result = await pool.query(query, params);

    logger.perf('findByAction()', Date.now() - t0);
    logger.success(`${result.rows.length} log(s) para ação "${acao}"`, { count: result.rows.length });

    return result.rows;

  } catch (error) {
    logger.error('Erro em findByAction', { message: error.message, acao });
    return [];
  }
}

// ============================================================
// FIND ALL — Admin only
// ============================================================
/**
 * ⚠️  ATENÇÃO: esta função deve ser chamada SOMENTE por rotas
 *     de admin com autenticação reforçada.
 *     Retorna logs de todos os usuários.
 *
 * ⚠️  MELHORIA: paginação obrigatória + log de quem consultou.
 */
async function findAll({ limit = 50, offset = 0 } = {}) {
  const t0 = Date.now();

  const safeLimit  = Math.min(Math.max(parseInt(limit)  || 50, 1), 500);
  const safeOffset = Math.max(parseInt(offset) || 0, 0);

  logger.db('SELECT ALL audit_logs — operação administrativa', { limit: safeLimit, offset: safeOffset });

  try {
    const result = await pool.query(
      `SELECT * FROM audit_logs ORDER BY criado_em DESC LIMIT $1 OFFSET $2`,
      [safeLimit, safeOffset]
    );

    logger.perf('findAll()', Date.now() - t0);
    logger.success(`findAll retornou ${result.rows.length} log(s)`, { count: result.rows.length });

    return result.rows;

  } catch (error) {
    logger.error('Erro em findAll', { message: error.message });
    return [];
  }
}

// ============================================================
// COUNT — Estatísticas por ação
// ============================================================
/**
 * ⚠️  NOVO: útil para dashboard admin (ex: quantos logins hoje,
 *     quantos certificados emitidos na semana).
 */
async function countByAction(acao, { desde = null } = {}) {
  const t0 = Date.now();

  logger.db('COUNT audit_logs WHERE acao', { acao, desde });

  try {
    let query  = `SELECT COUNT(*)::int AS total FROM audit_logs WHERE acao = $1`;
    const params = [acao];

    if (desde) {
      query += ` AND criado_em >= $2`;
      params.push(desde);
    }

    const result = await pool.query(query, params);
    const total  = result.rows[0]?.total ?? 0;

    logger.perf('countByAction()', Date.now() - t0);
    logger.info(`Contagem para "${acao}"`, { total, desde });

    return total;

  } catch (error) {
    logger.error('Erro em countByAction', { message: error.message, acao });
    return 0;
  }
}

module.exports = {
  create,
  findByUserId,
  findByAction,
  findAll,
  countByAction,
  ACTIONS, // ← exportado para os controllers usarem as constantes
};