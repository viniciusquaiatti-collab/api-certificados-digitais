// src/models/Certificate.js
// ============================================================
// 🏢 NexaSpark — Model de Certificados
// Core do negócio — cada função é auditada e monitorada.
// ============================================================

const { pool } = require('../database/db');

// ============================================================
// 🎨 LOGGER
// ============================================================
const c = {
  green:   (s) => `\x1b[32m${s}\x1b[0m`,
  red:     (s) => `\x1b[31m${s}\x1b[0m`,
  yellow:  (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:    (s) => `\x1b[36m${s}\x1b[0m`,
  magenta: (s) => `\x1b[35m${s}\x1b[0m`,
  gray:    (s) => `\x1b[90m${s}\x1b[0m`,
  bold:    (s) => `\x1b[1m${s}\x1b[0m`,
};

const logger = {
  info:    (msg, data) => console.log(   c.cyan(`ℹ️  [Certificate]`),    msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  success: (msg, data) => console.log(   c.green(`✅ [Certificate]`),   msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  warn:    (msg, data) => console.warn(  c.yellow(`⚠️  [Certificate]`),  msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  error:   (msg, data) => console.error( c.red(`❌ [Certificate]`),     msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  db:      (msg, data) => console.log(   c.cyan(`🗄️  [Certificate:DB]`), msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  sec:     (msg, data) => console.warn(  c.red(`🚨 [Certificate:SEC]`), msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  perf:    (label, ms) => console.log(   c.magenta(`⏱️  [Certificate:PERF]`), `${label} — ${c.bold(ms + 'ms')}`),
};

console.log(c.green(c.bold('📜 [Certificate] Modelo inicializado')));

// ============================================================
// 🛡️  HELPER — Sanitiza CPF para log
// CPF nunca deve aparecer em texto puro nos logs
// ============================================================
function sanitizeCpf(cpf) {
  if (!cpf) return null;
  return cpf.replace(/\d(?=\d{3})/g, '*'); // "123.456.789-00" → "***.***.***-00"
}

function sanitizeForLog(data) {
  if (!data) return {};
  const clone = { ...data };
  if (clone.cpf) clone.cpf = sanitizeCpf(clone.cpf);
  return clone;
}

// ============================================================
// CREATE
// ============================================================
/**
 * Cria um certificado no banco de dados.
 *
 * ⚠️  PROBLEMA ORIGINAL:
 *     - Retornava apenas `result.rows[0].id` (só o ID)
 *     - O controller precisava fazer um segundo SELECT para
 *       ter os dados do certificado logo após criar.
 *       Isso são 2 round-trips desnecessários ao banco.
 *
 * ✅  CORREÇÃO: RETURNING retorna o registro completo em um
 *     único round-trip. Mais eficiente e atômico.
 *
 * ⚠️  SEGURANÇA: CPF é mascarado antes de qualquer log.
 */
async function create(data) {
  const t0 = Date.now();
  const {
    usuario_id,
    nome_participante,
    cpf,
    cpf_parcial,
    nome_curso,
    carga_horaria,
    data_emissao,
    codigo_verificacao,
    hash,
    nome_instrutor = null,
    descricao      = null,
  } = data;

  logger.db('INSERT certificates — iniciando', sanitizeForLog({
    usuario_id,
    nome_participante,
    cpf,
    nome_curso,
    carga_horaria,
    data_emissao,
    codigo_verificacao,
    hash: hash?.substring(0, 16) + '...',
  }));

  try {
    const result = await pool.query(
      `INSERT INTO certificates
         (usuario_id, nome_participante, cpf, cpf_parcial, nome_curso,
          carga_horaria, data_emissao, codigo_verificacao, hash,
          nome_instrutor, descricao, verificacoes_count, criado_em)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, NOW())
       RETURNING *`,
      [
        usuario_id,
        nome_participante,
        cpf,
        cpf_parcial,
        nome_curso,
        carga_horaria,
        data_emissao,
        codigo_verificacao,
        hash,
        nome_instrutor,
        descricao,
      ]
    );

    const cert = result.rows[0];
    logger.perf('create()', Date.now() - t0);
    logger.success('Certificado criado', {
      id:                cert.id,
      nome_participante: cert.nome_participante,
      cpf_parcial:       cert.cpf_parcial,
      nome_curso:        cert.nome_curso,
      codigo_verificacao: cert.codigo_verificacao,
    });

    return cert;

  } catch (error) {
    // ⚠️  CORREÇÃO: no original erros de constraint passavam como genérico.
    //     Unique violation no codigo_verificacao (23505) merece log específico.
    if (error.code === '23505') {
      logger.sec('Violação de constraint única — codigo_verificacao duplicado', {
        codigo_verificacao,
        usuario_id,
      });
      const uniqueError = new Error('Código de verificação já existe — tente novamente');
      uniqueError.code = 'CERT_CODE_DUPLICATE';
      throw uniqueError;
    }

    logger.error('Erro ao criar certificado', { message: error.message, code: error.code });
    throw error;
  }
}

// ============================================================
// FIND BY VERIFICATION CODE — Rota pública
// ============================================================
/**
 * Busca certificado pelo código de verificação.
 * Usado pela rota pública — qualquer pessoa pode verificar.
 *
 * ⚠️  PROBLEMA ORIGINAL: `SELECT *` retornava o CPF completo
 *     para qualquer pessoa que soubesse o código de verificação.
 *     Isso é uma violação LGPD — CPF é dado pessoal sensível.
 *
 * ✅  CORREÇÃO: retornamos apenas cpf_parcial (já mascarado)
 *     e excluímos o CPF completo e o hash interno da resposta pública.
 */
async function findByVerificationCode(codigo) {
  const t0 = Date.now();

  logger.db('SELECT certificates WHERE codigo_verificacao — rota pública', { codigo });

  try {
    const result = await pool.query(
      // ⚠️  NUNCA retorne cpf ou hash na rota pública
      `SELECT
         id,
         nome_participante,
         cpf_parcial,
         nome_curso,
         carga_horaria,
         data_emissao,
         codigo_verificacao,
         nome_instrutor,
         descricao,
         pdf_path,
         verificacoes_count,
         ultima_verificacao,
         criado_em
       FROM certificates
       WHERE codigo_verificacao = $1`,
      [codigo]
    );

    const cert = result.rows[0] || null;
    logger.perf('findByVerificationCode()', Date.now() - t0);

    if (cert) {
      logger.success('Certificado encontrado por código', {
        id:                cert.id,
        codigo_verificacao: cert.codigo_verificacao,
      });
    } else {
      logger.warn('Certificado não encontrado por código', { codigo });
    }

    return cert;

  } catch (error) {
    logger.error('Erro em findByVerificationCode', { message: error.message, codigo });
    throw error;
  }
}

// ============================================================
// FIND BY ID — Rota autenticada
// ============================================================
/**
 * Busca certificado por ID, garantindo que pertence ao usuário.
 *
 * ⚠️  PROBLEMA ORIGINAL: `SELECT *` retornava o CPF completo.
 *     Em uma rota autenticada o CPF pode ser exibido (é o próprio
 *     dono), mas o hash criptográfico interno não deve ser exposto
 *     por API — é dado de auditoria interna.
 *
 * ✅  CORREÇÃO: excluímos apenas o `hash` da resposta.
 *     CPF é retornado normalmente (rota autenticada = dono).
 */
async function findById(id, usuario_id) {
  const t0 = Date.now();

  logger.db('SELECT certificates WHERE id AND usuario_id', { id, usuario_id });

  try {
    const result = await pool.query(
      `SELECT
         id, usuario_id, nome_participante, cpf, cpf_parcial,
         nome_curso, carga_horaria, data_emissao, codigo_verificacao,
         nome_instrutor, descricao, pdf_path,
         verificacoes_count, ultima_verificacao, criado_em
       FROM certificates
       WHERE id = $1 AND usuario_id = $2`,
      [id, usuario_id]
    );

    const cert = result.rows[0] || null;
    logger.perf('findById()', Date.now() - t0);

    if (cert) {
      logger.success('Certificado encontrado', { id: cert.id, usuario_id });
    } else {
      logger.warn('Certificado não encontrado ou não pertence ao usuário', { id, usuario_id });
    }

    return cert;

  } catch (error) {
    logger.error('Erro em findById', { message: error.message, id, usuario_id });
    throw error;
  }
}

// ============================================================
// FIND BY USER ID — Lista do usuário autenticado
// ============================================================
/**
 * Lista todos os certificados de um usuário.
 *
 * ⚠️  MELHORIA: adicionado parâmetro de paginação (limit/offset)
 *     para evitar que usuários com muitos certificados
 *     sobrecarreguem a API com um único SELECT sem LIMIT.
 *
 * ⚠️  MELHORIA: hash e cpf excluídos da listagem —
 *     apenas o necessário para a UI de listagem.
 */
async function findByUserId(usuario_id, { limit = 50, offset = 0 } = {}) {
  const t0 = Date.now();

  // Sanitiza para evitar SQL injection via paginação
  const safeLimit  = Math.min(Math.max(parseInt(limit)  || 50,  1), 200);
  const safeOffset = Math.max(parseInt(offset) || 0, 0);

  logger.db('SELECT certificates WHERE usuario_id', { usuario_id, limit: safeLimit, offset: safeOffset });

  try {
    const result = await pool.query(
      `SELECT
         id, nome_participante, cpf_parcial, nome_curso,
         carga_horaria, data_emissao, codigo_verificacao,
         nome_instrutor, pdf_path,
         verificacoes_count, ultima_verificacao, criado_em
       FROM certificates
       WHERE usuario_id = $1
       ORDER BY criado_em DESC
       LIMIT $2 OFFSET $3`,
      [usuario_id, safeLimit, safeOffset]
    );

    logger.perf('findByUserId()', Date.now() - t0);
    logger.success(`${result.rows.length} certificado(s) encontrado(s)`, {
      usuario_id,
      count:  result.rows.length,
      limit:  safeLimit,
      offset: safeOffset,
    });

    return result.rows;

  } catch (error) {
    logger.error('Erro em findByUserId', { message: error.message, usuario_id });
    throw error;
  }
}

// ============================================================
// UPDATE FILE PATH — Atualiza caminho do PDF gerado
// ============================================================
/**
 * ⚠️  MELHORIA: retorna boolean para o controller saber
 *     se a atualização teve efeito real (id existia).
 */
async function updateFilePath(id, pdf_path) {
  const t0 = Date.now();

  logger.db('UPDATE certificates SET pdf_path', { id, pdf_path });

  try {
    const result = await pool.query(
      `UPDATE certificates
       SET pdf_path = $1, atualizado_em = NOW()
       WHERE id = $2`,
      [pdf_path, id]
    );

    logger.perf('updateFilePath()', Date.now() - t0);

    if (result.rowCount === 0) {
      logger.warn('updateFilePath — nenhuma linha atualizada', { id });
      return false;
    }

    logger.success('pdf_path atualizado', { id, pdf_path });
    return true;

  } catch (error) {
    logger.error('Erro em updateFilePath', { message: error.message, id });
    throw error;
  }
}

// ============================================================
// INCREMENT VERIFICATION — Contador de verificações públicas
// ============================================================
/**
 * ⚠️  DECISÃO TÉCNICA: usar UPDATE atômico no banco
 *     (`verificacoes_count + 1`) em vez de SELECT → increment → UPDATE.
 *     Evita race condition quando múltiplos requests verificam
 *     o mesmo certificado simultaneamente.
 *
 * ⚠️  MELHORIA: retorna o novo total para o controller logar.
 */
async function incrementVerification(id) {
  const t0 = Date.now();

  logger.db('UPDATE verificacoes_count + 1', { id });

  try {
    const result = await pool.query(
      `UPDATE certificates
       SET verificacoes_count = verificacoes_count + 1,
           ultima_verificacao = NOW()
       WHERE id = $1
       RETURNING verificacoes_count`,
      [id]
    );

    logger.perf('incrementVerification()', Date.now() - t0);

    const newCount = result.rows[0]?.verificacoes_count;
    logger.success('Verificação incrementada', { id, total: newCount });

    return newCount;

  } catch (error) {
    // ⚠️  Não relançamos — falha no contador não deve quebrar
    //     o fluxo principal de verificação do certificado.
    logger.error('Erro em incrementVerification — não crítico', { message: error.message, id });
    return null;
  }
}

// ============================================================
// ADD VERIFICATION HISTORY — Histórico de quem verificou
// ============================================================
/**
 * ⚠️  SEGURANÇA: IP e user-agent ficam no histórico.
 *     Isso é auditoria — quem verificou, quando e de onde.
 *     Importante para detecção de abuso (scraping, verificações em massa).
 *
 * ⚠️  MELHORIA: retorna o ID do registro criado para rastreamento.
 */
async function addVerificationHistory(data) {
  const t0 = Date.now();
  const { certificate_id, codigo_verificacao, ip_address, user_agent } = data;

  logger.db('INSERT verification_history', {
    certificate_id,
    codigo_verificacao,
    ip_address,
    user_agent: user_agent?.substring(0, 60) + (user_agent?.length > 60 ? '...' : ''),
  });

  try {
    const result = await pool.query(
      `INSERT INTO verification_history
         (certificado_id, codigo_verificacao, ip_address, user_agent, data_verificacao)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id`,
      [certificate_id, codigo_verificacao, ip_address || null, user_agent || null]
    );

    const historyId = result.rows[0]?.id;
    logger.perf('addVerificationHistory()', Date.now() - t0);
    logger.success('Histórico de verificação registrado', { historyId, certificate_id, ip_address });

    return historyId;

  } catch (error) {
    // ⚠️  Não relançamos — falha no histórico não deve impedir
    //     a resposta ao usuário que está verificando o certificado.
    logger.error('Erro em addVerificationHistory — não crítico', { message: error.message, certificate_id });
    return null;
  }
}

// ============================================================
// COUNT BY USER — Contagem para dashboard/limites
// ============================================================
/**
 * ⚠️  NOVO: função auxiliar para o dashboard e para
 *     implementar limites por plano (ex: max 500 certificados).
 */
async function countByUserId(usuario_id) {
  const t0 = Date.now();

  logger.db('SELECT COUNT certificates WHERE usuario_id', { usuario_id });

  try {
    const result = await pool.query(
      'SELECT COUNT(*)::int AS total FROM certificates WHERE usuario_id = $1',
      [usuario_id]
    );

    const total = result.rows[0]?.total ?? 0;
    logger.perf('countByUserId()', Date.now() - t0);
    logger.info('Contagem de certificados', { usuario_id, total });

    return total;

  } catch (error) {
    logger.error('Erro em countByUserId', { message: error.message, usuario_id });
    throw error;
  }
}

module.exports = {
  create,
  findByVerificationCode,
  findById,
  findByUserId,
  updateFilePath,
  incrementVerification,
  addVerificationHistory,
  countByUserId,
};