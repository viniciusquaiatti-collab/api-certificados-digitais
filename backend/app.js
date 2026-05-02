// app.js
// ============================================================
// 🏢 NexaSpark API — Entry Point
// Certificação Digital Enterprise
// ============================================================

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const rateLimit  = require('express-rate-limit');
const db         = require('./src/database/db');
const adminRoutes = require('./src/routes/adminRoutes');


// ── Rotas ────────────────────────────────────────────────────
const authRoutes        = require('./src/routes/authRoutes');
const certificateRoutes = require('./src/routes/certificateRoutes');

const app  = express();
const PORT = process.env.PORT || 8080;

// ============================================================
// 🎨 LOGGER CENTRALIZADO — ANSI colors, sem dependência externa
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
    const statusStr  = String(status);
    const statusColor =
      status < 300 ? c.green(statusStr) :
      status < 400 ? c.cyan(statusStr)  :
      status < 500 ? c.yellow(statusStr) : c.red(statusStr);
    console.log(
      c.magenta(`📤 [RES]`),
      c.bold(method.padEnd(7)),
      c.white(url.padEnd(40)),
      statusColor,
      c.gray(`${ms}ms | ID: ${id}`)
    );
  },
  sep:     ()              => console.log(c.gray('═'.repeat(60))),
  subsep:  ()              => console.log(c.gray('─'.repeat(60))),
  sec:     (msg, data)     => console.warn(c.red(`🚨 [SECURITY]`), msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  perf:    (label, ms)     => console.log(c.magenta(`⏱️  [PERF]`), `${label} — ${c.bold(ms + 'ms')}`),
};

// ============================================================
// 🚀 BANNER DE INICIALIZAÇÃO
// ============================================================
logger.sep();
console.log(c.bold(c.green('  🚀 NexaSpark API — Inicializando')));
console.log(c.gray(`  Node.js ${process.version} | PID ${process.pid}`));
logger.sep();
logger.info('APP', 'NODE_ENV', process.env.NODE_ENV || 'development');
logger.info('APP', 'PORT', PORT);
logger.info('APP', 'Timestamp', new Date().toISOString());
logger.subsep();

// ============================================================
// ⚙️  TRUST PROXY
// Necessário para Railway/Heroku — garante req.ip correto
// atrás de reverse proxy (sem isso, req.ip seria sempre 127.0.0.1)
// ============================================================
app.set('trust proxy', 1);
logger.success('APP', 'trust proxy configurado');

// ============================================================
// 🌐 CORS
//
// ⚠️  PROBLEMA ORIGINAL: app.use(cors()) sem restrição de origem
//     aceita requisições de qualquer domínio — inseguro em produção.
//
// ✅  CORREÇÃO: whitelist explícita de origens permitidas.
//     Em desenvolvimento aceita localhost. Em produção, só o domínio real.
//     Qualquer outra origem recebe 403 automaticamente pelo cors().
// ============================================================
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Fallback para desenvolvimento local
if (ALLOWED_ORIGINS.length === 0) {
  ALLOWED_ORIGINS.push('http://localhost:3000', 'http://localhost:3001');
  logger.warn('CORS', 'ALLOWED_ORIGINS não definido no .env — usando fallback de desenvolvimento', ALLOWED_ORIGINS);
} else {
  logger.success('CORS', 'Origens permitidas carregadas', ALLOWED_ORIGINS);
}

const corsOptions = {
  origin: (origin, callback) => {
    // Permite requisições sem origin (Postman, curl, server-to-server)
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) {
      logger.info('CORS', `Origem permitida → ${origin}`);
      return callback(null, true);
    }

    logger.sec(`Origem bloqueada pelo CORS → ${origin}`, { origin });
    return callback(new Error(`CORS: origem não permitida — ${origin}`));
  },
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
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
// 📋 MIDDLEWARE DE REQUEST/RESPONSE LOGGING
//
// ⚠️  PROBLEMA ORIGINAL: o debug global logava req.headers inteiro,
//     o que expõe o token JWT (Authorization header) nos logs.
//     Em produção isso é uma falha grave de segurança.
//
// ✅  CORREÇÃO:
//     - Headers sensíveis são mascarados antes do log
//     - Body com senha é sanitizado
//     - requestId único gerado e injetado em req para correlação
//     - Tempo de resposta logado no evento 'finish'
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

  req.requestId  = requestId;
  req.startTime  = Date.now();

  // Log da requisição entrada
  logger.subsep();
  logger.request(req.method, req.originalUrl, req.ip, requestId);
  logger.info('REQ', 'Headers', sanitizeHeaders(req.headers));

  if (Object.keys(req.body || {}).length > 0) {
    logger.info('REQ', 'Body', sanitizeBody(req.body));
  }
  if (Object.keys(req.query || {}).length > 0) {
    logger.info('REQ', 'Query', req.query);
  }
  if (Object.keys(req.params || {}).length > 0) {
    logger.info('REQ', 'Params', req.params);
  }

  // Log da resposta ao finalizar
  res.on('finish', () => {
    const ms = Date.now() - req.startTime;
    logger.response(req.method, req.originalUrl, res.statusCode, ms, requestId);
    logger.perf(`${req.method} ${req.originalUrl}`, ms);

    // Alerta para respostas lentas (> 2s)
    if (ms > 2000) {
      logger.warn('PERF', `Resposta lenta detectada!`, {
        method: req.method,
        url:    req.originalUrl,
        ms,
        requestId,
      });
    }

    // Alerta para erros 5xx
    if (res.statusCode >= 500) {
      logger.error('APP', `Resposta 5xx detectada`, {
        status:    res.statusCode,
        url:       req.originalUrl,
        requestId,
        ip:        req.ip,
      });
    }
  });

  next();
});

