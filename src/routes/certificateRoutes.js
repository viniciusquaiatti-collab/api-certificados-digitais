const express = require('express');
const router = express.Router();

// Importação do controlador e do middleware que nós criamos
const CertificateController = require('../controllers/certificateController');
const authMiddleware = require('../middlewares/authMiddleware');

// Rota para criar um novo certificado (protegida por autenticação)
router.post('/', authMiddleware, CertificateController.createCertificate);

// Rota para verificar um certificado (pública)
router.get('/verify/:code', CertificateController.verifyCertificate);

module.exports = router;