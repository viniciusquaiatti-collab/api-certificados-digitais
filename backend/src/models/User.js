// src/models/User.js

const { pool } = require('../database/db');

// ============================================================
// 🏢 LOGGER — Enterprise Grade | NexaSpark User Model
// ============================================================
const chalk = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  gray:   (s) => `\x1b[90m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
};

const logger = {
  info:    (msg, data) => console.log( chalk.cyan(`ℹ️  [User]`),  msg, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  success: (msg, data) => console.log( chalk.green(`✅ [User]`),  msg, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  warn:    (msg, data) => console.warn(chalk.yellow(`⚠️  [User]`), msg, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  error:   (msg, data) => console.error(chalk.red(`❌ [User]`),   msg, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  db:      (msg, data) => console.log( chalk.cyan(`🗄️  [User:DB]`), msg, data !== undefined ? chalk.gray(JSON.stringify(data)) : ''),
  perf:    (label, ms) => console.log( `\x1b[35m⏱️  [User:PERF]\x1b[0m ${label} — ${chalk.bold(ms + 'ms')}`),
};

console.log(chalk.green(chalk.bold('🗄️  [User] Modelo inicializado')));

// ============================================================
// 📋 HELPER — Sanitiza dados antes de logar (nunca expõe hash)
// ============================================================
function sanitize(obj) {
  if (!obj) return null;
  const clone = { ...obj };
  if (clone.senha_hash) clone.senha_hash = '[REDACTED]';
  return clone;
}

// ============================================================
// CREATE
// ============================================================
/**
 * Cria um novo usuário no banco de dados.
 *
 * ⚠️  MELHORIA EM RELAÇÃO AO ORIGINAL:
 *     - Email é normalizado (lower + trim) antes de inserir
 *     - Erro de constraint única (email duplicado) é tratado
 *       explicitamente com mensagem clara, não como erro genérico
 *     - Log de performance por operação de banco
 */
async function create({ email, senha_hash }) {
  const t0 = Date.now();
  const emailNorm = email?.trim().toLowerCase();

  logger.db('INSERT users — iniciando', { email: emailNorm });

  try {
    const result = await pool.query(
      `INSERT INTO users (email, senha_hash, criado_em)
       VALUES ($1, $2, NOW())
       RETURNING id, email, criado_em`,
      [emailNorm, senha_hash]
    );

    const user = result.rows[0];
    logger.perf('create()', Date.now() - t0);
    logger.success('Usuário criado', sanitize(user));

    return user;

  } catch (error) {
    // ⚠️  CORREÇÃO: no original, erros de constraint (email único)
    //     eram relançados como erro genérico. Agora tratamos
    //     especificamente o código 23505 do PostgreSQL.
    if (error.code === '23505') {
      logger.warn('Violação de constraint — email duplicado', { email: emailNorm });
      const uniqueError = new Error('Email já cadastrado');
      uniqueError.code = 'EMAIL_DUPLICATE';
      throw uniqueError;
    }

    logger.error('Erro ao criar usuário', { message: error.message, code: error.code });
    throw error;
  }
}

// ============================================================
// FIND BY EMAIL
// ============================================================
/**
 * Busca usuário pelo email.
 *
 * ⚠️  MELHORIA: normaliza email antes da query.
 *     No original, "User@Gmail.com" não encontraria "user@gmail.com".
 */
async function findByEmail(email) {
  const t0 = Date.now();
  const emailNorm = email?.trim().toLowerCase();

  logger.db('SELECT users WHERE email — iniciando', { email: emailNorm });

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [emailNorm]
    );

    const user = result.rows[0] || null;
    logger.perf('findByEmail()', Date.now() - t0);

    if (user) {
      logger.success('Usuário encontrado', { id: user.id, email: user.email });
    } else {
      logger.info('Usuário não encontrado', { email: emailNorm });
    }

    return user;

  } catch (error) {
    logger.error('Erro em findByEmail', { message: error.message, email: emailNorm });
    throw error;
  }
}

// ============================================================
// FIND BY ID
// ============================================================
/**
 * Busca usuário pelo ID.
 * Não retorna senha_hash — apenas campos seguros.
 */
async function findById(id) {
  const t0 = Date.now();

  logger.db('SELECT users WHERE id — iniciando', { id });

  try {
    const result = await pool.query(
      'SELECT id, email, criado_em FROM users WHERE id = $1',
      [id]
    );

    const user = result.rows[0] || null;
    logger.perf('findById()', Date.now() - t0);

    if (user) {
      logger.success('Usuário encontrado por ID', { id: user.id, email: user.email });
    } else {
      logger.warn('Usuário não encontrado por ID', { id });
    }

    return user;

  } catch (error) {
    logger.error('Erro em findById', { message: error.message, id });
    throw error;
  }
}

// ============================================================
// UPDATE PASSWORD
// ============================================================
/**
 * Atualiza o hash de senha do usuário.
 *
 * ⚠️  MELHORIA: verifica se a linha foi de fato atualizada (rowCount).
 *     No original, um ID inexistente passaria silenciosamente.
 */
async function updatePassword(id, senha_hash) {
  const t0 = Date.now();

  logger.db('UPDATE users SET senha_hash — iniciando', { id });

  try {
    const result = await pool.query(
      'UPDATE users SET senha_hash = $1 WHERE id = $2',
      [senha_hash, id]
    );

    logger.perf('updatePassword()', Date.now() - t0);

    if (result.rowCount === 0) {
      logger.warn('updatePassword — nenhuma linha atualizada', { id });
      return false;
    }

    logger.success('Senha atualizada', { id });
    return true;

  } catch (error) {
    logger.error('Erro em updatePassword', { message: error.message, id });
    throw error;
  }
}

// ============================================================
// DELETE BY ID
// ============================================================
/**
 * Remove usuário do banco.
 *
 * ⚠️  MELHORIA: retorna boolean indicando se o usuário existia.
 */
async function deleteById(id) {
  const t0 = Date.now();

  logger.db('DELETE FROM users WHERE id — iniciando', { id });

  try {
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1',
      [id]
    );

    logger.perf('deleteById()', Date.now() - t0);

    if (result.rowCount === 0) {
      logger.warn('deleteById — usuário não encontrado para deletar', { id });
      return false;
    }

    logger.success('Usuário deletado', { id });
    return true;

  } catch (error) {
    logger.error('Erro em deleteById', { message: error.message, id });
    throw error;
  }
}

module.exports = {
  create,
  findByEmail,
  findById,
  updatePassword,
  deleteById,
};