// src/controllers/authController.js
// ============================================================
// 🏢 NexaSpark — Auth Controller v2.1 ANTI-ABUSE + COMPLETE PROFILE
//
// HISTÓRICO:
//   v1.0 → register/login/googleCallback/me/getProfile básicos
//   v2.0 → Sistema anti-abuse no register:
//           • Validação de CPF (dígitos verificadores)
//           • Lock por CPF hash — um CPF = uma conta free
//           • Device fingerprint silencioso
//           • IP tracking + flag de multi-account
//           • Conta bloqueada bloqueada no login
//           • Registro de abuse_flags automático
//           • Todos os logs enterprise mantidos + expandidos
//   v2.1 → completeProfile():
//           • Recebe CPF + data_nascimento de usuários Google
//           • Valida CPF matematicamente
//           • Verifica duplicata (outro usuário com mesmo CPF)
//           • Salva hash do CPF + data_nascimento no banco
//           • Marca cpf_cadastrado = TRUE
//           • Atualiza resposta do me() com cpf_cadastrado
//
// ⚠️  MÉTODO register() foi expandido — TODOS os outros
//     métodos (login, googleCallback, me, getProfile) são
//     IDÊNTICOS à v2.0 — zero regressão.
// ============================================================

const User     = require('../models/User');
const AuditLog = require('../models/AuditLog');
const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');

// ============================================================
// 🎨 LOGGER — idêntico à v2.0
// ============================================================
const chalk = {
  green:   (s) => `\x1b[32m${s}\x1b[0m`,
  red:     (s) => `\x1b[31m${s}\x1b[0m`,
  yellow:  (s) => `\x1b[33m${s}\x1b[0m`,
  blue:    (s) => `\x1b[34m${s}\x1b[0m`,
  cyan:    (s) => `\x1b[36m${s}\x1b[0m`,
  gray:    (s) => `\x1b[90m${s}\x1b[0m`,
  bold:    (s) => `\x1b[1m${s}\x1b[0m`,
  magenta: (s) => `\x1b[35m${s}\x1b[0m`,
  white:   (s) => `\x1b[37m${s}\x1b[0m`,
  bgRed:   (s) => `\x1b[41m\x1b[97m\x1b[1m ${s} \x1b[0m`,
  bgYellow:(s) => `\x1b[43m\x1b[30m\x1b[1m ${s} \x1b[0m`,
  bgCyan:  (s) => `\x1b[46m\x1b[30m\x1b[1m ${s} \x1b[0m`,
};

