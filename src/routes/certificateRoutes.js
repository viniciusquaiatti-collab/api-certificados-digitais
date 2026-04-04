const express = require('express');
const router = express.Router();
const certificateController = require('../controllers/certificateController');
const authMiddleware = require('../middlewares/authMiddleware');
const { createCertificateSchema, verifyCertificateSchema } = require('../schemas');
const validate = require('../middlewares/validateSchema');

console.log('[CertificateRoutes] Definindo rotas de certificados com validação Zod.');

// Rota para criar certificado, exigindo autenticação e validação dos dados
router.post('/', authMiddleware, validate({ body: createCertificateSchema }), certificateController.createCertificate);

// Rota de verificação, que agora valida o código antes de buscar
router.get('/verify/:codigo', validate({ params: verifyCertificateSchema }), certificateController.verifyCertificate);

module.exports = router;