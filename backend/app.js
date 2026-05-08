// app.js
// ============================================================
// 🏢 NexaSpark API — Entry Point
// Certificação Digital Enterprise
//
// ⚠️  ADIÇÕES nesta versão:
//   - helmet: segurança de headers HTTP (posição: PRIMEIRO middleware)
//     Configurado especificamente para stack Cloudflare + Railway:
//     - hsts DESABILITADO → Cloudflare já injeta HSTS, duplicar causa conflito
//     - contentSecurityPolicy DESABILITADO → API serve JSON, não HTML
//     - crossOriginResourcePolicy → 'cross-origin' para Vercel + Cloudinary
//   - express-session: necessário para o Passport funcionar
//     durante o redirect cycle do OAuth. TTL de 5 min.
//   - passport.initialize() + passport.session(): middleware
//     do Passport registrado após session e body parsers.
//   - adminRoutes: estava importado mas nunca registrado —
//     corrigido com app.use('/api/admin', adminRoutes).
// ============================================================

require('dotenv').config();

const express   = require('express');
const helmet    = require('helmet');    // ← NOVO
const cors      = require('cors');
const path      = require('path');
const rateLimit = require('express-rate-limit');
const session   = require('express-session');
const db        = require('./src/database/db');

const passport = require('./src/config/passport');

const authRoutes        = require('./src/routes/authRoutes');
const certificateRoutes = require('./src/routes/certificateRoutes');
const adminRoutes       = require('./src/routes/adminRoutes');

const app  = express();
const PORT = process.env.PORT || 8080;

// ============================================================
// 🎨 LOGGER CENTRALIZADO
// ============================================================
const c = {
  green:   (s) => `\x1b[32m${s}\x1b[0m`,
  red:     (s) => `\x1b[31m${s}\x1b[0m`,
  yellow:  (s) => `\x1b[33m${s}\x1b[0m`,
  blue:    (s) => `\x1b[34m${s}\x1b[0m`,
  cyan:    (s) => `\x1b[36m${s}\x1b[0m`,
  gray:    (s) => `\x1b[90m${s}\x1b[0m`,
  magenta: (s) => `\x1b[35m${s}\x1b[0m`,
  bold:    (s) => `\x1b[1m${s}\x1b[0m`,
  white:   (s) => `\x1b[37m${s}\x1b[0m`,
};

