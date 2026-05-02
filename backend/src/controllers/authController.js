// src/controllers/authController.js

const User       = require('../models/User');
const AuditLog   = require('../models/AuditLog');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');

// ============================================================
// 🏢 LOGGER — Enterprise Grade | NexaSpark Auth System
// ============================================================
const chalk = {
  // Node.js não tem chalk por padrão — usamos ANSI codes direto
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  blue:   (s) => `\x1b[34m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  gray:   (s) => `\x1b[90m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  magenta:(s) => `\x1b[35m${s}\x1b[0m`,
};

const logger = {
  info:    (scope, msg, data) => console.log(   chalk.blue(`ℹ️  [${scope}]`),  msg, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  success: (scope, msg, data) => console.log(   chalk.green(`✅ [${scope}]`),  msg, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  warn:    (scope, msg, data) => console.warn(  chalk.yellow(`⚠️  [${scope}]`), msg, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  error:   (scope, msg, data) => console.error( chalk.red(`❌ [${scope}]`),    msg, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  perf:    (scope, label, ms) => console.log(   chalk.magenta(`⏱️  [${scope}]`), `${label} — ${chalk.bold(ms + 'ms')}`),
  event:   (scope, action, data) => console.log(chalk.cyan(`🎯 [${scope}]`),   `ACTION → ${action}`, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  audit:   (msg, data)        => console.log(   chalk.green(`🔏 [AUDIT]`),     msg, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  sec:     (msg, data)        => console.warn(  chalk.red(`🚨 [SECURITY]`),    msg, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  db:      (msg, data)        => console.log(   chalk.cyan(`🗄️  [DB]`),         msg, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  sep:     ()                 => console.log(   chalk.gray('─'.repeat(60))),
};

// ============================================================
// 🔒 CONSTANTES DE SEGURANÇA
//
// ⚠️  PROBLEMA IDENTIFICADO NO CÓDIGO ORIGINAL:
//     Não havia limite de tentativas de login (brute-force).
//     Adicionamos controle in-memory. Em produção, use Redis.
// ============================================================
const LOGIN_MAX_ATTEMPTS  = 5;
const LOGIN_WINDOW_MS     = 15 * 60 * 1000; // 15 minutos
const loginAttempts       = new Map(); // { ip -> { count, firstAttempt } }

function checkBruteForce(ip) {
  const now  = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    return { blocked: false, remaining: LOGIN_MAX_ATTEMPTS - 1 };
  }

  // Janela expirou — reseta
  if (now - entry.firstAttempt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    return { blocked: false, remaining: LOGIN_MAX_ATTEMPTS - 1 };
  }

  entry.count++;
  if (entry.count > LOGIN_MAX_ATTEMPTS) {
    const resetIn = Math.ceil((LOGIN_WINDOW_MS - (now - entry.firstAttempt)) / 1000 / 60);
    return { blocked: true, resetIn };
  }

  return { blocked: false, remaining: LOGIN_MAX_ATTEMPTS - entry.count };
}

function clearBruteForce(ip) {
  loginAttempts.delete(ip);
}

// ============================================================
// 🛡️  HELPER — Sanitiza dados de log (nunca loga senha)
// ============================================================
function sanitizeForLog(obj) {
  if (!obj) return {};
  const clone = { ...obj };
  if (clone.password)   clone.password   = `[${clone.password.length} chars]`;
  if (clone.senha_hash) clone.senha_hash  = '[REDACTED]';
  if (clone.token)      clone.token       = clone.token.substring(0, 20) + '...';
  return clone;
}

// ============================================================
// 🛡️  HELPER — Extrai contexto da requisição
// ============================================================
function reqContext(req) {
  return {
    ip:        req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    method:    req.method,
    path:      req.path,
    requestId: req.headers['x-request-id'] || `req_${Date.now()}`,
  };
}

console.log(chalk.green(chalk.bold('🚀 [AuthController] Módulo inicializado')));
logger.sep();

// ============================================================

class AuthController {

  // ══════════════════════════════════════════════════════════
  // REGISTER
  // ══════════════════════════════════════════════════════════
  static async register(req, res) {
    const t0  = Date.now();
    const ctx = reqContext(req);

    logger.sep();
    logger.info('REGISTER', 'Requisição recebida', ctx);

    try {
      const { email, password } = req.body;

      // ── Validação básica ──────────────────────────────────
      // ⚠️  PROBLEMA ORIGINAL: não havia sanitização do email
      //     (espaços, maiúsculas). Um email "User@Gmail.com "
      //     seria tratado diferente de "user@gmail.com".
      const emailNormalized = email?.trim().toLowerCase();

      logger.info('REGISTER', 'Dados recebidos', sanitizeForLog({ email: emailNormalized, password }));

      if (!emailNormalized || !password) {
        logger.warn('REGISTER', 'Campos obrigatórios ausentes', { email: !!email, password: !!password });
        return res.status(400).json({ success: false, error: 'Email e senha são obrigatórios' });
      }

      // Validação de formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailNormalized)) {
        logger.warn('REGISTER', 'Formato de email inválido', { email: emailNormalized });
        return res.status(400).json({ success: false, error: 'Formato de email inválido' });
      }

      // Validação de força de senha
      if (password.length < 8) {
        logger.warn('REGISTER', 'Senha fraca — mínimo 8 caracteres');
        return res.status(400).json({ success: false, error: 'A senha deve ter no mínimo 8 caracteres' });
      }

      // ── Verifica duplicata ────────────────────────────────
      logger.db('Verificando usuário existente...', { email: emailNormalized });
      const existingUser = await User.findByEmail(emailNormalized);

      if (existingUser) {
        // ⚠️  SEGURANÇA: não revele se o email existe — use mensagem genérica em produção.
        //     Aqui mantemos explícito pois é plataforma fechada/B2B.
        logger.sec('Tentativa de registro com email já cadastrado', { email: emailNormalized, ip: ctx.ip });
        return res.status(409).json({ success: false, error: 'Este email já está cadastrado' });
      }

      // ── Hash da senha ─────────────────────────────────────
      // ⚠️  MELHORIA: salt rounds 10 → 12 para maior segurança
      //     (custo computacional aceitável em 2025)
      logger.info('REGISTER', 'Gerando hash bcrypt (rounds: 12)');
      const senha_hash = await bcrypt.hash(password, 12);
      logger.success('REGISTER', 'Hash gerado com sucesso');

      // ── Cria usuário ──────────────────────────────────────
      logger.db('Inserindo usuário no banco...', { email: emailNormalized });
      const newUser = await User.create({ email: emailNormalized, senha_hash });
      logger.success('DB', 'Usuário criado', { id: newUser.id, email: newUser.email });

      // ── Gera JWT ──────────────────────────────────────────
      logger.info('REGISTER', 'Gerando token JWT (7d)');
      const token = jwt.sign(
        { id: newUser.id, email: newUser.email, role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '7d', issuer: 'nexaspark', audience: 'nexaspark-app' }
      );

      // ⚠️  SEGURANÇA: nunca logue o token completo em produção
      logger.info('REGISTER', 'Token gerado', { prefix: token.substring(0, 25) + '...', size: token.length });

      // ── Auditoria ─────────────────────────────────────────
      logger.audit('Novo registro de usuário', { userId: newUser.id, email: newUser.email, ip: ctx.ip });
      await AuditLog.create({
        usuario_id: newUser.id,
        acao:       'REGISTER',
        detalhe:    `Registro via plataforma web: ${emailNormalized}`,
        ip_address: ctx.ip,
        user_agent: ctx.userAgent,
      });

      const elapsed = Date.now() - t0;
      logger.perf('REGISTER', 'Fluxo completo', elapsed);
      logger.success('REGISTER', '══ Registro finalizado com sucesso ══', { userId: newUser.id });
      logger.sep();

      return res.status(201).json({
        success: true,
        message: 'Conta criada com sucesso',
        data: { id: newUser.id, email: newUser.email, token },
      });

    } catch (error) {
      const elapsed = Date.now() - t0;
      logger.error('REGISTER', `Erro não tratado após ${elapsed}ms`, { message: error.message });
      logger.error('REGISTER', 'Stack trace completo:\n' + error.stack);
      logger.sep();

      return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
  }

  // ══════════════════════════════════════════════════════════
  // LOGIN
  // ══════════════════════════════════════════════════════════
  static async login(req, res) {
    const t0  = Date.now();
    const ctx = reqContext(req);

    logger.sep();
    logger.info('LOGIN', 'Requisição recebida', ctx);

    try {
      const { email, password } = req.body;

      // ── Normalização ──────────────────────────────────────
      // ⚠️  CORREÇÃO: mesmo problema do register — email deve ser normalizado
      const emailNormalized = email?.trim().toLowerCase();

      logger.info('LOGIN', 'Tentativa de autenticação', sanitizeForLog({ email: emailNormalized, password }));

      // ── Brute-force protection ────────────────────────────
      // ⚠️  NOVO: proteção contra ataques de força bruta
      const bruteCheck = checkBruteForce(ctx.ip);
      if (bruteCheck.blocked) {
        logger.sec('Brute-force bloqueado', { ip: ctx.ip, resetIn: bruteCheck.resetIn });
        return res.status(429).json({
          success: false,
          error:   `Muitas tentativas. Tente novamente em ${bruteCheck.resetIn} minuto(s).`,
        });
      }

      if (bruteCheck.remaining <= 2) {
        logger.warn('LOGIN', 'IP próximo do limite de tentativas', { ip: ctx.ip, remaining: bruteCheck.remaining });
      }

      // ── Validação ─────────────────────────────────────────
      if (!emailNormalized || !password) {
        logger.warn('LOGIN', 'Campos ausentes');
        return res.status(400).json({ success: false, error: 'Email e senha são obrigatórios' });
      }

      // ── Busca usuário ─────────────────────────────────────
      logger.db('Buscando usuário por email...', { email: emailNormalized });
      const user = await User.findByEmail(emailNormalized);

      if (!user) {
        // ⚠️  SEGURANÇA: mesma mensagem para "não existe" e "senha errada"
        //     Evita enumeração de usuários (user enumeration attack)
        logger.sec('Usuário não encontrado', { email: emailNormalized, ip: ctx.ip });
        return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
      }

      logger.db('Usuário encontrado', { id: user.id, email: user.email });

      // ── Valida senha ──────────────────────────────────────
      logger.info('LOGIN', 'Comparando hash bcrypt...');
      const t1 = Date.now();
      const isPasswordValid = await bcrypt.compare(password, user.senha_hash);
      logger.perf('LOGIN', 'bcrypt.compare', Date.now() - t1);

      if (!isPasswordValid) {
        logger.sec('Senha inválida', { userId: user.id, ip: ctx.ip });
        return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
      }

      // ── Limpa tentativas após sucesso ─────────────────────
      clearBruteForce(ctx.ip);
      logger.success('LOGIN', 'Autenticação bem-sucedida', { userId: user.id });

      // ── Gera JWT ──────────────────────────────────────────
      logger.info('LOGIN', 'Gerando token JWT (7d)');
      const token = jwt.sign(
        { id: user.id, email: user.email, role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '7d', issuer: 'nexaspark', audience: 'nexaspark-app' }
      );

      logger.info('LOGIN', 'Token gerado', { prefix: token.substring(0, 25) + '...', size: token.length });

      // ── Auditoria ─────────────────────────────────────────
      logger.audit('Login realizado', { userId: user.id, email: user.email, ip: ctx.ip, userAgent: ctx.userAgent });
      await AuditLog.create({
        usuario_id: user.id,
        acao:       'LOGIN',
        detalhe:    `Login via plataforma web`,
        ip_address: ctx.ip,
        user_agent: ctx.userAgent,
      });

      const elapsed = Date.now() - t0;
      logger.perf('LOGIN', 'Fluxo completo', elapsed);
      logger.success('LOGIN', '══ Login finalizado com sucesso ══', { userId: user.id });
      logger.sep();

      return res.json({
        success: true,
        data: { id: user.id, email: user.email, token },
      });

    } catch (error) {
      const elapsed = Date.now() - t0;
      logger.error('LOGIN', `Erro não tratado após ${elapsed}ms`, { message: error.message });
      logger.error('LOGIN', 'Stack trace:\n' + error.stack);
      logger.sep();

      return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
  }

  // ══════════════════════════════════════════════════════════
  // ME — Valida sessão ativa
  // ══════════════════════════════════════════════════════════
  static async me(req, res) {
    const t0  = Date.now();
    const ctx = reqContext(req);

    logger.sep();
    logger.info('ME', 'Validação de sessão iniciada', ctx);

    try {
      if (!req.user) {
        logger.error('ME', 'req.user não definido — authMiddleware não executou corretamente');
        return res.status(401).json({ success: false, error: 'Não autenticado' });
      }

      const { id: userId, email: tokenEmail } = req.user;
      logger.info('ME', 'Token decodificado', { userId, tokenEmail });

      // ── Busca dados frescos do banco ──────────────────────
      // ⚠️  MELHORIA: sempre busca do banco para garantir que o usuário
      //     ainda existe e não foi desativado após o token ser emitido
      logger.db('Buscando dados atualizados do usuário...', { userId });
      const user = await User.findById(userId);

      if (!user) {
        logger.sec('Token válido mas usuário não existe mais no banco', { userId, ip: ctx.ip });
        return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
      }

      const elapsed = Date.now() - t0;
      logger.perf('ME', 'Validação completa', elapsed);
      logger.success('ME', 'Sessão validada com sucesso', { userId: user.id, email: user.email });
      logger.sep();

      return res.json({
        success: true,
        data: { id: user.id, email: user.email },
      });

    } catch (error) {
      logger.error('ME', 'Erro não tratado', { message: error.message });
      logger.error('ME', 'Stack:\n' + error.stack);
      logger.sep();

      return res.status(500).json({ success: false, error: 'Erro interno' });
    }
  }

  // ══════════════════════════════════════════════════════════
  // PROFILE
  // ══════════════════════════════════════════════════════════
  static async getProfile(req, res) {
    const t0  = Date.now();
    const ctx = reqContext(req);

    logger.sep();
    logger.info('PROFILE', 'Requisição recebida', ctx);

    try {
      const userId = req.user?.id;

      if (!userId) {
        logger.error('PROFILE', 'req.user.id não definido');
        return res.status(401).json({ success: false, error: 'Não autenticado' });
      }

      logger.db('Buscando perfil do usuário...', { userId });
      const user = await User.findById(userId);

      if (!user) {
        logger.warn('PROFILE', 'Usuário não encontrado', { userId });
        return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
      }

      const elapsed = Date.now() - t0;
      logger.perf('PROFILE', 'Perfil carregado', elapsed);
      logger.success('PROFILE', 'Perfil retornado com sucesso', { userId: user.id });
      logger.sep();

      return res.json({
        success: true,
        data: { id: user.id, email: user.email, criado_em: user.criado_em },
      });

    } catch (error) {
      logger.error('PROFILE', 'Erro não tratado', { message: error.message });
      logger.sep();

      return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
    }
  }
}

module.exports = AuthController;