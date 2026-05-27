// src/routes/certificateRoutes.js
// ============================================================
// 🏢 NexaSpark — Certificate Routes
// Rotas de emissão e verificação de certificados digitais.
//
// ⚠️  ADIÇÕES nesta versão:
//   - certEmitLimiter: rate limit para POST /
//     10 emissões/minuto por USUÁRIO AUTENTICADO (userId)
//     Fallback por IP se token não disponível.
//     Impede abuse de créditos e ataques de spam.
//
//   - verifyLimiter: rate limit para GET /verify/:codigo
//     Rota pública — sem autenticação — vulnerável a scraping.
//     30 verificações/minuto por IP.
//     Impede enumeração de códigos por brute force.
//
// ⚠️  POR QUE RATE LIMIT POR USUÁRIO E NÃO SÓ POR IP?
//     Rate limit por IP é burlável com VPN (troca de IP).
//     Rate limit por userId usa o ID do banco — não há como
//     burlar sem comprometer a conta em si.
//
// ✅ v2.1 — PATCH CRÍTICO (zero remoção, apenas acréscimo):
//   planLimitMiddleware adicionado na chain do POST /
//
//   BUG ORIGINAL: planLimitMiddleware estava importado desde v2.0
//   mas NUNCA foi adicionado na chain da rota POST /. Por isso
//   o limite mensal do plano free nunca era verificado e usuários
//   podiam emitir certificados ilimitadamente (bug 5/2).
//
//   CORREÇÃO: planLimitMiddleware inserido como 4º middleware
//   na chain do POST /, entre certEmitLimiter e validateSchema.
//
//   CHAIN CORRETA v2.1 — POST /api/certificates:
//     1. routeLogger         → loga a requisição
//     2. authMiddleware      → valida JWT + popula req.user com plano_limite
//     3. certEmitLimiter     → rate limit 10/min por userId
//     4. planLimitMiddleware → ✅ NOVO — verifica limite mensal do plano
//     5. validateSchema      → valida body
//     6. controller          → lógica de negócio
//
// ✅ v3.0 — ADIÇÕES (nada removido, apenas acrescentado):
//   PATCH /:id/revoke — rota de revogação de certificados
//   Só o dono pode revogar. Requer JWT. Idempotente.
//   Declarada ANTES de /:id para Express não confundir "revoke"
//   com um ID numérico — mas usa PATCH então sem conflito real.
// ============================================================

const express               = require('express');
const router                = express.Router();
const rateLimit             = require('express-rate-limit');
const { ipKeyGenerator }    = require('express-rate-limit');
const CertificateController = require('../controllers/certificateController');
const authMiddleware        = require('../middlewares/authMiddleware');
const validateSchema        = require('../middlewares/validateSchema');
const planLimitMiddleware   = require('../middlewares/planLimitMiddleware'); // v2.0 IMPORTADO — v2.1 ATIVADO NA CHAIN
const { certificateSchema, verifySchema, getByIdSchema } = require('../schemas');

