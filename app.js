require('dotenv').config(); // Sempre no topo para carregar as variáveis de ambiente
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

// Importação de rotas
const authRoutes = require('./src/routes/authRoutes');
const certificateRoutes = require('./src/routes/certificateRoutes');
const adminRoutes = require('./src/routes/adminRoutes');

// Importação do middleware de autenticação
const authMiddleware = require('./src/middlewares/authMiddleware');

// Inicialização do app Express
const app = express();
const PORT = process.env.PORT || 8080;

// --- Middlewares Globais ---
app.use(cors()); // Habilita o CORS para todas as rotas
app.use(express.json()); // Middleware para fazer o parsing de corpo de requisições JSON
app.use(express.urlencoded({ extended: true })); // Middleware para fazer o parsing de dados de formulário

// Middleware para servir arquivos estáticos (como os PDFs gerados)
app.use('/certificates', express.static(path.join(__dirname, 'certificates')));

// --- Middleware de Rate Limiting (Segurança) ---
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limite de 100 requisições por IP a cada 15 minutos
  message: 'Muitas requisições a partir deste IP, tente novamente mais tarde.',
  standardHeaders: true, // Retorna os headers `RateLimit-*` na resposta
  legacyHeaders: false, // Desabilita o header `X-RateLimit-*`
  handler: (req, res) => { // Função customizada para quando o limite é atingido
    console.warn(`[RateLimit] Limite de requisições atingido para o IP: ${req.ip}`);
    res.status(429).json({ error: 'Muitas requisições a partir deste IP, tente novamente mais tarde.' });
  }
});
app.use('/api/', limiter); // Aplica o rate limiting apenas às rotas da API

// --- Logs de Requisições (Middleware Simples) ---
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  next();
});

// --- Rotas da API ---
app.use('/api/auth', authRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/admin', adminRoutes);

// --- Rota de Health Check (Importante para monitoramento) ---
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

// --- Middleware para Rotas Não Encontradas (404) ---
app.use((req, res, next) => {
  console.warn(`[404] Rota não encontrada: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Rota não encontrada.' });
});

// --- Middleware Central de Tratamento de Erros (Deve ser o último middleware) ---
app.use((err, req, res, next) => {
  console.error('[Erro Geral] Ocorreu um erro não tratado:', err.message);
  console.error('[Erro Geral] Stack trace:', err.stack);

  // Em produção, você não deve expor o stack trace completo
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    error: isDevelopment ? err.message : 'Erro interno do servidor.',
    ...(isDevelopment && { stack: err.stack }) // Inclui o stack trace apenas em desenvolvimento
  });
});

// --- Inicialização do Servidor ---
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(` Acesse a API em: http://localhost:${PORT}`);
  console.log(` Health Check: http://localhost:${PORT}/api/health`);
});

module.exports = app;

