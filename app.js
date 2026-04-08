// app.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const db = require('./src/database/db');

// Importação de rotas
const authRoutes = require('./src/routes/authRoutes');
const certificateRoutes = require('./src/routes/certificateRoutes');

// Inicialização do app Express
const app = express();
const PORT = process.env.PORT || 8080;

// --- Middlewares Globais ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Arquivos estáticos (PDFs)
app.use('/certificates', express.static(path.join(__dirname, 'src/certificates')));

// --- Middleware de Rate Limiting ---
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Muitas requisições a partir deste IP, tente novamente mais tarde.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`[RateLimit] Limite atingido para IP: ${req.ip}`);
    res.status(429).json({ 
      success: false, 
      error: 'Muitas requisições, tente novamente mais tarde.' 
    });
  }
});
app.use('/api/', limiter);

// --- Logs de Requisições ---
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  next();
});

// --- Rotas da API ---
app.use('/api/auth', authRoutes);
app.use('/api/certificates', certificateRoutes);

// --- Health Check ---
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    success: true, 
    status: 'UP', 
    timestamp: new Date().toISOString() 
  });
});

// --- Rota 404 ---
app.use((req, res) => {
  console.warn(`[404] Rota não encontrada: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    success: false, 
    error: 'Rota não encontrada.' 
  });
});

// --- Middleware de Erros ---
app.use((err, req, res, next) => {
  console.error('[Erro] Ocorreu um erro:', err.message);
  
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    success: false,
    error: isDevelopment ? err.message : 'Erro interno do servidor.',
    ...(isDevelopment && { stack: err.stack })
  });
});

// --- Inicialização do Servidor ---
async function startServer() {
  try {
    // Testar conexão com banco
    await db.query('SELECT NOW()');
    console.log('✅ [Database] Conexão estabelecida com sucesso');
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
      console.log(` Acesse a API em: http://localhost:${PORT}`);
      console.log(` Health Check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ [Database] Falha ao conectar:', error.message);
    console.error('❌ Verifique se o DATABASE_URL está configurado no .env');
    process.exit(1);
  }
}

startServer();

module.exports = app;