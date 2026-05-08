// src/models/Certificate.js
// ============================================================
// 🏢 NexaSpark — Certificate Model v2.0 ENTERPRISE
//
// Camada de acesso ao banco de dados para certificados.
// Zero lógica de negócio aqui — apenas SQL + logging.
//
// ✅ v2 — ADIÇÕES E CORREÇÕES:
//   🔐 updateHashPreview() — salva hash_preview no banco
//      Necessário para o DNA visual no frontend funcionar
//   🔍 findByVerificationCode() — agora retorna hash_preview
//      Campo adicionado ao SELECT para a rota /verify
//   📊 Logger enterprise alinhado com controller e service
//   ⚡ Timestamps ISO em todos os logs para correlação
//   🛡️  CPF nunca em texto puro nos logs (LGPD Art. 37)
//   🗄️  Hints de migration SQL embutidos nos erros
//   📈 Performance semafórica (⚡🟡🟠🔴) em todas as queries
//
// ⚠️  MIGRATION NECESSÁRIA (Supabase SQL Editor):
//   ALTER TABLE certificates
//     ADD COLUMN IF NOT EXISTS hash_preview VARCHAR(64),
//     ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ;
//
//   -- Retroativo para certificados antigos:
//   UPDATE certificates
//     SET hash_preview = UPPER(SUBSTRING(hash, 1, 32))
//   WHERE hash_preview IS NULL AND hash IS NOT NULL;
// ============================================================

const { pool } = require('../database/db');

// ============================================================
// 🎨 ENTERPRISE LOGGER — NexaSpark Global Debug System v2
//
// Alinhado com certificateController.js e certificateService.js
// para consistência visual total no terminal Railway/local.
//
// Cada linha de log tem:
//   — Timestamp ISO (correlação entre serviços)
//   — Emoticon por domínio (escaneamento visual rápido)
//   — Prefixo [MODEL:scope] (grep/filter no Railway)
//   — Performance semafórica com thresholds por operação
// ============================================================

