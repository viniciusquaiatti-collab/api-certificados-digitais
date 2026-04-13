const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/adminController');
const authMiddleware = require('../middlewares/authMiddleware');

// Todas as rotas aqui precisam de autenticação
// O middleware authMiddleware será executado antes de qualquer controlador nesta rota
router.use(authMiddleware);

/**
 * @route   GET /api/admin/dashboard
 * @desc    Obtém dados gerais para o dashboard do administrador.
 * @access  Private (requer token de admin)
 */
router.get('/dashboard', AdminController.getDashboardData);

/**
 * @route   GET /api/admin/logs
 * @desc    Obtém todos os logs de auditoria, com paginação.
 * @access  Private (requer token de admin)
 */
router.get('/logs', AdminController.getAllAuditLogs);

/**
 * @route   GET /api/admin/users/:id/logs
 * @desc    Obtém os logs de auditoria para um usuário específico.
 * @access  Private (requer token de admin)
 */
router.get('/users/:id/logs', AdminController.getUserAuditLogs);

module.exports = router;