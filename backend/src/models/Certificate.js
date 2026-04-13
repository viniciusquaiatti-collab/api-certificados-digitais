// src/models/Certificate.js
const { pool } = require('../database/db');

console.log('--- [Certificate] Iniciando modelo de certificados ---');

/**
 * Criar certificado
 */
async function create(data) {
  const { usuario_id, nome_participante, cpf, cpf_parcial, nome_curso, carga_horaria, data_emissao, codigo_verificacao, hash } = data;
  
  try {
    const result = await pool.query(
      `INSERT INTO certificates 
      (usuario_id, nome_participante, cpf, cpf_parcial, nome_curso, carga_horaria, data_emissao, codigo_verificacao, hash, verificacoes_count, criado_em)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, NOW())
      RETURNING id`,
      [usuario_id, nome_participante, cpf, cpf_parcial, nome_curso, carga_horaria, data_emissao, codigo_verificacao, hash]
    );
    
    console.log(`✅ [Certificate] Certificado criado: ID ${result.rows[0].id}`);
    
    return result.rows[0].id;
  } catch (error) {
    console.error('❌ [Certificate] Erro ao criar certificado:', error.message);
    throw error;
  }
}

/**
 * Buscar por código de verificação (PÚBLICO)
 */
async function findByVerificationCode(codigo) {
  try {
    const result = await pool.query(
      `SELECT * FROM certificates WHERE codigo_verificacao = $1`,
      [codigo]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error('❌ [Certificate] Erro ao buscar certificado:', error.message);
    throw error;
  }
}

/**
 * Buscar por ID (AUTENTICADO)
 */
async function findById(id, usuario_id) {
  try {
    const result = await pool.query(
      `SELECT * FROM certificates WHERE id = $1 AND usuario_id = $2`,
      [id, usuario_id]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error('❌ [Certificate] Erro ao buscar certificado por ID:', error.message);
    throw error;
  }
}

/**
 * Buscar por usuário (AUTENTICADO)
 */
async function findByUserId(usuario_id) {
  try {
    const result = await pool.query(
      `SELECT id, nome_participante, cpf_parcial, nome_curso, carga_horaria, data_emissao, codigo_verificacao, verificacoes_count, ultima_verificacao, criado_em
       FROM certificates 
       WHERE usuario_id = $1 
       ORDER BY criado_em DESC`,
      [usuario_id]
    );
    
    return result.rows;
  } catch (error) {
    console.error('❌ [Certificate] Erro ao buscar certificados do usuário:', error.message);
    throw error;
  }
}

/**
 * Atualizar URL do PDF
 */
async function updateFilePath(id, pdf_path) {
  try {
    await pool.query(
      'UPDATE certificates SET pdf_path = $1 WHERE id = $2',
      [pdf_path, id]
    );
  } catch (error) {
    console.error('❌ [Certificate] Erro ao atualizar PDF:', error.message);
    throw error;
  }
}

/**
 * Incrementar contador de verificações
 */
async function incrementVerification(id) {
  try {
    await pool.query(
      `UPDATE certificates 
       SET verificacoes_count = verificacoes_count + 1, 
           ultima_verificacao = NOW() 
       WHERE id = $1`,
      [id]
    );
  } catch (error) {
    console.error('❌ [Certificate] Erro ao incrementar verificação:', error.message);
  }
}

/**
 * Adicionar histórico de verificação
 */
async function addVerificationHistory(data) {
  const { certificate_id, codigo_verificacao, ip_address, user_agent } = data;
  
  try {
    await pool.query(
      `INSERT INTO verification_history (certificado_id, codigo_verificacao, ip_address, user_agent, data_verificacao)
       VALUES ($1, $2, $3, $4, NOW())`,
      [certificate_id, codigo_verificacao, ip_address, user_agent]
    );
  } catch (error) {
    console.error('❌ [Certificate] Erro ao adicionar histórico:', error.message);
  }
}

module.exports = {
  create,
  findByVerificationCode,
  findById,
  findByUserId,
  updateFilePath,
  incrementVerification,
  addVerificationHistory
};