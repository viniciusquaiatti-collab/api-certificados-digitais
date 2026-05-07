// src/routes/certificateRoutes.js
// ============================================================
// 🏢 NexaSpark — Certificate Routes
// Rotas de emissão e verificação de certificados digitais.
//
// ⚠️  ADIÇÕES nesta versão:
//   -  rate limit para POST /
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
// ============================================================

const express               = require('express');
const router                = express.Router();
const rateLimit             = require('express-rate-limit');
const CertificateController = require('../controllers/certificateController');
const authMiddleware        = require('../middlewares/authMiddleware');
const validateSchema        = require('../middlewares/validateSchema');
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
//   Camada 4: certEmitLimiter     (10 emissões/min por userId) ← NOVO
//   Camada 5: verifyLimiter       (30 verificações/min por IP) ← NOVO
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
  keyGenerator: (req) => {
    const key      = req.user?.id ? `user_${req.user.id}` : `ip_${req.ip}`;
    const mode     = req.user?.id ? 'userId (seguro)' : 'ip (fallback — sem req.user)';

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

  keyGenerator: (req) => req.ip,

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
  certEmitLimiter: '10 emissões/min por userId (fallback: IP)',
  verifyLimiter:   '30 verificações/min por IP (anti-enumeração)',
  camadas:         '4 e 5 de defesa em profundidade ativas',
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
 */
router.get(
  '/verify/:codigo',
  routeLogger('CERT:VERIFY'),
  verifyLimiter,                         // ← camada 5: anti-enumeração
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
 * ⚠️  CHAIN OBRIGATÓRIA (ordem importa):
 *   1. routeLogger     → loga a requisição
 *   2. authMiddleware  → valida JWT, popula req.user ← DEVE VIR PRIMEIRO
 *   3. certEmitLimiter → rate limit por userId (precisa de req.user)
 *   4. validateSchema  → valida body contra certificateSchema
 *   5. controller      → executa lógica de negócio
 *
 * ⚠️  certEmitLimiter na posição 3 garante:
 *     - req.user populado → keyGenerator usa userId
 *     - Body não parseado desnecessariamente se bloqueado
 */
router.post(
  '/',
  routeLogger('CERT:CREATE'),
  authMiddleware,                        // ← 1º: valida JWT
  certEmitLimiter,                       // ← 2º: rate limit por userId
  validateSchema(certificateSchema),     // ← 3º: valida body
  CertificateController.createCertificate
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
logger.route('GET',  '/api/certificates/verify/:codigo', 'limited');
logger.route('POST', '/api/certificates',                'protected');
logger.route('GET',  '/api/certificates',                'protected');
logger.route('GET',  '/api/certificates/:id',            'protected');
logger.sep();

module.exports = router;