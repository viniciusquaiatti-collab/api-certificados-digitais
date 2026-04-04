const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const AuditLog = require('../models/AuditLog');

class AuthController {
  /**
   * Registra um novo usuário no sistema.
   * @param {object} req - Objeto de requisição Express.
   * @param {object} res - Objeto de resposta Express.
   */
  static async register(req, res) {
    console.log('--- [AuthController.register] Iniciando registro de novo usuário ---');
    // Correção: Mapear o campo 'password' do JSON para a variável 'senha'
    const { nome, email, password: senha } = req.body;
    const ip_address = req.ip || req.connection.remoteAddress;
    const user_agent = req.headers['user-agent'];

    console.log(`Dados recebidos: Nome=${nome}, Email=${email}`);

    // Validação de entrada (ainda válida, mas redundante com o Zod)
    if (!nome || !email || !senha) {
      console.warn('[AuthController.register] Tentativa de registro com dados incompletos.');
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
    }

    try {
      // Verificar se o usuário já existe
      console.log(`[AuthController.register] Verificando se o email ${email} já existe...`);
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        console.warn(`[AuthController.register] Tentativa de registro com email já existente: ${email}`);
        return res.status(400).json({ error: 'Email já cadastrado.' });
      }

      // Criar o usuário
      console.log(`[AuthController.register] Criando usuário ${nome}...`);
      const userId = await User.create({ nome, email, senha });
      console.log(`[AuthController.register] Usuário criado com sucesso. ID: ${userId}`);

      // Registrar a ação de criação na auditoria
      await AuditLog.log({
        usuario_id: userId,
        acao: 'USER_REGISTER',
        detalhe: `Novo usuário registrado: ${nome} (${email}).`,
        ip_address,
        user_agent
      });

      res.status(201).json({
        message: 'Usuário registrado com sucesso.',
        userId
      });
    } catch (error) {
      console.error('[AuthController.register] Erro ao registrar usuário:', error.message);
      console.error('[AuthController.register] Stack trace:', error.stack);
      res.status(500).json({ error: 'Erro interno do servidor ao registrar usuário.' });
    }
  }

  /**
   * Autentica um usuário e retorna um token JWT.
   * @param {object} req - Objeto de requisição Express.
   * @param {object} res - Objeto de resposta Express.
   */
  static async login(req, res) {
    console.log('--- [AuthController.login] Iniciando tentativa de login ---');
    // Correção: Mapear o campo 'password' do JSON para a variável 'senha'
    const { email, password: senha } = req.body;
    const ip_address = req.ip || req.connection.remoteAddress;
    const user_agent = req.headers['user-agent'];

    console.log(`Tentativa de login para o email: ${email} a partir do IP: ${ip_address}`);

    // Validação de entrada (ainda válida, mas redundante com o Zod)
    if (!email || !senha) {
      console.warn('[AuthController.login] Tentativa de login com email ou senha em branco.');
      return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    try {
      // Verificar se o usuário existe
      console.log(`[AuthController.login] Buscando usuário ${email} no banco de dados...`);
      const user = await User.findByEmail(email);
      if (!user) {
        console.warn(` [AuthController.login] Falha no login: Usuário não encontrado para o email ${email}.`);
        // Registrar tentativa de login com usuário inexistente
        await AuditLog.log({
          usuario_id: null, // Usuário não existe, não temos ID
          acao: 'LOGIN_FAILED_USER_NOT_FOUND',
          detalhe: `Tentativa de login para email não cadastrado: ${email}.`,
          ip_address,
          user_agent
        });
        return res.status(401).json({ error: 'Credenciais inválidas.' }); // Mensagem genérica por segurança
      }

      // Verificar a senha
      console.log(`[AuthController.login] Usuário encontrado. Verificando senha...`);
      const isPasswordValid = await bcrypt.compare(senha, user.senha_hash);
      if (!isPasswordValid) {
        console.warn(` [AuthController.login] Falha no login: Senha incorreta para o usuário ${email}.`);
        // Registrar tentativa de login com senha incorreta
        await AuditLog.log({
          usuario_id: user.id,
          acao: 'LOGIN_FAILED_WRONG_PASSWORD',
          detalhe: `Tentativa de login com senha incorreta para o usuário ${email}.`,
          ip_address,
          user_agent
        });
        return res.status(401).json({ error: 'Credenciais inválidas.' }); // Mensagem genérica por segurança
      }

      // Gerar token JWT
      console.log(`[AuthController.login] Senha válida. Gerando token JWT para o usuário ${user.id}...`);
      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Registrar login bem-sucedido na auditoria
      await AuditLog.log({
        usuario_id: user.id,
        acao: 'LOGIN_SUCCESS',
        detalhe: `Login bem-sucedido para o usuário ${user.nome} (${email}).`,
        ip_address,
        user_agent
      });

      console.log(` [AuthController.login] Login realizado com sucesso para o usuário ${user.id}.`);

      res.json({
        message: 'Login realizado com sucesso.',
        token,
        userId: user.id
      });
    } catch (error) {
      console.error(' [AuthController.login] Erro ao fazer login:', error.message);
      console.error(' [AuthController.login] Stack trace:', error.stack);
      res.status(500).json({ error: 'Erro interno do servidor ao fazer login.' });
    }
  }
}

module.exports = AuthController;