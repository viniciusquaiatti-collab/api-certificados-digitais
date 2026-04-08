// app.js - VERSÃO CORRIGIDA PARA RAILWAY (copie tudo)
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

// PORTA (Railway usa process.env.PORT automaticamente)
const PORT = process.env.PORT || 8080;

// TRUST PROXY (Railway)
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

// --- LOGS DETALHADOS ---
app.use((req, res, next) => {
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - IP: ${req.ip}`
  );
  next();
});

// ==========================
//  ROTA RAIZ (ESSENCIAL PARA TESTE)
// ==========================
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: ' API Certificados Digitais ONLINE - Railway OK!',
    port: PORT,
    docs: {
      health: '/api/health',
      auth: '/api/auth',
      certificates: '/api/certificates',
      teste: '/teste'
    }
  });
});

//  TESTE RÁPIDO (TEXTO SIMPLES)
app.get('/teste', (req, res) => {
  res.send(' API ONLINE - Funcionando no Railway!');
});

// --- HEALTH CHECK ---
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'UP',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// --- ROTAS PRINCIPAIS ---
app.use('/api/auth', authRoutes);
app.use('/api/certificates', certificateRoutes);

// --- 404 (SEMPRE DEPOIS DAS ROTAS) ---
app.use((req, res) => {
  console.warn(`[404] ${req.method} ${req.originalUrl} from ${req.ip}`);
  res.status(404).json({
    success: false,
    error: 'Rota não encontrada.',
    requested: req.originalUrl
  });
});

// --- ERROR HANDLER ---
app.use((err, req, res, next) => {
  console.error('[ERRO]', err.message, err.stack);
  
  const isDev = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    success: false,
    error: isDev ? err.message : 'Erro interno do servidor.',
    ...(isDev && { stack: err.stack })
  });
});

// ========================================
//  START SERVER - CORRIGIDO RAILWAY
// ========================================
async function startServer() {
  try {
    // Teste DB (não trava server)
    await db.query('SELECT NOW()');
    console.log(' [Database] Conectado PostgreSQL');
  } catch (error) {
    console.warn(' [Database] Sem conexão inicial, continua:', error.message);
  }
  
  // SERVER SEMPRE INICIA - BIND 0.0.0.0 OBRIGATÓRIO RAILWAY
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(` Servidor rodando em 0.0.0.0:${PORT}`);
    console.log(` Root: http://localhost:${PORT}/`);
    console.log(` Health: http://localhost:${PORT}/api/health`);
  });
  
  // Graceful shutdown (Railway)
  process.on('SIGTERM', () => {
    console.log(' SIGTERM - Fechando graciosamente');
    server.close(() => {
      console.log(' Server fechado');
      process.exit(0);
    });
  });
  
  process.on('SIGINT', () => {
    console.log(' SIGINT - Fechando');
    server.close(() => process.exit(0));
  });
}

console.log(' Iniciando API Certificados Digitais...');
startServer();
