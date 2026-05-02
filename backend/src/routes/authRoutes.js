// src/routes/authRoutes.js

const express        = require('express');
const router         = express.Router();
const AuthController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const { registerSchema, loginSchema } = require('../schemas');
const validateSchema = require('../middlewares/validateSchema');

// ============================================================
// 🏢 LOGGER — Enterprise Grade | NexaSpark Routes
// ============================================================
const chalk = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  blue:   (s) => `\x1b[34m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  gray:   (s) => `\x1b[90m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
};

const logger = {
  info:    (scope, msg) => console.log( chalk.blue(`ℹ️  [${scope}]`),    msg),
  success: (scope, msg) => console.log( chalk.green(`✅ [${scope}]`),    msg),
  warn:    (scope, msg) => console.warn(chalk.yellow(`⚠️  [${scope}]`),  msg),
  route:   (method, path, type) => console.log(
    chalk.cyan(`🛣️  [ROUTE]`),
    chalk.bold(method.padEnd(6)),
    path.padEnd(30),
    type === 'public'    ? chalk.green('[PUBLIC]')    :
    type === 'protected' ? chalk.yellow('[PROTECTED]') : ''
  ),
  sep: () => console.log(chalk.gray('─'.repeat(60))),
};

// ============================================================
// 📋 MIDDLEWARE DE LOG DE REQUISIÇÕES
//
// ⚠️  MELHORIA EM RELAÇÃO AO ORIGINAL:
//     Logs inline nas rotas ficavam espalhados e repetidos.
//     Centralizamos em um middleware único por rota, com:
//     - requestId para rastrear cada requisição do início ao fim
//     - timestamp ISO para correlação com outros sistemas
//     - log do tempo de resposta ao finalizar
// ============================================================
function routeLogger(routeName) {
  return (req, res, next) => {
    const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const startTime = Date.now();

    // Injeta requestId no req para uso em toda a cadeia
    req.requestId = requestId;

    console.log(
      chalk.cyan(`📨 [${routeName}]`),
      chalk.bold(`${req.method} ${req.originalUrl}`),
      chalk.gray(`| ID: ${requestId} | IP: ${req.ip} | ${new Date().toISOString()}`)
    );

    // Log quando a resposta for enviada
    res.on('finish', () => {
      const elapsed = Date.now() - startTime;
      const statusColor =
        res.statusCode < 300 ? chalk.green :
        res.statusCode < 400 ? chalk.cyan  :
        res.statusCode < 500 ? chalk.yellow : chalk.red;

      console.log(
        chalk.cyan(`📤 [${routeName}]`),
        `Resposta ${statusColor(String(res.statusCode))}`,
        chalk.gray(`| ${elapsed}ms | ID: ${requestId}`)
      );
    });

    next();
  };
}

// ============================================================
// 🔓 ROTAS PÚBLICAS
// ============================================================

/**
 * POST /api/auth/register
 * Cria novo usuário na plataforma.
 * Acesso: público
 */
router.post(
  '/register',
  routeLogger('AUTH:REGISTER'),
  validateSchema(registerSchema),
  AuthController.register
);

/**
 * POST /api/auth/login
 * Autentica usuário e retorna JWT.
 * Acesso: público
 * Proteção: brute-force (5 tentativas / 15min por IP)
 */
router.post(
  '/login',
  routeLogger('AUTH:LOGIN'),
  validateSchema(loginSchema),
  AuthController.login
);

// ============================================================
// 🔒 ROTAS PROTEGIDAS (requerem JWT válido no header)
// ============================================================

/**
 * GET /api/auth/me
 * Valida token e retorna dados básicos do usuário autenticado.
 * Usado pelo frontend para verificar se a sessão ainda é válida.
 * Acesso: protegido
 */
router.get(
  '/me',
  routeLogger('AUTH:ME'),
  authMiddleware,
  AuthController.me
);

/**
 * GET /api/auth/profile
 * Retorna perfil completo do usuário autenticado.
 * Acesso: protegido
 */
router.get(
  '/profile',
  routeLogger('AUTH:PROFILE'),
  authMiddleware,
  AuthController.getProfile
);

// ============================================================
// 📋 LOG DE ROTAS REGISTRADAS (exibido na inicialização)
// ============================================================
logger.sep();
logger.success('AuthRoutes', 'Rotas de autenticação registradas:');
logger.route('POST',  '/api/auth/register', 'public');
logger.route('POST',  '/api/auth/login',    'public');
logger.route('GET',   '/api/auth/me',       'protected');
logger.route('GET',   '/api/auth/profile',  'protected');
logger.sep();

module.exports = router;