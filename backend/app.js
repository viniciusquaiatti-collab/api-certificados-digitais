// app.js

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const db = require('./src/database/db');

// Rotas
const authRoutes = require('./src/routes/authRoutes');
const certificateRoutes = require('./src/routes/certificateRoutes');

const app = express();
const PORT = process.env.PORT || 8080;

console.log('🚀 [APP] Inicializando servidor...');
console.log('🌍 [ENV] NODE_ENV:', process.env.NODE_ENV);

// TRUST PROXY (Railway)
app.set('trust proxy', 1);

// ===========================================
// MIDDLEWARES GLOBAIS
// ===========================================
app.use(cors());

app.use((req, res, next) => {
  console.log('🌐 [CORS] Request liberada');
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===========================================
// DEBUG GLOBAL (NÍVEL EMPRESA)
// ===========================================
app.use((req, res, next) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📥 [REQUEST INCOMING]');
  console.log('🕒 Time:', new Date().toISOString());
  console.log('➡️ Method:', req.method);
  console.log('📍 URL:', req.originalUrl);
  console.log('🌐 IP:', req.ip);
  console.log('🧾 Headers:', req.headers);
  console.log('📦 Body:', req.body);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  next();
});

// ===========================================
// ARQUIVOS ESTÁTICOS
// ===========================================
app.use('/certificates', express.static(path.join(__dirname, 'src/certificates')));

// ===========================================
// RATE LIMIT
// ===========================================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

// ===========================================
// ROTA RAIZ
// ===========================================
app.get('/', (req, res) => {
  console.log('🏠 [ROOT] Health check raiz acessado');

  res.status(200).json({
    success: true,
    message: 'API Certificados Digitais ONLINE',
    port: PORT,
    endpoints: {
      auth: '/api/auth',
      certificates: '/api/certificates',
      health: '/api/health'
    }
  });
});

// ===========================================
// TESTE
// ===========================================
app.get('/teste', (req, res) => {
  console.log('🧪 [TESTE] Endpoint acionado');
  res.send('API ONLINE');
});

// ===========================================
// HEALTH CHECK
// ===========================================
app.get('/api/health', (req, res) => {
  console.log('💓 [HEALTH] Verificação de saúde');

  res.status(200).json({
    success: true,
    status: 'UP',
    timestamp: new Date().toISOString()
  });
});

// ===========================================
// ROTAS PRINCIPAIS
// ===========================================
console.log('📡 [APP] Registrando rotas...');

app.use('/api/auth', (req, res, next) => {
  console.log('🔐 [ROUTE PREFIX] /api/auth');
  next();
}, authRoutes);

app.use('/api/certificates', (req, res, next) => {
  console.log('📜 [ROUTE PREFIX] /api/certificates');
  next();
}, certificateRoutes);

// ===========================================
// 404
// ===========================================
app.use((req, res) => {
  console.warn('❌ [404] Rota não encontrada:', req.originalUrl);

  res.status(404).json({
    success: false,
    error: 'Rota não encontrada',
    path: req.originalUrl
  });
});

// ===========================================
// ERROR HANDLER
// ===========================================
app.use((err, req, res, next) => {
  console.error('🔥 [GLOBAL ERROR]');
  console.error('Mensagem:', err.message);
  console.error('Stack:', err.stack);

  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'development'
      ? err.message
      : 'Erro interno do servidor'
  });
});

// ===========================================
// START SERVER
// ===========================================
async function startServer() {
  try {
    console.log('🔌 [DB] Testando conexão...');
    await db.query('SELECT NOW()');
    console.log('✅ [DB] PostgreSQL conectado');
  } catch (error) {
    console.warn('⚠️ [DB] Falha inicial:', error.message);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🚀 Servidor ONLINE`);
    console.log(`🌍 http://localhost:${PORT}`);
    console.log(`💓 /api/health`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  });

  process.on('SIGTERM', () => {
    console.log('🛑 [SIGTERM] Encerrando...');
    server.close(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    console.log('🛑 [SIGINT] Encerrando...');
    server.close(() => process.exit(0));
  });
}

startServer();