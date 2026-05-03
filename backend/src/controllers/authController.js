// src/controllers/authController.js
// ============================================================
// 🏢 NexaSpark — Auth Controller | Enterprise Grade
// Certificação Digital
//
// Métodos:
//   register       → Cria conta local (email + senha)
//   login          → Autentica conta local, retorna JWT
//   googleCallback → Processa retorno OAuth Google, retorna JWT
//   me             → Valida sessão ativa via JWT
//   getProfile     → Retorna perfil completo do usuário
//
// ⚠️  ADIÇÃO: googleCallback integrado ao fluxo Passport.
//     JWT gerado com auth_provider para rastreabilidade.
//     Auditoria via AuditLog.ACTIONS para consistência.
// ============================================================

const User     = require('../models/User');
const AuditLog = require('../models/AuditLog');
const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');

// ============================================================
// 🎨 LOGGER — ANSI colors | Padrão NexaSpark
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
// 🔒 BRUTE FORCE PROTECTION — In-memory
//
// ⚠️  LIMITAÇÃO CONHECIDA: o Map reseta se o Railway reiniciar
//     o container. Para produção crítica, substitua por Redis.
//     Registrado aqui intencionalmente para visibilidade.
//     O rate limiter do app.js é a primeira linha de defesa.
//     Este é o segundo nível, por controller.
// ============================================================
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS    = 15 * 60 * 1000; // 15 minutos
const loginAttempts      = new Map();       // ip → { count, firstAttempt }

console.log(chalk.cyan(`ℹ️  [AuthController:BRUTEFORCE]`), chalk.gray(JSON.stringify({
  maxAttempts: LOGIN_MAX_ATTEMPTS,
  windowMs:    LOGIN_WINDOW_MS,
  windowMin:   LOGIN_WINDOW_MS / 1000 / 60,
  storage:     'in-memory Map (reseta no restart)',
  note:        'Para HA, migre para Redis',
})));

function checkBruteForce(ip) {
  const now   = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    console.log(chalk.cyan(`ℹ️  [BRUTEFORCE]`), `Primeira tentativa registrada`, chalk.gray(JSON.stringify({ ip, remaining: LOGIN_MAX_ATTEMPTS - 1 })));
    return { blocked: false, remaining: LOGIN_MAX_ATTEMPTS - 1 };
  }

  // Janela expirou — reseta contador
  if (now - entry.firstAttempt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    console.log(chalk.cyan(`ℹ️  [BRUTEFORCE]`), `Janela expirada — contador resetado`, chalk.gray(JSON.stringify({ ip })));
    return { blocked: false, remaining: LOGIN_MAX_ATTEMPTS - 1 };
  }

  entry.count++;
  const remaining = LOGIN_MAX_ATTEMPTS - entry.count;

  if (entry.count > LOGIN_MAX_ATTEMPTS) {
    const resetIn = Math.ceil((LOGIN_WINDOW_MS - (now - entry.firstAttempt)) / 1000 / 60);
    console.warn(chalk.red(`🚨 [BRUTEFORCE]`), `IP BLOQUEADO`, chalk.gray(JSON.stringify({ ip, count: entry.count, resetIn })));
    return { blocked: true, resetIn };
  }

  console.log(chalk.yellow(`⚠️  [BRUTEFORCE]`), `Tentativa registrada`, chalk.gray(JSON.stringify({ ip, count: entry.count, remaining })));
  return { blocked: false, remaining };
}

function clearBruteForce(ip) {
  const hadEntry = loginAttempts.has(ip);
  loginAttempts.delete(ip);
  if (hadEntry) {
    console.log(chalk.green(`✅ [BRUTEFORCE]`), `Contador limpo após login bem-sucedido`, chalk.gray(JSON.stringify({ ip })));
  }
}

// ============================================================
// 🛡️  HELPERS
// ============================================================

// Sanitiza objetos para log — nunca expõe senhas ou tokens
function sanitizeForLog(obj) {
  if (!obj) return {};
  const clone = { ...obj };
  if (clone.password)   clone.password   = `[${clone.password.length} chars]`;
  if (clone.senha_hash) clone.senha_hash = '[REDACTED]';
  if (clone.token)      clone.token      = clone.token.substring(0, 20) + '...';
  return clone;
}

