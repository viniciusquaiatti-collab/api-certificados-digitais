// src/routes/authRoutes.js
// ============================================================
// 🏢 NexaSpark — Auth Routes | Enterprise Grade
// Certificação Digital
//
// Rotas públicas:
//   POST /api/auth/register          → cria conta local
//   POST /api/auth/login             → autentica conta local
//   GET  /api/auth/google            → inicia fluxo OAuth Google
//   GET  /api/auth/google/callback   → retorno do Google OAuth
//
// Rotas protegidas (JWT obrigatório):
//   GET  /api/auth/me                → valida sessão ativa
//   GET  /api/auth/profile           → perfil completo
//
// ⚠️  ADIÇÃO: rotas Google OAuth integradas ao Passport.
//     Rate limiter de auth (20/15min) se aplica a todas —
//     inclusive às rotas Google, pois estão sob /api/auth.
// ============================================================

const express        = require('express');
const router         = express.Router();
const AuthController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const { registerSchema, loginSchema } = require('../schemas');
const validateSchema = require('../middlewares/validateSchema');

// ⚠️  NOVO: Passport carregado para as rotas Google OAuth.
//     Importamos de src/config/passport.js que configura
//     a GoogleStrategy e serialize/deserializeUser.
const passport = require('../config/passport');

// ============================================================
// 🎨 LOGGER — Mesmo padrão ANSI do projeto
// ============================================================
const chalk = {
  green:   (s) => `\x1b[32m${s}\x1b[0m`,
  red:     (s) => `\x1b[31m${s}\x1b[0m`,
  yellow:  (s) => `\x1b[33m${s}\x1b[0m`,
  blue:    (s) => `\x1b[34m${s}\x1b[0m`,
  cyan:    (s) => `\x1b[36m${s}\x1b[0m`,
  gray:    (s) => `\x1b[90m${s}\x1b[0m`,
  bold:    (s) => `\x1b[1m${s}\x1b[0m`,
  magenta: (s) => `\x1b[35m${s}\x1b[0m`,
  white:   (s) => `\x1b[37m${s}\x1b[0m`,
};

