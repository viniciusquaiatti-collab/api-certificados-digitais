// src/controllers/authController.js
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

console.log('🚀 --- [AuthController] Inicializado com sucesso ---');

class AuthController {

  // ===========================================
  // REGISTER
  // ===========================================
  static async register(req, res) {
    console.log('📝 --- [REGISTER] Iniciando registro ---');
    console.log('📦 [REGISTER] Body:', req.body);
    console.log('🌐 [REGISTER] IP:', req.ip);
    console.log('🖥️ [REGISTER] User-Agent:', req.get('User-Agent'));

    const startTime = Date.now();

    try {
      const { email, password } = req.body;

      console.log(`[REGISTER] Email: ${email}`);
      console.log(`[REGISTER] Password length: ${password?.length}`);

      if (!email || !password) {
        console.warn('[REGISTER] Campos obrigatórios ausentes');
        return res.status(400).json({
          success: false,
          error: 'Email e senha são obrigatórios'
        });
      }

      console.log('[REGISTER] Verificando usuário existente...');
      const existingUser = await User.findByEmail(email);

      if (existingUser) {
        console.warn(`[REGISTER] Usuário já existe: ${email}`);
        return res.status(400).json({
          success: false,
          error: 'Usuário já existe'
        });
      }

      console.log('[REGISTER] Gerando hash...');
      const senha_hash = await bcrypt.hash(password, 10);

      console.log('[REGISTER] Criando usuário...');
      const newUser = await User.create({
        email,
        senha_hash
      });

      console.log(`[REGISTER] Usuário criado ID: ${newUser.id}`);

      console.log('[REGISTER] Gerando token...');
      const token = jwt.sign(
        { id: newUser.id, email: newUser.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      console.log('🔑 [REGISTER] Token:', token);
      console.log('📏 [REGISTER] Token size:', token.length);

      console.log('[REGISTER] Salvando auditoria...');
      await AuditLog.create({
        usuario_id: newUser.id,
        acao: 'REGISTER',
        detalhe: `Usuário registrado: ${email}`,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });

      console.log(`✅ [REGISTER] Finalizado em ${Date.now() - startTime}ms`);

      return res.status(201).json({
        success: true,
        message: 'Registro criado com sucesso',
        data: {
          id: newUser.id,
          email: newUser.email,
          token
        }
      });

    } catch (error) {
      console.error('🔥 [REGISTER ERROR]', error.message);
      console.error(error.stack);

      return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  // ===========================================
  // LOGIN
  // ===========================================
  static async login(req, res) {
    console.log('🔐 --- [LOGIN] Iniciando login ---');
    console.log('📦 [LOGIN] Body:', req.body);
    console.log('🌐 [LOGIN] IP:', req.ip);

    const startTime = Date.now();

    try {
      const { email, password } = req.body;

      console.log(`[LOGIN] Email: ${email}`);

      if (!email || !password) {
        console.warn('[LOGIN] Campos ausentes');
        return res.status(400).json({
          success: false,
          error: 'Email e senha são obrigatórios'
        });
      }

      console.log('[LOGIN] Buscando usuário...');
      const user = await User.findByEmail(email);

      if (!user) {
        console.warn('[LOGIN] Usuário não encontrado');
        return res.status(401).json({
          success: false,
          error: 'Credenciais inválidas'
        });
      }

      console.log('[LOGIN] Validando senha...');
      const isPasswordValid = await bcrypt.compare(password, user.senha_hash);

      if (!isPasswordValid) {
        console.warn('[LOGIN] Senha inválida');
        return res.status(401).json({
          success: false,
          error: 'Credenciais inválidas'
        });
      }

      console.log('[LOGIN] Senha válida');

      console.log('[LOGIN] Gerando token...');
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      console.log('🔑 [LOGIN] Token:', token);
      console.log('📏 [LOGIN] Token size:', token.length);

      await AuditLog.create({
        usuario_id: user.id,
        acao: 'LOGIN',
        detalhe: `Login realizado: ${email}`,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });

      console.log(`✅ [LOGIN] Finalizado em ${Date.now() - startTime}ms`);

      return res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          token
        }
      });

    } catch (error) {
      console.error('🔥 [LOGIN ERROR]', error.message);
      console.error(error.stack);

      return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  // ===========================================
  // 🔥 VALIDAÇÃO DE TOKEN (NÍVEL ENTERPRISE)
  // ===========================================
  static async me(req, res) {
    console.log('🔍 --- [ME] Validação de sessão iniciada ---');
    console.log('🌐 [ME] IP:', req.ip);
    console.log('🖥️ [ME] User-Agent:', req.get('User-Agent'));
    console.log('📦 [ME] req.user recebido:', req.user);

    const startTime = Date.now();

    try {
      if (!req.user) {
        console.error('❌ [ME] req.user não existe → middleware falhou');
        return res.status(401).json({
          success: false,
          error: 'Não autenticado'
        });
      }

      const userId = req.user.id;

      console.log('👤 [ME] ID do usuário:', userId);

      console.log('[ME] Buscando usuário no banco...');
      const user = await User.findById(userId);

      if (!user) {
        console.warn('❌ [ME] Usuário não encontrado no banco');
        return res.status(404).json({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      console.log('✅ [ME] Usuário validado:', user.email);

      console.log(`🏁 [ME] Finalizado em ${Date.now() - startTime}ms`);

      return res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email
        }
      });

    } catch (error) {
      console.error('🔥 [ME ERROR]');
      console.error('Mensagem:', error.message);
      console.error('Stack:', error.stack);

      return res.status(500).json({
        success: false,
        error: 'Erro interno'
      });
    }
  }

  // ===========================================
  // PROFILE
  // ===========================================
  static async getProfile(req, res) {
    console.log('👤 --- [PROFILE] Iniciando ---');

    try {
      console.log('[PROFILE] req.user:', req.user);

      const userId = req.user.id;

      const user = await User.findById(userId);

      if (!user) {
        console.warn('[PROFILE] Usuário não encontrado');
        return res.status(404).json({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      console.log('[PROFILE] OK');

      return res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          criado_em: user.criado_em
        }
      });

    } catch (error) {
      console.error('🔥 [PROFILE ERROR]', error.message);

      return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
}

module.exports = AuthController;