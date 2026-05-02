// src/routes/adminRoutes.js
// ============================================================
// 🏢 NexaSpark — Admin Routes
// Área mais sensível da API. Dupla proteção:
//   1. authMiddleware — valida JWT
//   2. adminGuard     — verifica role === 'admin'
// ============================================================

const express         = require('express');
const router          = express.Router();
const AdminController = require('../controllers/adminController');
const authMiddleware  = require('../middlewares/authMiddleware');

// ============================================================
// 🎨 LOGGER
// ============================================================
const c = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  gray:   (s) => `\x1b[90m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
};

const logger = {
  success: (scope, msg) => console.log( c.green(`✅ [${scope}]`),   msg),
  warn:    (scope, msg) => console.warn(c.yellow(`⚠️  [${scope}]`),  msg),
  sec:     (msg, data)  => console.warn(c.red(`🚨 [SECURITY]`),     msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  route:   (method, path) => console.log(
    c.cyan(`🛣️  [ROUTE]`),
    c.bold(method.padEnd(7)),
    path.padEnd(40),
    c.red('[ADMIN ONLY]')
  ),
  sep: () => console.log(c.gray('─'.repeat(60))),
};

// ============================================================
// 🔴 ADMIN GUARD MIDDLEWARE
//
// ⚠️  PROBLEMA CRÍTICO #6 — SEM VERIFICAÇÃO DE ROLE
//
// O original aplicava apenas authMiddleware — que valida o JWT
// e confirma que o usuário está autenticado.
// MAS qualquer usuário autenticado (role: 'user') conseguia
// acessar /api/admin/dashboard, /api/admin/logs, etc.
//
// Isso significa que qualquer conta registrada na plataforma
// tinha acesso a TODOS os dados administrativos:
//   - Total de usuários
//   - Todos os logs de auditoria
//   - Logs de outros usuários
//
// ✅ CORREÇÃO: adminGuard verifica req.user.role === 'admin'
//    após o authMiddleware já ter validado e decodificado o JWT.
//    Se não for admin, retorna 403 Forbidden imediatamente.
//    O acesso não-autorizado é logado como alerta de segurança.
// ============================================================
function adminGuard(req, res, next) {
  const ip        = req.ip || 'unknown';
  const requestId = req.requestId || 'unknown';
  const userId    = req.user?.id || null;
  const email     = req.user?.email || null;
  const role      = req.user?.role || null;

  console.log(
    c.cyan(`🔐 [adminGuard]`),
    `Verificando permissão admin`,
    c.gray(`| userId: ${userId} | role: ${role} | IP: ${ip} | ID: ${requestId}`)
  );

  if (role !== 'admin') {
    logger.sec('Tentativa de acesso admin sem permissão', {
      userId,
      email,
      role,
      ip,
      requestId,
      path: req.originalUrl,
    });

    return res.status(403).json({
      success: false,
      error:   'Acesso negado — permissão de administrador necessária',
      code:    'FORBIDDEN_ADMIN_REQUIRED',
    });
  }

  console.log(
    c.green(`✅ [adminGuard]`),
    `Acesso admin autorizado`,
    c.gray(`| userId: ${userId} | email: ${email}`)
  );

  next();
}

// ============================================================
// 📋 ROUTE LOGGER
// ============================================================
function routeLogger(routeName) {
  return (req, res, next) => {
    const requestId = req.requestId || `adm_${Date.now()}`;
    req.requestId   = requestId;

    console.log(
      c.red(`📨 [${routeName}]`),
      c.bold(`${req.method} ${req.originalUrl}`),
      c.gray(`| ADMIN: ${req.user?.email || '?'} | IP: ${req.ip} | ID: ${requestId}`)
    );

    res.on('finish', () => {
      const elapsed     = req.startTime ? Date.now() - req.startTime : '?';
      const statusStr   = String(res.statusCode);
      const statusColor =
        res.statusCode < 300 ? c.green(statusStr)  :
        res.statusCode < 400 ? c.cyan(statusStr)   :
        res.statusCode < 500 ? c.yellow(statusStr) : c.red(statusStr);

      console.log(
        c.red(`📤 [${routeName}]`),
        `Resposta ${statusColor}`,
        c.gray(`| ${elapsed}ms | ID: ${requestId}`)
      );
    });

    next();
  };
}

// ============================================================
// 🔒 APLICAR PROTEÇÃO DUPLA EM TODAS AS ROTAS ADMIN
//
// Ordem obrigatória:
//   1. authMiddleware — decodifica JWT e injeta req.user
//   2. adminGuard     — verifica req.user.role === 'admin'
//
// Se invertido, adminGuard não teria req.user disponível.
// ============================================================
router.use(authMiddleware);
router.use(adminGuard);

// ============================================================
// 🛣️  ROTAS ADMINISTRATIVAS
// ============================================================

/**
 * GET /api/admin/dashboard
 * Métricas gerais: total de usuários, certificados, verificações hoje,
 * top cursos, últimos logins.
 */
router.get(
  '/dashboard',
  routeLogger('ADMIN:DASHBOARD'),
  AdminController.getDashboardData
);

/**
 * GET /api/admin/logs?limit=50&page=1
 * Lista paginada de todos os logs de auditoria do sistema.
 */
router.get(
  '/logs',
  routeLogger('ADMIN:LOGS'),
  AdminController.getAllAuditLogs
);

/**
 * GET /api/admin/users
 * Lista paginada de todos os usuários com contagem de certificados.
 */
router.get(
  '/users',
  routeLogger('ADMIN:USERS'),
  AdminController.getAllUsers
);

/**
 * GET /api/admin/users/:id/logs?limit=50&offset=0
 * Logs de auditoria de um usuário específico.
 * ⚠️  :id deve ser um UUID v4 válido.
 */
router.get(
  '/users/:id/logs',
  routeLogger('ADMIN:USER_LOGS'),
  AdminController.getUserAuditLogs
);

// ============================================================
// 📋 LOG DE ROTAS REGISTRADAS
// ============================================================
logger.sep();
logger.success('AdminRoutes', 'Rotas administrativas registradas (dupla proteção):');
logger.route('GET', '/api/admin/dashboard');
logger.route('GET', '/api/admin/logs');
logger.route('GET', '/api/admin/users');
logger.route('GET', '/api/admin/users/:id/logs');
logger.sep();

// ⚠️  LEMBRETE: adminRoutes deve ser registrado no app.js
//     Adicione: app.use('/api/admin', adminRoutes);
logger.warn('AdminRoutes', '⚠️  Lembrete: registrar no app.js → app.use("/api/admin", adminRoutes)');
logger.sep();

module.exports = router;