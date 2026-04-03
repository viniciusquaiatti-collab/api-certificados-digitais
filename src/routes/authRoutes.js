const express = require('express');
const AuthController = require('../controllers/authController');
const router = express.Router();

// Rota de registro do usuário
router.post('/register', AuthController.register);

// Roota de Login 
router.post('/login', AuthController.login);

module.exports = router;