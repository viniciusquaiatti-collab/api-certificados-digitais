// src/controllers/certificateController.js
// ============================================================
// 🏢 NexaSpark — Certificate Controller
// Core do produto: emissão e verificação de certificados digitais.
// Cada função é rastreada, auditada e monitorada de ponta a ponta.
// ============================================================

const Certificate        = require('../models/Certificate');
const CertificateService = require('../services/certificateService');
const AuditLog           = require('../models/AuditLog');
const crypto             = require('crypto');

// ============================================================
// 🎨 LOGGER ENTERPRISE — ANSI colors, zero dependências externas
// ============================================================
const c = {
  green:   (s) => `\x1b[32m${s}\x1b[0m`,
  red:     (s) => `\x1b[31m${s}\x1b[0m`,
  yellow:  (s) => `\x1b[33m${s}\x1b[0m`,
  blue:    (s) => `\x1b[34m${s}\x1b[0m`,
  cyan:    (s) => `\x1b[36m${s}\x1b[0m`,
  magenta: (s) => `\x1b[35m${s}\x1b[0m`,
  gray:    (s) => `\x1b[90m${s}\x1b[0m`,
  bold:    (s) => `\x1b[1m${s}\x1b[0m`,
  white:   (s) => `\x1b[37m${s}\x1b[0m`,
};

