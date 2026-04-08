// src/middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

console.log('--- [authMiddleware] Middleware de autenticação carregado ---');

function authMiddleware(req, res, next) {
  console.log('--- [authMiddleware] Verificando token de autenticação ---');
  
  try {
    // Pegar token do header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      console.warn('[authMiddleware] Token não fornecido');
      return res.status(401).json({
        success: false,
        error: 'Token não fornecido'
      });
    }
    
    // Verificar formato Bearer
    const parts = authHeader.split(' ');
    
    if (parts.length !== 2) {
      console.warn('[authMiddleware] Token mal formatado');
      return res.status(401).json({
        success: false,
        error: 'Token mal formatado'
      });
    }
    
    const [scheme, token] = parts;
    
    if (!/^Bearer$/i.test(scheme)) {
      console.warn('[authMiddleware] Token não é Bearer');
      return res.status(401).json({
        success: false,
        error: 'Token não é Bearer'
      });
    }
    
    // Verificar token JWT
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        console.warn('[authMiddleware] Token inválido:', err.message);
        return res.status(401).json({
          success: false,
          error: 'Token inválido ou expirado'
        });
      }
      
      // Adicionar dados do usuário ao request
      req.user = {
        id: decoded.id,
        email: decoded.email
      };
      
      console.log('🧠 [authMiddleware] Token decodificado:', decoded);
      console.log(`[authMiddleware] Token válido para o usuário ID: ${decoded.id}`);
      
      next();
    });
    
  } catch (error) {
    console.error('[authMiddleware] Erro:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

module.exports = authMiddleware;