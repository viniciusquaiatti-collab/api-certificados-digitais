// src/models/AuditLog.js
const { pool } = require('../database/db');

console.log('--- [AuditLog] Iniciando modelo de auditoria ---');

/**
 * Registra uma ação no log de auditoria
 */
async function create(data) {
  const { usuario_id, acao, detalhe, ip_address, user_agent } = data;
  
  try {
    const result = await pool.query(
      `INSERT INTO audit_logs (usuario_id, acao, detalhe, ip_address, user_agent, criado_em)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id`,
      [usuario_id || null, acao, detalhe, ip_address || null, user_agent || null]
    );
    
    console.log(` [AuditLog] Ação registrada: ${acao} (ID: ${result.rows[0].id})`);
    
    return result.rows[0].id;
  } catch (error) {
    console.error(' [AuditLog] Erro ao registrar ação:', error.message);
    return null;
  }
}

/**
 * Busca logs por usuário
 */
async function findByUserId(usuario_id, limit = 100) {
  try {
    const result = await pool.query(
      `SELECT * FROM audit_logs 
       WHERE usuario_id = $1 
       ORDER BY criado_em DESC 
       LIMIT $2`,
      [usuario_id, limit]
    );
    
    return result.rows;
  } catch (error) {
    console.error(' [AuditLog] Erro ao buscar logs:', error.message);
    return [];
  }
}

/**
 * Busca logs por ação
 */
async function findByAction(acao, limit = 100) {
  try {
    const result = await pool.query(
      `SELECT * FROM audit_logs 
       WHERE acao = $1 
       ORDER BY criado_em DESC 
       LIMIT $2`,
      [acao, limit]
    );
    
    return result.rows;
  } catch (error) {
    console.error(' [AuditLog] Erro ao buscar logs:', error.message);
    return [];
  }
}

/**
 * Busca todos os logs
 */
async function findAll(limit = 100) {
  try {
    const result = await pool.query(
      `SELECT * FROM audit_logs 
       ORDER BY criado_em DESC 
       LIMIT $1`,
      [limit]
    );
    
    return result.rows;
  } catch (error) {
    console.error(' [AuditLog] Erro ao buscar logs:', error.message);
    return [];
  }
}

module.exports = {
  create,
  findByUserId,
  findByAction,
  findAll
};