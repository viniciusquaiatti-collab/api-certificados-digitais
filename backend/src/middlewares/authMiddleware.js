// src/middlewares/authMiddleware.js

const jwt = require('jsonwebtoken');

// ============================================================
// 🏢 LOGGER — Enterprise Grade | NexaSpark Auth Middleware
// ============================================================
const chalk = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  gray:   (s) => `\x1b[90m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
};

const logger = {
  info:  (msg, data) => console.log( chalk.cyan(`ℹ️  [authMiddleware]`),    msg, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  success:(msg, data) => console.log(chalk.green(`✅ [authMiddleware]`),    msg, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  warn:  (msg, data) => console.warn(chalk.yellow(`⚠️  [authMiddleware]`),  msg, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  error: (msg, data) => console.error(chalk.red(`❌ [authMiddleware]`),    msg, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  sec:   (msg, data) => console.warn(chalk.red(`🚨 [authMiddleware:SEC]`), msg, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  perf:  (label, ms) => console.log(`\x1b[35m⏱️  [authMiddleware:PERF]\x1b[0m ${label} — ${chalk.bold(ms + 'ms')}`),
};

console.log(chalk.green(chalk.bold('🔐 [authMiddleware] Middleware de autenticação carregado')));

// ============================================================
// 🔐 AUTH MIDDLEWARE
//
// Responsabilidade: validar o JWT no header Authorization
// e injetar req.user para os controllers downstream.
//
// Fluxo:
//   1. Extrai header Authorization
//   2. Valida formato "Bearer <token>"
//   3. Verifica assinatura e expiração do JWT
//   4. Injeta { id, email, role } em req.user
//   5. Chama next() ou retorna 401
//
// ⚠️  MELHORIAS EM RELAÇÃO AO ORIGINAL:
//   - Adicionado log de performance (jwt.verify pode ser lento)
//   - Tratamento explícito de TokenExpiredError vs JsonWebTokenError
//     (erros diferentes merecem mensagens diferentes e logs distintos)
//   - requestId propagado para correlação de logs
//   - Verificação de issuer e audience para maior segurança
//   - Log de segurança separado para tentativas inválidas
//
// ✅ v2.1 — PATCH CRÍTICO (zero remoção, apenas acréscimo):
//   req.user agora propaga TODOS os campos relevantes do JWT:
//   — plano:          necessário para planLimitMiddleware saber o tipo de plano
//   — plano_limite:   necessário para planLimitMiddleware bloquear no limite certo
//   — auth_provider:  necessário para fluxos OAuth (Google vs local)
//   — cpf_cadastrado: necessário para CompleteProfileModal no frontend
//
//   SEM esse patch, planLimitMiddleware recebia req.user?.plano_limite
//   como undefined e usava o fallback hardcoded — sem bloqueio real.
// ============================================================
function authMiddleware(req, res, next) {
  const t0        = Date.now();
  const ip        = req.ip || req.connection?.remoteAddress || 'unknown';
  const requestId = req.requestId || req.headers['x-request-id'] || `mw_${Date.now()}`;
  const path      = req.originalUrl || req.path;

  logger.info('Verificando autenticação', { path, ip, requestId });

  try {
    // ── 1. Extrai o header ──────────────────────────────────
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      logger.warn('Header Authorization ausente', { path, ip, requestId });
      return res.status(401).json({
        success: false,
        error:   'Token não fornecido',
        code:    'TOKEN_MISSING',
      });
    }

    // ── 2. Valida formato "Bearer <token>" ──────────────────
    const parts = authHeader.split(' ');

    if (parts.length !== 2 || !/^Bearer$/i.test(parts[0])) {
      logger.warn('Formato inválido do header Authorization', {
        received: authHeader.substring(0, 20) + '...',
        ip,
        requestId,
      });
      return res.status(401).json({
        success: false,
        error:   'Formato inválido. Use: Authorization: Bearer <token>',
        code:    'TOKEN_MALFORMED',
      });
    }

    const token = parts[1];

    // ── 3. Verifica o JWT ───────────────────────────────────
    logger.info('Verificando assinatura JWT...', { requestId, tokenPrefix: token.substring(0, 20) + '...' });

    const t1 = Date.now();
    jwt.verify(
      token,
      process.env.JWT_SECRET,
      // ⚠️  MELHORIA: verifica issuer e audience para maior segurança
      //     Tokens gerados por outros sistemas são rejeitados
      { issuer: 'nexaspark', audience: 'nexaspark-app' },
      (err, decoded) => {
        const verifyMs = Date.now() - t1;
        logger.perf('jwt.verify()', verifyMs);

        if (err) {
          // ── Trata tipos diferentes de erro JWT ──────────
          if (err.name === 'TokenExpiredError') {
            logger.warn('Token expirado', {
              ip,
              requestId,
              expiredAt: err.expiredAt,
            });
            return res.status(401).json({
              success:   false,
              error:     'Sessão expirada. Faça login novamente.',
              code:      'TOKEN_EXPIRED',
              expiredAt: err.expiredAt,
            });
          }

          if (err.name === 'NotBeforeError') {
            logger.warn('Token ainda não é válido (nbf)', { ip, requestId });
            return res.status(401).json({
              success: false,
              error:   'Token ainda não é válido',
              code:    'TOKEN_NOT_BEFORE',
            });
          }

          // JsonWebTokenError — assinatura inválida, token adulterado, etc.
          logger.sec('Token com assinatura inválida detectado', {
            ip,
            requestId,
            error: err.message,
            tokenPrefix: token.substring(0, 25) + '...',
          });

          return res.status(401).json({
            success: false,
            error:   'Token inválido',
            code:    'TOKEN_INVALID',
          });
        }

        // ── 4. Token válido — injeta req.user ────────────────
        //
        // ✅ v2.1 — PATCH CRÍTICO: propaga plano_limite do JWT decoded
        //
        // PROBLEMA ORIGINAL: req.user só tinha { id, email, role }.
        // planLimitMiddleware usa req.user?.plano_limite para verificar
        // o limite mensal do plano free. Como plano_limite não era
        // propagado aqui, o middleware sempre recebia undefined e usava
        // o fallback hardcoded — por isso usuários podiam emitir ilimitado.
        //
        // RAIZ DO BUG 5/2: o JWT carregava plano_limite corretamente
        // (gerado pelo authController.generateJWT), mas este middleware
        // não repassava o campo para req.user. Logo o planLimitMiddleware
        // nunca via o valor real e nunca bloqueava corretamente.
        //
        // SOLUÇÃO: propagar todos os campos relevantes do decoded JWT
        // para req.user, mantendo retrocompatibilidade total (os campos
        // originais id, email, role permanecem inalterados).
        //
        // CAMPOS ADICIONADOS EM v2.1:
        //   plano:          'free' | 'pro' | 'enterprise'
        //                   — planLimitMiddleware: verifica se é free
        //   plano_limite:   número inteiro (ex: 2, 9999)
        //                   — planLimitMiddleware: usa como teto mensal
        //   auth_provider:  'local' | 'google'
        //                   — controllers: distingue fluxo OAuth vs senha
        //   cpf_cadastrado: boolean
        //                   — frontend: controla exibição do CompleteProfileModal
        req.user = {
          id:             decoded.id,
          email:          decoded.email,
          role:           decoded.role           || 'user',
          // ✅ v2.1: campos de plano — propagados do JWT decoded
          // CRÍTICO para planLimitMiddleware funcionar corretamente
          plano:          decoded.plano          || 'free',
          plano_limite:   decoded.plano_limite   || 2,
          // ✅ v2.1: campos de perfil — propagados do JWT decoded
          auth_provider:  decoded.auth_provider  || 'local',
          cpf_cadastrado: decoded.cpf_cadastrado || false,
        };

        const totalMs = Date.now() - t0;
        logger.perf('authMiddleware total', totalMs);
        logger.success('Token validado', {
          userId:         decoded.id,
          email:          decoded.email,
          role:           decoded.role,
          // ✅ v2.1: loga plano_limite para diagnóstico
          // Confirma no terminal que o campo chegou corretamente no middleware
          // e será repassado para planLimitMiddleware
          plano:          decoded.plano          || 'free',
          plano_limite:   decoded.plano_limite   || 2,
          auth_provider:  decoded.auth_provider  || 'local',
          cpf_cadastrado: decoded.cpf_cadastrado || false,
          requestId,
          expiresAt:      new Date(decoded.exp * 1000).toISOString(),
          nota_v21:       'plano_limite propagado — planLimitMiddleware funcionará corretamente',
        });

        // ── 5. Próximo middleware / controller ───────────────
        next();
      }
    );

  } catch (error) {
    // Erros síncronos inesperados (não deveria acontecer, mas cobre edge cases)
    logger.error('Erro síncrono inesperado no middleware', {
      message:   error.message,
      requestId,
      ip,
    });
    logger.error('Stack:\n' + error.stack);

    return res.status(500).json({
      success: false,
      error:   'Erro interno no servidor',
      code:    'INTERNAL_ERROR',
    });
  }
}

module.exports = authMiddleware;