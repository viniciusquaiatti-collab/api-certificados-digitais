// src/models/User.js
const { pool } = require('../database/db');

console.log('--- [User] Iniciando modelo de usuário ---');

/**
 * Criar novo usuário
 */
async function create({ email, senha_hash }) {
  try {
    const result = await pool.query(
      `INSERT INTO users (email, senha_hash, criado_em)
       VALUES ($1, $2, NOW())
       RETURNING id, email, criado_em`,
      [email, senha_hash]
    );
    
    console.log(` [User] Usuário criado: ${email} (ID: ${result.rows[0].id})`);
    
    return result.rows[0];
  } catch (error) {
    console.error(' [User] Erro ao criar usuário:', error.message);
    throw error;
  }
}

/**
 * Buscar usuário por email
 */
async function findByEmail(email) {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error(' [User] Erro ao buscar usuário:', error.message);
    throw error;
  }
}

/**
 * Buscar usuário por ID
 */
async function findById(id) {
  try {
    const result = await pool.query(
      'SELECT id, email, criado_em FROM users WHERE id = $1',
      [id]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error(' [User] Erro ao buscar usuário por ID:', error.message);
    throw error;
  }
}

/**
 * Atualizar senha
 */
async function updatePassword(id, senha_hash) {
  try {
    await pool.query(
      'UPDATE users SET senha_hash = $1 WHERE id = $2',
      [senha_hash, id]
    );
  } catch (error) {
    console.error(' [User] Erro ao atualizar senha:', error.message);
    throw error;
  }
}

/**
 * Deletar usuário
 */
async function deleteById(id) {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
  } catch (error) {
    console.error(' [User] Erro ao deletar usuário:', error.message);
    throw error;
  }
}

module.exports = {
  create,
  findByEmail,
  findById,
  updatePassword,
  deleteById
};