// Extrai contexto padronizado da requisição
function reqContext(req) {
  return {
    ip:        req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    method:    req.method,
    path:      req.path,
    requestId: req.requestId || req.headers['x-request-id'] || `req_${Date.now()}`,
  };
}

// Gera JWT com payload padronizado
// ⚠️  Centralizado aqui para garantir consistência entre
//     login local e OAuth — mesmo formato, mesma expiração
function generateJWT(user, authProvider = 'local') {
  const payload = {
    id:            user.id,
    email:         user.email,
    role:          user.role || 'user',
    auth_provider: authProvider,
    // ⚠️  nome e avatar no token evitam query extra no frontend
    //     para exibir nome/avatar do usuário logado
    nome:          user.nome   || null,
    avatar:        user.avatar || null,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '7d',
    issuer:    'nexaspark',
    audience:  'nexaspark-app',
  });

  console.log(chalk.cyan(`ℹ️  [JWT:GENERATED]`), chalk.gray(JSON.stringify({
    userId:       user.id,
    email:        user.email,
    authProvider,
    prefix:       token.substring(0, 25) + '...',
    size:         token.length,
    expiresIn:    '7d',
    issuer:       'nexaspark',
  })));

  return token;
}

// ============================================================
// 🚀 BANNER DE INICIALIZAÇÃO DO MÓDULO
// ============================================================
logger.bigsep();
console.log(chalk.bold(chalk.green('  🚀 [AuthController] Módulo inicializado')));
console.log(chalk.gray(`  Métodos: register | login | googleCallback | me | getProfile`));
console.log(chalk.gray(`  JWT: 7d | issuer: nexaspark | audience: nexaspark-app`));
logger.bigsep();
logger.sep();

// ============================================================
// 🏛️  CLASS AuthController
// ============================================================
class AuthController {

