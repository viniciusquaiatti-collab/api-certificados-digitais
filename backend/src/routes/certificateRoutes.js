// src/routes/certificateRoutes.js
// ============================================================
// 🏢 NexaSpark — Certificate Routes
// Rotas de emissão e verificação de certificados digitais.
// ============================================================

const express               = require('express');
const router                = express.Router();
const CertificateController = require('../controllers/certificateController');
const authMiddleware        = require('../middlewares/authMiddleware');
const validateSchema        = require('../middlewares/validateSchema');
const { certificateSchema, verifySchema, getByIdSchema } = require('../schemas');

// ============================================================
// 🎨 LOGGER
// ============================================================
const c = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  gray:   (s) => `\x1b[90m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
};

const logger = {
  success: (scope, msg) => console.log( c.green(`✅ [${scope}]`),   msg),
  route:   (method, path, type) => console.log(
    c.cyan(`🛣️  [ROUTE]`),
    c.bold(method.padEnd(7)),
    path.padEnd(40),
    type === 'public'    ? c.green('[PUBLIC]')    :
    type === 'protected' ? c.yellow('[PROTECTED]') : ''
  ),
  sep: () => console.log(c.gray('─'.repeat(60))),
};

// ============================================================
// 📋 MIDDLEWARE DE LOG POR ROTA
//
// ⚠️  MELHORIA EM RELAÇÃO AO ORIGINAL:
//     O original tinha apenas console.log esparsos.
//     Centralizamos em routeLogger com requestId e timing,
//     igual ao padrão definido no authRoutes.
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
 *     para que Express não interprete "verify" como um UUID.
 *     No original a ordem estava correta, mantemos assim.
 */
router.get(
  '/verify/:codigo',
  routeLogger('CERT:VERIFY'),
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
 * Valida o body contra certificateSchema antes de chegar no controller.
 */
router.post(
  '/',
  routeLogger('CERT:CREATE'),
  authMiddleware,
  validateSchema(certificateSchema),
  CertificateController.createCertificate
);

/**
 * GET /api/certificates
 *
 * Lista todos os certificados do usuário autenticado.
 * Suporta paginação via query params: ?limit=50&offset=0
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
 * Retorna um certificado específico pelo ID (UUID).
 * Garante que o certificado pertence ao usuário autenticado.
 *
 * ⚠️  SEGURANÇA: findById(id, usuario_id) no model garante
 *     que um usuário não consegue ver certificados de outro
 *     mesmo que adivinhe o UUID.
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
logger.route('GET',  '/api/certificates/verify/:codigo', 'public');
logger.route('POST', '/api/certificates',                'protected');
logger.route('GET',  '/api/certificates',                'protected');
logger.route('GET',  '/api/certificates/:id',            'protected');
logger.sep();

module.exports = router;