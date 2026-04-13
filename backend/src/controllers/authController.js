// src/controllers/authController.js
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

console.log('--- [AuthController] Iniciando controller de autenticação ---');

class AuthController {
  
  // ===========================================
  // REGISTRO (apenas email + senha - SEM TOKEN)
  // ===========================================
  static async register(req, res) {
    console.log('--- [AuthController.register] Iniciando registro ---');
    
    try {
      const { email, password } = req.body;
      
      console.log(`[AuthController.register] Email: ${email}`);
      
      // Verificar se usuário já existe
      const existingUser = await User.findByEmail(email);
      
      if (existingUser) {
        console.warn(`[AuthController.register] Usuário já existe: ${email}`);
        return res.status(400).json({
          success: false,
          error: 'Credenciais inválidas'
        });
      }
      
      // Criar hash da senha
      const senha_hash = await bcrypt.hash(password, 10);
      
      // Criar usuário
      const newUser = await User.create({
        email,
        senha_hash
      });
      
      console.log(`[AuthController.register] Usuário criado: ID ${newUser.id}`);
      
      // Registrar no log de auditoria
      await AuditLog.create({
        usuario_id: newUser.id,
        acao: 'REGISTER',
        detalhe: `Usuário registrado: ${email}`,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      console.log(`[AuthController.register] Registro concluído com sucesso`);
      
      // Retorna APENAS confirmação, SEM TOKEN
      res.status(201).json({
        success: true,
        message: 'Registro criado com sucesso'
      });
      
    } catch (error) {
      console.error('[AuthController.register] Erro:', error.message);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
  
  // ===========================================
  // LOGIN (apenas email + senha - COM TOKEN)
  // ===========================================
  static async login(req, res) {
    console.log('--- [AuthController.login] Iniciando login ---');
    
    try {
      const { email, password } = req.body;
      
      console.log(`[AuthController.login] Email: ${email} | IP: ${req.ip}`);
      
      // Buscar usuário
      const user = await User.findByEmail(email);
      
      if (!user) {
        console.warn(`[AuthController.login] Usuário não encontrado: ${email}`);
        return res.status(401).json({
          success: false,
          error: 'Credenciais inválidas'
        });
      }
      
      // Verificar senha
      const isPasswordValid = await bcrypt.compare(password, user.senha_hash);
      
      if (!isPasswordValid) {
        console.warn(`[AuthController.login] Senha inválida para: ${email}`);
        return res.status(401).json({
          success: false,
          error: 'Credenciais inválidas'
        });
      }
      
      console.log(`[AuthController.login] Senha válida. Gerando token...`);
      
      // Gerar token JWT
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      // Registrar no log de auditoria
      await AuditLog.create({
        usuario_id: user.id,
        acao: 'LOGIN',
        detalhe: `Login realizado: ${email}`,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      console.log(`[AuthController.login] Login concluído`);
      
      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          token
        }
      });
      
    } catch (error) {
      console.error('[AuthController.login] Erro:', error.message);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
  
  // ===========================================
  // PERFIL DO USUÁRIO (rota protegida)
  // ===========================================
  static async getProfile(req, res) {
    console.log('--- [AuthController.getProfile] Buscando perfil ---');
    
    try {
      const userId = req.user.id;
      
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'Usuário não encontrado'
        });
      }
      
      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          criado_em: user.criado_em
        }
      });
    } catch (error) {
      console.error('[AuthController.getProfile] Erro:', error.message);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
}

module.exports = AuthController;