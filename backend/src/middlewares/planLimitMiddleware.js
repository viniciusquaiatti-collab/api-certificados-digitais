// src/middlewares/planLimitMiddleware.js
// ============================================================
// 🏢 NexaSpark — Plan Limit Middleware v1.0
//
// Verifica se o usuário atingiu o limite mensal do plano free
// ANTES de chegar no controller de emissão.
//
// POSIÇÃO NA CHAIN (certificateRoutes.js):
//   router.post('/',
//     authMiddleware,       ← 1: valida JWT
//     certEmitLimiter,      ← 2: rate limit por userId
//     planLimitMiddleware,  ← 3: ✅ NOVO — verifica plano
//     validateSchema,       ← 4: valida body
//     controller            ← 5: lógica de negócio
//   );
//
// ⚠️  DECISÃO ARQUITETURAL:
//   O limite está no middleware, não no controller.
//   Isso mantém o controller focado em emissão e permite
//   reutilizar este middleware em outras rotas futuras.
//
// LIMITES:
//   Plano free:       3 certificados/mês (plano_limite = 3)
//   Plano pro:        ilimitado (plano_limite = 9999)
//   Plano enterprise: ilimitado
// ============================================================

const Certificate = require('../models/Certificate');
const AuditLog    = require('../models/AuditLog');