// ============================================================
// 📁 ARQUIVOS ESTÁTICOS — Certificados gerados
// ============================================================
app.use(
  '/certificates',
  express.static(path.join(__dirname, 'src/certificates'), {
    // ⚠️  SEGURANÇA: desativa directory listing
    index: false,
  })
);
logger.success('APP', 'Static files: /certificates → src/certificates');

// ============================================================
// 🚦 RATE LIMITING
//
// ⚠️  MELHORIA: rate limits diferenciados por tipo de rota.
//     Auth (login/register) recebe limite muito mais restritivo
//     que as rotas gerais. Evita ataques de credential stuffing.
// ============================================================

// Limite geral — 100 req / 15min por IP
const globalLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    error:   'Muitas requisições. Tente novamente em 15 minutos.',
    code:    'RATE_LIMIT_EXCEEDED',
  },
  handler: (req, res, next, options) => {
    logger.sec('Rate limit global atingido', { ip: req.ip, url: req.originalUrl });
    res.status(429).json(options.message);
  },
});

// Limite de autenticação — 20 req / 15min por IP (mais restritivo)
const authLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    error:   'Muitas tentativas de autenticação. Tente novamente em 15 minutos.',
    code:    'AUTH_RATE_LIMIT_EXCEEDED',
  },
  handler: (req, res, next, options) => {
    logger.sec('Rate limit de autenticação atingido', { ip: req.ip, url: req.originalUrl });
    res.status(429).json(options.message);
  },
});

app.use('/api', globalLimiter);
app.use('/api/auth', authLimiter);
logger.success('APP', 'Rate limiting configurado', { global: '100/15min', auth: '20/15min' });

// ============================================================
// 🩺 HEALTH CHECK
// ============================================================
app.get('/api/health', async (req, res) => {
  logger.info('HEALTH', 'Health check solicitado', { ip: req.ip });

  let dbStatus = 'UP';
  let dbLatency = null;

  try {
    const t0     = Date.now();
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
    memory: {
      heapUsed:  Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
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

logger.success('APP', 'Rotas registradas');

// ============================================================
// 🔍 404 — Rota não encontrada
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
//
// ⚠️  MELHORIA: o original expunha stack trace em produção.
//     Agora stack só aparece em development.
//     Adicionamos requestId e timestamp para correlação de logs.
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

  // Erro de CORS — mensagem específica
  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({
      success: false,
      error:   'Origem não permitida',
      code:    'CORS_BLOCKED',
    });
  }

  res.status(status).json({
    success:    false,
    error:      process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor',
    code:       err.code || 'INTERNAL_ERROR',
    requestId:  req.requestId,
    timestamp:  new Date().toISOString(),
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
    // ⚠️  DECISÃO: não abortamos o start se o DB falhar —
    //     Railway pode reconectar. O health check vai expor o status.
    logger.error('DB', 'Falha na conexão inicial', { message: error.message });
    logger.warn('DB', 'Servidor iniciará mesmo assim — health check monitorará o DB');
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.sep();
    console.log(c.bold(c.green(`  ✅ Servidor ONLINE → http://localhost:${PORT}`)));
    console.log(c.gray(`  Health: http://localhost:${PORT}/api/health`));
    console.log(c.gray(`  PID: ${process.pid} | ${new Date().toISOString()}`));
    logger.sep();
  });

  // ── Graceful shutdown ────────────────────────────────────
  // ⚠️  MELHORIA: timeout de 10s para o servidor fechar conexões
  //     ativas antes de encerrar o processo. O original fechava
  //     abruptamente podendo corromper writes em andamento.
  function gracefulShutdown(signal) {
    logger.warn('APP', `${signal} recebido — iniciando graceful shutdown`);

    server.close(() => {
      logger.success('APP', 'Servidor HTTP fechado');
      process.exit(0);
    });

    // Força encerramento após 10s se ainda houver conexões
    setTimeout(() => {
      logger.error('APP', 'Graceful shutdown timeout (10s) — forçando encerramento');
      process.exit(1);
    }, 10_000);
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

  // ── Erros não tratados ───────────────────────────────────
  // ⚠️  NOVO: captura erros assíncronos não tratados que
  //     normalmente derrubam o processo silenciosamente
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('PROCESS', 'unhandledRejection detectado!', {
      reason: String(reason),
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

startServer();