// ============================================================
// 🎨 LOGGER
// ============================================================
const c = {
  green:   (s) => `\x1b[32m${s}\x1b[0m`,
  yellow:  (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:    (s) => `\x1b[36m${s}\x1b[0m`,
  gray:    (s) => `\x1b[90m${s}\x1b[0m`,
  bold:    (s) => `\x1b[1m${s}\x1b[0m`,
  red:     (s) => `\x1b[31m${s}\x1b[0m`,
  magenta: (s) => `\x1b[35m${s}\x1b[0m`,
};

const logger = {
  success: (scope, msg, data) => console.log(  c.green(`✅ [${scope}]`),   msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  warn:    (scope, msg, data) => console.warn( c.yellow(`⚠️  [${scope}]`),  msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  error:   (scope, msg, data) => console.error(c.red(`❌ [${scope}]`),     msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  sec:     (msg, data)        => console.warn( c.red(`🚨 [SECURITY]`),     msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  route:   (method, path, type) => console.log(
    c.cyan(`🛣️  [ROUTE]`),
    c.bold(method.padEnd(7)),
    path.padEnd(40),
    type === 'public'    ? c.green('[PUBLIC]')           :
    type === 'protected' ? c.yellow('[PROTECTED]')       :
    type === 'limited'   ? c.magenta('[RATE LIMITED]')   : ''
  ),
  sep: () => console.log(c.gray('─'.repeat(60))),
};

// ============================================================
// 🚦 RATE LIMITERS — Defesa em profundidade para certificados
//
// CAMADAS DE PROTEÇÃO (ordem de chegada do request):
//   Camada 1: Cloudflare DDoS     (volumétrico — externo)
//   Camada 2: globalLimiter       (100 req/15min por IP — app.js)
//   Camada 3: authLimiter         (20 req/15min por IP em /auth — app.js)
//   Camada 4: certEmitLimiter     (10 emissões/min por userId) ← mantido
//   Camada 5: planLimitMiddleware (limite mensal do plano)    ← v2.1 ATIVO
//   Camada 6: verifyLimiter       (30 verificações/min por IP) ← mantido
//
// Cada camada captura um tipo diferente de abuso.
// Nenhuma camada sozinha é suficiente — a segurança vem
// da combinação de todas elas.
// ============================================================

// ── certEmitLimiter — Emissão de certificados ─────────────
//
// Por que 10/min?
//   Um RH humano dificilmente emite mais de 10 certs/min.
//   Acima disso é automação — queremos saber e bloquear.
//
// Por que por userId e não por IP?
//   IP: VPN troca em segundos, burla o limite trivialmente.
//   userId: vinculado à conta — impossível burlar sem
//   comprometer a própria conta Google/senha.
//
// ⚠️  POSIÇÃO NA CHAIN: APÓS authMiddleware
//     certEmitLimiter deve ser o 3º middleware na rota POST /
//     para garantir que req.user já está populado pelo JWT.
//     Se vier antes do authMiddleware, req.user é undefined
//     e o keyGenerator cai sempre no fallback de IP.
const certEmitLimiter = rateLimit({
  windowMs: 60 * 1000, // janela de 1 minuto
  max:      10,        // máximo 10 emissões por minuto

  // keyGenerator: userId do JWT > IP como fallback
  // ⚠️  ipKeyGenerator: helper obrigatório do express-rate-limit v8
  //     normaliza IPv4-mapped IPv6 (::ffff:1.2.3.4 → 1.2.3.4)
  //     sem isso, usuários IPv6 bypassam o limite
  keyGenerator: (req) => {
    const key  = req.user?.id
      ? `user_${req.user.id}`
      : `ip_${ipKeyGenerator(req)}`; // ← helper correto para IPv6
    const mode = req.user?.id ? 'userId (seguro)' : 'ip (fallback)';

    logger.warn('CERT:RATELIMIT:EMIT', 'Key gerada para rate limit de emissão', {
      key,
      userId:    req.user?.id    || null,
      email:     req.user?.email || null,
      ip:        req.ip,
      mode,
      requestId: req.requestId,
    });

    return key;
  },

  // Handler customizado — log de segurança + resposta estruturada
  handler: (req, res) => {
    logger.sec('🚨 RATE LIMIT EMISSÃO ATINGIDO — possível abuso', {
      userId:    req.user?.id    || null,
      email:     req.user?.email || null,
      ip:        req.ip,
      url:       req.originalUrl,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
      acao:      'Emissão bloqueada — 10 certs/min atingido',
      alerta:    'Investigar se é abuso de créditos ou automação não autorizada',
    });

    return res.status(429).json({
      success:    false,
      error:      'Limite de emissões atingido. Máximo de 10 certificados por minuto.',
      code:       'CERT_EMIT_RATE_LIMIT',
      retryAfter: 60,
      requestId:  req.requestId,
      timestamp:  new Date().toISOString(),
    });
  },

  standardHeaders:        true,  // Retry-After no header
  legacyHeaders:          false,
  skipSuccessfulRequests: false, // conta sucessos e falhas igualmente
});

// ── verifyLimiter — Verificação pública ───────────────────
//
// Rota GET /verify/:codigo é pública (sem auth).
// Vulnerável a enumeração de códigos:
//   atacante tenta AAAA0001, AAAA0002... até encontrar válidos
//   → scraping da base de certificados
//
// 30 req/min por IP é generoso para uso legítimo
// (uma empresa verificando 30 certs por minuto é improvável)
// mas inviabiliza automação de enumeração.
const verifyLimiter = rateLimit({
  windowMs: 60 * 1000, // janela de 1 minuto
  max:      30,        // 30 verificações por minuto por IP

  keyGenerator: (req) => ipKeyGenerator(req), // ← helper correto para IPv6

  handler: (req, res) => {
    logger.sec('🚨 RATE LIMIT VERIFICAÇÃO ATINGIDO — possível enumeração', {
      ip:        req.ip,
      codigo:    req.params?.codigo ? req.params.codigo.substring(0, 8) + '...' : null,
      url:       req.originalUrl,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
      acao:      'Verificação bloqueada — 30 req/min por IP atingido',
      alerta:    'Possível tentativa de enumeração de códigos de certificado',
    });

    return res.status(429).json({
      success:    false,
      error:      'Muitas verificações. Tente novamente em 1 minuto.',
      code:       'CERT_VERIFY_RATE_LIMIT',
      retryAfter: 60,
      requestId:  req.requestId,
      timestamp:  new Date().toISOString(),
    });
  },

  standardHeaders: true,
  legacyHeaders:   false,
});

logger.success('CertificateRoutes', 'Rate limiters configurados ✅', {
  certEmitLimiter:     '10 emissões/min por userId (fallback: IP)',
  planLimitMiddleware: 'limite mensal do plano free — camada 5 ATIVA ✅',
  verifyLimiter:       '30 verificações/min por IP (anti-enumeração)',
  camadas:             '5 e 6 de defesa em profundidade ativas',
});

// ============================================================
// 📋 MIDDLEWARE DE LOG POR ROTA
// ============================================================
function routeLogger(routeName) {
  return (req, res, next) => {
    const requestId = req.requestId || req.headers['x-request-id'] || `cert_${Date.now()}`;
    req.requestId   = requestId;

    console.log(
      c.cyan(`📨 [${routeName}]`),
      c.bold(`${req.method} ${req.originalUrl}`),
      c.gray(`| ID: ${requestId} | IP: ${req.ip} | ${new Date().toISOString()}`)
    );

    res.on('finish', () => {
      const elapsed     = req.startTime ? Date.now() - req.startTime : '?';
      const statusStr   = String(res.statusCode);
      const statusColor =
        res.statusCode < 300 ? c.green(statusStr)  :
        res.statusCode < 400 ? c.cyan(statusStr)   :
        res.statusCode < 500 ? c.yellow(statusStr) : c.red(statusStr);

      console.log(
        c.cyan(`📤 [${routeName}]`),
        `Resposta ${statusColor}`,
        c.gray(`| ${elapsed}ms | ID: ${requestId}`)
      );
    });

    next();
  };
}

// ============================================================
// 🔓 ROTAS PÚBLICAS — Sem autenticação
// ============================================================

/**
 * GET /api/certificates/verify/:codigo
 *
 * Verificação pública de certificado por código.
 * Qualquer pessoa pode verificar — sem login.
 *
 * ⚠️  ORDEM DAS ROTAS IMPORTA:
 *     Esta rota DEVE ser declarada ANTES de /:id
 *     para que Express não interprete "verify" como um ID.
 *
 * ⚠️  RATE LIMIT: verifyLimiter (30/min por IP)
 *     Protege contra enumeração de códigos por brute force.
 *     Posição: antes do validateSchema para bloquear mais cedo.
 *
 * ✅ v3: retorna 410 Gone para certificados revogados
 *     O controller detecta revoked_at no retorno do model
 *     e retorna 410 antes de incrementar qualquer contador.
 */
router.get(
  '/verify/:codigo',
  routeLogger('CERT:VERIFY'),
  verifyLimiter,                         // ← camada 6: anti-enumeração
  validateSchema(verifySchema),
  CertificateController.verifyCertificate
);

// ============================================================
// 🔒 ROTAS PROTEGIDAS — Requerem JWT válido
// ============================================================

/**
 * POST /api/certificates
 *
 * Emite um novo certificado digital.
 * Requer autenticação JWT.
 *
 * ✅ v2.1 — CHAIN CORRIGIDA (planLimitMiddleware adicionado):
 *
 *   CHAIN CORRETA v2.1 (ordem importa):
 *   1. routeLogger         → loga method, path, requestId, IP e timestamp
 *   2. authMiddleware      → valida JWT + popula req.user com plano_limite
 *   3. certEmitLimiter     → rate limit 10/min por userId (anti-spam)
 *   4. planLimitMiddleware → ✅ ADICIONADO — verifica limite mensal do plano
 *   5. validateSchema      → valida body contra certificateSchema (Zod)
 *   6. controller          → lógica de negócio: hash, PDF, banco, audit
 *
 * ⚠️  ORDEM CRÍTICA:
 *   planLimitMiddleware DEVE vir APÓS authMiddleware
 *   — precisa de req.user.plano_limite para funcionar
 *   planLimitMiddleware DEVE vir ANTES do controller
 *   — bloqueia ANTES de gerar o PDF (economiza Cloudinary + CPU)
 */
router.post(
  '/',
  routeLogger('CERT:CREATE'),
  authMiddleware,                        // ← 1º: valida JWT + popula req.user com plano_limite
  certEmitLimiter,                       // ← 2º: rate limit por userId (10 emissões/min)
  planLimitMiddleware,                   // ← 3º: ✅ v2.1 ADICIONADO — limite mensal do plano
  validateSchema(certificateSchema),     // ← 4º: valida body (Zod schema)
  CertificateController.createCertificate // ← 5º: lógica de negócio
);

/**
 * GET /api/certificates
 *
 * Lista todos os certificados do usuário autenticado.
 * Suporta paginação: ?limit=50&offset=0
 */
router.get(
  '/',
  routeLogger('CERT:LIST'),
  authMiddleware,
  CertificateController.getUserCertificates
);

/**
 * PATCH /api/certificates/:id/revoke
 *
 * Revoga um certificado digital.
 * Requer autenticação JWT — só o dono pode revogar.
 *
 * Corpo (opcional):
 *   { "reason": "Certificado emitido por engano" }
 *
 * ✅ v3.0 — NOVO
 *
 * ⚠️  ORDEM DAS ROTAS IMPORTA:
 *     Declarada ANTES de /:id por convenção de clareza.
 *     Na prática não há conflito — usa PATCH e /:id usa GET,
 *     mas Express resolve por método HTTP, não só por path.
 *
 * ⚠️  Por que PATCH e não DELETE?
 *     DELETE semanticamente remove o recurso.
 *     Revogação NÃO remove — o certificado continua existindo
 *     e verificável (com 410 Gone). PATCH é semanticamente
 *     correto para "modificação parcial do estado".
 *
 * ⚠️  Por que não precisa de validateSchema?
 *     O body é opcional — { reason } é string simples.
 *     Validação de tamanho (max 255 chars) está no controller.
 */
router.patch(
  '/:id/revoke',
  routeLogger('CERT:REVOKE'),
  authMiddleware,                          // ← JWT obrigatório — só o dono revoga
  CertificateController.revokeCertificate  // ← lógica de revogação
);

/**
 * GET /api/certificates/:id
 *
 * Retorna certificado específico pelo ID.
 *
 * ⚠️  SEGURANÇA: findById(id, usuario_id) no model garante
 *     isolamento entre usuários — um usuário não acessa
 *     certificados de outro mesmo conhecendo o ID.
 */
router.get(
  '/:id',
  routeLogger('CERT:GET_BY_ID'),
  authMiddleware,
  validateSchema(getByIdSchema),
  CertificateController.getCertificateById
);

// ============================================================
// 📋 LOG DE ROTAS REGISTRADAS (exibido na inicialização)
// ============================================================
logger.sep();
logger.success('CertificateRoutes', 'Rotas de certificados registradas:');
logger.route('GET',   '/api/certificates/verify/:codigo', 'limited');
logger.route('POST',  '/api/certificates',                'protected');
logger.route('GET',   '/api/certificates',                'protected');
logger.route('PATCH', '/api/certificates/:id/revoke',     'protected');
logger.route('GET',   '/api/certificates/:id',            'protected');
// ✅ v2.1: confirmação de que planLimitMiddleware está ATIVO na chain
logger.success('CertificateRoutes', '✅ planLimitMiddleware ATIVO na rota POST /', {
  posicao:  '3º na chain (após auth + rateLimit, antes de validateSchema)',
  bloqueia: 'plano free → limite mensal configurado em planLimitMiddleware.js',
  retorna:  '403 PLAN_LIMIT_REACHED quando limite atingido',
  depende:  'authMiddleware v2.1 — req.user.plano_limite deve estar populado',
});
// ✅ v3.0: confirmação da rota de revogação
logger.success('CertificateRoutes', '✅ PATCH /:id/revoke ATIVO — v3.0', {
  auth:        'JWT obrigatório — só o dono revoga',
  idempotente: 'revogar duas vezes não quebra — retorna 200 com CERT_ALREADY_REVOKED',
  verificacao: 'certificados revogados retornam 410 Gone na rota /verify/:codigo',
});
logger.sep();

module.exports = router;