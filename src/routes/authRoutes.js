const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { registerSchema, loginSchema } = require('../schemas');
const validate = require('../middlewares/validateSchema');

console.log('[AuthRoutes] Definindo rotas de autenticação com validação Zod.');

// Rota de registro agora valida os dados antes de passar para o controller
router.post('/register', validate({ body: registerSchema }), authController.register);

// Rota de login também
router.post('/login', validate({ body: loginSchema }), authController.login);

module.exports = router;