const logger = {
  info:    (scope, msg, data) => console.log(  chalk.blue(`ℹ️  [${scope}]`),    msg, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  success: (scope, msg, data) => console.log(  chalk.green(`✅ [${scope}]`),   msg, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  warn:    (scope, msg, data) => console.warn( chalk.yellow(`⚠️  [${scope}]`),  msg, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  error:   (scope, msg, data) => console.error(chalk.red(`❌ [${scope}]`),     msg, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  route:   (method, path, type, extra) => console.log(
    chalk.cyan(`🛣️  [ROUTE]`),
    chalk.bold(method.padEnd(6)),
    chalk.white(path.padEnd(38)),
    type === 'public'    ? chalk.green('[PUBLIC]')    :
    type === 'protected' ? chalk.yellow('[PROTECTED]') :
    type === 'oauth'     ? chalk.cyan('[OAUTH]')      : '',
    extra ? chalk.gray(extra) : ''
  ),
  sep:    () => console.log(chalk.gray('─'.repeat(60))),
  bigsep: () => console.log(chalk.gray('═'.repeat(60))),
};

// ============================================================
// 📋 MIDDLEWARE DE LOG POR ROTA — routeLogger
//
// ⚠️  MELHORIA vs original:
//     Cada rota tem seu próprio prefixo nos logs.
//     requestId injetado em req para correlação em toda a chain.
//     Tempo de resposta logado no evento 'finish'.
//     Logs de redirect (3xx) tratados separadamente — OAuth usa redirect.
// ============================================================
function routeLogger(routeName) {
  return (req, res, next) => {
    // Reutiliza requestId do app.js se já existir
    const requestId = req.requestId
                   || req.headers['x-request-id']
                   || `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const startTime = Date.now();

    // Garante que requestId esteja disponível em toda a chain
    req.requestId = requestId;

    console.log(
      chalk.cyan(`📨 [${routeName}]`),
      chalk.bold(`${req.method} ${req.originalUrl}`),
      chalk.gray(`| ID: ${requestId} | IP: ${req.ip} | ${new Date().toISOString()}`)
    );

    // ⚠️  Log extra para rotas OAuth — headers relevantes
    if (routeName.includes('GOOGLE')) {
      console.log(
        chalk.cyan(`ℹ️  [${routeName}:OAUTH_HEADERS]`),
        chalk.gray(JSON.stringify({
          referer:    req.get('referer')    || null,
          origin:     req.get('origin')     || null,
          hasQuery:   Object.keys(req.query).length > 0,
          queryKeys:  Object.keys(req.query),
        }))
      );
    }

    // Log quando a resposta finalizar (inclui redirects)
    res.on('finish', () => {
      const elapsed = Date.now() - startTime;

      const statusColor =
        res.statusCode < 300 ? chalk.green   :
        res.statusCode < 400 ? chalk.cyan    :
        res.statusCode < 500 ? chalk.yellow  : chalk.red;

      // ⚠️  Redirects (3xx) são normais no fluxo OAuth
      const isRedirect = res.statusCode >= 300 && res.statusCode < 400;

      console.log(
        chalk.cyan(`📤 [${routeName}]`),
        `Resposta ${statusColor(String(res.statusCode))}`,
        isRedirect ? chalk.cyan('(redirect → frontend)') : '',
        chalk.gray(`| ${elapsed}ms | ID: ${requestId}`)
      );

      // Alerta para respostas lentas
      if (elapsed > 3000) {
        console.warn(
          chalk.yellow(`⚠️  [${routeName}:SLOW]`),
          `Rota lenta: ${elapsed}ms`,
          chalk.gray(JSON.stringify({ requestId, url: req.originalUrl }))
        );
      }
    });

    next();
  };
}

// ============================================================
// 🔓 ROTAS PÚBLICAS — Acesso sem autenticação
// ============================================================

/**
 * POST /api/auth/register
 *
 * Cria novo usuário com email + senha.
 * Valida via Zod (registerSchema) antes do controller.
 * Rate limit: 20 req/15min por IP (herdado do app.js authLimiter).
 */
router.post(
  '/register',
  routeLogger('AUTH:REGISTER'),
  validateSchema(registerSchema),
  AuthController.register
);

/**
 * POST /api/auth/login
 *
 * Autentica usuário local (email + senha).
 * Proteção extra contra brute force no AuthController.
 * Rate limit: 20 req/15min por IP (herdado do app.js authLimiter).
 */
router.post(
  '/login',
  routeLogger('AUTH:LOGIN'),
  validateSchema(loginSchema),
  AuthController.login
);

// ============================================================
// 🌐 ROTAS GOOGLE OAUTH 2.0
//
// ⚠️  FLUXO COMPLETO:
//   1. Frontend → GET /api/auth/google
//   2. Passport redireciona → accounts.google.com
//   3. Usuário autoriza → Google redireciona para callback URL
//   4. GET /api/auth/google/callback → Passport valida → controller gera JWT
//   5. Controller redireciona → ${FRONTEND_URL}/auth/callback?token=xxx
//   6. Frontend captura token, salva localStorage, limpa URL
// ============================================================

/**
 * GET /api/auth/google
 *
 * Inicia o fluxo OAuth — redireciona para tela do Google.
 * Acesso: público — chamado pelo botão "Continuar com Google".
 *
 * ⚠️  prompt: 'select_account' força seleção de conta mesmo
 *     se o usuário já tem uma sessão Google ativa.
 *     Necessário para permitir trocar de conta Google.
 *
 * ⚠️  session: false — não criamos session aqui.
 *     O express-session do app.js é usado internamente
 *     pelo Passport apenas durante o redirect cycle.
 */
router.get(
  '/google',
  routeLogger('AUTH:GOOGLE:INIT'),
  (req, res, next) => {
    // ⚠️  Log extra antes do redirect para o Google
    console.log(
      chalk.cyan(`ℹ️  [AUTH:GOOGLE:INIT]`),
      `Iniciando redirect para Google OAuth...`,
      chalk.gray(JSON.stringify({
        callbackURL:  process.env.GOOGLE_CALLBACK_URL,
        frontendUrl:  process.env.FRONTEND_URL,
        ip:           req.ip,
        requestId:    req.requestId,
      }))
    );
    next();
  },
  passport.authenticate('google', {
    scope:   ['profile', 'email'],
    prompt:  'select_account',
    session: false,
  })
);

/**
 * GET /api/auth/google/callback
 *
 * Google redireciona aqui após autenticação.
 * Passport valida o código, chama o verify callback (passport.js),
 * popula req.user, e passa para AuthController.googleCallback.
 *
 * ⚠️  failureRedirect: redireciona o BROWSER para o frontend
 *     com query param de erro — não retorna JSON.
 *     Isso é correto pois é um fluxo de browser redirect, não API.
 *
 * ⚠️  session: false — JWT é gerado no controller.
 *     Não dependemos de session para autenticação.
 */
router.get(
  '/google/callback',
  routeLogger('AUTH:GOOGLE:CALLBACK'),
  (req, res, next) => {
    // ⚠️  Log dos query params recebidos do Google
    //     code e state são normais — nunca logar o 'code' completo
    console.log(
      chalk.cyan(`ℹ️  [AUTH:GOOGLE:CALLBACK]`),
      `Query params recebidos do Google:`,
      chalk.gray(JSON.stringify({
        hasCode:    !!req.query.code,
        hasState:   !!req.query.state,
        hasError:   !!req.query.error,
        errorMsg:   req.query.error || null,
        // ⚠️  code truncado — é sensível (troca por access_token)
        codePrefix: req.query.code ? req.query.code.substring(0, 10) + '...' : null,
        requestId:  req.requestId,
      }))
    );

    // Se o Google retornou erro (ex: usuário cancelou)
    if (req.query.error) {
      console.warn(
        chalk.yellow(`⚠️  [AUTH:GOOGLE:CALLBACK]`),
        `Google retornou erro na autenticação:`,
        chalk.gray(JSON.stringify({ error: req.query.error, requestId: req.requestId }))
      );
    }

    next();
  },
  passport.authenticate('google', {
    session:         false,
    failureRedirect: `${process.env.FRONTEND_URL || 'https://nexaspark.com.br'}/login?error=google_auth_failed`,
  }),
  AuthController.googleCallback
);

// ============================================================
// 🔒 ROTAS PROTEGIDAS — JWT obrigatório no header Authorization
// ============================================================

/**
 * GET /api/auth/me
 *
 * Valida sessão e retorna dados básicos do usuário.
 * Usado pelo frontend para verificar se o token ainda é válido.
 * Retorna também auth_provider para o frontend saber se é Google ou local.
 */
router.get(
  '/me',
  routeLogger('AUTH:ME'),
  authMiddleware,
  AuthController.me
);

/**
 * GET /api/auth/profile
 *
 * Retorna perfil completo do usuário autenticado.
 * Inclui nome, avatar e auth_provider além de id/email.
 */
router.get(
  '/profile',
  routeLogger('AUTH:PROFILE'),
  authMiddleware,
  AuthController.getProfile
);

// ============================================================
// 📋 LOG DE ROTAS REGISTRADAS — exibido na inicialização
// ============================================================
logger.bigsep();
logger.success('AuthRoutes', 'Rotas de autenticação registradas:');
logger.sep();
logger.route('POST', '/api/auth/register',         'public',    '→ AuthController.register');
logger.route('POST', '/api/auth/login',             'public',    '→ AuthController.login');
logger.route('GET',  '/api/auth/google',            'oauth',     '→ Passport → Google');
logger.route('GET',  '/api/auth/google/callback',   'oauth',     '→ Passport → AuthController.googleCallback');
logger.route('GET',  '/api/auth/me',                'protected', '→ authMiddleware → AuthController.me');
logger.route('GET',  '/api/auth/profile',           'protected', '→ authMiddleware → AuthController.getProfile');
logger.sep();
console.log(chalk.gray(`  OAuth Callback URL: ${process.env.GOOGLE_CALLBACK_URL || 'NÃO DEFINIDO ⚠️'}`));
console.log(chalk.gray(`  Frontend URL:       ${process.env.FRONTEND_URL       || 'NÃO DEFINIDO ⚠️'}`));
logger.bigsep();

module.exports = router;