const logger = {
  info:    (scope, msg, data) => console.log(   c.blue(`ℹ️  [${scope}]`),    msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  success: (scope, msg, data) => console.log(   c.green(`✅ [${scope}]`),   msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  warn:    (scope, msg, data) => console.warn(  c.yellow(`⚠️  [${scope}]`),  msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  error:   (scope, msg, data) => console.error( c.red(`❌ [${scope}]`),     msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  request: (method, url, ip, id) => console.log(
    c.cyan(`📨 [REQ]`),
    c.bold(method.padEnd(7)),
    c.white(url.padEnd(40)),
    c.gray(`IP: ${ip} | ID: ${id}`)
  ),
  response: (method, url, status, ms, id) => {
    const statusStr   = String(status);
    const statusColor =
      status < 300 ? c.green(statusStr)  :
      status < 400 ? c.cyan(statusStr)   :
      status < 500 ? c.yellow(statusStr) : c.red(statusStr);
    console.log(
      c.magenta(`📤 [RES]`),
      c.bold(method.padEnd(7)),
      c.white(url.padEnd(40)),
      statusColor,
      c.gray(`${ms}ms | ID: ${id}`)
    );
  },
  sep:    ()           => console.log(c.gray('═'.repeat(60))),
  subsep: ()           => console.log(c.gray('─'.repeat(60))),
  sec:    (msg, data)  => console.warn(c.red(`🚨 [SECURITY]`), msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  perf:   (label, ms)  => console.log(c.magenta(`⏱️  [PERF]`), `${label} — ${c.bold(ms + 'ms')}`),
};

// ============================================================
// 🚀 BANNER DE INICIALIZAÇÃO
// ============================================================
logger.sep();
console.log(c.bold(c.green('  🚀 NexaSpark API — Inicializando')));
console.log(c.gray(`  Node.js ${process.version} | PID ${process.pid}`));
logger.sep();
logger.info('APP', 'NODE_ENV',  process.env.NODE_ENV || 'development');
logger.info('APP', 'PORT',      PORT);
logger.info('APP', 'Timestamp', new Date().toISOString());

console.log(c.cyan(`ℹ️  [APP:OAUTH_ENV]`), c.gray(JSON.stringify({
  GOOGLE_CLIENT_ID:     process.env.GOOGLE_CLIENT_ID     ? process.env.GOOGLE_CLIENT_ID.substring(0, 12) + '...'  : '❌ AUSENTE',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? '[REDACTED ✅]'                                         : '❌ AUSENTE',
  GOOGLE_CALLBACK_URL:  process.env.GOOGLE_CALLBACK_URL  || '❌ AUSENTE',
  FRONTEND_URL:         process.env.FRONTEND_URL          || '❌ AUSENTE',
})));

logger.subsep();

// ============================================================
// ⚙️  TRUST PROXY
// ============================================================
app.set('trust proxy', 1);
logger.success('APP', 'trust proxy configurado');

// ============================================================
// 🛡️  HELMET — Segurança de Headers HTTP
//
// ⚠️  POSIÇÃO OBRIGATÓRIA: PRIMEIRO middleware após trust proxy.
//     Helmet deve rodar ANTES de cors, session, passport e rotas.
//     Garante que TODOS os responses terão os headers seguros,
//     incluindo erros do CORS e do rate limiter.
//
// DECISÕES DE CONFIGURAÇÃO — específicas para NexaSpark:
//
//   hsts: false
//     → Cloudflare gerencia HSTS via SSL/TLS → Edge Certificates.
//       Header duplicado causa comportamento indefinido em browsers.
//
//   contentSecurityPolicy: false
//     → API serve exclusivamente JSON. CSP é para apps HTML/CSS/JS.
//       Habilitado aqui bloquearia requests legítimos do frontend Vercel.
//
//   crossOriginResourcePolicy: 'cross-origin'
//     → Frontend Vercel (nexaspark.com.br) acessa API Railway (domínio diferente).
//       Cloudinary também precisa servir PDFs cross-origin.
//       Sem isso, browsers modernos bloqueiam recursos cross-origin.
//
// HEADERS ATIVOS após esta configuração:
//   ✅ X-DNS-Prefetch-Control: off          → evita vazamento de DNS
//   ✅ X-Frame-Options: DENY                → bloqueia clickjacking (iframe malicioso)
//   ✅ X-Content-Type-Options: nosniff      → bloqueia MIME sniffing
//   ✅ X-XSS-Protection: 0                  → desativa auditor XSS legado (correto)
//   ✅ Referrer-Policy: no-referrer         → não vaza URL de origem nos requests
//   ✅ Origin-Agent-Cluster: ?1             → isolamento de processo no browser
//   ✅ X-Permitted-Cross-Domain-Policies: none → bloqueia Adobe Flash/PDF cross-domain
//   ✅ X-Powered-By: [REMOVIDO]             → hacker não sabe que é Express/Node
//
// Ref: https://helmetjs.github.io/
// ============================================================
app.use(helmet({
  hsts:                  false,
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  dnsPrefetchControl:           { allow: false },
  frameguard:                   { action: 'deny' },
  noSniff:                      true,
  referrerPolicy:               { policy: 'no-referrer' },
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  originAgentCluster:           true,
  hidePoweredBy:                true,
}));

logger.success('APP', '🛡️  Helmet configurado ✅', {
  hsts:                  'DESABILITADO — Cloudflare gerencia',
  contentSecurityPolicy: 'DESABILITADO — API JSON pura',
  crossOriginResource:   'cross-origin — Vercel + Cloudinary',
  frameguard:            'DENY — anti-clickjacking',
  noSniff:               'ATIVO — anti-MIME sniffing',
  referrerPolicy:        'no-referrer — sem vazamento de URL',
  hidePoweredBy:         'ATIVO — X-Powered-By removido',
  dnsPrefetch:           'OFF — sem vazamento de DNS',
});

// ============================================================
// 🌐 CORS
// ============================================================
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

if (ALLOWED_ORIGINS.length === 0) {
  ALLOWED_ORIGINS.push('http://localhost:3000', 'http://localhost:3001');
  logger.warn('CORS', 'ALLOWED_ORIGINS não definido — usando fallback de desenvolvimento', ALLOWED_ORIGINS);
} else {
  logger.success('CORS', 'Origens permitidas carregadas', ALLOWED_ORIGINS);
}

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) {
      logger.info('CORS', `Origem permitida → ${origin}`);
      return callback(null, true);
    }
    logger.sec(`Origem bloqueada pelo CORS → ${origin}`, { origin });
    return callback(new Error(`CORS: origem não permitida — ${origin}`));
  },
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
};

app.use(cors(corsOptions));
logger.success('APP', 'CORS configurado com whitelist');

// ============================================================
// 📦 BODY PARSERS
// ============================================================
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
logger.success('APP', 'Body parsers configurados (limit: 1mb)');

// ============================================================
// 🔐 EXPRESS-SESSION
// ============================================================
app.use(session({
  secret:            process.env.JWT_SECRET,
  resave:            false,
  saveUninitialized: false,
  name:              'nexaspark.sid',
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge:   5 * 60 * 1000,
    sameSite: 'lax',
  },
}));

logger.success('APP', 'express-session configurado', {
  name:     'nexaspark.sid',
  maxAge:   '5min',
  secure:   process.env.NODE_ENV === 'production',
  httpOnly: true,
  sameSite: 'lax',
  note:     'Session usada apenas durante redirect cycle OAuth',
});

// ============================================================
// 🛂 PASSPORT
// ============================================================
app.use(passport.initialize());
app.use(passport.session());

logger.success('APP', 'Passport inicializado', {
  strategy:  'google-oauth20',
  session:   false,
  serialize: 'user.id only',
});

// ============================================================
// 📋 MIDDLEWARE DE REQUEST/RESPONSE LOGGING
// ============================================================
function sanitizeHeaders(headers) {
  const clone = { ...headers };
  if (clone.authorization) clone.authorization = 'Bearer [REDACTED]';
  if (clone.cookie)        clone.cookie        = '[REDACTED]';
  return clone;
}

function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;
  const clone = { ...body };
  if (clone.password)   clone.password   = `[${String(clone.password).length} chars]`;
  if (clone.senha)      clone.senha      = '[REDACTED]';
  if (clone.senha_hash) clone.senha_hash = '[REDACTED]';
  return clone;
}

