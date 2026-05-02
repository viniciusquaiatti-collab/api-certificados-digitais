// src/middlewares/validateSchema.js
// ============================================================
// 🏢 NexaSpark — Middleware de Validação com Zod
// ============================================================

const c = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  gray:   (s) => `\x1b[90m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
};

const logger = {
  info:    (msg, data) => console.log( c.cyan(`ℹ️  [validateSchema]`),   msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  success: (msg, data) => console.log( c.green(`✅ [validateSchema]`),   msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  warn:    (msg, data) => console.warn(c.yellow(`⚠️  [validateSchema]`),  msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  error:   (msg, data) => console.error(c.red(`❌ [validateSchema]`),    msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
};

console.log(c.green(c.bold('🛡️  [validateSchema] Middleware de validação carregado')));

// ============================================================
// 🛡️  SANITIZE FOR LOG
//
// ⚠️  PROBLEMA ORIGINAL: o middleware logava req.body completo,
//     expondo senhas nos logs em texto puro.
//     Nunca logue dados sensíveis diretamente.
// ============================================================
function sanitizeForLog(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = { ...obj };
  if (clone.password)   clone.password   = `[${String(clone.password).length} chars]`;
  if (clone.senha)      clone.senha      = '[REDACTED]';
  if (clone.senha_hash) clone.senha_hash = '[REDACTED]';
  if (clone.cpf)        clone.cpf        = clone.cpf.replace(/\d(?=\d{3})/g, '*');
  return clone;
}

// ============================================================
// 🛡️  FORMAT ZOD ERRORS
//
// ⚠️  MELHORIA: o original retornava result.error.errors (array bruto do Zod)
//     diretamente para o cliente — verboso e inconsistente.
//     Agora formatamos em array de { field, message } limpo e legível.
// ============================================================
function formatZodErrors(errors) {
  return errors.map((err) => ({
    field:   err.path.join('.') || 'unknown',
    message: err.message,
    code:    err.code,
  }));
}

// ============================================================
// 🛡️  VALIDATE SCHEMA MIDDLEWARE
//
// Valida body, params e query contra schemas Zod.
// Uso: router.post('/rota', validateSchema(meuSchema), controller)
//
// O schema deve ter o formato:
// {
//   body?:   z.ZodObject,
//   params?: z.ZodObject,
//   query?:  z.ZodObject,
// }
// ============================================================
function validateSchema(schema) {
  // ⚠️  NOVO: valida em tempo de boot que o schema foi passado corretamente
  if (!schema || typeof schema !== 'object') {
    throw new Error('[validateSchema] Schema inválido — deve ser um objeto com body/params/query');
  }

  return (req, res, next) => {
    const requestId = req.requestId || req.headers['x-request-id'] || `val_${Date.now()}`;
    const route     = `${req.method} ${req.originalUrl}`;

    logger.info(`Iniciando validação → ${route}`, { requestId });

    // ── Valida body ───────────────────────────────────────
    if (schema.body) {
      logger.info('Validando body...', sanitizeForLog(req.body));

      const result = schema.body.safeParse(req.body);

      if (!result.success) {
        const errors = formatZodErrors(result.error.errors);
        logger.warn(`Body inválido em ${route}`, { errors, requestId });

        return res.status(400).json({
          success: false,
          error:   'Dados inválidos',
          code:    'VALIDATION_ERROR',
          details: errors,
        });
      }

      // ✅ Substitui req.body pelos dados parsed/coerced pelo Zod
      //    (garante tipos corretos mesmo que chegue como string)
      req.body = result.data;
      logger.success('Body validado com sucesso');
    }

    // ── Valida params ─────────────────────────────────────
    if (schema.params) {
      logger.info('Validando params...', req.params);

      const result = schema.params.safeParse(req.params);

      if (!result.success) {
        const errors = formatZodErrors(result.error.errors);
        logger.warn(`Params inválidos em ${route}`, { errors, requestId });

        return res.status(400).json({
          success: false,
          error:   'Parâmetros de rota inválidos',
          code:    'VALIDATION_ERROR_PARAMS',
          details: errors,
        });
      }

      req.params = result.data;
      logger.success('Params validados com sucesso');
    }

    // ── Valida query ──────────────────────────────────────
    if (schema.query) {
      logger.info('Validando query...', req.query);

      const result = schema.query.safeParse(req.query);

      if (!result.success) {
        const errors = formatZodErrors(result.error.errors);
        logger.warn(`Query inválida em ${route}`, { errors, requestId });

        return res.status(400).json({
          success: false,
          error:   'Query string inválida',
          code:    'VALIDATION_ERROR_QUERY',
          details: errors,
        });
      }

      req.query = result.data;
      logger.success('Query validada com sucesso');
    }

    logger.success(`Validação completa → ${route}`, { requestId });
    next();
  };
}

module.exports = validateSchema;