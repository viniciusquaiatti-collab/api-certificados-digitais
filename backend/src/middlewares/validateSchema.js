// src/middlewares/validateSchema.js
console.log('[validateSchema] Middleware de validação carregado.');

/**
 * Middleware de validação com Zod
 * Valida body, params, query de forma automática
 */
function validateSchema(schema) {
  return (req, res, next) => {
    console.log(`[validateSchema] Iniciando validação para a rota: ${req.method} ${req.originalUrl}`);
    console.log(`[validateSchema] Corpo da requisição (Body):`, req.body);
    console.log(`[validateSchema] Parâmetros da Rota (Params):`, req.params);
    console.log(`[validateSchema] Query String:`, req.query);

    try {
      // Validar body se existir no schema
      if (schema.body) {
        console.log('[validateSchema] Validando a chave: body');
        const result = schema.body.safeParse(req.body);
        
        if (!result.success) {
          console.warn('[validateSchema] Erro na validação do body:', result.error.errors);
          return res.status(400).json({
            success: false,
            error: 'Dados inválidos',
            details: result.error.errors
          });
        }
        
        req.body = result.data;
        console.log('[validateSchema] Validação bem-sucedida. Dados estão conformes ao schema.');
      }

      // Validar params se existir no schema
      if (schema.params) {
        console.log('[validateSchema] Validando a chave: params');
        const result = schema.params.safeParse(req.params);
        
        if (!result.success) {
          console.warn('[validateSchema] Erro na validação dos params:', result.error.errors);
          return res.status(400).json({
            success: false,
            error: 'Parâmetros inválidos',
            details: result.error.errors
          });
        }
        
        req.params = result.data;
      }

      // Validar query se existir no schema
      if (schema.query) {
        console.log('[validateSchema] Validando a chave: query');
        const result = schema.query.safeParse(req.query);
        
        if (!result.success) {
          console.warn('[validateSchema] Erro na validação da query:', result.error.errors);
          return res.status(400).json({
            success: false,
            error: 'Query string inválida',
            details: result.error.errors
          });
        }
        
        req.query = result.data;
      }

      next();
    } catch (error) {
      console.error('[validateSchema] Erro inesperado durante a validação:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno de validação'
      });
    }
  };
}

module.exports = validateSchema;