app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] ||
    `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  req.requestId = requestId;
  req.startTime = Date.now();

  logger.subsep();
  logger.request(req.method, req.originalUrl, req.ip, requestId);
  logger.info('REQ', 'Headers', sanitizeHeaders(req.headers));

  if (Object.keys(req.body   || {}).length > 0) logger.info('REQ', 'Body',   sanitizeBody(req.body));
  if (Object.keys(req.query  || {}).length > 0) logger.info('REQ', 'Query',  req.query);
  if (Object.keys(req.params || {}).length > 0) logger.info('REQ', 'Params', req.params);

  res.on('finish', () => {
    const ms = Date.now() - req.startTime;
    logger.response(req.method, req.originalUrl, res.statusCode, ms, requestId);
    logger.perf(`${req.method} ${req.originalUrl}`, ms);

    if (ms > 2000) {
      logger.warn('PERF', `Resposta lenta detectada!`, {
        method: req.method, url: req.originalUrl, ms, requestId,
      });
    }

    if (res.statusCode >= 500) {
      logger.error('APP', `Resposta 5xx detectada`, {
        status: res.statusCode, url: req.originalUrl, requestId, ip: req.ip,
      });
    }
  });

  next();
});

// ============================================================
// 📁 ARQUIVOS ESTÁTICOS
// ============================================================
app.use(
  '/certificates',
  express.static(path.join(__dirname, 'src/certificates'), {
    index: false,
  })
);
logger.success('APP', 'Static files: /certificates → src/certificates');

// ============================================================
// 🚦 RATE LIMITING
// ============================================================
const globalLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, error: 'Muitas requisições. Tente novamente em 15 minutos.', code: 'RATE_LIMIT_EXCEEDED' },
  handler: (req, res, next, options) => {
    logger.sec('Rate limit global atingido', { ip: req.ip, url: req.originalUrl });
    res.status(429).json(options.message);
  },
});

const authLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, error: 'Muitas tentativas de autenticação. Tente novamente em 15 minutos.', code: 'AUTH_RATE_LIMIT_EXCEEDED' },
  handler: (req, res, next, options) => {
    logger.sec('Rate limit de autenticação atingido', { ip: req.ip, url: req.originalUrl });
    res.status(429).json(options.message);
  },
});

app.use('/api',      globalLimiter);
app.use('/api/auth', authLimiter);
logger.success('APP', 'Rate limiting configurado', { global: '100/15min', auth: '20/15min' });

// ============================================================
// 🩺 HEALTH CHECK
// ============================================================
app.get('/api/health', async (req, res) => {
  logger.info('HEALTH', 'Health check solicitado', { ip: req.ip });

  let dbStatus  = 'UP';
  let dbLatency = null;

  try {
    const t0  = Date.now();
    await db.query('SELECT 1');
    dbLatency = Date.now() - t0;
    logger.success('HEALTH', 'Banco respondeu', { latency: dbLatency + 'ms' });
  } catch (err) {
    dbStatus = 'DOWN';
    logger.error('HEALTH', 'Banco não respondeu', { error: err.message });
  }

  const status = dbStatus === 'UP' ? 200 : 503;

  res.status(status).json({
    success:   dbStatus === 'UP',
    status:    dbStatus === 'UP' ? 'UP' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    version:   process.env.npm_package_version || '1.0.0',
    uptime:    Math.floor(process.uptime()) + 's',
    database:  { status: dbStatus, latency: dbLatency ? dbLatency + 'ms' : null },
    oauth:     { google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) },
    memory: {
      heapUsed:  Math.round(process.memoryUsage().heapUsed  / 1024 / 1024) + 'MB',
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
    },
  });
});

// ============================================================
// 🌐 ROTA RAIZ
// ============================================================
app.get('/', (req, res) => {
  logger.info('ROOT', 'Rota raiz acessada', { ip: req.ip });
  res.status(200).json({
    success:  true,
    message:  'NexaSpark API — Certificação Digital Enterprise',
    version:  process.env.npm_package_version || '1.0.0',
    endpoints: {
      health:       'GET  /api/health',
      auth:         'POST /api/auth/login | /api/auth/register',
      authGoogle:   'GET  /api/auth/google',
      authGoogleCb: 'GET  /api/auth/google/callback',
      certificates: 'GET|POST /api/certificates',
    },
  });
});

// ============================================================
// 🛣️  ROTAS PRINCIPAIS
// ============================================================
logger.subsep();
logger.info('APP', 'Registrando rotas...');

app.use('/api/auth',         authRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/admin',        adminRoutes);

logger.success('APP', 'Rotas registradas', {
  '/api/auth':         'authRoutes (local + OAuth Google)',
  '/api/certificates': 'certificateRoutes',
  '/api/admin':        'adminRoutes ← CORRIGIDO (estava sem registro)',
});

// ============================================================
// 🔍 404
// ============================================================
app.use((req, res) => {
  logger.warn('404', `Rota não encontrada → ${req.method} ${req.originalUrl}`, { ip: req.ip });
  res.status(404).json({
    success: false,
    error:   'Rota não encontrada',
    code:    'ROUTE_NOT_FOUND',
    path:    req.originalUrl,
    method:  req.method,
  });
});

// ============================================================
// 💥 GLOBAL ERROR HANDLER
// ============================================================
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;

  logger.error('GLOBAL_ERROR', `${status} — ${err.message}`, {
    requestId: req.requestId,
    url:       req.originalUrl,
    method:    req.method,
    ip:        req.ip,
  });

  if (err.stack) {
    logger.error('GLOBAL_ERROR', 'Stack trace:\n' + err.stack);
  }

  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({ success: false, error: 'Origem não permitida', code: 'CORS_BLOCKED' });
  }

  res.status(status).json({
    success:   false,
    error:     process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor',
    code:      err.code || 'INTERNAL_ERROR',
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ============================================================
// 🚀 START SERVER
// ============================================================
async function startServer() {
  logger.subsep();
  logger.info('DB', 'Testando conexão com PostgreSQL...');

  try {
    const t0 = Date.now();
    await db.query('SELECT NOW()');
    logger.perf('DB connection test', Date.now() - t0);
    logger.success('DB', 'PostgreSQL conectado ✅');
  } catch (error) {
    logger.error('DB', 'Falha na conexão inicial', { message: error.message });
    logger.warn('DB', 'Servidor iniciará mesmo assim — health check monitorará o DB');
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.sep();
    console.log(c.bold(c.green(`  ✅ NexaSpark API ONLINE → http://localhost:${PORT}`)));
    console.log(c.gray(`  Health:        http://localhost:${PORT}/api/health`));
    console.log(c.gray(`  OAuth Google:  http://localhost:${PORT}/api/auth/google`));
    console.log(c.gray(`  PID: ${process.pid} | ${new Date().toISOString()}`));
    logger.sep();
  });

  function gracefulShutdown(signal) {
    logger.warn('APP', `${signal} recebido — iniciando graceful shutdown`);
    server.close(() => {
      logger.success('APP', 'Servidor HTTP fechado');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('APP', 'Graceful shutdown timeout (10s) — forçando encerramento');
      process.exit(1);
    }, 10_000);
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('PROCESS', 'unhandledRejection detectado!', {
      reason:  String(reason),
      promise: String(promise),
    });
  });

  process.on('uncaughtException', (error) => {
    logger.error('PROCESS', 'uncaughtException — processo será encerrado!', {
      message: error.message,
      stack:   error.stack,
    });
    process.exit(1);
  });
}

// ============================================================
// ⚠️  EXPORTAÇÃO SEPARADA DO START
//
// app é exportado SEM chamar startServer().
// Isso permite que o Supertest importe o app nos testes
// sem subir o servidor HTTP na porta 8080.
//
// startServer() só é chamado quando o arquivo é executado
// diretamente (node app.js ou npm start/dev).
//
// Padrão: require.main === module detecta execução direta.
// ============================================================
if (require.main === module) {
  startServer();
}

module.exports = app;