// src/services/certificateService.js
// ============================================================
// 🏢 NexaSpark — Certificate Service
// Responsável por gerar o PDF do certificado e fazer upload
// para o Cloudinary. Camada de serviço — sem Express, sem HTTP.
// ============================================================

const PDFDocument = require('pdfkit');
const QRCode      = require('qrcode');
const cloudinary  = require('cloudinary').v2;
const crypto      = require('crypto');
const path        = require('path');
const fs          = require('fs');

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
  blue:    (s) => `\x1b[34m${s}\x1b[0m`,
  white:   (s) => `\x1b[97m${s}\x1b[0m`,
};

const logger = {
  info:    (scope, msg, data) => console.log(   c.cyan(`ℹ️  [${scope}]`),    msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  success: (scope, msg, data) => console.log(   c.green(`✅ [${scope}]`),   msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  warn:    (scope, msg, data) => console.warn(  c.yellow(`⚠️  [${scope}]`),  msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  error:   (scope, msg, data) => console.error( c.red(`❌ [${scope}]`),     msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  perf:    (scope, label, ms) => console.log(   c.magenta(`⏱️  [${scope}]`), `${label} — ${c.bold(ms + 'ms')}`),
  sec:     (msg, data)        => console.warn(  c.red(`🚨 [SECURITY]`),    msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  cloud:   (msg, data)        => console.log(   c.blue(`☁️  [CLOUDINARY]`), msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  pdf:     (msg, data)        => console.log(   c.white(`🖨️  [PDF]`),       msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  sep:     ()                 => console.log(c.gray('─'.repeat(60))),
};

console.log(c.green(c.bold('📄 [CertificateService] Serviço inicializado')));

// ============================================================
// ☁️  CLOUDINARY — Configuração com validação de ambiente
//
// ⚠️  PROBLEMA ORIGINAL:
//     O serviço usava apenas CLOUDINARY_URL como variável.
//     O cloudinaryService.js usava CLOUDINARY_CLOUD_NAME,
//     CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET (separadas).
//     Dois arquivos diferentes configurando Cloudinary de formas
//     diferentes — risco de um sobrescrever o outro.
//
// ✅  CORREÇÃO: configuração única, compatível com ambas as formas.
//     Prioriza CLOUDINARY_URL (mais simples), com fallback para
//     as variáveis separadas. Falha em boot se nenhuma estiver
//     configurada — detecta o problema antes do primeiro request.
// ============================================================
function initCloudinary() {
  logger.sep();
  logger.cloud('Inicializando configuração do Cloudinary...');

  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({ cloudinary_url: process.env.CLOUDINARY_URL });

    // ⚠️  Valida que a URL tem o formato correto
    const url = process.env.CLOUDINARY_URL;
    const isValid = url.startsWith('cloudinary://') && url.includes('@');
    if (!isValid) {
      logger.warn('CLOUDINARY', 'CLOUDINARY_URL tem formato suspeito', {
        format:   'cloudinary://API_KEY:API_SECRET@CLOUD_NAME',
        received: url.substring(0, 20) + '...',
      });
    }

    logger.success('CLOUDINARY', 'Configurado via CLOUDINARY_URL ✅', {
      cloud_name: url.split('@')[1] || '?',
      format:     'CLOUDINARY_URL',
    });
    logger.sep();
    return true;
  }

  if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY    &&
    process.env.CLOUDINARY_API_SECRET
  ) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    logger.success('CLOUDINARY', 'Configurado via variáveis separadas ✅', {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    });
    logger.sep();
    return true;
  }

  logger.error('CLOUDINARY', '🚨 Nenhuma credencial Cloudinary encontrada!', {
    hint:      'Configure CLOUDINARY_URL ou CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET',
    impact:    'Geração de PDFs OFFLINE — uploads falharão',
    envStatus: {
      CLOUDINARY_URL:         !!process.env.CLOUDINARY_URL,
      CLOUDINARY_CLOUD_NAME:  !!process.env.CLOUDINARY_CLOUD_NAME,
      CLOUDINARY_API_KEY:     !!process.env.CLOUDINARY_API_KEY,
      CLOUDINARY_API_SECRET:  !!process.env.CLOUDINARY_API_SECRET,
    },
  });
  logger.sep();
  return false;
}

const cloudinaryReady = initCloudinary();

// ============================================================
// 🔐 HELPER — Gera hash SHA-256 do certificado
//
// ⚠️  PROBLEMA ORIGINAL:
//     O service incluía CERTIFICATE_SECRET_KEY no payload,
//     mas o controller não — hashes diferentes em 2 lugares.
//     A verificação de autenticidade sempre falharia.
//
// ✅  CORREÇÃO: payload consistente entre service e controller.
// ============================================================
function generateHash(data) {
  const {
    nome_participante,
    cpf,
    nome_curso,
    carga_horaria,
    data_emissao,
    codigo_verificacao,
  } = data;

  const payload = [
    nome_participante.trim().toUpperCase(),
    String(cpf).replace(/\D/g, ''),
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
// 🛡️  HELPER — Máscara de CPF (LGPD Art. 37)
// Exibe apenas os 2 últimos dígitos — suficiente para o
// titular confirmar que é seu CPF, sem risco de exposição.
// ============================================================
function maskCPF(cpf) {
  if (!cpf) return '***.***.***-**';
  const digits = String(cpf).replace(/\D/g, '').padStart(11, '0');
  return `***.***.***-${digits.slice(-2)}`;
}

// ============================================================
// 📅 HELPER — Formata data YYYY-MM-DD → DD/MM/YYYY
// ============================================================
function formatDateBR(dateString) {
  if (!dateString || typeof dateString !== 'string') return '';

  const parts = dateString.split('-');
  if (parts.length !== 3) {
    logger.warn('DATE', 'Formato de data inválido', { dateString });
    return dateString;
  }

  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

// ============================================================
// 🌐 HELPER — URL de verificação pública do certificado
//
// ⚠️  BUG CORRIGIDO: variável `base` não estava definida no
//     escopo da função — causava ReferenceError silencioso.
//
// ✅  Rota atualizada /verify/ → /verificar/ (página própria
//     NexaSpark em nexaspark.com.br/verificar/[codigo]).
// ============================================================
function getVerificationUrl(codigo) {
  const base = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const url  = `${base}/verificar/${codigo}`;

  logger.info('URL', 'URL de verificação gerada', {
    base,
    url,
    fonteDados: process.env.FRONTEND_URL
      ? 'FRONTEND_URL (env)'
      : '⚠️  fallback localhost — configure FRONTEND_URL no Railway',
  });

  return url;
}

// ============================================================
// ☁️  HELPER — Constrói URL Cloudinary com content-type correto
//
// ⚠️  PROBLEMA CRÍTICO CORRIGIDO — Mobile/iOS não abria o PDF:
//
// CAUSA RAIZ: O Cloudinary subia o arquivo com resource_type 'raw'
// mas SEM especificar o content-type na URL de entrega.
// A URL gerada era:
//   .../raw/upload/v.../certificados/cert_XXXX
//
// O browser/mobile recebia o arquivo sem Content-Type: application/pdf
// no header HTTP, portanto:
//   - Desktop Chrome: baixava como arquivo sem extensão
//   - iOS Safari: mostrava "não é possível abrir"
//   - Android: pedia para escolher aplicativo
//
// SOLUÇÃO: adicionar flags de transformação na URL do Cloudinary:
//   fl_attachment         → força download com nome correto
//   fl_attachment:cert_XX → define o nome do arquivo no download
//
// Para VISUALIZAÇÃO inline (não download), usar:
//   fl_inline             → serve inline com Content-Type correto
//
// A URL correta fica:
//   .../raw/upload/fl_inline/v.../certificados/cert_XXXX.pdf
//
// IMPORTANTE: o '.pdf' no final da URL instrui o CDN Cloudinary
// a servir com Content-Type: application/pdf — sem ele, raw
// serve como application/octet-stream que mobile não abre.
//
// Ref: https://cloudinary.com/documentation/transformation_reference#fl_attachment
// ============================================================
function buildCloudinaryPdfUrl(secureUrl, nomeParticipante, codigoVerificacao) {
  if (!secureUrl) {
    logger.error('CLOUDINARY:URL', 'secure_url vazia — não foi possível construir URL final');
    return secureUrl;
  }

  logger.cloud('Construindo URL final do PDF...', { secureUrl });

  // ── Estratégia: fl_inline + .pdf no final ────────────────
  // fl_inline  → serve com Content-Type: application/pdf (visualização no browser)
  // .pdf       → hint para o CDN do content-type correto
  //
  // Alternativa para forçar download com nome legível:
  //   fl_attachment:NexaSpark_Certificado_CODIGO
  //
  // ⚠️  Escolhemos fl_inline para que mobile abra direto no
  //     visualizador de PDF nativo (iOS Files, Android Drive)
  //     em vez de forçar download que pode falhar em alguns browsers.

  let url = secureUrl;

  // Insere fl_inline na URL após /upload/
  // Antes: .../raw/upload/v1777.../certificados/cert_XXX
  // Depois: .../raw/upload/fl_inline/v1777.../certificados/cert_XXX.pdf
  if (url.includes('/upload/') && !url.includes('fl_inline')) {
    url = url.replace('/upload/', '/upload/fl_inline/');
    logger.cloud('fl_inline inserido na URL ✅');
  }

  // Adiciona .pdf no final se não tiver
  if (!url.endsWith('.pdf')) {
    url = url + '.pdf';
    logger.cloud('.pdf adicionado ao final da URL ✅');
  }

  logger.success('CLOUDINARY:URL', 'URL final do PDF construída', {
    original: secureUrl,
    final:    url,
    flags:    'fl_inline + .pdf extension',
    impact:   'Mobile/iOS/Android abrirá como PDF nativo ✅',
  });

  return url;
}

// ============================================================
// 🖨️  GENERATE PDF — Core do serviço
//
// Fluxo:
//   1. Gera QR code apontando para URL de verificação
//   2. Constrói PDF com PDFKit (landscape A4)
//   3. Coleta chunks em buffer
//   4. Faz upload para Cloudinary
//   5. Constrói URL com flags corretas para mobile
//   6. Retorna URL final
//
// ⚠️  ANTI-PATTERN CORRIGIDO: new Promise(async ...) removido.
//     A função é async diretamente.
// ============================================================
async function generatePDF(data) {
  const t0 = Date.now();
  logger.sep();

  logger.pdf('════ INICIANDO GERAÇÃO DE CERTIFICADO ════', {
    nome_participante: data.nome_participante,
    nome_curso:        data.nome_curso,
    carga_horaria:     data.carga_horaria,
    data_emissao:      data.data_emissao,
    codigo:            data.codigo_verificacao,
    timestamp:         new Date().toISOString(),
  });

  // ── Pré-validação de dependências ─────────────────────────
  if (!cloudinaryReady) {
    logger.error('PDF', '🚨 Cloudinary não configurado — abortando geração', {
      hint: 'Verifique CLOUDINARY_URL no Railway',
    });
    throw new Error('Cloudinary não configurado — verifique as variáveis de ambiente');
  }

  const bgPath = path.join(__dirname, '../assets/certificate-bg.png');
  if (!fs.existsSync(bgPath)) {
    logger.error('PDF', '🚨 Imagem de fundo não encontrada', {
      bgPath,
      cwd:  process.cwd(),
      hint: 'Verifique se src/assets/certificate-bg.png existe no deploy',
    });
    throw new Error(`Imagem de fundo não encontrada: ${bgPath}`);
  }

  const bgStats = fs.statSync(bgPath);
  logger.success('PDF', 'Imagem de fundo encontrada', {
    bgPath,
    sizeKB: Math.round(bgStats.size / 1024),
  });

  // ── STEP 1: Gera QR Code ──────────────────────────────────
  const verificationUrl = getVerificationUrl(data.codigo_verificacao);
  logger.info('PDF', 'Gerando QR Code', { verificationUrl });

  const t1 = Date.now();
  const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
    width:  200,
    margin: 1,
    color:  { dark: '#000000', light: '#ffffff' },
  });
  logger.perf('PDF', 'QR Code gerado', Date.now() - t1);
  logger.info('PDF', 'QR Code stats', {
    dataUrlLength: qrCodeDataUrl.length,
    apontaPara:    verificationUrl,
  });

  // ── STEP 2: Gera hash e metadados ─────────────────────────
  const hash          = generateHash(data);
  const hashPreview   = hash.slice(0, 25).toUpperCase();
  const cpfMasked     = maskCPF(data.cpf);
  const dataFormatada = formatDateBR(data.data_emissao);

  logger.info('PDF', 'Metadados preparados', {
    cpfMasked,
    dataFormatada,
    hashPrefix: hashPreview.slice(0, 10) + '...',
    instrutor:  data.nome_instrutor || '(não informado)',
  });

  // ── STEP 3: Monta o PDF com PDFKit ────────────────────────
  logger.info('PDF', 'Montando documento PDFKit (A4 landscape)...');
  const t2  = Date.now();

  const doc    = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
  const chunks = [];

  doc.on('data', (chunk) => {
    chunks.push(chunk);
    logger.info('PDF:STREAM', `Chunk recebido`, { chunkSize: chunk.length });
  });

  const pdfReady = new Promise((resolve, reject) => {
    doc.on('end',   () => { logger.success('PDF:STREAM', 'Stream finalizado ✅'); resolve(); });
    doc.on('error', (err) => { logger.error('PDF:STREAM', 'Erro no stream PDFKit', { message: err.message }); reject(err); });
  });

  // ── Conteúdo visual do PDF ────────────────────────────────

  // Fundo
  doc.image(bgPath, 0, 0, { width: 842, height: 595 });

  // Título
  doc
    .font('Helvetica-Bold')
    .fontSize(36)
    .fillColor('#d4af37')
    .text('CERTIFICADO', 0, 120, { align: 'center' });

  // Subtítulo
  doc
    .fontSize(16)
    .fillColor('#ffffff')
    .font('Helvetica')
    .text('Certificamos que', 0, 165, { align: 'center' });

  // Nome do participante
  doc
    .font('Helvetica-Bold')
    .fontSize(28)
    .fillColor('#ffffff')
    .text(data.nome_participante.toUpperCase(), 0, 200, { align: 'center' });

  // CPF mascarado (LGPD)
  doc
    .font('Helvetica')
    .fontSize(12)
    .fillColor('#cccccc')
    .text(`CPF: ${cpfMasked}`, 0, 238, { align: 'center' });

  // Texto do curso
  doc
    .fontSize(14)
    .fillColor('#ffffff')
    .text('concluiu com êxito o curso', 0, 265, { align: 'center' });

  // Nome do curso
  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor('#d4af37')
    .text(data.nome_curso, 0, 288, { align: 'center' });

  // Carga horária e data
  doc
    .font('Helvetica')
    .fontSize(13)
    .fillColor('#cccccc')
    .text(`Carga horária: ${data.carga_horaria} horas`, 0, 322, { align: 'center' });

  doc
    .text(`Data de Emissão: ${dataFormatada}`, 0, 340, { align: 'center' });

  // Instrutor (opcional)
  if (data.nome_instrutor) {
    doc
      .fontSize(12)
      .text(`Instrutor: ${data.nome_instrutor}`, 0, 358, { align: 'center' });
    logger.info('PDF', 'Instrutor adicionado ao certificado', { instrutor: data.nome_instrutor });
  }

  // Assinatura digital (hash preview)
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#aaaaaa')
    .text('Assinatura digital (SHA-256):', 480, 385);

  doc
    .fontSize(8)
    .text(`${hashPreview}...`, 480, 397);

  // Selo CERTIFICADO AUTENTICADO
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#d4af37')
    .text('CERTIFICADO', 105, 476, { width: 110, align: 'center' });

  doc
    .fontSize(9)
    .text('AUTENTICADO', 105, 490, { width: 110, align: 'center' });

  // QR Code
  doc.image(qrCodeDataUrl, 645, 478, { width: 85 });
  logger.info('PDF', 'QR Code inserido no PDF', { posicao: 'x:645 y:478', tamanho: '85px' });

  // URL de verificação
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#cccccc')
    .text(verificationUrl, 0, 545, { align: 'center' });

  // Finaliza o stream
  doc.end();
  await pdfReady;

  logger.perf('PDF', 'PDFKit render completo', Date.now() - t2);

  // ── STEP 4: Upload para Cloudinary ────────────────────────
  const pdfBuffer = Buffer.concat(chunks);
  const base64PDF = pdfBuffer.toString('base64');
  const publicId  = `cert_${data.codigo_verificacao}_${Date.now()}`;

  logger.cloud('Preparando upload do PDF', {
    publicId,
    sizeKB:       Math.round(pdfBuffer.length / 1024),
    chunksCount:  chunks.length,
    base64Length: base64PDF.length,
  });

  // ============================================================
  // ⚠️  CORREÇÃO CRÍTICA — Upload com flags corretas para mobile
  //
  // PROBLEMA: resource_type 'raw' sem format definido fazia o
  // Cloudinary servir o arquivo sem Content-Type: application/pdf.
  //
  // SOLUÇÃO:
  //   format: 'pdf'           → Cloudinary registra como PDF
  //   resource_type: 'raw'    → mantém (PDFs são raw no Cloudinary)
  //   use_filename: true      → preserva nome do arquivo
  //   unique_filename: false  → evita sufixo aleatório no nome
  //
  // A URL final será processada por buildCloudinaryPdfUrl()
  // que adiciona fl_inline e .pdf para garantir Content-Type
  // correto na entrega via CDN.
  // ============================================================
  const t3 = Date.now();
  let uploadResult;

  try {
    logger.cloud('Executando cloudinary.uploader.upload()...', {
      resource_type: 'raw',
      format:        'pdf',
      folder:        'certificados',
      publicId,
    });

    uploadResult = await cloudinary.uploader.upload(
      `data:application/pdf;base64,${base64PDF}`,
      {
        resource_type:   'raw',
        format:          'pdf',           // ← CORREÇÃO: define format explicitamente
        folder:          'certificados',
        public_id:       publicId,
        use_filename:    true,
        unique_filename: false,
        overwrite:       false,
        tags:            ['nexaspark', 'certificate', 'pdf', data.codigo_verificacao],
      }
    );

    logger.perf('CLOUDINARY', 'Upload concluído', Date.now() - t3);
    logger.success('CLOUDINARY', 'Upload bem-sucedido ✅', {
      public_id:    uploadResult.public_id,
      secure_url:   uploadResult.secure_url,
      format:       uploadResult.format,
      resource_type: uploadResult.resource_type,
      bytes:        uploadResult.bytes,
      sizeKB:       Math.round((uploadResult.bytes || 0) / 1024),
      version:      uploadResult.version,
      created_at:   uploadResult.created_at,
    });

  } catch (uploadErr) {
    logger.error('CLOUDINARY', '🚨 FALHA CRÍTICA NO UPLOAD — detalhes completos', {
      message:    uploadErr.message,
      http_code:  uploadErr.http_code,
      name:       uploadErr.name,
      publicId,
      sizeKB:     Math.round(pdfBuffer.length / 1024),
      hints: [
        'Verifique se CLOUDINARY_URL está correto no Railway',
        'Verifique o limite de armazenamento do plano Cloudinary',
        'Verifique se o public_id não conflita com arquivo existente',
        `URL seria: https://res.cloudinary.com/[cloud_name]/raw/upload/certificados/${publicId}.pdf`,
      ],
    });
    throw uploadErr;
  }

  // ── STEP 5: Constrói URL final com content-type correto ───
  //
  // ⚠️  ESTA É A CORREÇÃO PRINCIPAL DO BUG MOBILE:
  //     A URL bruta do Cloudinary serve como raw/octet-stream.
  //     buildCloudinaryPdfUrl() insere fl_inline e .pdf para
  //     que o CDN sirva com Content-Type: application/pdf.
  //
  const urlFinal = buildCloudinaryPdfUrl(
    uploadResult.secure_url,
    data.nome_participante,
    data.codigo_verificacao
  );

  const totalMs = Date.now() - t0;
  logger.perf('PDF', 'Fluxo completo (QR + render + upload + URL)', totalMs);

  logger.success('PDF', '════ CERTIFICADO GERADO COM SUCESSO ════', {
    id:              data.codigo_verificacao,
    urlBruta:        uploadResult.secure_url,
    urlFinal,
    verificationUrl,
    totalMs,
    pdfSizeKB:       Math.round(pdfBuffer.length / 1024),
    cloudinarySizeKB: Math.round((uploadResult.bytes || 0) / 1024),
    mobile:          '✅ iOS/Android abrirão como PDF nativo',
  });

  logger.sep();

  // ⚠️  Retorna urlFinal (com fl_inline + .pdf) em vez da
  //     secure_url bruta — correção do bug mobile
  return urlFinal;
}

// ============================================================
module.exports = {
  generatePDF,
  generateHash,
  maskCPF,
  formatDateBR,
};