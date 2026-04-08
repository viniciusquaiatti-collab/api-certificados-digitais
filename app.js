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

// 🔥 PORTA (Railway usa process.env.PORT automaticamente)
const PORT = process.env.PORT || 8080;

// 🔥 IMPORTANTE PRA RAILWAY (proxy)
app.set('trust proxy', 1);

// --- MIDDLEWARES GLOBAIS ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- ARQUIVOS ESTÁTICOS ---
app.use('/certificates', express.static(path.join(__dirname, 'src/certificates')));

// --- RATE LIMIT (somente /api) ---
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

// --- LOGS ---
app.use((req, res, next) => {
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - IP: ${req.ip}`
  );
  next();
});

// ==========================
// 🔥 ROTA RAIZ (ESSENCIAL)
// ==========================
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: '🚀 API Certificados Digitais ONLINE',
    docs: {
      health: '/api/health',
      auth: '/api/auth',
      certificates: '/api/certificates'
    }
  });
});

// 🔥 TESTE RÁPIDO
app.get('/teste', (req, res) => {
  res.send('🚀 API ONLINE');
});

// --- HEALTH CHECK ---
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'UP',
    timestamp: new Date().toISOString()
  });
});

// --- ROTAS PRINCIPAIS ---
app.use('/api/auth', authRoutes);
app.use('/api/certificates', certificateRoutes);

// --- 404 (SEMPRE DEPOIS DAS ROTAS) ---
app.use((req, res) => {
  console.warn(`[404] ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: 'Rota não encontrada.'
  });
});

// --- ERROR HANDLER ---
app.use((err, req, res, next) => {
  console.error('[Erro]', err.message);

  const isDev = process.env.NODE_ENV === 'development';

  res.status(err.status || 500).json({
    success: false,
    error: isDev ? err.message : 'Erro interno do servidor.',
    ...(isDev && { stack: err.stack })
  });
});

// --- START SERVER ---
async function startServer() {
  try {
    await db.query('SELECT NOW()');
    console.log('✅ [Database] Conectado');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
    });

  } catch (error) {
    console.error('❌ Erro ao conectar no banco:', error.message);
    process.exit(1);
  }
}

startServer();

module.exports = app;