  // ══════════════════════════════════════════════════════════
  // 📝 REGISTER — Cria conta local
  // ══════════════════════════════════════════════════════════
  static async register(req, res) {
    const t0  = Date.now();
    const ctx = reqContext(req);

    logger.sep();
    logger.bigsep();
    console.log(chalk.bold(chalk.green('  📝 [REGISTER] Fluxo iniciado')));
    logger.bigsep();
    logger.info('REGISTER', 'Contexto da requisição', ctx);

    try {
      const { email, password } = req.body;

      // ── STEP 1: Normalização de entrada ───────────────────
      logger.flow('REGISTER', 1, 'Normalizando entrada...');
      const emailNormalized = email?.trim().toLowerCase();

      logger.info('REGISTER', 'Dados recebidos (sanitizados)', sanitizeForLog({ email: emailNormalized, password }));
      console.log(chalk.cyan(`ℹ️  [REGISTER:INPUT]`), chalk.gray(JSON.stringify({
        emailRaw:        email,
        emailNormalized,
        emailChanged:    email !== emailNormalized,
        passwordLength:  password?.length || 0,
        requestId:       ctx.requestId,
      })));

      // ── STEP 2: Validações ────────────────────────────────
      logger.flow('REGISTER', 2, 'Validando campos...');

      if (!emailNormalized || !password) {
        logger.warn('REGISTER', 'Campos obrigatórios ausentes', { hasEmail: !!email, hasPassword: !!password });
        return res.status(400).json({ success: false, error: 'Email e senha são obrigatórios', code: 'MISSING_FIELDS' });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailNormalized)) {
        logger.warn('REGISTER', 'Formato de email inválido', { email: emailNormalized });
        return res.status(400).json({ success: false, error: 'Formato de email inválido', code: 'INVALID_EMAIL' });
      }

      if (password.length < 8) {
        logger.warn('REGISTER', 'Senha fraca', { length: password.length, minimum: 8 });
        return res.status(400).json({ success: false, error: 'A senha deve ter no mínimo 8 caracteres', code: 'WEAK_PASSWORD' });
      }

      logger.success('REGISTER', 'Validações OK', { email: emailNormalized });

      // ── STEP 3: Verifica duplicata ────────────────────────
      logger.flow('REGISTER', 3, 'Verificando email duplicado no banco...');
      logger.db('SELECT users WHERE email', { email: emailNormalized });

      const tDb1 = Date.now();
      const existingUser = await User.findByEmail(emailNormalized);
      logger.perf('REGISTER', 'findByEmail()', Date.now() - tDb1);

      if (existingUser) {
        logger.sec('Tentativa de registro com email já cadastrado', {
          email:    emailNormalized,
          ip:       ctx.ip,
          userId:   existingUser.id,
          provider: existingUser.auth_provider || 'local',
        });
        return res.status(409).json({ success: false, error: 'Este email já está cadastrado', code: 'EMAIL_DUPLICATE' });
      }

      logger.info('REGISTER', 'Email disponível ✅', { email: emailNormalized });

      // ── STEP 4: Hash da senha ─────────────────────────────
      logger.flow('REGISTER', 4, 'Gerando hash bcrypt (rounds: 12)...');
      const tHash = Date.now();
      const senha_hash = await bcrypt.hash(password, 12);
      logger.perf('REGISTER', 'bcrypt.hash()', Date.now() - tHash);
      logger.success('REGISTER', 'Hash bcrypt gerado', { rounds: 12, hashLength: senha_hash.length });

      // ── STEP 5: Cria usuário ──────────────────────────────
      logger.flow('REGISTER', 5, 'Inserindo usuário no banco...');
      logger.db('INSERT INTO users', { email: emailNormalized });

      const tDb2  = Date.now();
      const newUser = await User.create({ email: emailNormalized, senha_hash });
      logger.perf('REGISTER', 'User.create()', Date.now() - tDb2);
      logger.success('REGISTER', 'Usuário criado no banco ✅', { id: newUser.id, email: newUser.email });

      // ── STEP 6: Gera JWT ──────────────────────────────────
      logger.flow('REGISTER', 6, 'Gerando JWT...');
      const token = generateJWT(newUser, 'local');

      // ── STEP 7: Auditoria ─────────────────────────────────
      logger.flow('REGISTER', 7, 'Registrando auditoria...');
      logger.audit('REGISTER — novo usuário', { userId: newUser.id, email: newUser.email, ip: ctx.ip });

      await AuditLog.create({
        usuario_id: newUser.id,
        acao:       AuditLog.ACTIONS?.REGISTER || 'REGISTER',
        detalhe:    `Registro via plataforma web: ${emailNormalized}`,
        ip_address: ctx.ip,
        user_agent: ctx.userAgent,
        metadata:   { auth_provider: 'local', requestId: ctx.requestId },
      });

      // ── STEP 8: Resposta ──────────────────────────────────
      const elapsed = Date.now() - t0;
      logger.perf('REGISTER', 'Fluxo completo', elapsed);
      logger.success('REGISTER', '══ REGISTER CONCLUÍDO ══', { userId: newUser.id, elapsed: elapsed + 'ms' });
      logger.sep();

      return res.status(201).json({
        success: true,
        message: 'Conta criada com sucesso',
        data:    { id: newUser.id, email: newUser.email, token },
      });

    } catch (error) {
      const elapsed = Date.now() - t0;
      logger.error('REGISTER', `Erro não tratado após ${elapsed}ms`, { message: error.message, code: error.code });
      console.error(chalk.red(`❌ [REGISTER:STACK]`), error.stack);
      logger.sep();
      return res.status(500).json({ success: false, error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' });
    }
  }

  // ══════════════════════════════════════════════════════════
  // 🔑 LOGIN — Autentica conta local
  // ══════════════════════════════════════════════════════════
  static async login(req, res) {
    const t0  = Date.now();
    const ctx = reqContext(req);

    logger.sep();
    logger.bigsep();
    console.log(chalk.bold(chalk.green('  🔑 [LOGIN] Fluxo iniciado')));
    logger.bigsep();
    logger.info('LOGIN', 'Contexto da requisição', ctx);

    try {
      const { email, password } = req.body;

      // ── STEP 1: Normalização ──────────────────────────────
      logger.flow('LOGIN', 1, 'Normalizando entrada...');
      const emailNormalized = email?.trim().toLowerCase();

      logger.info('LOGIN', 'Dados recebidos (sanitizados)', sanitizeForLog({ email: emailNormalized, password }));

      // ── STEP 2: Brute force check ─────────────────────────
      logger.flow('LOGIN', 2, 'Verificando brute force...', { ip: ctx.ip });
      const bruteCheck = checkBruteForce(ctx.ip);

      if (bruteCheck.blocked) {
        logger.sec('Brute-force bloqueado — acesso negado', {
          ip:      ctx.ip,
          resetIn: bruteCheck.resetIn,
          email:   emailNormalized,
        });
        return res.status(429).json({
          success: false,
          error:   `Muitas tentativas. Tente novamente em ${bruteCheck.resetIn} minuto(s).`,
          code:    'BRUTE_FORCE_BLOCKED',
        });
      }

      if (bruteCheck.remaining <= 2) {
        logger.warn('LOGIN', 'IP próximo do limite de tentativas', {
          ip:        ctx.ip,
          remaining: bruteCheck.remaining,
          max:       LOGIN_MAX_ATTEMPTS,
        });
      }

      // ── STEP 3: Validação básica ──────────────────────────
      logger.flow('LOGIN', 3, 'Validando campos...');

      if (!emailNormalized || !password) {
        logger.warn('LOGIN', 'Campos ausentes', { hasEmail: !!emailNormalized, hasPassword: !!password });
        return res.status(400).json({ success: false, error: 'Email e senha são obrigatórios', code: 'MISSING_FIELDS' });
      }

      // ── STEP 4: Busca usuário ─────────────────────────────
      logger.flow('LOGIN', 4, 'Buscando usuário no banco...', { email: emailNormalized });
      logger.db('SELECT users WHERE email', { email: emailNormalized });

      const tDb1 = Date.now();
      const user = await User.findByEmail(emailNormalized);
      logger.perf('LOGIN', 'findByEmail()', Date.now() - tDb1);

      if (!user) {
        // ⚠️  SEGURANÇA: mesma mensagem para "não existe" e "senha errada"
        //     Evita user enumeration attack
        logger.sec('Login falhou — usuário não encontrado', { email: emailNormalized, ip: ctx.ip });
        return res.status(401).json({ success: false, error: 'Credenciais inválidas', code: 'INVALID_CREDENTIALS' });
      }

      logger.info('LOGIN', 'Usuário encontrado', {
        userId:   user.id,
        email:    user.email,
        provider: user.auth_provider || 'local',
        hasSenhaHash: !!user.senha_hash,
      });

      // ── STEP 5: Verifica se é conta OAuth sem senha ────────
      // ⚠️  Usuários criados via Google não têm senha_hash.
      //     Tentativa de login por senha deve ser bloqueada
      //     com mensagem orientando ao fluxo correto.
      logger.flow('LOGIN', 5, 'Verificando tipo de conta...');

      if (!user.senha_hash && user.auth_provider === 'google') {
        logger.sec('Tentativa de login por senha em conta OAuth', {
          userId:   user.id,
          email:    user.email,
          provider: user.auth_provider,
          ip:       ctx.ip,
        });
        return res.status(401).json({
          success:  false,
          error:    'Esta conta foi criada com Google. Use o botão "Continuar com Google".',
          code:     'OAUTH_ACCOUNT_NO_PASSWORD',
          provider: 'google',
        });
      }

      // ── STEP 6: Valida senha ──────────────────────────────
      logger.flow('LOGIN', 6, 'Comparando hash bcrypt...');

      const tBcrypt = Date.now();
      const isPasswordValid = await bcrypt.compare(password, user.senha_hash);
      const bcryptMs = Date.now() - tBcrypt;
      logger.perf('LOGIN', 'bcrypt.compare()', bcryptMs);

      console.log(chalk.cyan(`ℹ️  [LOGIN:BCRYPT]`), chalk.gray(JSON.stringify({
        userId:  user.id,
        valid:   isPasswordValid,
        ms:      bcryptMs,
      })));

      if (!isPasswordValid) {
        logger.sec('Senha inválida', { userId: user.id, ip: ctx.ip, email: emailNormalized });
        return res.status(401).json({ success: false, error: 'Credenciais inválidas', code: 'INVALID_CREDENTIALS' });
      }

      // ── STEP 7: Limpa brute force e gera JWT ──────────────
      logger.flow('LOGIN', 7, 'Autenticação OK — limpando brute force e gerando JWT...');
      clearBruteForce(ctx.ip);

      const token = generateJWT(user, user.auth_provider || 'local');

      // ── STEP 8: Auditoria ─────────────────────────────────
      logger.flow('LOGIN', 8, 'Registrando auditoria...');
      logger.audit('LOGIN bem-sucedido', { userId: user.id, email: user.email, ip: ctx.ip });

      await AuditLog.create({
        usuario_id: user.id,
        acao:       AuditLog.ACTIONS?.LOGIN || 'LOGIN',
        detalhe:    `Login via plataforma web`,
        ip_address: ctx.ip,
        user_agent: ctx.userAgent,
        metadata:   { auth_provider: 'local', requestId: ctx.requestId },
      });

      // ── STEP 9: Resposta ──────────────────────────────────
      const elapsed = Date.now() - t0;
      logger.perf('LOGIN', 'Fluxo completo', elapsed);
      logger.success('LOGIN', '══ LOGIN CONCLUÍDO ══', { userId: user.id, elapsed: elapsed + 'ms' });
      logger.sep();

      return res.json({
        success: true,
        data:    { id: user.id, email: user.email, token },
      });

    } catch (error) {
      const elapsed = Date.now() - t0;
      logger.error('LOGIN', `Erro não tratado após ${elapsed}ms`, { message: error.message });
      console.error(chalk.red(`❌ [LOGIN:STACK]`), error.stack);
      logger.sep();
      return res.status(500).json({ success: false, error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' });
    }
  }

  // ══════════════════════════════════════════════════════════
  // 🌐 GOOGLE CALLBACK — Processa retorno OAuth 2.0
  //
  // ⚠️  NOVO: chamado pelo Passport após autenticação Google.
  //     req.user já foi populado pelo verify callback em
  //     src/config/passport.js — não fazemos DB aqui.
  //
  // Fluxo:
  //   Google → passport.js (upsert DB) → aqui (gera JWT) → frontend
  // ══════════════════════════════════════════════════════════
  static async googleCallback(req, res) {
    const t0  = Date.now();
    const ctx = reqContext(req);

    logger.sep();
    logger.bigsep();
    console.log(chalk.bold(chalk.green('  🌐 [GOOGLE_CALLBACK] Fluxo iniciado')));
    logger.bigsep();
    logger.info('GOOGLE_CALLBACK', 'Contexto da requisição', ctx);

    try {
      // ── STEP 1: Valida req.user populado pelo Passport ────
      logger.flow('GOOGLE_CALLBACK', 1, 'Verificando req.user do Passport...', { requestId: ctx.requestId });

      console.log(chalk.cyan(`ℹ️  [GOOGLE_CALLBACK:PASSPORT]`), chalk.gray(JSON.stringify({
        hasReqUser:    !!req.user,
        reqUserFields: req.user ? Object.keys(req.user) : [],
        requestId:     ctx.requestId,
        ip:            ctx.ip,
      })));

      if (!req.user) {
        // ⚠️  Se chegou aqui sem req.user, o Passport não populou
        //     o usuário — provavelmente falha no verify callback
        logger.error('GOOGLE_CALLBACK', 'req.user não definido — Passport falhou antes de chegar aqui', {
          requestId: ctx.requestId,
          ip:        ctx.ip,
        });
        const frontendUrl = process.env.FRONTEND_URL || 'https://nexaspark.com.br';
        return res.redirect(`${frontendUrl}/login?error=oauth_failed&code=NO_USER&requestId=${ctx.requestId}`);
      }

      const user = req.user;

      logger.success('GOOGLE_CALLBACK', 'req.user recebido do Passport', {
        userId:   user.id,
        email:    user.email,
        nome:     user.nome,
        provider: user.auth_provider,
        hasAvatar: !!user.avatar,
      });

      // ── STEP 2: Valida campos mínimos do usuário ──────────
      logger.flow('GOOGLE_CALLBACK', 2, 'Validando dados do usuário...', { userId: user.id });

      if (!user.id || !user.email) {
        logger.error('GOOGLE_CALLBACK', 'Usuário do Passport com campos inválidos', {
          hasId:    !!user.id,
          hasEmail: !!user.email,
          userKeys: Object.keys(user),
        });
        const frontendUrl = process.env.FRONTEND_URL || 'https://nexaspark.com.br';
        return res.redirect(`${frontendUrl}/login?error=oauth_invalid_user`);
      }

      // ── STEP 3: Gera JWT — mesmo formato que login/register ─
      logger.flow('GOOGLE_CALLBACK', 3, 'Gerando JWT com auth_provider=google...');
      const token = generateJWT(user, 'google');

      // ── STEP 4: Auditoria ─────────────────────────────────
      logger.flow('GOOGLE_CALLBACK', 4, 'Registrando auditoria LOGIN_GOOGLE...');
      logger.audit('LOGIN_GOOGLE — via OAuth Google', {
        userId:   user.id,
        email:    user.email,
        ip:       ctx.ip,
        provider: 'google',
      });

      // ⚠️  AuditLog não lança exceção — nunca vai quebrar o fluxo
      await AuditLog.create({
        usuario_id: user.id,
        acao:       'LOGIN_GOOGLE',
        detalhe:    `Login via Google OAuth — ${user.email}`,
        ip_address: ctx.ip,
        user_agent: ctx.userAgent,
        metadata: {
          auth_provider: 'google',
          hasAvatar:     !!user.avatar,
          requestId:     ctx.requestId,
        },
      });

      // ── STEP 5: Redireciona pro frontend com token ─────────
      // ⚠️  Token na URL é o padrão para OAuth server-side flow.
      //     O frontend captura em /auth/callback, salva no
      //     localStorage e limpa a URL imediatamente.
      //     Token na URL é visível no browser history — o frontend
      //     DEVE usar history.replaceState() para limpar.
      logger.flow('GOOGLE_CALLBACK', 5, 'Redirecionando para frontend...');

      const frontendUrl  = process.env.FRONTEND_URL || 'https://nexaspark.com.br';
      const redirectUrl  = `${frontendUrl}/auth/callback?token=${token}`;

      console.log(chalk.cyan(`ℹ️  [GOOGLE_CALLBACK:REDIRECT]`), chalk.gray(JSON.stringify({
        frontendUrl,
        redirectTo:    frontendUrl + '/auth/callback',
        tokenPrefix:   token.substring(0, 25) + '...',
        requestId:     ctx.requestId,
      })));

      const elapsed = Date.now() - t0;
      logger.perf('GOOGLE_CALLBACK', 'Fluxo completo', elapsed);
      logger.success('GOOGLE_CALLBACK', '══ GOOGLE CALLBACK CONCLUÍDO ══', {
        userId:   user.id,
        email:    user.email,
        elapsed:  elapsed + 'ms',
      });
      logger.sep();

      return res.redirect(redirectUrl);

    } catch (error) {
      const elapsed = Date.now() - t0;
      logger.error('GOOGLE_CALLBACK', `Erro não tratado após ${elapsed}ms`, { message: error.message });
      console.error(chalk.red(`❌ [GOOGLE_CALLBACK:STACK]`), error.stack);
      logger.sep();

      const frontendUrl = process.env.FRONTEND_URL || 'https://nexaspark.com.br';
      return res.redirect(`${frontendUrl}/login?error=oauth_server_error`);
    }
  }

  // ══════════════════════════════════════════════════════════
  // 👤 ME — Valida sessão ativa
  // ══════════════════════════════════════════════════════════
  static async me(req, res) {
    const t0  = Date.now();
    const ctx = reqContext(req);

    logger.sep();
    logger.info('ME', 'Validação de sessão iniciada', ctx);

    try {
      if (!req.user) {
        logger.error('ME', 'req.user não definido — authMiddleware não executou', { requestId: ctx.requestId });
        return res.status(401).json({ success: false, error: 'Não autenticado', code: 'NOT_AUTHENTICATED' });
      }

      const { id: userId, email: tokenEmail, auth_provider } = req.user;

      logger.info('ME', 'Token decodificado', { userId, tokenEmail, auth_provider });
      logger.flow('ME', 1, 'Buscando dados frescos do banco...', { userId });

      // ⚠️  Sempre busca do banco para garantir que o usuário
      //     ainda existe — pode ter sido desativado após o token
      const tDb = Date.now();
      const user = await User.findById(userId);
      logger.perf('ME', 'findById()', Date.now() - tDb);

      if (!user) {
        logger.sec('Token válido mas usuário não existe mais no banco', { userId, ip: ctx.ip });
        return res.status(404).json({ success: false, error: 'Usuário não encontrado', code: 'USER_NOT_FOUND' });
      }

      console.log(chalk.cyan(`ℹ️  [ME:USER]`), chalk.gray(JSON.stringify({
        userId:    user.id,
        email:     user.email,
        provider:  auth_provider,
        requestId: ctx.requestId,
      })));

      const elapsed = Date.now() - t0;
      logger.perf('ME', 'Validação completa', elapsed);
      logger.success('ME', 'Sessão validada com sucesso', { userId: user.id });
      logger.sep();

      return res.json({
        success: true,
        data:    { id: user.id, email: user.email, auth_provider },
      });

    } catch (error) {
      logger.error('ME', 'Erro não tratado', { message: error.message });
      console.error(chalk.red(`❌ [ME:STACK]`), error.stack);
      logger.sep();
      return res.status(500).json({ success: false, error: 'Erro interno', code: 'INTERNAL_ERROR' });
    }
  }

  // ══════════════════════════════════════════════════════════
  // 📋 PROFILE — Retorna perfil completo
  // ══════════════════════════════════════════════════════════
  static async getProfile(req, res) {
    const t0  = Date.now();
    const ctx = reqContext(req);

    logger.sep();
    logger.info('PROFILE', 'Requisição recebida', ctx);

    try {
      const userId = req.user?.id;

      if (!userId) {
        logger.error('PROFILE', 'req.user.id não definido', { requestId: ctx.requestId });
        return res.status(401).json({ success: false, error: 'Não autenticado', code: 'NOT_AUTHENTICATED' });
      }

      logger.flow('PROFILE', 1, 'Buscando perfil no banco...', { userId });
      const tDb = Date.now();
      const user = await User.findById(userId);
      logger.perf('PROFILE', 'findById()', Date.now() - tDb);

      if (!user) {
        logger.warn('PROFILE', 'Usuário não encontrado', { userId });
        return res.status(404).json({ success: false, error: 'Usuário não encontrado', code: 'USER_NOT_FOUND' });
      }

      console.log(chalk.cyan(`ℹ️  [PROFILE:DATA]`), chalk.gray(JSON.stringify({
        userId:   user.id,
        email:    user.email,
        criado_em: user.criado_em,
        requestId: ctx.requestId,
      })));

      const elapsed = Date.now() - t0;
      logger.perf('PROFILE', 'Perfil carregado', elapsed);
      logger.success('PROFILE', 'Perfil retornado com sucesso', { userId: user.id });
      logger.sep();

      return res.json({
        success: true,
        data: {
          id:        user.id,
          email:     user.email,
          nome:      user.nome   || null,
          avatar:    user.avatar || null,
          criado_em: user.criado_em,
          auth_provider: req.user?.auth_provider || 'local',
        },
      });

    } catch (error) {
      logger.error('PROFILE', 'Erro não tratado', { message: error.message });
      console.error(chalk.red(`❌ [PROFILE:STACK]`), error.stack);
      logger.sep();
      return res.status(500).json({ success: false, error: 'Erro interno do servidor', code: 'INTERNAL_ERROR' });
    }
  }
}

module.exports = AuthController;