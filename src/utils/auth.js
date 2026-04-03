const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Pega o token depois de "Bearer "

  if (!token) {
    console.log('Erro: Token não fornecido');
    return res.status(401).json({ error: 'Token de acesso necessário' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log('Erro na verificação do token:', err.message); // Adicionei log para depurar
      return res.status(403).json({ error: 'Token inválido' });
    }

    req.userId = user.userId;
    next();
  });
}

module.exports = { authenticateToken };