const logger = {
  info:    (scope, msg, data) => console.log(   chalk.blue(`ℹ️  [${scope}]`),    msg, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  success: (scope, msg, data) => console.log(   chalk.green(`✅ [${scope}]`),   msg, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  warn:    (scope, msg, data) => console.warn(  chalk.yellow(`⚠️  [${scope}]`),  msg, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  error:   (scope, msg, data) => console.error( chalk.red(`❌ [${scope}]`),     msg, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  perf:    (scope, label, ms) => console.log(   chalk.magenta(`⏱️  [${scope}]`), `${label} — ${chalk.bold(ms + 'ms')}`),
  event:   (scope, action, data) => console.log(chalk.cyan(`🎯 [${scope}]`),    `ACTION → ${action}`, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  audit:   (msg, data)        => console.log(   chalk.green(`🔏 [AUDIT]`),      msg, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  sec:     (msg, data)        => console.warn(  chalk.red(`🚨 [SECURITY]`),     msg, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  abuse:   (msg, data)        => console.warn(  chalk.bgYellow('🚩 ABUSE'),      chalk.yellow(msg), data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  profile: (msg, data)        => console.log(   chalk.bgCyan('👤 PROFILE'),      chalk.cyan(msg), data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  db:      (msg, data)        => console.log(   chalk.cyan(`🗄️  [DB]`),          msg, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  flow:    (scope, step, msg, data) => console.log(
    chalk.magenta(`🔀 [${scope}:FLOW]`),
    chalk.bold(`[STEP ${step}]`),
    chalk.white(msg),
    data !== undefined ? chalk.gray(JSON.stringify(data)) : ''
  ),
  sep:     () => console.log(chalk.gray('─'.repeat(60))),
  bigsep:  () => console.log(chalk.gray('═'.repeat(60))),
};

// ============================================================
// 🔒 BRUTE FORCE PROTECTION — idêntico à v2.0
// ============================================================
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS    = 15 * 60 * 1000;
const loginAttempts      = new Map();

function checkBruteForce(ip) {
  const now   = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    return { blocked: false, remaining: LOGIN_MAX_ATTEMPTS - 1 };
  }

  if (now - entry.firstAttempt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    return { blocked: false, remaining: LOGIN_MAX_ATTEMPTS - 1 };
  }

  entry.count++;
  const remaining = LOGIN_MAX_ATTEMPTS - entry.count;

  if (entry.count > LOGIN_MAX_ATTEMPTS) {
    const resetIn = Math.ceil((LOGIN_WINDOW_MS - (now - entry.firstAttempt)) / 1000 / 60);
    return { blocked: true, resetIn };
  }

  return { blocked: false, remaining };
}

function clearBruteForce(ip) {
  loginAttempts.delete(ip);
}

// ============================================================
// 🛡️  HELPERS — idênticos à v2.0
// ============================================================
function sanitizeForLog(obj) {
  if (!obj) return {};
  const clone = { ...obj };
  if (clone.password)      clone.password      = `[${clone.password?.length} chars]`;
  if (clone.senha_hash)    clone.senha_hash    = '[REDACTED]';
  if (clone.token)         clone.token         = clone.token?.substring(0, 20) + '...';
  if (clone.cpf_emissor)   clone.cpf_emissor   = `***.***.***-${String(clone.cpf_emissor).replace(/\D/g,'').slice(-2)}`;
  if (clone.cpf)           clone.cpf           = `***.***.***-${String(clone.cpf).replace(/\D/g,'').slice(-2)}`;
  return clone;
}

function reqContext(req) {
  return {
    ip:        req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    method:    req.method,
    path:      req.path,
    requestId: req.requestId || req.headers['x-request-id'] || `req_${Date.now()}`,
  };
}

function generateJWT(user, authProvider = 'local') {
  const payload = {
    id:             user.id,
    email:          user.email,
    role:           user.role          || 'user',
    auth_provider:  authProvider,
    nome:           user.nome          || null,
    avatar:         user.avatar        || null,
    plano:          user.plano         || 'free',
    plano_limite:   user.plano_limite  || 3,
    cpf_cadastrado: user.cpf_cadastrado || false,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '7d',
    issuer:    'nexaspark',
    audience:  'nexaspark-app',
  });
}

// ============================================================
// 🚩 HELPER — Calcula abuse score — idêntico à v2.0
// ============================================================
function calculateAbuseScore(checks) {
  const {
    cpfExists,
    deviceAccounts,
    ipAccountsLast7d,
  } = checks;

  let score   = 0;
  const flags = [];

  if (cpfExists) {
    score += 10;
    flags.push({ tipo: 'CPF_DUPLICATE', severidade: 3, pontos: 10 });
  }

  if (deviceAccounts >= 1) {
    const pts = deviceAccounts * 3;
    score += pts;
    flags.push({ tipo: 'DEVICE_DUPLICATE', severidade: deviceAccounts >= 2 ? 3 : 2, pontos: pts, contas: deviceAccounts });
  }

  if (ipAccountsLast7d >= 2) {
    const extras = ipAccountsLast7d - 1;
    const pts    = extras * 2;
    score += pts;
    flags.push({ tipo: 'IP_MULTI_ACCOUNT', severidade: ipAccountsLast7d >= 4 ? 3 : 2, pontos: pts, contas: ipAccountsLast7d });
  }

  return {
    score,
    flags,
    shouldBlock: cpfExists,
    isHighRisk:  score >= 5,
  };
}

// ============================================================
// 🚀 BANNER DE INICIALIZAÇÃO
// ============================================================
logger.bigsep();
console.log(chalk.bold(chalk.green('  🚀 [AuthController v2.1] Módulo Anti-Abuse + Complete Profile')));
console.log(chalk.gray('  Métodos: register (anti-abuse) | login | googleCallback | me | getProfile | completeProfile'));
console.log(chalk.gray('  v2.1: completeProfile() — CPF + data_nascimento para usuários Google'));
logger.bigsep();
logger.sep();

// ============================================================
// 🏛️  CLASS AuthController
// ============================================================
class AuthController {

  // ══════════════════════════════════════════════════════════
  // 📝 REGISTER v2.0 — idêntico — sem alteração
  // ══════════════════════════════════════════════════════════
  static async register(req, res) {
    const t0  = Date.now();
    const ctx = reqContext(req);

    logger.sep();
    logger.bigsep();
    console.log(chalk.bold(chalk.green('  📝 [REGISTER v2.0] Fluxo Anti-Abuse iniciado')));
    logger.bigsep();
    logger.info('REGISTER', 'Contexto da requisição', ctx);

    try {
      const {
        email,
        password,
        cpf_emissor        = null,
        nome_completo      = null,
        telefone           = null,
        device_fingerprint = null,
      } = req.body;

      logger.flow('REGISTER', 1, 'Normalizando entrada...');
      const emailNormalized = email?.trim().toLowerCase();
      const cpfDigitos      = cpf_emissor ? String(cpf_emissor).replace(/\D/g, '') : null;

      logger.info('REGISTER', 'Dados recebidos (sanitizados)', sanitizeForLog({
        email: emailNormalized, password, cpf_emissor,
        nome_completo, has_device_fp: !!device_fingerprint, ip: ctx.ip,
      }));

      logger.flow('REGISTER', 2, 'Validando campos obrigatórios...');

      if (!emailNormalized || !password) {
        return res.status(400).json({ success: false, error: 'Email e senha são obrigatórios', code: 'MISSING_FIELDS' });
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalized)) {
        return res.status(400).json({ success: false, error: 'Formato de email inválido', code: 'INVALID_EMAIL' });
      }

      if (password.length < 8) {
        return res.status(400).json({ success: false, error: 'A senha deve ter no mínimo 8 caracteres', code: 'WEAK_PASSWORD' });
      }

      logger.success('REGISTER', '✅ Validações básicas OK');

      logger.flow('REGISTER', 3, 'Validando CPF (dígitos verificadores)...');

      if (cpfDigitos) {
        const cpfValid = User.validateCpf(cpfDigitos);
        logger.info('REGISTER:CPF', 'Resultado da validação matemática', {
          length: cpfDigitos.length, valido: cpfValid, sufixo: cpfDigitos.slice(-2),
        });

        if (!cpfValid) {
          logger.sec('CPF inválido no cadastro', { sufixo: cpfDigitos.slice(-2), ip: ctx.ip, email: emailNormalized });
          return res.status(400).json({ success: false, error: 'CPF inválido. Verifique os dados informados.', code: 'INVALID_CPF' });
        }

        logger.success('REGISTER:CPF', '✅ CPF matematicamente válido');
      } else {
        logger.warn('REGISTER:CPF', '⚠️  CPF não informado — registro sem lock de CPF', { email: emailNormalized });
      }

      logger.flow('REGISTER', 4, 'Verificando email duplicado...');
      const tDb1 = Date.now();
      const existingUser = await User.findByEmail(emailNormalized);
      logger.perf('REGISTER', 'findByEmail()', Date.now() - tDb1);

      if (existingUser) {
        logger.sec('Email já cadastrado', { email: emailNormalized, ip: ctx.ip });
        return res.status(409).json({ success: false, error: 'Este email já está cadastrado', code: 'EMAIL_DUPLICATE' });
      }

      logger.flow('REGISTER', 5, '🔒 Verificando CPF duplicado (lock primário anti-abuse)...');

      let cpfExistingAccount = null;
      if (cpfDigitos) {
        const tCpf = Date.now();
        cpfExistingAccount = await User.findByCpfHash(cpfDigitos);
        logger.perf('REGISTER:ABUSE', 'findByCpfHash()', Date.now() - tCpf);

        if (cpfExistingAccount) {
          await User.updateAbuseScore(cpfExistingAccount.id, {
            increment: 3, tipo: 'CPF_DUPLICATE',
            detalhe:   `Tentativa de criar segunda conta com mesmo CPF. Email novo: ${emailNormalized}`,
            ip:        ctx.ip,
            metadata:  { email_novo: emailNormalized, email_existente: cpfExistingAccount.email, requestId: ctx.requestId },
          });

          await AuditLog.create({
            usuario_id: null,
            acao:       AuditLog.ACTIONS?.SECURITY_ALERT || 'SECURITY_ALERT',
            detalhe:    `Bloqueio por CPF duplicado. Email tentado: ${emailNormalized}`,
            ip_address: ctx.ip, user_agent: ctx.userAgent,
            metadata:   { tipo: 'CPF_DUPLICATE', email_novo: emailNormalized, conta_existente: cpfExistingAccount.id, requestId: ctx.requestId },
          });

          logger.abuse('⛔ REGISTRO BLOQUEADO — CPF duplicado', {
            email_tentado: emailNormalized, conta_existente: cpfExistingAccount.email, ip: ctx.ip,
          });

          return res.status(409).json({
            success: false,
            error:   'Não foi possível criar a conta com os dados informados. Verifique suas informações ou entre em contato com o suporte.',
            code:    'REGISTRATION_BLOCKED',
          });
        }

        logger.success('REGISTER:ABUSE', '✅ CPF disponível — não encontrado no sistema');
      }

      logger.flow('REGISTER', 6, '🔍 Verificando device fingerprint...');
      let deviceAccounts = 0;
      if (device_fingerprint) {
        const tFp = Date.now();
        const existingFpAccounts = await User.findByDeviceFingerprint(device_fingerprint);
        logger.perf('REGISTER:ABUSE', 'findByDeviceFingerprint()', Date.now() - tFp);
        deviceAccounts = existingFpAccounts.length;
        if (deviceAccounts >= 1) {
          logger.abuse(`⚠️  Device fingerprint em ${deviceAccounts} conta(s)`, {
            fp_prefix: device_fingerprint.substring(0, 8) + '...', ip: ctx.ip,
          });
        }
      }

      logger.flow('REGISTER', 7, '🌐 Verificando IP multi-account...');
      const tIp = Date.now();
      const ipAccountsLast7d = await User.countByIpLast7Days(ctx.ip);
      logger.perf('REGISTER:ABUSE', 'countByIpLast7Days()', Date.now() - tIp);
      if (ipAccountsLast7d >= 2) {
        logger.abuse(`⚠️  IP com ${ipAccountsLast7d} conta(s) nos últimos 7 dias`, { ip: ctx.ip, total: ipAccountsLast7d });
      }

      logger.flow('REGISTER', 8, '📊 Calculando abuse score...');
      const abuseCheck = calculateAbuseScore({ cpfExists: !!cpfExistingAccount, deviceAccounts, ipAccountsLast7d });
      logger.info('REGISTER:ABUSE', 'Resultado da análise anti-abuse', {
        score: abuseCheck.score, flags: abuseCheck.flags, shouldBlock: abuseCheck.shouldBlock,
      });

      logger.flow('REGISTER', 9, 'Gerando hash bcrypt (rounds: 12)...');
      const tHash      = Date.now();
      const senha_hash = await bcrypt.hash(password, 12);
      logger.perf('REGISTER', 'bcrypt.hash()', Date.now() - tHash);

      logger.flow('REGISTER', 10, '🗄️  Inserindo usuário com campos anti-abuse...');
      const tDb2   = Date.now();
      const newUser = await User.create({
        email:             emailNormalized,
        senha_hash,
        cpf_emissor:       cpfDigitos,
        nome_completo:     nome_completo     || null,
        telefone:          telefone          || null,
        device_fingerprint: device_fingerprint || null,
        ip_cadastro:       ctx.ip,
      });
      logger.perf('REGISTER', 'User.create()', Date.now() - tDb2);
      logger.success('REGISTER', '✅ Usuário criado', { id: newUser.id, email: newUser.email });

      if (abuseCheck.score > 0) {
        await User.updateAbuseScore(newUser.id, {
          increment: abuseCheck.score,
          tipo:      abuseCheck.flags[0]?.tipo || 'MULTI_SIGNAL',
          detalhe:   `Score inicial: ${abuseCheck.score}`,
          ip:        ctx.ip,
          metadata:  { flags: abuseCheck.flags, requestId: ctx.requestId },
        });
      }

      logger.flow('REGISTER', 11, 'Gerando JWT com plano...');
      const token = generateJWT(newUser, 'local');

      logger.flow('REGISTER', 12, 'Registrando auditoria...');
      await AuditLog.create({
        usuario_id: newUser.id,
        acao:       AuditLog.ACTIONS?.REGISTER || 'REGISTER',
        detalhe:    `Registro v2.0: ${emailNormalized}`,
        ip_address: ctx.ip, user_agent: ctx.userAgent,
        metadata:   {
          auth_provider: 'local', hasCpf: !!cpfDigitos, hasDevice: !!device_fingerprint,
          deviceAccounts, ipAccountsLast7d, abuseScore: abuseCheck.score,
          plano: newUser.plano, requestId: ctx.requestId,
        },
      });

      const elapsed = Date.now() - t0;
      logger.perf('REGISTER', 'Fluxo completo v2.0', elapsed);
      logger.success('REGISTER', '══ REGISTER v2.0 CONCLUÍDO ══', { userId: newUser.id, elapsed: elapsed + 'ms' });
      logger.sep();

      return res.status(201).json({
        success: true,
        message: 'Conta criada com sucesso',
        data: {
          id:           newUser.id,
          email:        newUser.email,
          plano:        newUser.plano,
          plano_limite: newUser.plano_limite,
          token,
        },
      });

    } catch (error) {
      logger.error('REGISTER', `Erro não tratado — ${error.message}`, { code: error.code });
      console.error(chalk.red(`❌ [REGISTER:STACK]`), error.stack);
      logger.sep();
      return res.status(500).json({ success: false, error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' });
    }
  }

  // ══════════════════════════════════════════════════════════
  // 🔑 LOGIN v2.0 — idêntico à v2.0
  // ══════════════════════════════════════════════════════════
  static async login(req, res) {
    const t0  = Date.now();
    const ctx = reqContext(req);

    logger.sep();
    logger.bigsep();
    console.log(chalk.bold(chalk.green('  🔑 [LOGIN v2.0] Fluxo iniciado')));
    logger.bigsep();

    try {
      const { email, password } = req.body;
      const emailNormalized = email?.trim().toLowerCase();

      logger.flow('LOGIN', 1, 'Normalizando + brute force check...');
      const bruteCheck = checkBruteForce(ctx.ip);

      if (bruteCheck.blocked) {
        return res.status(429).json({
          success: false,
          error:   `Muitas tentativas. Tente novamente em ${bruteCheck.resetIn} minuto(s).`,
          code:    'BRUTE_FORCE_BLOCKED',
        });
      }

      if (!emailNormalized || !password) {
        return res.status(400).json({ success: false, error: 'Email e senha são obrigatórios', code: 'MISSING_FIELDS' });
      }

      logger.flow('LOGIN', 2, 'Buscando usuário no banco...');
      const tDb = Date.now();
      const user = await User.findByEmail(emailNormalized);
      logger.perf('LOGIN', 'findByEmail()', Date.now() - tDb);

      if (!user) {
        logger.sec('Login falhou — usuário não encontrado', { email: emailNormalized, ip: ctx.ip });
        return res.status(401).json({ success: false, error: 'Credenciais inválidas', code: 'INVALID_CREDENTIALS' });
      }

      if (user.bloqueado) {
        logger.sec('⛔ Login em conta bloqueada', { userId: user.id, email: user.email, ip: ctx.ip });
        return res.status(403).json({
          success: false,
          error:   'Esta conta está temporariamente suspensa. Entre em contato com o suporte.',
          code:    'ACCOUNT_BLOCKED',
        });
      }

      logger.flow('LOGIN', 3, 'Verificando tipo de conta...');

      if (!user.senha_hash && user.auth_provider === 'google') {
        return res.status(401).json({
          success:  false,
          error:    'Esta conta foi criada com Google. Use o botão "Continuar com Google".',
          code:     'OAUTH_ACCOUNT_NO_PASSWORD',
          provider: 'google',
        });
      }

      logger.flow('LOGIN', 4, 'Comparando hash bcrypt...');
      const tBcrypt = Date.now();
      const isPasswordValid = await bcrypt.compare(password, user.senha_hash);
      logger.perf('LOGIN', 'bcrypt.compare()', Date.now() - tBcrypt);

      if (!isPasswordValid) {
        logger.sec('Senha inválida', { userId: user.id, ip: ctx.ip });
        return res.status(401).json({ success: false, error: 'Credenciais inválidas', code: 'INVALID_CREDENTIALS' });
      }

      clearBruteForce(ctx.ip);
      const token = generateJWT(user, user.auth_provider || 'local');

      await AuditLog.create({
        usuario_id: user.id,
        acao:       AuditLog.ACTIONS?.LOGIN || 'LOGIN',
        detalhe:    'Login via plataforma web',
        ip_address: ctx.ip, user_agent: ctx.userAgent,
        metadata:   { auth_provider: 'local', plano: user.plano, requestId: ctx.requestId },
      });

      const elapsed = Date.now() - t0;
      logger.perf('LOGIN', 'Fluxo completo', elapsed);
      logger.success('LOGIN', '══ LOGIN CONCLUÍDO ══', { userId: user.id, elapsed: elapsed + 'ms' });
      logger.sep();

      return res.json({
        success: true,
        data:    { id: user.id, email: user.email, plano: user.plano, plano_limite: user.plano_limite, token },
      });

    } catch (error) {
      logger.error('LOGIN', `Erro — ${error.message}`);
      console.error(chalk.red(`❌ [LOGIN:STACK]`), error.stack);
      logger.sep();
      return res.status(500).json({ success: false, error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' });
    }
  }

  // ══════════════════════════════════════════════════════════
  // 🌐 GOOGLE CALLBACK — idêntico à v2.0
  // ══════════════════════════════════════════════════════════
  static async googleCallback(req, res) {
    const t0  = Date.now();
    const ctx = reqContext(req);

    logger.sep();
    console.log(chalk.bold(chalk.green('  🌐 [GOOGLE_CALLBACK v2.1] Fluxo iniciado')));

    try {
      if (!req.user) {
        logger.error('GOOGLE_CALLBACK', 'req.user não definido');
        const frontendUrl = process.env.FRONTEND_URL || 'https://nexaspark.com.br';
        return res.redirect(`${frontendUrl}/login?error=oauth_failed`);
      }

      const user = req.user;

      if (!user.id || !user.email) {
        const frontendUrl = process.env.FRONTEND_URL || 'https://nexaspark.com.br';
        return res.redirect(`${frontendUrl}/login?error=oauth_invalid_user`);
      }

      const userFromDb = await User.findByEmail(user.email);
      if (userFromDb?.bloqueado) {
        logger.sec('⛔ Login Google em conta bloqueada', { userId: user.id, email: user.email });
        const frontendUrl = process.env.FRONTEND_URL || 'https://nexaspark.com.br';
        return res.redirect(`${frontendUrl}/login?error=account_blocked`);
      }

      // ✅ v2.1: inclui cpf_cadastrado no JWT do Google
      const userWithCpfFlag = {
        ...user,
        cpf_cadastrado: userFromDb?.cpf_cadastrado || false,
      };

      const token = generateJWT(userWithCpfFlag, 'google');

      await AuditLog.create({
        usuario_id: user.id,
        acao:       'LOGIN_GOOGLE',
        detalhe:    `Login via Google OAuth — ${user.email}`,
        ip_address: ctx.ip, user_agent: ctx.userAgent,
        metadata:   {
          auth_provider:  'google',
          cpf_cadastrado: userFromDb?.cpf_cadastrado || false,
          requestId:      ctx.requestId,
        },
      });

      const frontendUrl = process.env.FRONTEND_URL || 'https://nexaspark.com.br';
      logger.success('GOOGLE_CALLBACK', '✅ OAuth Google v2.1 concluído', {
        userId: user.id, cpf_cadastrado: userFromDb?.cpf_cadastrado || false,
      });
      logger.sep();
      return res.redirect(`${frontendUrl}/auth/callback?token=${token}`);

    } catch (error) {
      logger.error('GOOGLE_CALLBACK', `Erro — ${error.message}`);
      const frontendUrl = process.env.FRONTEND_URL || 'https://nexaspark.com.br';
      return res.redirect(`${frontendUrl}/login?error=oauth_server_error`);
    }
  }

  // ══════════════════════════════════════════════════════════
  // 👤 ME v2.1 — adiciona cpf_cadastrado na resposta
  // ══════════════════════════════════════════════════════════
  static async me(req, res) {
    const t0  = Date.now();
    const ctx = reqContext(req);
    logger.sep();
    logger.info('ME', 'Validação de sessão iniciada', ctx);

    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Não autenticado', code: 'NOT_AUTHENTICATED' });
      }

      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'Usuário não encontrado', code: 'USER_NOT_FOUND' });
      }

      if (user.bloqueado) {
        logger.sec('⛔ Sessão de conta bloqueada', { userId: user.id });
        return res.status(403).json({
          success: false,
          error:   'Conta suspensa. Entre em contato com o suporte.',
          code:    'ACCOUNT_BLOCKED',
        });
      }

      logger.perf('ME', 'Validação completa', Date.now() - t0);
      logger.success('ME', '✅ Sessão válida', { userId: user.id, cpf_cadastrado: user.cpf_cadastrado });
      logger.sep();

      // ✅ v2.1: retorna cpf_cadastrado — frontend usa para exibir modal
      return res.json({
        success: true,
        data: {
          id:             user.id,
          email:          user.email,
          nome:           user.nome          || null,
          auth_provider:  req.user.auth_provider || 'local',
          plano:          user.plano         || 'free',
          plano_limite:   user.plano_limite  || 3,
          cpf_cadastrado: user.cpf_cadastrado || false,
          criado_em:      user.criado_em,
        },
      });

    } catch (error) {
      logger.error('ME', `Erro — ${error.message}`);
      logger.sep();
      return res.status(500).json({ success: false, error: 'Erro interno', code: 'INTERNAL_ERROR' });
    }
  }

  // ══════════════════════════════════════════════════════════
  // 📋 PROFILE v2.1 — inclui cpf_cadastrado
  // ══════════════════════════════════════════════════════════
  static async getProfile(req, res) {
    const ctx = reqContext(req);
    logger.sep();
    logger.info('PROFILE', 'Requisição recebida', ctx);

    try {
      const user = await User.findById(req.user?.id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'Usuário não encontrado', code: 'USER_NOT_FOUND' });
      }

      logger.success('PROFILE', '✅ Perfil retornado', { userId: user.id });
      logger.sep();

      return res.json({
        success: true,
        data: {
          id:             user.id,
          email:          user.email,
          nome:           user.nome          || null,
          nome_completo:  user.nome_completo || null,
          avatar:         user.avatar        || null,
          plano:          user.plano         || 'free',
          plano_limite:   user.plano_limite  || 3,
          cpf_cadastrado: user.cpf_cadastrado || false,
          criado_em:      user.criado_em,
          auth_provider:  req.user?.auth_provider || 'local',
        },
      });

    } catch (error) {
      logger.error('PROFILE', `Erro — ${error.message}`);
      logger.sep();
      return res.status(500).json({ success: false, error: 'Erro interno', code: 'INTERNAL_ERROR' });
    }
  }

  // ══════════════════════════════════════════════════════════
  // ✅ v2.1 — COMPLETE PROFILE
  //
  // Rota: POST /api/auth/complete-profile
  // Auth: JWT obrigatório (authMiddleware)
  //
  // Fluxo:
  //   1. Valida campos obrigatórios (cpf + data_nascimento)
  //   2. Valida CPF matematicamente (dígitos verificadores)
  //   3. Verifica se CPF já está vinculado a outra conta
  //   4. Salva hash do CPF + data_nascimento no banco
  //   5. Marca cpf_cadastrado = TRUE
  //   6. Auditoria
  //   7. Retorna novo JWT com cpf_cadastrado = true
  //
  // Chamado por: CompleteProfileModal.tsx
  // Disparado quando: usuário Google tenta acessar o dashboard
  // sem CPF cadastrado (cpf_cadastrado === false)
  // ══════════════════════════════════════════════════════════
  static async completeProfile(req, res) {
    const t0  = Date.now();
    const ctx = reqContext(req);

    logger.sep();
    logger.bigsep();
    console.log(chalk.bold(chalk.green('  👤 [COMPLETE_PROFILE v2.1] Fluxo iniciado')));
    logger.bigsep();
    logger.profile('Completando perfil de usuário Google', {
      userId:    req.user?.id,
      email:     req.user?.email,
      requestId: ctx.requestId,
    });

    try {
      const userId = req.user?.id;

      if (!userId) {
        logger.sec('completeProfile sem userId no token', { requestId: ctx.requestId });
        return res.status(401).json({ success: false, error: 'Não autenticado', code: 'NOT_AUTHENTICATED' });
      }

      const { cpf, data_nascimento } = req.body;

      // ── STEP 1: Valida campos obrigatórios ────────────────
      logger.flow('COMPLETE_PROFILE', 1, 'Validando campos obrigatórios...');

      if (!cpf || !data_nascimento) {
        logger.warn('COMPLETE_PROFILE', 'Campos obrigatórios ausentes', { hasCpf: !!cpf, hasData: !!data_nascimento });
        return res.status(400).json({
          success: false,
          error:   'CPF e data de nascimento são obrigatórios',
          code:    'MISSING_FIELDS',
        });
      }

      const cpfDigitos = String(cpf).replace(/\D/g, '');
      logger.profile('Dados recebidos', sanitizeForLog({ cpf, data_nascimento }));

      // ── STEP 2: Valida CPF matematicamente ───────────────
      logger.flow('COMPLETE_PROFILE', 2, 'Validando CPF (dígitos verificadores)...');

      const cpfValid = User.validateCpf(cpfDigitos);
      logger.info('COMPLETE_PROFILE:CPF', 'Resultado validação matemática', {
        length: cpfDigitos.length, valido: cpfValid, sufixo: cpfDigitos.slice(-2),
      });

      if (!cpfValid) {
        logger.sec('CPF inválido no completeProfile', {
          sufixo: cpfDigitos.slice(-2), ip: ctx.ip, userId,
          alerta: 'Pode ser CPF falso, gerado ou erro de digitação',
        });
        return res.status(400).json({
          success: false,
          error:   'CPF inválido. Verifique os números informados.',
          code:    'INVALID_CPF',
        });
      }

      logger.success('COMPLETE_PROFILE:CPF', '✅ CPF matematicamente válido');

      // ── STEP 3: Verifica duplicata ────────────────────────
      // Um CPF = uma conta. Se outro usuário já tem esse CPF,
      // bloqueia sem revelar qual conta possui o CPF (enum. attack).
      logger.flow('COMPLETE_PROFILE', 3, '🔒 Verificando duplicata de CPF...');

      const tCpf = Date.now();
      const existingAccount = await User.findByCpfHash(cpfDigitos);
      logger.perf('COMPLETE_PROFILE', 'findByCpfHash()', Date.now() - tCpf);

      if (existingAccount && existingAccount.id !== userId) {
        logger.abuse('⛔ CPF já vinculado a outra conta — bloqueando completeProfile', {
          userId_tentando:  userId,
          cpf_sufixo:       cpfDigitos.slice(-2),
          ip:               ctx.ip,
          requestId:        ctx.requestId,
        });

        // Incrementa abuse score na conta que tentou usar CPF duplicado
        await User.updateAbuseScore(userId, {
          increment: 5,
          tipo:      'CPF_DUPLICATE_COMPLETE_PROFILE',
          detalhe:   `Tentou vincular CPF já existente em outra conta via completeProfile`,
          ip:        ctx.ip,
          metadata:  { requestId: ctx.requestId },
        });

        return res.status(409).json({
          success: false,
          error:   'Não foi possível vincular os dados informados. Verifique as informações ou entre em contato com o suporte.',
          code:    'CPF_ALREADY_REGISTERED',
        });
      }

      logger.success('COMPLETE_PROFILE', '✅ CPF disponível para vinculação');

      // ── STEP 4: Valida data de nascimento ─────────────────
      logger.flow('COMPLETE_PROFILE', 4, 'Validando data de nascimento...');

      const dataNasc     = new Date(data_nascimento);
      const hoje         = new Date();
      const idadeMinima  = new Date(hoje.getFullYear() - 16, hoje.getMonth(), hoje.getDate());
      const idadeMaxima  = new Date(hoje.getFullYear() - 120, hoje.getMonth(), hoje.getDate());

      if (isNaN(dataNasc.getTime())) {
        return res.status(400).json({ success: false, error: 'Data de nascimento inválida', code: 'INVALID_DATE' });
      }

      if (dataNasc > idadeMinima) {
        return res.status(400).json({
          success: false,
          error:   'É necessário ter pelo menos 16 anos para usar a plataforma.',
          code:    'UNDERAGE',
        });
      }

      if (dataNasc < idadeMaxima) {
        return res.status(400).json({ success: false, error: 'Data de nascimento inválida', code: 'INVALID_DATE' });
      }

      logger.success('COMPLETE_PROFILE', '✅ Data de nascimento válida', {
        data_nascimento, idade: hoje.getFullYear() - dataNasc.getFullYear(),
      });

      // ── STEP 5: Salva no banco ────────────────────────────
      logger.flow('COMPLETE_PROFILE', 5, '🗄️  Salvando CPF hash + data_nascimento...');

      const tDb = Date.now();

      // User.saveCpfAndBirthdate() deve:
      //   UPDATE users SET
      //     cpf_emissor_hash = SHA256($cpfDigitos),
      //     data_nascimento  = $data_nascimento,
      //     cpf_cadastrado   = TRUE,
      //     atualizado_em    = NOW()
      //   WHERE id = $userId
      const updatedUser = await User.saveCpfAndBirthdate(userId, cpfDigitos, data_nascimento);

      logger.perf('COMPLETE_PROFILE', 'User.saveCpfAndBirthdate()', Date.now() - tDb);
      logger.success('COMPLETE_PROFILE', '✅ CPF e data de nascimento salvos', {
        userId, cpf_sufixo: cpfDigitos.slice(-2), data_nascimento,
        cpf_cadastrado: true,
      });

      // ── STEP 6: Auditoria ─────────────────────────────────
      logger.flow('COMPLETE_PROFILE', 6, 'Registrando auditoria...');

      await AuditLog.create({
        usuario_id: userId,
        acao:       'PROFILE_COMPLETED',
        detalhe:    `Perfil completado via Google OAuth — CPF vinculado`,
        ip_address: ctx.ip,
        user_agent: ctx.userAgent,
        metadata:   {
          cpf_sufixo:     cpfDigitos.slice(-2),
          data_nascimento,
          auth_provider:  'google',
          requestId:      ctx.requestId,
        },
      });

      logger.audit('COMPLETE_PROFILE — perfil Google completado', {
        userId, email: req.user?.email, cpf_sufixo: cpfDigitos.slice(-2),
      });

      // ── STEP 7: Gera novo JWT com cpf_cadastrado = true ───
      logger.flow('COMPLETE_PROFILE', 7, 'Gerando novo JWT com cpf_cadastrado = true...');

      const userForJwt = {
        ...req.user,
        cpf_cadastrado: true,
        plano:          updatedUser?.plano         || req.user.plano         || 'free',
        plano_limite:   updatedUser?.plano_limite  || req.user.plano_limite  || 3,
      };

      const newToken = generateJWT(userForJwt, req.user.auth_provider || 'google');

      const elapsed = Date.now() - t0;
      logger.perf('COMPLETE_PROFILE', 'Fluxo completo', elapsed);
      logger.success('COMPLETE_PROFILE', '══ PERFIL COMPLETADO ══', {
        userId, elapsed: elapsed + 'ms', cpf_cadastrado: true,
      });
      logger.sep();

      return res.json({
        success: true,
        message: 'Perfil completado com sucesso. Bem-vindo à NexaSpark.',
        data: {
          cpf_cadastrado: true,
          token:          newToken, // frontend atualiza o token no localStorage
        },
      });

    } catch (error) {
      const elapsed = Date.now() - t0;
      logger.error('COMPLETE_PROFILE', `Erro não tratado após ${elapsed}ms`, {
        message: error.message, code: error.code,
      });
      console.error(chalk.red(`❌ [COMPLETE_PROFILE:STACK]`), error.stack);
      logger.sep();
      return res.status(500).json({ success: false, error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' });
    }
  }
}

module.exports = AuthController;