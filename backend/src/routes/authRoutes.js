// src/routes/authRoutes.js

const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const { registerSchema, loginSchema } = require('../schemas');
const validateSchema = require('../middlewares/validateSchema');

console.log('🚀 [AuthRoutes] Inicializando rotas de autenticação...');

// ===========================================
// ROTAS PÚBLICAS
// ===========================================

/**
 * @route   POST /api/auth/register
 */
router.post(
  '/register',
  (req, res, next) => {
    console.log('📝 [ROUTE] POST /register acionada');
    next();
  },
  validateSchema(registerSchema),
  authController.register
);

/**
 * @route   POST /api/auth/login
 */
router.post(
  '/login',
  (req, res, next) => {
    console.log('🔐 [ROUTE] POST /login acionada');
    next();
  },
  validateSchema(loginSchema),
  authController.login
);

// ===========================================
// ROTAS PROTEGIDAS
// ===========================================

/**
 * @route   GET /api/auth/profile
 */
router.get(
  '/profile',
  (req, res, next) => {
    console.log('👤 [ROUTE] GET /profile acionada');
    next();
  },
  authMiddleware,
  authController.getProfile
);

/**
 * 🚨 NOVA ROTA CRÍTICA
 * @route   GET /api/auth/me
 */
router.get(
  '/me',
  (req, res, next) => {
    console.log('🔍 [ROUTE] GET /me acionada');
    next();
  },
  authMiddleware,
  authController.me
);

console.log('✅ [AuthRoutes] Rotas registradas com sucesso:');
console.log('➡️ POST   /api/auth/register');
console.log('➡️ POST   /api/auth/login');
console.log('➡️ GET    /api/auth/profile (PROTEGIDA)');
console.log('➡️ GET    /api/auth/me (PROTEGIDA)');

module.exports = router;