const z = require('zod');

/**
 * Middleware de validação usando Zod
 * @param {object} schemaMap - Objeto com schemas para cada parte da requisição (body, params, query)
 */
const validateSchema = (schemaMap) => {
  return (req, res, next) => {
    console.log(`[validateSchema] Iniciando validação para a rota: ${req.method} ${req.originalUrl}`);
    console.log(`[validateSchema] Corpo da requisição (Body):`, req.body);
    console.log(`[validateSchema] Parâmetros da Rota (Params):`, req.params);
    console.log(`[validateSchema] Query String:`, req.query);

    try {
      // Itera sobre o mapa de schemas e valida cada parte da requisição
      for (const key in schemaMap) {
        if (schemaMap[key]) {
          console.log(`[validateSchema] Validando a chave: ${key}`);
          const validatedData = schemaMap[key].parse(req[key]);
          
          // Armazena os dados validados no objeto req
          req.validatedData = req.validatedData || {};
          req.validatedData[key] = validatedData;
        }
      }

      console.log('[validateSchema] Validação bem-sucedida. Dados estão conformes ao schema.');
      next();
    } catch (err) {
      console.log('[validateSchema] ERRO DE VALIDAÇÃO DETECTADO!');

      if (err instanceof z.ZodError) {
        console.log('[validateSchema] Detalhes do erro Zod:', JSON.stringify(err.errors, null, 2));
        
        const errorMessages = err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }));

        return res.status(400).json({
          success: false,
          error: 'Dados inválidos.',
          details: errorMessages
        });
      }

      console.error('[validateSchema] Erro inesperado durante a validação:', err);
      return res.status(500).json({
        success: false,
        error: 'Erro interno no servidor durante a validação.'
      });
    }
  };
};

console.log('[validateSchema] Middleware de validação carregado.');
module.exports = validateSchema;