// ============================================================
// 🎨 LOGGER
// ============================================================
const ANSI = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', magenta: '\x1b[35m', gray: '\x1b[90m',
  brightRed: '\x1b[91m', brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m', brightWhite: '\x1b[97m',
  bgRed: '\x1b[41m', bgYellow: '\x1b[43m',
};

const c = {
  green:        (s) => `${ANSI.green}${s}${ANSI.reset}`,
  brightGreen:  (s) => `${ANSI.brightGreen}${s}${ANSI.reset}`,
  red:          (s) => `${ANSI.red}${s}${ANSI.reset}`,
  brightRed:    (s) => `${ANSI.brightRed}${s}${ANSI.reset}`,
  yellow:       (s) => `${ANSI.yellow}${s}${ANSI.reset}`,
  brightYellow: (s) => `${ANSI.brightYellow}${s}${ANSI.reset}`,
  cyan:         (s) => `${ANSI.cyan}${s}${ANSI.reset}`,
  magenta:      (s) => `${ANSI.magenta}${s}${ANSI.reset}`,
  gray:         (s) => `${ANSI.gray}${s}${ANSI.reset}`,
  bold:         (s) => `${ANSI.bold}${s}${ANSI.reset}`,
  danger:       (s) => `${ANSI.bgRed}${ANSI.brightWhite}${ANSI.bold} ${s} ${ANSI.reset}`,
  warn:         (s) => `${ANSI.bgYellow}${ANSI.bold} ${s} ${ANSI.reset}`,
};

const ts  = () => c.gray(`[${new Date().toISOString()}]`);
const fmt = (d) => { try { return c.gray(JSON.stringify(d ?? '')); } catch { return ''; } };

const fmtMs = (ms) =>
  ms < 50   ? c.brightGreen(`${ms}ms ⚡`) :
  ms < 200  ? c.brightYellow(`${ms}ms 🟡`) :
              c.brightRed(`${ms}ms 🔴`);

const logger = {
  info:    (m, d) => console.log(   ts(), c.cyan(`ℹ️  [PLAN:LIMIT]`),    c.brightWhite(m), fmt(d)),
  success: (m, d) => console.log(   ts(), c.brightGreen(`✅ [PLAN:LIMIT]`), c.brightWhite(m), fmt(d)),
  warn:    (m, d) => console.warn(  ts(), c.warn('⚠️  PLAN:LIMIT'),        c.yellow(m),      fmt(d)),
  error:   (m, d) => console.error( ts(), c.brightRed(`❌ [PLAN:LIMIT]`),  c.red(m),         fmt(d)),
  perf:    (l, ms)=> console.log(   ts(), c.magenta(`⏱️  [PLAN:LIMIT]`),   l, '→', fmtMs(ms)),
  blocked: (m, d) => console.warn(  ts(), c.danger('🚫 PLAN:BLOCKED'),     c.red(c.bold(m)), fmt(d)),
  sep:     ()     => console.log(   c.gray('─'.repeat(72))),
};

// ============================================================
// PLAN LIMIT MIDDLEWARE
// ============================================================
async function planLimitMiddleware(req, res, next) {
  const t0         = Date.now();
  const usuario_id = req.user?.id;
  const requestId  = req.requestId || `plan_${Date.now()}`;
  const ip         = req.ip || 'unknown';

  logger.sep();
  logger.info('Verificando limite do plano...', {
    usuario_id,
    plano:        req.user?.plano        || 'free',
    plano_limite: req.user?.plano_limite || 3,
    requestId,
    ip,
  });

  try {
    // ── Planos ilimitados passam direto ───────────────────
    const plano        = req.user?.plano        || 'free';
    const plano_limite = req.user?.plano_limite || 2; // ← free = 2 certificados/mês

    if (plano !== 'free' || plano_limite >= 9999) {
      logger.success('Plano ilimitado — passando direto', {
        plano,
        plano_limite,
        usuario_id,
      });
      return next();
    }

    // ── Conta emissões do mês atual ───────────────────────
    logger.info('Contando emissões do mês atual...', { usuario_id });
    const t1         = Date.now();
    const usedThisMonth = await Certificate.countThisMonthByUserId(usuario_id);
    logger.perf('countThisMonthByUserId()', Date.now() - t1);

    const remaining = plano_limite - usedThisMonth;

    logger.info('Status do plano', {
      usuario_id,
      plano,
      plano_limite,
      used_this_month:  usedThisMonth,
      remaining,
      status: remaining > 0 ? '✅ Dentro do limite' : '🔴 LIMITE ATINGIDO',
    });

    // ── Limite atingido — bloqueia ────────────────────────
    if (usedThisMonth >= plano_limite) {
      logger.blocked('EMISSÃO BLOQUEADA — limite do plano free atingido', {
        usuario_id,
        plano,
        plano_limite,
        used_this_month: usedThisMonth,
        remaining:       0,
        ip,
        requestId,
        hint:            'Usuário deve fazer upgrade para continuar emitindo',
      });

      // Registra no AuditLog para analytics de conversão
      // (saber quantas vezes usuários atingiram o limite = dado valioso para pricing)
      await AuditLog.create({
        usuario_id,
        acao:       AuditLog.ACTIONS?.RATE_LIMIT_HIT || 'RATE_LIMIT_HIT',
        detalhe:    `Emissão bloqueada por limite do plano free (${usedThisMonth}/${plano_limite})`,
        ip_address: ip,
        user_agent: req.get('User-Agent') || 'unknown',
        metadata: {
          plano,
          plano_limite,
          used_this_month: usedThisMonth,
          requestId,
          event_type:      'PLAN_LIMIT_REACHED', // para funil de conversão
        },
      }).catch((e) => {
        // Não crítico — não bloqueia o fluxo
        logger.error('Falha ao registrar AuditLog de limite (não crítico)', { message: e.message });
      });

      logger.perf('planLimitMiddleware (bloqueado)', Date.now() - t0);
      logger.sep();

      return res.status(403).json({
        success:      false,
        error:        `Você atingiu o limite de ${plano_limite} certificados gratuitos por mês. Faça upgrade para continuar emitindo.`,
        code:         'PLAN_LIMIT_REACHED',
        data: {
          plano,
          plano_limite,
          used_this_month: usedThisMonth,
          remaining:       0,
          upgrade_url:     '/dashboard?upgrade=true', // frontend mostra modal de upgrade
        },
      });
    }

    // ── Dentro do limite — informa quantos restam ─────────
    // Injeta no req para o controller usar se quiser
    req.planStatus = {
      plano,
      plano_limite,
      used_this_month: usedThisMonth,
      remaining,
      isLastFree: remaining === 1, // último gratuito — frontend pode mostrar hint
    };

    if (remaining === 1) {
      logger.warn('⚠️  ÚLTIMO certificado gratuito deste mês', {
        usuario_id,
        plano_limite,
        used_this_month: usedThisMonth,
        hint:            'Frontend deve exibir hint de upgrade após esta emissão',
      });
    }

    logger.success(`✅ Dentro do limite — ${remaining} restante(s)`, {
      usuario_id,
      remaining,
      plano_limite,
    });

    logger.perf('planLimitMiddleware (permitido)', Date.now() - t0);
    logger.sep();
    return next();

  } catch (error) {
    // ⚠️  DECISÃO ARQUITETURAL:
    //     Se o middleware de limite falhar (ex: banco indisponível),
    //     NÃO bloqueamos a emissão. Preferimos emitir sem checar
    //     do que bloquear um usuário legítimo por falha técnica.
    //     O limite será checado na próxima vez que o banco estiver ok.
    logger.error('Erro ao verificar limite do plano — PERMITINDO (fail-open)', {
      message:    error.message,
      pg_code:    error.code,
      usuario_id,
      requestId,
      decisao:    'fail-open: emissão permitida para não prejudicar usuário legítimo',
      hint:       'Investigar se countThisMonthByUserId() está funcionando',
    });

    // Injeta flag para o controller saber que o check falhou
    req.planStatus = { error: error.message, checked: false };

    logger.perf('planLimitMiddleware (erro — fail-open)', Date.now() - t0);
    logger.sep();
    return next(); // fail-open
  }
}

module.exports = planLimitMiddleware;