const z = require('zod');

// Factory function que cria um middleware de validação para um schema específico
const validate = (schemaMap) => (req, res, next) => {
  console.log(`[validateSchema] Iniciando validação para a rota: ${req.method} ${req.originalUrl}`);
  console.log(`[validateSchema] Corpo da requisição (Body):`, JSON.stringify(req.body, null, 2));
  console.log(`[validateSchema] Parâmetros da Rota (Params):`, JSON.stringify(req.params, null, 2));
  console.log(`[validateSchema] Query String:`, JSON.stringify(req.query, null, 2));
  
  try {
    // Itera sobre o mapa de schemas e valida cada parte da requisição
    for (const key in schemaMap) {
      if (schemaMap[key]) {
        console.log(`[validateSchema] Validando a chave: ${key}`);
        schemaMap[key].parse(req[key]);
      }
    }
    
    console.log('[validateSchema] Validação bem-sucedida. Dados estão conformes ao schema.');
    next(); // Dados válidos, passa para o próximo middleware/controller
  } catch (err) {
    console.error('[validateSchema] ERRO DE VALIDAÇÃO DETECTADO!');
    
    if (err instanceof z.ZodError) {
      console.error('[validateSchema] Detalhes do erro Zod:', JSON.stringify(err.errors, null, 2));
      // Retorna uma lista de erros amigável
      const errorMessages = err.errors.map(e => ({ field: e.path.join('.'), message: e.message }));
      return res.status(400).json({ 
        error: 'Dados inválidos.',
        details: errorMessages 
      });
    } else {
      // Para outros tipos de erro inesperados
      console.error('[validateSchema] Erro inesperado durante a validação:', err);
      return res.status(500).json({ message: 'Erro interno no servidor durante a validação.' });
    }
  }
};

console.log('[validateSchema] Middleware de validação carregado.');
module.exports = validate;