const ANSI = {
  reset:         '\x1b[0m',
  bold:          '\x1b[1m',
  dim:           '\x1b[2m',
  red:           '\x1b[31m',
  green:         '\x1b[32m',
  yellow:        '\x1b[33m',
  blue:          '\x1b[34m',
  magenta:       '\x1b[35m',
  cyan:          '\x1b[36m',
  white:         '\x1b[37m',
  gray:          '\x1b[90m',
  brightRed:     '\x1b[91m',
  brightGreen:   '\x1b[92m',
  brightYellow:  '\x1b[93m',
  brightBlue:    '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan:    '\x1b[96m',
  brightWhite:   '\x1b[97m',
  bgRed:         '\x1b[41m',
  bgGreen:       '\x1b[42m',
  bgYellow:      '\x1b[43m',
};

const c = {
  green:         (s) => `${ANSI.green}${s}${ANSI.reset}`,
  brightGreen:   (s) => `${ANSI.brightGreen}${s}${ANSI.reset}`,
  red:           (s) => `${ANSI.red}${s}${ANSI.reset}`,
  brightRed:     (s) => `${ANSI.brightRed}${s}${ANSI.reset}`,
  yellow:        (s) => `${ANSI.yellow}${s}${ANSI.reset}`,
  brightYellow:  (s) => `${ANSI.brightYellow}${s}${ANSI.reset}`,
  cyan:          (s) => `${ANSI.cyan}${s}${ANSI.reset}`,
  brightCyan:    (s) => `${ANSI.brightCyan}${s}${ANSI.reset}`,
  magenta:       (s) => `${ANSI.magenta}${s}${ANSI.reset}`,
  brightMagenta: (s) => `${ANSI.brightMagenta}${s}${ANSI.reset}`,
  blue:          (s) => `${ANSI.blue}${s}${ANSI.reset}`,
  brightBlue:    (s) => `${ANSI.brightBlue}${s}${ANSI.reset}`,
  white:         (s) => `${ANSI.white}${s}${ANSI.reset}`,
  brightWhite:   (s) => `${ANSI.brightWhite}${s}${ANSI.reset}`,
  gray:          (s) => `${ANSI.gray}${s}${ANSI.reset}`,
  bold:          (s) => `${ANSI.bold}${s}${ANSI.reset}`,
  dim:           (s) => `${ANSI.dim}${s}${ANSI.reset}`,
  danger:        (s) => `${ANSI.bgRed}${ANSI.brightWhite}${ANSI.bold} ${s} ${ANSI.reset}`,
  ok:            (s) => `${ANSI.bgGreen}${ANSI.white}${ANSI.bold} ${s} ${ANSI.reset}`,
};

// Timestamp ISO — correlação entre model, controller e service
const ts = () => c.gray(`[${new Date().toISOString()}]`);

// Serializa payload para log — JSON compacto, trata circular refs
const fmt = (data) => {
  if (data === undefined || data === null) return '';
  try   { return c.gray(JSON.stringify(data, null, 0)); }
  catch { return c.gray('[não serializável]'); }
};

// Performance semafórica — thresholds calibrados para queries PostgreSQL
// < 50ms   → ⚡ verde  (índice usado, cache hit)
// < 200ms  → 🟡 amarelo (query ok, sem índice ou tabela grande)
// < 1000ms → 🟠 laranja (query lenta — verificar EXPLAIN ANALYZE)
// >= 1000ms → 🔴 vermelho (query crítica — indexar urgente)
const fmtMs = (ms) =>
  ms < 50   ? c.brightGreen(`${ms}ms ⚡`) :
  ms < 200  ? c.brightYellow(`${ms}ms 🟡`) :
  ms < 1000 ? c.yellow(`${ms}ms 🟠`) :
              c.brightRed(`${ms}ms 🔴 QUERY LENTA — verifique EXPLAIN ANALYZE`);

const logger = {
  // ── Informativos ─────────────────────────────────────────
  info:    (scope, msg, data) => console.log(
    ts(), c.brightCyan(`ℹ️  [MODEL:${scope}]`), c.white(msg), fmt(data)
  ),

  // ── Sucesso ──────────────────────────────────────────────
  success: (scope, msg, data) => console.log(
    ts(), c.brightGreen(`✅ [MODEL:${scope}]`), c.brightWhite(msg), fmt(data)
  ),

  // ── Aviso ────────────────────────────────────────────────
  warn:    (scope, msg, data) => console.warn(
    ts(), c.brightYellow(`⚠️  [MODEL:${scope}]`), c.yellow(msg), fmt(data)
  ),

  // ── Erro ─────────────────────────────────────────────────
  error:   (scope, msg, data) => console.error(
    ts(), c.brightRed(`❌ [MODEL:${scope}]`), c.red(c.bold(msg)), fmt(data)
  ),

  // ── Performance semafórica ────────────────────────────────
  perf:    (scope, label, ms) => console.log(
    ts(), c.magenta(`⏱️  [MODEL:${scope}]`), c.white(label), '→', fmtMs(ms)
  ),

  // ── SQL / Database ────────────────────────────────────────
  sql:     (scope, operation, data) => console.log(
    ts(), c.brightYellow(`🗄️  [MODEL:SQL:${scope}]`), c.white(operation), fmt(data)
  ),

  // ── Segurança ─────────────────────────────────────────────
  sec:     (msg, data) => console.warn(
    ts(), c.danger('🚨 SECURITY'), c.red(c.bold(msg)), fmt(data)
  ),

  // ── LGPD ─────────────────────────────────────────────────
  lgpd:    (msg, data) => console.log(
    ts(), c.brightGreen(`🛡️  [MODEL:LGPD]`), c.white(msg), fmt(data)
  ),

  // ── Separadores ───────────────────────────────────────────
  sep:     () => console.log(c.gray('─'.repeat(72))),
  sepBold: () => console.log(c.brightGreen('═'.repeat(72))),

  // ── Tabela key-value ──────────────────────────────────────
  table:   (scope, data) => {
    console.log(ts(), c.cyan(`📊 [MODEL:${scope}]`));
    Object.entries(data).forEach(([k, v]) => {
      const key = c.gray(`   ${k.padEnd(28)}`);
      const val = c.brightWhite(String(v ?? '—'));
      console.log(`${key} ${val}`);
    });
  },

  // ── Stack trace formatado ─────────────────────────────────
  stack:   (scope, error) => {
    const lines = (error.stack || error.message || String(error)).split('\n').slice(0, 5);
    console.error(ts(), c.brightRed(`💥 [MODEL:${scope}:STACK]`));
    lines.forEach(line => console.error(c.red(`   ${line}`)));
  },

  // ── Resultado final ───────────────────────────────────────
  result:  (scope, status, data) => {
    const icon  = status === 'ok' ? '✅' : status === 'warn' ? '⚠️ ' : '❌';
    const label = status === 'ok' ? 'SUCCESS' : status === 'warn' ? 'WARNING' : 'FAILURE';
    const color = status === 'ok' ? c.brightGreen : status === 'warn' ? c.brightYellow : c.brightRed;
    console.log(ts(), color(`${icon} [MODEL:${scope}] ${label}`), fmt(data));
  },
};

// ============================================================
// 🖥️  BOOT — Model inicializado
// ============================================================
logger.sep();
console.log(`${ANSI.brightGreen}📜  ${ANSI.bold}${ANSI.brightWhite}NexaSpark Certificate Model v2.0 ENTERPRISE${ANSI.reset}`);
logger.info('BOOT', 'Model carregado e pronto', {
  env:       process.env.NODE_ENV || 'development',
  pid:       process.pid,
  migration: 'ALTER TABLE certificates ADD COLUMN IF NOT EXISTS hash_preview VARCHAR(64)',
  hint:      'Se hash_preview aparecer como null, rode a migration acima no Supabase',
});
logger.sep();

// ============================================================
// 🛡️  HELPERS — Sanitização e formatação
// ============================================================

/**
 * Mascara CPF para logs — LGPD Art. 37.
 * "123.456.789-00" → "***.***.***-00"
 * Apenas os 2 últimos dígitos são preservados.
 */
function sanitizeCpf(cpf) {
  if (!cpf) return null;
  const digits = String(cpf).replace(/\D/g, '');
  return `***.***.***-${digits.slice(-2)}`;
}

/**
 * Sanitiza objeto de dados para log seguro.
 * Remove CPF completo e trunca hash SHA-256.
 */
function sanitizeForLog(data) {
  if (!data || typeof data !== 'object') return {};
  const clone = { ...data };

  if (clone.cpf) {
    clone.cpf = sanitizeCpf(clone.cpf);
    logger.lgpd('CPF mascarado para log', { sufixo: String(data.cpf).replace(/\D/g,'').slice(-2) });
  }
  if (clone.hash && String(clone.hash).length > 16) {
    clone.hash = clone.hash.substring(0, 16) + '...[TRUNCADO]';
  }
  if (clone.hashPreview && String(clone.hashPreview).length > 16) {
    clone.hashPreview = clone.hashPreview.substring(0, 16) + '...';
  }
  if (clone.password || clone.senha) {
    clone.password = clone.senha = '[REDACTED]';
  }

  return clone;
}

// ============================================================
// 🎓 CREATE — Insere certificado no banco
//
// ✅ RETURNING * — único round-trip, sem SELECT adicional
// ✅ Constraint 23505 tratada com erro tipado
// ✅ CPF mascarado em todos os logs
// ============================================================
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

  logger.sql('CREATE', 'INSERT INTO certificates — iniciando', sanitizeForLog({
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
    // ⚠️  RETURNING * — evita segundo SELECT após INSERT
    //     Atômico e eficiente: 1 round-trip ao banco, não 2
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

    logger.perf('CREATE', 'INSERT INTO certificates', Date.now() - t0);
    logger.result('CREATE', 'ok', {
      id:                cert.id,
      nome_participante: cert.nome_participante,
      cpf_parcial:       cert.cpf_parcial,
      nome_curso:        cert.nome_curso,
      codigo_verificacao: cert.codigo_verificacao,
      criado_em:         cert.criado_em,
      hash_preview_slot: '⏳ será salvo após geração do PDF',
    });

    return cert;

  } catch (error) {
    logger.perf('CREATE', 'INSERT falhou em', Date.now() - t0);

    // Unique violation — codigo_verificacao duplicado (astronomicamente raro)
    if (error.code === '23505') {
      logger.sec('Violação de UNIQUE constraint — codigo_verificacao duplicado', {
        codigo_verificacao,
        usuario_id,
        pg_error:  error.code,
        hint:      'crypto.randomBytes(8) deve ser re-executado pelo controller',
        impacto:   'Nenhum dado corrompido — INSERT foi rejeitado pelo banco',
      });

      const uniqueError     = new Error('Código de verificação já existe — tente novamente');
      uniqueError.code      = 'CERT_CODE_DUPLICATE';
      uniqueError.retryable = true;
      throw uniqueError;
    }

    // Foreign key — usuario_id não existe
    if (error.code === '23503') {
      logger.error('CREATE', '🚨 Foreign key violation — usuario_id não existe', {
        usuario_id,
        pg_error: error.code,
        hint:     'Usuário foi deletado entre o login e a emissão?',
      });
    }

    logger.error('CREATE', 'Erro ao inserir certificado', {
      message:  error.message,
      pg_code:  error.code,
      pg_detail: error.detail,
    });
    logger.stack('CREATE', error);

    throw error;
  }
}

// ============================================================
// 🔍 FIND BY VERIFICATION CODE — Rota pública
//
// ✅ v2: inclui hash_preview no SELECT
//    — necessário para o DNA visual no frontend
// ✅ NUNCA retorna cpf ou hash completo (LGPD + segurança)
// ✅ Auditoria de acesso público embutida no log
// ============================================================
async function findByVerificationCode(codigo) {
  const t0 = Date.now();

  logger.sql('FIND_BY_CODE', 'SELECT certificates WHERE codigo_verificacao', {
    codigo,
    acesso:    'PÚBLICO — sem autenticação',
    lgpd_note: 'CPF completo e hash excluídos do SELECT',
  });

  try {
    const result = await pool.query(
      // ⚠️  SEGURANÇA: NUNCA retornar cpf (completo) ou hash em rota pública
      // ✅  v2: hash_preview incluído — necessário para DNA visual no frontend
      //
      // Campos retornados e suas justificativas:
      //   id                  → referência interna
      //   nome_participante   → exibição pública (nome do certificado)
      //   cpf_parcial         → LGPD — apenas 2 últimos dígitos
      //   nome_curso          → dados do certificado
      //   carga_horaria       → dados do certificado
      //   data_emissao        → dados do certificado
      //   codigo_verificacao  → código que foi buscado
      //   nome_instrutor      → dados opcionais do certificado
      //   descricao           → dados opcionais do certificado
      //   pdf_path            → link para download do PDF
      //   hash_preview        → ✅ v2: 32 chars para DNA visual no frontend
      //   verificacoes_count  → contador para exibição ("3ª verificação")
      //   ultima_verificacao  → timestamp da última verificação
      //   criado_em           → data de emissão do certificado
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
         hash_preview,
         verificacoes_count,
         ultima_verificacao,
         criado_em
       FROM certificates
       WHERE codigo_verificacao = $1`,
      [codigo]
    );

    const cert = result.rows[0] || null;

    logger.perf('FIND_BY_CODE', 'SELECT WHERE codigo_verificacao', Date.now() - t0);

    if (cert) {
      logger.result('FIND_BY_CODE', 'ok', {
        id:                cert.id,
        nome_participante: cert.nome_participante,
        nome_curso:        cert.nome_curso,
        codigo_verificacao: cert.codigo_verificacao,
        hash_preview:      cert.hash_preview
          ? cert.hash_preview.substring(0, 16) + '... ✅'
          : '❌ null — migration pendente ou certificado antigo',
        verificacoes_count: cert.verificacoes_count,
        pdf_presente:       cert.pdf_path ? '✅' : '❌ null',
      });
    } else {
      logger.result('FIND_BY_CODE', 'warn', {
        codigo,
        encontrado: false,
        hint:       'Código inválido, expirado ou não existe no banco',
      });
    }

    return cert;

  } catch (error) {
    logger.perf('FIND_BY_CODE', 'SELECT falhou em', Date.now() - t0);
    logger.error('FIND_BY_CODE', 'Erro ao buscar por código de verificação', {
      message:  error.message,
      pg_code:  error.code,
      codigo,
      hint:     'Verifique se a coluna hash_preview existe — rode a migration se necessário',
      migration: 'ALTER TABLE certificates ADD COLUMN IF NOT EXISTS hash_preview VARCHAR(64)',
    });
    logger.stack('FIND_BY_CODE', error);
    throw error;
  }
}

// ============================================================
// 🔑 FIND BY ID — Rota autenticada (dono do certificado)
//
// ✅ Retorna CPF completo — rota autenticada = dono do dado
// ✅ hash excluído — dado interno de auditoria
// ✅ hash_preview incluído — para exibição no dashboard
// ============================================================
async function findById(id, usuario_id) {
  const t0 = Date.now();

  logger.sql('FIND_BY_ID', 'SELECT certificates WHERE id AND usuario_id', {
    id,
    usuario_id,
    acesso: 'AUTENTICADO — dono do certificado',
    nota:   'CPF retornado (rota autenticada = titular)',
  });

  try {
    const result = await pool.query(
      // ✅ CPF retornado — rota autenticada, usuário é o titular
      // ❌ hash excluído — dado interno de auditoria
      // ✅ hash_preview incluído — exibição no dashboard
      `SELECT
         id,
         usuario_id,
         nome_participante,
         cpf,
         cpf_parcial,
         nome_curso,
         carga_horaria,
         data_emissao,
         codigo_verificacao,
         nome_instrutor,
         descricao,
         pdf_path,
         hash_preview,
         verificacoes_count,
         ultima_verificacao,
         criado_em
       FROM certificates
       WHERE id = $1 AND usuario_id = $2`,
      [id, usuario_id]
    );

    const cert = result.rows[0] || null;

    logger.perf('FIND_BY_ID', 'SELECT WHERE id AND usuario_id', Date.now() - t0);

    if (cert) {
      logger.result('FIND_BY_ID', 'ok', {
        id:                cert.id,
        usuario_id,
        nome_participante: cert.nome_participante,
        hash_preview:      cert.hash_preview ? '✅ presente' : '❌ null',
      });
    } else {
      logger.result('FIND_BY_ID', 'warn', {
        id,
        usuario_id,
        encontrado:  false,
        sec_note:    'Pode ser tentativa de acesso a dados de outro usuário',
      });
    }

    return cert;

  } catch (error) {
    logger.perf('FIND_BY_ID', 'SELECT falhou em', Date.now() - t0);
    logger.error('FIND_BY_ID', 'Erro ao buscar certificado por ID', {
      message:   error.message,
      pg_code:   error.code,
      id,
      usuario_id,
    });
    logger.stack('FIND_BY_ID', error);
    throw error;
  }
}

// ============================================================
// 📋 FIND BY USER ID — Dashboard do usuário autenticado
//
// ✅ Paginação obrigatória (limit/offset) — sem LIMIT no SELECT
// ✅ ORDER BY criado_em DESC — mais recente primeiro
// ✅ hash e cpf excluídos — não necessários para listagem
// ✅ hash_preview incluído — DNA visual no dashboard
// ============================================================
async function findByUserId(usuario_id, { limit = 50, offset = 0 } = {}) {
  const t0 = Date.now();

  // Sanitiza parâmetros de paginação — evita SQL injection via cast
  const safeLimit  = Math.min(Math.max(parseInt(limit)  || 50,  1), 200);
  const safeOffset = Math.max(parseInt(offset) || 0, 0);

  logger.sql('FIND_BY_USER', 'SELECT certificates WHERE usuario_id (paginado)', {
    usuario_id,
    limit:  safeLimit,
    offset: safeOffset,
    order:  'criado_em DESC',
  });

  try {
    const result = await pool.query(
      // ❌ cpf excluído — listagem não precisa expor CPF completo
      // ❌ hash excluído — dado interno
      // ✅ hash_preview incluído — DNA visual no dashboard
      `SELECT
         id,
         nome_participante,
         cpf_parcial,
         nome_curso,
         carga_horaria,
         data_emissao,
         codigo_verificacao,
         nome_instrutor,
         pdf_path,
         hash_preview,
         verificacoes_count,
         ultima_verificacao,
         criado_em
       FROM certificates
       WHERE usuario_id = $1
       ORDER BY criado_em DESC
       LIMIT $2 OFFSET $3`,
      [usuario_id, safeLimit, safeOffset]
    );

    logger.perf('FIND_BY_USER', 'SELECT WHERE usuario_id', Date.now() - t0);
    logger.result('FIND_BY_USER', 'ok', {
      usuario_id,
      count:       result.rows.length,
      limit:       safeLimit,
      offset:      safeOffset,
      temMais:     result.rows.length === safeLimit ? 'possivelmente — use offset' : 'não',
    });

    return result.rows;

  } catch (error) {
    logger.perf('FIND_BY_USER', 'SELECT falhou em', Date.now() - t0);
    logger.error('FIND_BY_USER', 'Erro ao listar certificados do usuário', {
      message:   error.message,
      pg_code:   error.code,
      usuario_id,
    });
    logger.stack('FIND_BY_USER', error);
    throw error;
  }
}

// ============================================================
// ☁️  UPDATE FILE PATH — Salva URL do PDF após upload
//
// ✅ Retorna boolean — controller sabe se UPDATE teve efeito
// ✅ atualizado_em = NOW() — rastreabilidade de quando o PDF foi gerado
// ============================================================
async function updateFilePath(id, pdf_path) {
  const t0 = Date.now();

  logger.sql('UPDATE_PDF', 'UPDATE certificates SET pdf_path', {
    id,
    pdf_path: pdf_path ? pdf_path.substring(0, 60) + '...' : null,
  });

  try {
    const result = await pool.query(
      `UPDATE certificates
       SET pdf_path = $1,
           atualizado_em = NOW()
       WHERE id = $2
       RETURNING id, pdf_path, atualizado_em`,
      [pdf_path, id]
    );

    logger.perf('UPDATE_PDF', 'UPDATE SET pdf_path', Date.now() - t0);

    if (result.rowCount === 0) {
      logger.result('UPDATE_PDF', 'warn', {
        id,
        rowCount: 0,
        hint:     'Certificado não encontrado para atualização — ID inválido?',
      });
      return false;
    }

    logger.result('UPDATE_PDF', 'ok', {
      id,
      pdf_path:     pdf_path?.substring(0, 60) + '...',
      atualizado_em: result.rows[0]?.atualizado_em,
    });

    return true;

  } catch (error) {
    logger.perf('UPDATE_PDF', 'UPDATE falhou em', Date.now() - t0);
    logger.error('UPDATE_PDF', 'Erro ao atualizar pdf_path', {
      message:  error.message,
      pg_code:  error.code,
      id,
      hint:     'Verifique se a coluna atualizado_em existe — adicione se necessário',
      migration: 'ALTER TABLE certificates ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ',
    });
    logger.stack('UPDATE_PDF', error);
    throw error;
  }
}

// ============================================================
// 🔐 UPDATE HASH PREVIEW — ✅ v2: NOVO — salva preview do SHA-256
//
// Necessário para o DNA visual funcionar no frontend.
// Chamado pelo controller após generatePDF() retornar hashPreview.
//
// ⚠️  MIGRATION NECESSÁRIA ANTES DE USAR:
//   ALTER TABLE certificates
//     ADD COLUMN IF NOT EXISTS hash_preview VARCHAR(64);
//
// hashPreview = 32 chars uppercase do SHA-256 completo
// Ex: "A3F2B1C4D5E6F7A8B9C0D1E2F3A4B5C6"
// ============================================================
async function updateHashPreview(id, hashPreview) {
  const t0 = Date.now();

  if (!hashPreview || typeof hashPreview !== 'string') {
    logger.warn('UPDATE_HASH', '⚠️  hashPreview inválido ou vazio — UPDATE ignorado', {
      id,
      hashPreview,
      hint: 'Verifique se generatePDF() retornou hashPreview corretamente',
    });
    return false;
  }

  logger.sql('UPDATE_HASH', 'UPDATE certificates SET hash_preview', {
    id,
    hashPreview: hashPreview.substring(0, 16) + '...',
    length:      hashPreview.length,
  });

  try {
    const result = await pool.query(
      `UPDATE certificates
       SET hash_preview  = $1,
           atualizado_em = NOW()
       WHERE id = $2
       RETURNING id, hash_preview, atualizado_em`,
      [hashPreview, id]
    );

    logger.perf('UPDATE_HASH', 'UPDATE SET hash_preview', Date.now() - t0);

    if (result.rowCount === 0) {
      logger.result('UPDATE_HASH', 'warn', {
        id,
        rowCount:  0,
        hint:      'Certificado não encontrado — ID inválido?',
        impacto:   'DNA visual não funcionará para este certificado',
      });
      return false;
    }

    logger.result('UPDATE_HASH', 'ok', {
      id,
      hash_preview:  hashPreview.substring(0, 16) + '...',
      length:        hashPreview.length,
      atualizado_em: result.rows[0]?.atualizado_em,
      beneficio:     '✅ DNA visual disponível no frontend para este certificado',
    });

    return true;

  } catch (error) {
    logger.perf('UPDATE_HASH', 'UPDATE falhou em', Date.now() - t0);
    logger.error('UPDATE_HASH', '❌ Erro ao salvar hash_preview', {
      message:   error.message,
      pg_code:   error.code,
      id,
      impacto:   'DNA visual não funcionará — hash_preview ficará null',
      migration: 'ALTER TABLE certificates ADD COLUMN IF NOT EXISTS hash_preview VARCHAR(64)',
      hint:      'Rode a migration acima no Supabase SQL Editor e tente novamente',
    });
    logger.stack('UPDATE_HASH', error);

    // ⚠️  Não relançamos — falha no hash_preview não deve quebrar
    //     o fluxo principal de emissão do certificado.
    //     O certificado foi criado, o PDF foi gerado, apenas o DNA
    //     visual ficará indisponível para este certificado.
    return false;
  }
}

// ============================================================
// 📈 INCREMENT VERIFICATION — Contador atômico de verificações
//
// ✅ UPDATE atômico — sem race condition em verificações paralelas
// ✅ Retorna novo total — controller loga sem segundo SELECT
// ✅ Não relança erro — falha no contador não quebra verificação
// ============================================================
async function incrementVerification(id) {
  const t0 = Date.now();

  logger.sql('INCR_VERIFY', 'UPDATE verificacoes_count + 1 (atômico)', {
    id,
    estrategia: 'UPDATE atômico no banco — sem race condition',
  });

  try {
    // ⚠️  UPDATE atômico — equivalente a mutex no banco
    //     Múltiplos requests simultâneos são serializados pelo PostgreSQL
    //     sem necessidade de lock explícito ou verificação de versão.
    const result = await pool.query(
      `UPDATE certificates
       SET verificacoes_count = verificacoes_count + 1,
           ultima_verificacao = NOW()
       WHERE id = $1
       RETURNING verificacoes_count, ultima_verificacao`,
      [id]
    );

    logger.perf('INCR_VERIFY', 'UPDATE verificacoes_count', Date.now() - t0);

    const novoTotal = result.rows[0]?.verificacoes_count;

    logger.result('INCR_VERIFY', 'ok', {
      id,
      novoTotal,
      ultima_verificacao: result.rows[0]?.ultima_verificacao,
      operacao:           'atômica — sem race condition',
    });

    return novoTotal;

  } catch (error) {
    logger.perf('INCR_VERIFY', 'UPDATE falhou em', Date.now() - t0);
    logger.error('INCR_VERIFY', '⚠️  Erro ao incrementar contador (não crítico)', {
      message: error.message,
      pg_code: error.code,
      id,
      impacto: 'Contador não atualizado — verificação ainda retorna dados corretos',
    });

    // ⚠️  Não relançamos — falha no contador não deve impedir
    //     a resposta ao usuário que está verificando o certificado.
    return null;
  }
}

// ============================================================
// 📚 ADD VERIFICATION HISTORY — Histórico de quem verificou
//
// ✅ IP + user-agent registrados para auditoria e anti-scraping
// ✅ Não relança erro — histórico não bloqueia verificação
// ✅ Retorna ID do registro para rastreamento
// ============================================================
async function addVerificationHistory(data) {
  const t0 = Date.now();

  const { certificate_id, codigo_verificacao, ip_address, user_agent } = data;

  logger.sql('HIST_INSERT', 'INSERT INTO verification_history', {
    certificate_id,
    codigo_verificacao,
    ip_address,
    user_agent: user_agent
      ? user_agent.substring(0, 60) + (user_agent.length > 60 ? '...' : '')
      : null,
    finalidade: 'Auditoria — quem verificou, quando e de onde',
  });

  try {
    const result = await pool.query(
      `INSERT INTO verification_history
         (certificado_id, codigo_verificacao, ip_address, user_agent, data_verificacao)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, data_verificacao`,
      [
        certificate_id,
        codigo_verificacao,
        ip_address || null,
        user_agent || null,
      ]
    );

    const historyId    = result.rows[0]?.id;
    const verificadoEm = result.rows[0]?.data_verificacao;

    logger.perf('HIST_INSERT', 'INSERT INTO verification_history', Date.now() - t0);
    logger.result('HIST_INSERT', 'ok', {
      historyId,
      certificate_id,
      ip_address,
      verificadoEm,
      anti_scraping: 'IP registrado — padrão de abuso detectável via analytics',
    });

    return historyId;

  } catch (error) {
    logger.perf('HIST_INSERT', 'INSERT falhou em', Date.now() - t0);
    logger.error('HIST_INSERT', '⚠️  Erro ao salvar histórico (não crítico)', {
      message:       error.message,
      pg_code:       error.code,
      certificate_id,
      impacto:       'Histórico não registrado — verificação ainda retorna dados corretos',
      hint:          'Verifique se a tabela verification_history existe no banco',
    });

    // ⚠️  Não relançamos — histórico não bloqueia o fluxo de verificação.
    return null;
  }
}

// ============================================================
// 🔢 COUNT BY USER — Contagem para dashboard e limites de plano
//
// ✅ COUNT(*) com cast para int — retorna número, não string
// ✅ Usado pelo dashboard para exibir total
// ✅ Será usado pelo sistema de planos (Free: 5/mês, etc.)
// ============================================================
async function countByUserId(usuario_id) {
  const t0 = Date.now();

  logger.sql('COUNT_USER', 'SELECT COUNT(*) WHERE usuario_id', {
    usuario_id,
    uso: 'Dashboard + limites de plano',
  });

  try {
    const result = await pool.query(
      'SELECT COUNT(*)::int AS total FROM certificates WHERE usuario_id = $1',
      [usuario_id]
    );

    const total = result.rows[0]?.total ?? 0;

    logger.perf('COUNT_USER', 'SELECT COUNT(*)', Date.now() - t0);
    logger.result('COUNT_USER', 'ok', {
      usuario_id,
      total,
      plano_free_limite: 5,
      dentro_do_limite:  total <= 5 ? '✅ sim' : '⚠️  não — plano excedido',
    });

    return total;

  } catch (error) {
    logger.perf('COUNT_USER', 'SELECT COUNT falhou em', Date.now() - t0);
    logger.error('COUNT_USER', 'Erro ao contar certificados do usuário', {
      message:   error.message,
      pg_code:   error.code,
      usuario_id,
    });
    logger.stack('COUNT_USER', error);
    throw error;
  }
}

// ============================================================
// 📅 COUNT THIS MONTH — Emissões do mês atual (limite de plano)
//
// ✅ NOVO v2 — necessário para bloquear plano Free (5/mês)
// ✅ Filtra por usuario_id + criado_em no mês atual
// ✅ Será usado pelo middleware de limite de plano
// ============================================================
async function countThisMonthByUserId(usuario_id) {
  const t0 = Date.now();

  logger.sql('COUNT_MONTH', 'SELECT COUNT(*) WHERE usuario_id AND mês atual', {
    usuario_id,
    mes:  new Date().toISOString().substring(0, 7),
    uso:  'Validação do limite mensal do plano Free (5/mês)',
  });

  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM certificates
       WHERE usuario_id  = $1
         AND criado_em  >= DATE_TRUNC('month', NOW())
         AND criado_em  <  DATE_TRUNC('month', NOW()) + INTERVAL '1 month'`,
      [usuario_id]
    );

    const total = result.rows[0]?.total ?? 0;

    logger.perf('COUNT_MONTH', 'SELECT COUNT(*) mês atual', Date.now() - t0);
    logger.result('COUNT_MONTH', total >= 5 ? 'warn' : 'ok', {
      usuario_id,
      total_este_mes:    total,
      limite_plano_free: 5,
      restantes:         Math.max(0, 5 - total),
      status:            total >= 5 ? '🔴 LIMITE ATINGIDO' : '🟢 dentro do limite',
      mes_referencia:    new Date().toISOString().substring(0, 7),
    });

    return total;

  } catch (error) {
    logger.perf('COUNT_MONTH', 'SELECT COUNT falhou em', Date.now() - t0);
    logger.error('COUNT_MONTH', 'Erro ao contar emissões do mês', {
      message:   error.message,
      pg_code:   error.code,
      usuario_id,
    });
    logger.stack('COUNT_MONTH', error);
    throw error;
  }
}

// ============================================================
// 📤 EXPORTS
// ============================================================
module.exports = {
  // ── CRUD principal ────────────────────────────────────────
  create,
  findByVerificationCode,
  findById,
  findByUserId,

  // ── Updates parciais ──────────────────────────────────────
  updateFilePath,
  updateHashPreview,      // ✅ v2: NOVO — DNA visual no frontend

  // ── Contadores ────────────────────────────────────────────
  countByUserId,
  countThisMonthByUserId, // ✅ v2: NOVO — limite mensal do plano Free

  // ── Auditoria ─────────────────────────────────────────────
  incrementVerification,
  addVerificationHistory,
};