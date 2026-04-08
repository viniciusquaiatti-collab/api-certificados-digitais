// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const { registerSchema, loginSchema } = require('../schemas');
const validateSchema = require('../middlewares/validateSchema');

console.log('[AuthRoutes] Definindo rotas de autenticação.');

// ===========================================
// ROTAS PÚBLICAS
// ===========================================

/**
 * @route   POST /api/auth/register
 * @desc    Registrar novo usuário (apenas email + senha)
 * @access  Público
 */
router.post(
  '/register',
  validateSchema(registerSchema),
  authController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Login de usuário (apenas email + senha)
 * @access  Público
 */
router.post(
  '/login',
  validateSchema(loginSchema),
  authController.login
);

// ===========================================
// ROTAS PROTEGIDAS
// ===========================================

/**
 * @route   GET /api/auth/profile
 * @desc    Obter perfil do usuário logado
 * @access  Privado (JWT)
 */
router.get(
  '/profile',
  authMiddleware,
  authController.getProfile
);

module.exports = router;