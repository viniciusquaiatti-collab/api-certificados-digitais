// src/routes/certificateRoutes.js
const express = require('express');
const router = express.Router();
const certificateController = require('../controllers/certificateController');
const authMiddleware = require('../middlewares/authMiddleware');
const { certificateSchema, verifySchema, getByIdSchema } = require('../schemas');
const validateSchema = require('../middlewares/validateSchema');

console.log('[CertificateRoutes] Definindo rotas de certificados.');

// ===========================================
// ROTAS PÚBLICAS (SEM AUTENTICAÇÃO)
// ===========================================

/**
 * @route   GET /api/certificates/verify/:codigo
 * @desc    Verificar certificado por código (PÚBLICO - LGPD)
 * @access  Público
 */
router.get(
  '/verify/:codigo',
  validateSchema(verifySchema),
  certificateController.verifyCertificate
);

// ===========================================
// ROTAS PROTEGIDAS (AUTENTICADAS)
// ===========================================

/**
 * @route   POST /api/certificates
 * @desc    Criar novo certificado
 * @access  Privado (JWT)
 */
router.post(
  '/',
  authMiddleware,
  validateSchema(certificateSchema),
  certificateController.createCertificate
);

/**
 * @route   GET /api/certificates
 * @desc    Listar certificados do usuário logado
 * @access  Privado (JWT)
 */
router.get(
  '/',
  authMiddleware,
  certificateController.getUserCertificates
);

/**
 * @route   GET /api/certificates/:id
 * @desc    Buscar certificado por ID
 * @access  Privado (JWT)
 */
router.get(
  '/:id',
  authMiddleware,
  validateSchema(getByIdSchema),
  certificateController.getCertificateById
);

module.exports = router;