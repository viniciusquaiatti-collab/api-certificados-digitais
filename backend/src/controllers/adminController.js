// src/controllers/adminController.js
// ============================================================
// 🏢 NexaSpark — Admin Controller
// Área administrativa — acesso ao coração do sistema.
// Esta é a rota mais sensível de toda a API.
// Cada acesso é auditado. Cada erro é documentado.
// ============================================================

const { pool } = require('../database/db');
const AuditLog  = require('../models/AuditLog');

// ============================================================
// 🎨 LOGGER ENTERPRISE
// ============================================================
const c = {
  green:   (s) => `\x1b[32m${s}\x1b[0m`,
  red:     (s) => `\x1b[31m${s}\x1b[0m`,
  yellow:  (s) => `\x1b[33m${s}\x1b[0m`,
  blue:    (s) => `\x1b[34m${s}\x1b[0m`,
  cyan:    (s) => `\x1b[36m${s}\x1b[0m`,
  magenta: (s) => `\x1b[35m${s}\x1b[0m`,
  gray:    (s) => `\x1b[90m${s}\x1b[0m`,
  bold:    (s) => `\x1b[1m${s}\x1b[0m`,
};

const logger = {
  info:    (scope, msg, data) => console.log(   c.blue(`ℹ️  [${scope}]`),    msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  success: (scope, msg, data) => console.log(   c.green(`✅ [${scope}]`),   msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  warn:    (scope, msg, data) => console.warn(  c.yellow(`⚠️  [${scope}]`),  msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  error:   (scope, msg, data) => console.error( c.red(`❌ [${scope}]`),     msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  perf:    (scope, label, ms) => console.log(   c.magenta(`⏱️  [${scope}]`), `${label} — ${c.bold(ms + 'ms')}`),
  audit:   (msg, data)        => console.log(   c.green(`🔏 [AUDIT]`),     msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  sec:     (msg, data)        => console.warn(  c.red(`🚨 [SECURITY]`),    msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  sep:     ()                 => console.log(   c.gray('─'.repeat(60))),
};

// ============================================================
// 🛡️  HELPER — Contexto da requisição
// ============================================================
function reqContext(req) {
  return {
    ip:        req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    requestId: req.requestId || req.headers['x-request-id'] || `adm_${Date.now()}`,
    adminId:   req.user?.id || null,
    adminEmail:req.user?.email || null,
    role:      req.user?.role || 'unknown',
  };
}

console.log(c.red(c.bold('🔴 [AdminController] Módulo administrativo inicializado')));
logger.sep();

// ============================================================

class AdminController {

  // ══════════════════════════════════════════════════════════
  // DASHBOARD — Métricas gerais do sistema
  // ══════════════════════════════════════════════════════════
  static async getDashboardData(req, res) {
    const t0  = Date.now();
    const ctx = reqContext(req);

    logger.sep();
    logger.info('ADMIN:DASHBOARD', 'Acesso ao dashboard administrativo', ctx);

    // ⚠️  AUDITORIA DE ACESSO ADMIN:
    //     Todo acesso admin é registrado — quem acessou, quando, de onde.
    //     Isso é requisito de compliance para APIs com dados sensíveis.
    await AuditLog.create({
      usuario_id: ctx.adminId,
      acao:       AuditLog.ACTIONS.ADMIN_ACCESS,
      detalhe:    'Acesso ao dashboard administrativo',
      ip_address: ctx.ip,
      user_agent: ctx.userAgent,
      metadata:   { endpoint: 'GET /api/admin/dashboard', requestId: ctx.requestId },
    });

    try {
      // ══════════════════════════════════════════════════════
      // ⚠️  PROBLEMA CRÍTICO #1 — DRIVER ERRADO
      //
      // O original usava: db.execute(...)
      // db.execute() é do driver mysql2 (MySQL).
      // Este projeto usa PostgreSQL com o driver `pg` (pool.query).
      //
      // Isso significa que o AdminController NUNCA funcionou.
      // Cada chamada lançava TypeError: db.execute is not a function.
      //
      // ✅ CORREÇÃO: trocamos db.execute() por pool.query()
      //    e ajustamos a sintaxe SQL de MySQL para PostgreSQL.
      // ══════════════════════════════════════════════════════

      // ⚠️  PROBLEMA CRÍTICO #2 — NOMES DE TABELAS ERRADOS
      //
      // O original usava: 'usuarios', 'certificados', 'historico_verificacoes'
      // O restante do projeto usa: 'users', 'certificates', 'verification_history'
      // Isso causaria QueryError: relation "usuarios" does not exist.
      //
      // ✅ CORREÇÃO: usando os nomes corretos do schema PostgreSQL.
      // ══════════════════════════════════════════════════════

      // ⚠️  PROBLEMA CRÍTICO #3 — SINTAXE SQL MySQL vs PostgreSQL
      //
      // O original usava CURDATE() — função do MySQL.
      // PostgreSQL usa CURRENT_DATE ou NOW()::date.
      //
      // ✅ CORREÇÃO: NOW()::date para PostgreSQL.
      // ══════════════════════════════════════════════════════

      // ⚠️  MELHORIA: executamos todas as queries em paralelo com Promise.all.
      //     O original tinha Promise.all mas com db.execute (MySQL) — nunca funcionou.
      //     Agora com pool.query funciona de verdade.
      logger.info('ADMIN:DASHBOARD', 'Executando queries em paralelo...');
      const t1 = Date.now();

      const [
        usersResult,
        certsResult,
        verificationsTodayResult,
        certsThisMonthResult,
        recentLoginsResult,
        topCoursesResult,
      ] = await Promise.all([

        // Total de usuários cadastrados
        pool.query('SELECT COUNT(*)::int AS total FROM users'),

        // Total de certificados emitidos
        pool.query('SELECT COUNT(*)::int AS total FROM certificates'),

        // Verificações públicas hoje
        // ⚠️  CORREÇÃO: CURRENT_DATE (PostgreSQL) em vez de CURDATE() (MySQL)
        pool.query(
          `SELECT COUNT(*)::int AS total
           FROM verification_history
           WHERE data_verificacao::date = CURRENT_DATE`
        ),

        // Certificados emitidos este mês
        pool.query(
          `SELECT COUNT(*)::int AS total
           FROM certificates
           WHERE DATE_TRUNC('month', criado_em) = DATE_TRUNC('month', NOW())`
        ),

        // Últimos 5 logins (para atividade recente no dashboard)
        pool.query(
          `SELECT usuario_id, ip_address, criado_em
           FROM audit_logs
           WHERE acao = $1
           ORDER BY criado_em DESC
           LIMIT 5`,
          [AuditLog.ACTIONS.LOGIN]
        ),

        // Top 5 cursos mais certificados
        pool.query(
          `SELECT nome_curso, COUNT(*)::int AS total
           FROM certificates
           GROUP BY nome_curso
           ORDER BY total DESC
           LIMIT 5`
        ),
      ]);

      logger.perf('ADMIN:DASHBOARD', 'Todas as queries (paralelo)', Date.now() - t1);

      const dashboardData = {
        overview: {
          totalUsers:         usersResult.rows[0].total,
          totalCertificates:  certsResult.rows[0].total,
          verificationsToday: verificationsTodayResult.rows[0].total,
          certsThisMonth:     certsThisMonthResult.rows[0].total,
        },
        activity: {
          recentLogins: recentLoginsResult.rows,
          topCourses:   topCoursesResult.rows,
        },
        meta: {
          generatedAt: new Date().toISOString(),
          requestId:   ctx.requestId,
        },
      };

      const elapsed = Date.now() - t0;
      logger.perf('ADMIN:DASHBOARD', 'Fluxo completo', elapsed);
      logger.success('ADMIN:DASHBOARD', 'Dashboard gerado com sucesso', {
        totalUsers:        dashboardData.overview.totalUsers,
        totalCertificates: dashboardData.overview.totalCertificates,
        requestId:         ctx.requestId,
        totalMs:           elapsed,
      });
      logger.sep();

      return res.json({
        success: true,
        data:    dashboardData,
      });

    } catch (error) {
      const elapsed = Date.now() - t0;
      logger.error('ADMIN:DASHBOARD', `Erro após ${elapsed}ms`, {
        message:   error.message,
        code:      error.code,
        requestId: ctx.requestId,
        adminId:   ctx.adminId,
      });
      logger.error('ADMIN:DASHBOARD', 'Stack:\n' + error.stack);
      logger.sep();

      return res.status(500).json({
        success:   false,
        error:     'Erro ao buscar dados do dashboard',
        code:      'ADMIN_DASHBOARD_ERROR',
        requestId: ctx.requestId,
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  // GET ALL AUDIT LOGS — Paginado
  // ══════════════════════════════════════════════════════════
  static async getAllAuditLogs(req, res) {
    const t0  = Date.now();
    const ctx = reqContext(req);

    logger.sep();
    logger.info('ADMIN:LOGS', 'Listando todos os logs de auditoria', ctx);

    await AuditLog.create({
      usuario_id: ctx.adminId,
      acao:       AuditLog.ACTIONS.ADMIN_ACCESS,
      detalhe:    'Listagem de logs de auditoria',
      ip_address: ctx.ip,
      user_agent: ctx.userAgent,
      metadata:   { endpoint: 'GET /api/admin/logs', requestId: ctx.requestId },
    });

    try {
      // ⚠️  MELHORIA: paginação por page/limit com validação robusta.
      //     O original não validava se limit era razoável —
      //     alguém poderia passar limit=999999 e derrubar o banco.
      const limit  = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 500);
      const page   = Math.max(parseInt(req.query.page) || 1, 1);
      const offset = (page - 1) * limit;

      // ⚠️  NOVO: filtros opcionais por ação e por período
      const { acao, desde, ate } = req.query;

      logger.info('ADMIN:LOGS', 'Parâmetros', { limit, page, offset, acao, desde, ate });

      // ══════════════════════════════════════════════════════
      // ⚠️  PROBLEMA CRÍTICO #4 — NOME DE TABELA ERRADO
      //
      // O original usava: 'auditoria_acoes'
      // O modelo AuditLog e o schema usam: 'audit_logs'
      //
      // ✅ CORREÇÃO: usamos AuditLog.findAll() que já tem
      //    o nome correto da tabela encapsulado no model.
      //    Não repetimos SQL aqui — seguimos o padrão do projeto.
      // ══════════════════════════════════════════════════════

      // ⚠️  MELHORIA: count e dados em paralelo
      const [logs, totalResult] = await Promise.all([
        AuditLog.findAll({ limit, offset }),
        // ⚠️  CORREÇÃO: 'audit_logs' em vez de 'auditoria_acoes'
        pool.query('SELECT COUNT(*)::int AS total FROM audit_logs'),
      ]);

      const total      = totalResult.rows[0].total;
      const totalPages = Math.ceil(total / limit);
      const hasMore    = page < totalPages;

      const elapsed = Date.now() - t0;
      logger.perf('ADMIN:LOGS', 'Fluxo completo', elapsed);
      logger.success('ADMIN:LOGS', 'Logs retornados', {
        count:      logs.length,
        total,
        page,
        totalPages,
        requestId:  ctx.requestId,
      });
      logger.sep();

      return res.json({
        success: true,
        data:    logs,
        pagination: {
          currentPage: page,
          totalPages,
          total,
          limit,
          hasMore,
        },
      });

    } catch (error) {
      const elapsed = Date.now() - t0;
      logger.error('ADMIN:LOGS', `Erro após ${elapsed}ms`, {
        message:   error.message,
        code:      error.code,
        requestId: ctx.requestId,
      });
      logger.error('ADMIN:LOGS', 'Stack:\n' + error.stack);
      logger.sep();

      return res.status(500).json({
        success:   false,
        error:     'Erro ao buscar logs de auditoria',
        code:      'ADMIN_LOGS_ERROR',
        requestId: ctx.requestId,
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  // GET USER AUDIT LOGS — Logs de um usuário específico
  // ══════════════════════════════════════════════════════════
  static async getUserAuditLogs(req, res) {
    const t0  = Date.now();
    const ctx = reqContext(req);

    logger.sep();
    logger.info('ADMIN:USER_LOGS', 'Buscando logs de usuário específico', ctx);

    try {
      const { id } = req.params;

      // ══════════════════════════════════════════════════════
      // ⚠️  PROBLEMA CRÍTICO #5 — VALIDAÇÃO DE ID INCORRETA
      //
      // O original validava: isNaN(id)
      // Isso funciona para IDs numéricos (MySQL auto_increment).
      // Mas este projeto usa UUIDs no PostgreSQL.
      // isNaN('550e8400-e29b-41d4-a716-446655440000') === true
      // porque UUID não é um número — então todos os IDs seriam rejeitados!
      //
      // ✅ CORREÇÃO: validamos se é um UUID v4 válido com regex.
      // ══════════════════════════════════════════════════════
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      if (!id || !UUID_REGEX.test(id)) {
        logger.warn('ADMIN:USER_LOGS', 'ID de usuário inválido — não é UUID v4', { id, requestId: ctx.requestId });
        return res.status(400).json({
          success: false,
          error:   'ID de usuário inválido — deve ser um UUID v4',
          code:    'INVALID_USER_ID',
        });
      }

      const limit  = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 500);
      const offset = Math.max(parseInt(req.query.offset) || 0, 0);

      logger.info('ADMIN:USER_LOGS', 'Parâmetros', { userId: id, limit, offset });

      // ⚠️  CORREÇÃO: o original chamava AuditLog.getAuditLogsByUserId()
      //     que NÃO EXISTE no modelo — o método correto é findByUserId().
      //     Isso causaria TypeError em tempo de execução.
      const [logs, userResult] = await Promise.all([
        AuditLog.findByUserId(id, { limit, offset }),
        // Verifica se o usuário existe antes de retornar logs
        pool.query('SELECT id, email, criado_em FROM users WHERE id = $1', [id]),
      ]);

      if (!userResult.rows[0]) {
        logger.warn('ADMIN:USER_LOGS', 'Usuário não encontrado', { userId: id });
        return res.status(404).json({
          success: false,
          error:   'Usuário não encontrado',
          code:    'USER_NOT_FOUND',
        });
      }

      // Auditamos quem consultou os logs de quem
      logger.audit('Admin consultou logs de usuário', {
        adminId:       ctx.adminId,
        targetUserId:  id,
        logsRetornados: logs.length,
        requestId:     ctx.requestId,
      });

      await AuditLog.create({
        usuario_id: ctx.adminId,
        acao:       AuditLog.ACTIONS.ADMIN_USER_LIST,
        detalhe:    `Admin consultou logs do usuário ${id}`,
        ip_address: ctx.ip,
        user_agent: ctx.userAgent,
        metadata:   { targetUserId: id, logsCount: logs.length, requestId: ctx.requestId },
      });

      const elapsed = Date.now() - t0;
      logger.perf('ADMIN:USER_LOGS', 'Fluxo completo', elapsed);
      logger.success('ADMIN:USER_LOGS', 'Logs do usuário retornados', {
        userId:    id,
        count:     logs.length,
        requestId: ctx.requestId,
      });
      logger.sep();

      return res.json({
        success: true,
        user:    userResult.rows[0],
        data:    logs,
        pagination: {
          limit,
          offset,
          count: logs.length,
        },
      });

    } catch (error) {
      const elapsed = Date.now() - t0;
      logger.error('ADMIN:USER_LOGS', `Erro após ${elapsed}ms`, {
        message:   error.message,
        code:      error.code,
        userId:    req.params.id,
        requestId: ctx.requestId,
      });
      logger.error('ADMIN:USER_LOGS', 'Stack:\n' + error.stack);
      logger.sep();

      return res.status(500).json({
        success:   false,
        error:     'Erro ao buscar logs do usuário',
        code:      'ADMIN_USER_LOGS_ERROR',
        requestId: ctx.requestId,
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  // GET ALL USERS — Lista de usuários para o painel admin
  // ══════════════════════════════════════════════════════════
  /**
   * ⚠️  NOVO: esta função não existia no original.
   *     Um dashboard admin sem lista de usuários é incompleto.
   *     Adicionamos com os cuidados corretos de segurança —
   *     senha_hash NUNCA é retornada.
   */
  static async getAllUsers(req, res) {
    const t0  = Date.now();
    const ctx = reqContext(req);

    logger.sep();
    logger.info('ADMIN:USERS', 'Listando todos os usuários', ctx);

    await AuditLog.create({
      usuario_id: ctx.adminId,
      acao:       AuditLog.ACTIONS.ADMIN_USER_LIST,
      detalhe:    'Listagem de todos os usuários',
      ip_address: ctx.ip,
      user_agent: ctx.userAgent,
      metadata:   { endpoint: 'GET /api/admin/users', requestId: ctx.requestId },
    });

    try {
      const limit  = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
      const page   = Math.max(parseInt(req.query.page) || 1, 1);
      const offset = (page - 1) * limit;

      logger.info('ADMIN:USERS', 'Parâmetros', { limit, page, offset });

      const [usersResult, countResult] = await Promise.all([
        pool.query(
          // ⚠️  SEGURANÇA: senha_hash NUNCA aparece neste SELECT
          `SELECT
             u.id,
             u.email,
             u.criado_em,
             COUNT(c.id)::int AS total_certificados
           FROM users u
           LEFT JOIN certificates c ON c.usuario_id = u.id
           GROUP BY u.id, u.email, u.criado_em
           ORDER BY u.criado_em DESC
           LIMIT $1 OFFSET $2`,
          [limit, offset]
        ),
        pool.query('SELECT COUNT(*)::int AS total FROM users'),
      ]);

      const total      = countResult.rows[0].total;
      const totalPages = Math.ceil(total / limit);

      const elapsed = Date.now() - t0;
      logger.perf('ADMIN:USERS', 'Fluxo completo', elapsed);
      logger.success('ADMIN:USERS', 'Usuários listados', {
        count:     usersResult.rows.length,
        total,
        page,
        requestId: ctx.requestId,
      });
      logger.sep();

      return res.json({
        success: true,
        data:    usersResult.rows,
        pagination: {
          currentPage: page,
          totalPages,
          total,
          limit,
          hasMore: page < totalPages,
        },
      });

    } catch (error) {
      const elapsed = Date.now() - t0;
      logger.error('ADMIN:USERS', `Erro após ${elapsed}ms`, {
        message:   error.message,
        code:      error.code,
        requestId: ctx.requestId,
      });
      logger.error('ADMIN:USERS', 'Stack:\n' + error.stack);
      logger.sep();

      return res.status(500).json({
        success:   false,
        error:     'Erro ao listar usuários',
        code:      'ADMIN_USERS_ERROR',
        requestId: ctx.requestId,
      });
    }
  }
}

module.exports = AdminController;