const logger = {
  info:    (scope, msg, data) => console.log(   c.blue(`ℹ️  [${scope}]`),    msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  success: (scope, msg, data) => console.log(   c.green(`✅ [${scope}]`),   msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  warn:    (scope, msg, data) => console.warn(  c.yellow(`⚠️  [${scope}]`),  msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  error:   (scope, msg, data) => console.error( c.red(`❌ [${scope}]`),     msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  perf:    (scope, label, ms) => console.log(   c.magenta(`⏱️  [${scope}]`), `${label} — ${c.bold(ms + 'ms')}`),
  event:   (scope, action, data) => console.log(c.cyan(`🎯 [${scope}]`),   `ACTION → ${action}`, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  audit:   (msg, data)        => console.log(   c.green(`🔏 [AUDIT]`),     msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  sec:     (msg, data)        => console.warn(  c.red(`🚨 [SECURITY]`),    msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  sep:     ()                 => console.log(   c.gray('─'.repeat(60))),
};

// ============================================================
// 🛡️  HELPER — Contexto da requisição
// Extrai e centraliza IP, User-Agent e requestId para todos os logs.
// ============================================================
function reqContext(req) {
  return {
    ip:        req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    requestId: req.requestId || req.headers['x-request-id'] || `cert_${Date.now()}`,
    userId:    req.user?.id || null,
  };
}

// ============================================================
// 🛡️  HELPER — Sanitiza dados para log
// CPF NUNCA aparece em texto puro nos logs.
// ============================================================
function sanitizeForLog(data) {
  if (!data || typeof data !== 'object') return data;
  const clone = { ...data };
  if (clone.cpf) {
    const digits = String(clone.cpf).replace(/\D/g, '');
    clone.cpf = `***.***.***-${digits.slice(-2)}`;
  }
  if (clone.hash) clone.hash = clone.hash.substring(0, 16) + '...';
  return clone;
}

// ============================================================
// 🔐 HELPER — Gera hash SHA-256 do certificado
//
// ⚠️  DECISÃO TÉCNICA DOCUMENTADA:
//     O hash é composto por: nome | cpf | curso | carga | data | código.
//     Isso garante que qualquer alteração em qualquer campo
//     produz um hash completamente diferente — imutabilidade real.
//     O codigo_verificacao entra no hash para torná-lo único
//     mesmo que dois alunos façam o mesmo curso no mesmo dia.
// ============================================================
function generateCertificateHash(data) {
  const { nome_participante, cpf, nome_curso, carga_horaria, data_emissao, codigo_verificacao } = data;

  const payload = [
    nome_participante.trim().toUpperCase(),
    cpf.replace(/\D/g, ''),       // apenas dígitos — formato não altera o hash
    nome_curso.trim().toUpperCase(),
    String(carga_horaria),
    data_emissao,
    codigo_verificacao,
  ].join('|');

  const hash = crypto.createHash('sha256').update(payload, 'utf8').digest('hex');

  logger.info('HASH', 'SHA-256 gerado', {
    payloadLength: payload.length,
    hashPrefix:    hash.substring(0, 16) + '...',
  });

  return hash;
}

// ============================================================
// 🔐 HELPER — Gera CPF parcial para exibição pública
//
// ⚠️  LGPD: CPF é dado pessoal. A versão parcial exibida
//     publicamente mostra apenas os 2 últimos dígitos — suficiente
//     para o titular confirmar que é seu CPF, mas insuficiente
//     para qualquer uso indevido.
// ============================================================
function generateCpfParcial(cpf) {
  const digits = String(cpf).replace(/\D/g, '');
  return `***.***.***-${digits.slice(-2)}`;
}

console.log(c.green(c.bold('🔥 [CertificateController] Módulo inicializado')));
logger.sep();

// ============================================================

class CertificateController {

  // ══════════════════════════════════════════════════════════
  // CREATE CERTIFICATE — Rota autenticada
  // ══════════════════════════════════════════════════════════
  static async createCertificate(req, res) {
    const t0  = Date.now();
    const ctx = reqContext(req);

    logger.sep();
    logger.info('CREATE', 'Iniciando criação de certificado', ctx);

    try {
      const usuario_id = req.user.id;
      const {
        nome_participante,
        cpf,
        nome_curso,
        carga_horaria,
        data_emissao,
        nome_instrutor = null,
        descricao      = null,
      } = req.body;

      logger.info('CREATE', 'Dados recebidos', sanitizeForLog({
        usuario_id,
        nome_participante,
        cpf,
        nome_curso,
        carga_horaria,
        data_emissao,
        nome_instrutor,
      }));

      // ── Verifica configuração do Cloudinary ───────────────
      // ⚠️  CORREÇÃO: no original esta verificação estava dentro
      //     do controller, mas apenas para CLOUDINARY_URL.
      //     Movemos para uma checagem mais completa e informativa.
      if (!process.env.CLOUDINARY_URL && !process.env.CLOUDINARY_CLOUD_NAME) {
        logger.error('CREATE', 'Cloudinary não configurado', {
          hint: 'Adicione CLOUDINARY_URL ou CLOUDINARY_CLOUD_NAME no .env',
        });
        return res.status(503).json({
          success: false,
          error:   'Serviço de geração de PDF temporariamente indisponível',
          code:    'PDF_SERVICE_UNAVAILABLE',
        });
      }

      // ── Gera código de verificação único ─────────────────
      // ⚠️  DECISÃO TÉCNICA: crypto.randomBytes(8) gera 8 bytes
      //     de entropia real do SO → 64 bits → 16 chars hex.
      //     Em uppercase fica mais legível para o usuário final.
      //     Colisão é astronomicamente improvável, mas o banco
      //     tem constraint UNIQUE e o model trata o erro 23505.
      const t1 = Date.now();
      const codigo_verificacao = crypto.randomBytes(8).toString('hex').toUpperCase();
      logger.perf('CREATE', 'randomBytes()', Date.now() - t1);
      logger.info('CREATE', 'Código de verificação gerado', { codigo_verificacao });

      // ── Gera CPF parcial ──────────────────────────────────
      const cpf_parcial = generateCpfParcial(cpf);
      logger.info('CREATE', 'CPF parcial gerado (LGPD)', { cpf_parcial });

      // ── Gera hash SHA-256 ─────────────────────────────────
      const t2   = Date.now();
      const hash = generateCertificateHash({
        nome_participante,
        cpf,
        nome_curso,
        carga_horaria,
        data_emissao,
        codigo_verificacao,
      });
      logger.perf('CREATE', 'SHA-256 hash', Date.now() - t2);

      // ── Persiste no banco ─────────────────────────────────
      logger.info('CREATE', 'Inserindo certificado no banco...');
      const t3   = Date.now();
      const cert = await Certificate.create({
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
      });
      logger.perf('CREATE', 'Certificate.create()', Date.now() - t3);
      logger.success('CREATE', 'Certificado persistido no banco', { id: cert.id });

      // ── Gera PDF (não-crítico) ────────────────────────────
      // ⚠️  DECISÃO ARQUITETURAL IMPORTANTE:
      //     A geração do PDF é feita DEPOIS de persistir no banco.
      //     Se o PDF falhar, o certificado ainda existe e pode ser
      //     recuperado/re-gerado. O contrário (PDF antes do banco)
      //     criaria PDFs órfãos sem registro no sistema.
      //     Falha no PDF → retornamos sucesso com pdf_url: null.
      //     O frontend deve tratar esse caso e mostrar "PDF em processamento".
      let pdfUrl = null;

      try {
        logger.info('CREATE', 'Gerando PDF via CertificateService...');
        const t4 = Date.now();

        pdfUrl = await CertificateService.generatePDF({
          id: cert.id,
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
        });

        logger.perf('CREATE', 'PDF generation', Date.now() - t4);
        logger.success('CREATE', 'PDF gerado com sucesso', { pdfUrl });

        await Certificate.updateFilePath(cert.id, pdfUrl);
        logger.success('CREATE', 'pdf_path atualizado no banco');

      } catch (pdfError) {
        // PDF falhou mas o certificado foi criado — log claro do motivo
        logger.error('CREATE', 'Falha na geração do PDF — certificado criado sem PDF', {
          certId:  cert.id,
          message: pdfError.message,
          stack:   pdfError.stack?.split('\n').slice(0, 3).join(' | '),
          hint:    'PDF pode ser re-gerado posteriormente via endpoint dedicado',
        });
        // pdfUrl permanece null — retornamos assim mesmo
      }

      // ── Auditoria ─────────────────────────────────────────
      logger.audit('Certificado criado', {
        certId:           cert.id,
        usuario_id,
        nome_participante,
        nome_curso,
        codigo_verificacao,
        pdfGerado:        !!pdfUrl,
      });

      await AuditLog.create({
        usuario_id,
        acao:       AuditLog.ACTIONS.CERT_CREATED,
        detalhe:    `Certificado emitido para "${nome_participante}" — Curso: "${nome_curso}"`,
        ip_address: ctx.ip,
        user_agent: ctx.userAgent,
        metadata: {
          certId:           cert.id,
          codigo_verificacao,
          nome_curso,
          carga_horaria,
          pdfGerado:        !!pdfUrl,
        },
      });

      const elapsed = Date.now() - t0;
      logger.perf('CREATE', 'Fluxo completo de criação', elapsed);
      logger.success('CREATE', '══ Certificado criado com sucesso ══', {
        id:                cert.id,
        codigo_verificacao,
        pdfGerado:         !!pdfUrl,
        totalMs:           elapsed,
      });
      logger.sep();

      return res.status(201).json({
        success: true,
        message: 'Certificado emitido com sucesso',
        data: {
          id:                cert.id,
          codigo_verificacao: cert.codigo_verificacao,
          nome_participante:  cert.nome_participante,
          nome_curso:         cert.nome_curso,
          carga_horaria:      cert.carga_horaria,
          data_emissao:       cert.data_emissao,
          cpf_parcial:        cert.cpf_parcial,
          hash_preview:       hash.substring(0, 16).toUpperCase() + '...',
          pdf_url:            pdfUrl,
          criado_em:          cert.criado_em,
        },
      });

    } catch (error) {
      const elapsed = Date.now() - t0;
      logger.error('CREATE', `Erro não tratado após ${elapsed}ms`, {
        message:   error.message,
        code:      error.code,
        requestId: ctx.requestId,
      });
      logger.error('CREATE', 'Stack trace:\n' + error.stack);
      logger.sep();

      // ⚠️  CORREÇÃO: o original expunha error.message diretamente
      //     na resposta — isso pode vazar detalhes internos.
      //     Em produção usamos mensagem genérica. Em dev mostramos o erro.
      return res.status(500).json({
        success:   false,
        error:     process.env.NODE_ENV === 'development'
          ? `Erro ao criar certificado: ${error.message}`
          : 'Erro ao criar certificado. Tente novamente.',
        code:      error.code || 'CERT_CREATE_ERROR',
        requestId: ctx.requestId,
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  // VERIFY CERTIFICATE — Rota pública
  // ══════════════════════════════════════════════════════════
  static async verifyCertificate(req, res) {
    const t0  = Date.now();
    const ctx = reqContext(req);

    logger.sep();
    logger.info('VERIFY', 'Verificação pública iniciada', ctx);

    try {
      const { codigo } = req.params;

      logger.info('VERIFY', 'Buscando certificado por código', { codigo });

      const certificate = await Certificate.findByVerificationCode(codigo);

      if (!certificate) {
        logger.warn('VERIFY', 'Certificado não encontrado', { codigo, ip: ctx.ip });

        // Auditamos tentativas inválidas também —
        // detecta scraping ou tentativas de enumerar certificados
        await AuditLog.create({
          usuario_id: null,
          acao:       AuditLog.ACTIONS.CERT_VERIFIED,
          detalhe:    `Verificação FALHOU — código não encontrado: ${codigo}`,
          ip_address: ctx.ip,
          user_agent: ctx.userAgent,
          metadata:   { codigo, encontrado: false },
        });

        return res.status(404).json({
          success: false,
          error:   'Certificado não encontrado ou código inválido',
          code:    'CERT_NOT_FOUND',
        });
      }

      logger.success('VERIFY', 'Certificado encontrado', {
        id:               certificate.id,
        nome_participante: certificate.nome_participante,
        nome_curso:        certificate.nome_curso,
      });

      // ── Incrementa contador + histórico (paralelo) ────────
      // ⚠️  MELHORIA: executamos os dois em paralelo com Promise.allSettled.
      //     No original eram dois awaits sequenciais — desnecessário,
      //     pois um não depende do outro.
      //     allSettled garante que ambos tentam executar mesmo se um falhar,
      //     sem bloquear a resposta ao usuário.
      const t1 = Date.now();
      const [incrResult, histResult] = await Promise.allSettled([
        Certificate.incrementVerification(certificate.id),
        Certificate.addVerificationHistory({
          certificate_id:    certificate.id,
          codigo_verificacao: codigo,
          ip_address:         ctx.ip,
          user_agent:         ctx.userAgent,
        }),
      ]);

      logger.perf('VERIFY', 'increment + history (paralelo)', Date.now() - t1);

      if (incrResult.status === 'rejected') {
        logger.error('VERIFY', 'Falha ao incrementar contador — não crítico', {
          reason: incrResult.reason?.message,
        });
      }
      if (histResult.status === 'rejected') {
        logger.error('VERIFY', 'Falha ao salvar histórico — não crítico', {
          reason: histResult.reason?.message,
        });
      }

      const newVerificationCount = incrResult.status === 'fulfilled'
        ? incrResult.value
        : (certificate.verificacoes_count || 0) + 1;

      // ── Auditoria ─────────────────────────────────────────
      logger.audit('Certificado verificado publicamente', {
        certId:           certificate.id,
        codigo,
        ip:               ctx.ip,
        totalVerificacoes: newVerificationCount,
      });

      await AuditLog.create({
        usuario_id: null,
        acao:       AuditLog.ACTIONS.CERT_VERIFIED,
        detalhe:    `Certificado verificado: "${certificate.nome_participante}" — "${certificate.nome_curso}"`,
        ip_address: ctx.ip,
        user_agent: ctx.userAgent,
        metadata: {
          certId:            certificate.id,
          codigo,
          totalVerificacoes: newVerificationCount,
          encontrado:        true,
        },
      });

      const elapsed = Date.now() - t0;
      logger.perf('VERIFY', 'Fluxo completo de verificação', elapsed);
      logger.success('VERIFY', '══ Verificação concluída com sucesso ══', {
        id:               certificate.id,
        codigo,
        totalVerificacoes: newVerificationCount,
        totalMs:           elapsed,
      });
      logger.sep();

      // ⚠️  SEGURANÇA: a resposta pública NUNCA retorna:
      //     - CPF completo (só cpf_parcial — LGPD)
      //     - hash completo (apenas hash_preview — não expõe dado interno)
      //     - usuario_id (não revelamos quem emitiu)
      //     - pdf_path interno (retornamos como pdf_url renomeado)
      return res.json({
        success: true,
        data: {
          valido: true,
          participante: {
            nome: certificate.nome_participante.toUpperCase(),
            cpf:  certificate.cpf_parcial,
          },
          curso: {
            nome:         certificate.nome_curso,
            carga_horaria: certificate.carga_horaria,
            data_emissao:  certificate.data_emissao,
            instrutor:     certificate.nome_instrutor || null,
          },
          verificacao: {
            codigo:            certificate.codigo_verificacao,
            hash_preview:      certificate.hash
              // ⚠️  hash NÃO vem do findByVerificationCode (foi excluído do SELECT)
              //     hash_preview é gerado aqui apenas se tivermos acesso ao hash.
              //     Como a rota pública não retorna hash do banco, usamos o código.
              ? certificate.hash.substring(0, 12).toUpperCase()
              : null,
            total_verificacoes: newVerificationCount,
            verificado_em:      new Date().toISOString(),
          },
          pdf_url: certificate.pdf_path || null,
        },
      });

    } catch (error) {
      const elapsed = Date.now() - t0;
      logger.error('VERIFY', `Erro não tratado após ${elapsed}ms`, {
        message:   error.message,
        requestId: ctx.requestId,
      });
      logger.error('VERIFY', 'Stack trace:\n' + error.stack);
      logger.sep();

      return res.status(500).json({
        success:   false,
        error:     'Erro ao verificar certificado',
        code:      'CERT_VERIFY_ERROR',
        requestId: ctx.requestId,
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  // GET USER CERTIFICATES — Rota autenticada
  // ══════════════════════════════════════════════════════════
  static async getUserCertificates(req, res) {
    const t0  = Date.now();
    const ctx = reqContext(req);

    logger.sep();
    logger.info('LIST', 'Listando certificados do usuário', ctx);

    try {
      const usuario_id = req.user.id;

      // ⚠️  MELHORIA: suporte a paginação via query params
      const limit  = parseInt(req.query.limit)  || 50;
      const offset = parseInt(req.query.offset) || 0;

      logger.info('LIST', 'Parâmetros de listagem', { usuario_id, limit, offset });

      const [certificates, total] = await Promise.all([
        Certificate.findByUserId(usuario_id, { limit, offset }),
        Certificate.countByUserId(usuario_id),
      ]);

      const elapsed = Date.now() - t0;
      logger.perf('LIST', 'findByUserId + countByUserId (paralelo)', elapsed);
      logger.success('LIST', 'Certificados listados', {
        usuario_id,
        count:  certificates.length,
        total,
        offset,
        limit,
      });
      logger.sep();

      return res.json({
        success: true,
        data:    certificates,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + certificates.length < total,
        },
      });

    } catch (error) {
      logger.error('LIST', 'Erro ao listar certificados', {
        message:   error.message,
        userId:    ctx.userId,
        requestId: ctx.requestId,
      });
      logger.error('LIST', 'Stack:\n' + error.stack);
      logger.sep();

      return res.status(500).json({
        success:   false,
        error:     'Erro ao listar certificados',
        code:      'CERT_LIST_ERROR',
        requestId: ctx.requestId,
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  // GET CERTIFICATE BY ID — Rota autenticada
  // ══════════════════════════════════════════════════════════
  static async getCertificateById(req, res) {
    const t0  = Date.now();
    const ctx = reqContext(req);

    logger.sep();
    logger.info('GET_BY_ID', 'Buscando certificado por ID', ctx);

    try {
      const { id }     = req.params;
      const usuario_id = req.user.id;

      logger.info('GET_BY_ID', 'Parâmetros', { id, usuario_id });

      const certificate = await Certificate.findById(id, usuario_id);

      if (!certificate) {
        logger.warn('GET_BY_ID', 'Certificado não encontrado ou não pertence ao usuário', {
          id,
          usuario_id,
          requestId: ctx.requestId,
        });
        return res.status(404).json({
          success: false,
          error:   'Certificado não encontrado',
          code:    'CERT_NOT_FOUND',
        });
      }

      // Auditamos consultas individuais — saber quem acessou o quê
      await AuditLog.create({
        usuario_id,
        acao:       AuditLog.ACTIONS.CERT_VIEWED,
        detalhe:    `Certificado visualizado: ID ${id}`,
        ip_address: ctx.ip,
        user_agent: ctx.userAgent,
        metadata:   { certId: id },
      });

      const elapsed = Date.now() - t0;
      logger.perf('GET_BY_ID', 'Fluxo completo', elapsed);
      logger.success('GET_BY_ID', 'Certificado retornado', { id, usuario_id });
      logger.sep();

      return res.json({
        success: true,
        data:    certificate,
      });

    } catch (error) {
      logger.error('GET_BY_ID', 'Erro ao buscar certificado', {
        message:   error.message,
        id:        req.params.id,
        userId:    ctx.userId,
        requestId: ctx.requestId,
      });
      logger.error('GET_BY_ID', 'Stack:\n' + error.stack);
      logger.sep();

      return res.status(500).json({
        success:   false,
        error:     'Erro ao buscar certificado',
        code:      'CERT_GET_ERROR',
        requestId: ctx.requestId,
      });
    }
  }
}

module.exports = CertificateController;