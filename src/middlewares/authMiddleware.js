const jwt = require('jsonwebtoken');

/**
 * Middleware de Autenticação
 * Verifica se o token JWT fornecido no header 'Authorization' é válido.
 * Se for válido, adiciona o userId decodificado ao objeto de requisição (req.userId).
 * Caso contrário, bloqueia a requisição com um erro 401 (Não Autorizado).
 */
const authMiddleware = (req, res, next) => {
  console.log('--- [authMiddleware] Verificando token de autenticação ---');

  // O token geralmente é enviado no header: Authorization: Bearer <token>
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Pega apenas o token, sem o 'Bearer'

  if (!token) {
    console.warn('⚠️ [authMiddleware] Acesso negado: Nenhum token fornecido.');
    return res.status(401).json({ error: 'Acesso negado. Nenhum token fornecido.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.warn('⚠️ [authMiddleware] Acesso negado: Token inválido ou expirado.');
      // Erros comuns: 'TokenExpiredError' ou 'JsonWebTokenError'
      return res.status(401).json({ error: 'Acesso negado. Token inválido.' });
    }

    // Se o token for válido, o payload decodificado (com userId) é anexado à requisição
    req.userId = decoded.userId;
    console.log(`[authMiddleware] Token válido para o usuário ID: ${req.userId}`);
    
    // Chama o próximo middleware ou o controlador de rota
    next();
  });
};

module.exports = authMiddleware;