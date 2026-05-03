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
};

const logger = {
  info:    (scope, msg, data) => console.log(   c.cyan(`ℹ️  [${scope}]`),    msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  success: (scope, msg, data) => console.log(   c.green(`✅ [${scope}]`),   msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  warn:    (scope, msg, data) => console.warn(  c.yellow(`⚠️  [${scope}]`),  msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  error:   (scope, msg, data) => console.error( c.red(`❌ [${scope}]`),     msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  perf:    (scope, label, ms) => console.log(   c.magenta(`⏱️  [${scope}]`), `${label} — ${c.bold(ms + 'ms')}`),
  sec:     (msg, data)        => console.warn(  c.red(`🚨 [SECURITY]`),    msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
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
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({ cloudinary_url: process.env.CLOUDINARY_URL });
    logger.success('CLOUDINARY', 'Configurado via CLOUDINARY_URL');
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
    logger.success('CLOUDINARY', 'Configurado via variáveis separadas');
    return true;
  }

  logger.error('CLOUDINARY', 'Nenhuma credencial encontrada!', {
    hint: 'Configure CLOUDINARY_URL ou CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET no .env',
  });
  return false;
}

const cloudinaryReady = initCloudinary();

// ============================================================
// 🔐 HELPER — Gera hash SHA-256 do certificado
//
// ⚠️  PROBLEMA CRÍTICO DE CONSISTÊNCIA:
//     O original aqui incluía `CERTIFICATE_SECRET_KEY` no payload:
//     `${nome}|${cpf}|...|${secret}`
//
//     Mas o certificateController.js gerava o hash SEM o secret:
//     `${nome}|${cpf}|...` (sem secret)
//
//     Isso significa que o hash gravado no banco (pelo controller)
//     é DIFERENTE do hash impresso no PDF (pelo service).
//     A verificação de autenticidade que compara os dois
//     SEMPRE FALHARIA — tornando a validação inútil.
//
// ✅  CORREÇÃO: removemos o secret do payload aqui para ficar
//     consistente com o controller. O hash deve ser o mesmo
//     em ambos os lugares.
//
//     NOTA: Se quiser adicionar o secret de volta para maior
//     segurança, adicione também no controller — mas faça em
//     ambos os lugares ao mesmo tempo.
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
// 🛡️  HELPER — Máscara de CPF para exibição
//
// ⚠️  PROBLEMA ORIGINAL: a máscara expunha mais dígitos do
//     que o necessário. Ex: "1**.4**.***-90" revelava o
//     1º e 4º dígitos — informação desnecessária.
//
// ✅  CORREÇÃO (LGPD): exibe apenas os 2 últimos dígitos.
//     Suficiente para o titular confirmar que é seu CPF,
//     insuficiente para qualquer uso indevido.
// ============================================================
function maskCPF(cpf) {
  if (!cpf) return '***.***.***-**';
  const digits = String(cpf).replace(/\D/g, '').padStart(11, '0');
  return `***.***.***-${digits.slice(-2)}`;
}

// ============================================================
// 📅 HELPER — Formata data YYYY-MM-DD → DD/MM/YYYY
//
// ⚠️  PROBLEMA ORIGINAL: a função não validava se dateString
//     era uma string válida antes de chamar .split('-').
//     Com valor undefined/null lançaria TypeError.
//
// ✅  CORREÇÃO: guarda com fallback e validação de formato.
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
// ⚠️  BUG CRÍTICO CORRIGIDO #1 — ReferenceError: base is not defined
//     A versão anterior retornava `${base}/verify/${codigo}` mas
//     a variável `base` não estava definida no escopo da função —
//     causava ReferenceError em tempo de execução, abortando
//     silenciosamente toda geração de PDF.
//
// ⚠️  CORREÇÃO #2 — Rota atualizada: /verify/ → /verificar/
//     A nova página de verificação própria do NexaSpark está em:
//     web/src/app/verificar/[codigo]/page.tsx
//     URL pública: nexaspark.com.br/verificar/CODIGO
//     O QR code impresso no PDF agora aponta para domínio próprio,
//     eliminando a dependência do Lovable (verificadoroficial.lovable.app).
//
// ✅  CORREÇÃO: base definida corretamente via FRONTEND_URL.
//
// ⚠️  AÇÃO NECESSÁRIA NO RAILWAY:
//     Adicione/atualize a variável de ambiente:
//     FRONTEND_URL=https://nexaspark.com.br
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
// 🖨️  GENERATE PDF — Core do serviço
//
// Fluxo:
//   1. Gera QR code apontando para URL de verificação
//   2. Constrói PDF com PDFKit (landscape A4)
//   3. Coleta chunks em buffer
//   4. Faz upload para Cloudinary como raw/PDF
//   5. Retorna secure_url
//
// ⚠️  PROBLEMA ORIGINAL #1 — new Promise(async ...)
//     É um anti-pattern. Se o código interno lançar uma
//     exceção síncrona antes do primeiro await, a promise
//     engole o erro silenciosamente em algumas versões do Node.
//
// ✅  CORREÇÃO: removemos o anti-pattern. A função é async
//     diretamente, e tratamos o streaming do PDFKit com
//     uma Promise interna apenas para o evento 'end'.
//
// ⚠️  PROBLEMA ORIGINAL #2 — Upload de base64 para Cloudinary
//     O original convertia o buffer para base64 e passava como
//     data URI. Isso funciona mas é ineficiente para PDFs grandes.
//     Mantemos para compatibilidade, mas documentamos.
// ============================================================
async function generatePDF(data) {
  const t0 = Date.now();

  logger.info('PDF', 'Iniciando geração do PDF', {
    nome_participante: data.nome_participante,
    nome_curso:        data.nome_curso,
    codigo:            data.codigo_verificacao,
  });

  // ── Pré-validação ─────────────────────────────────────────
  if (!cloudinaryReady) {
    throw new Error('Cloudinary não configurado — verifique as variáveis de ambiente');
  }

  const bgPath = path.join(__dirname, '../assets/certificate-bg.png');
  if (!fs.existsSync(bgPath)) {
    logger.error('PDF', 'Imagem de fundo não encontrada', { bgPath });
    throw new Error(`Imagem de fundo não encontrada: ${bgPath}`);
  }

  logger.success('PDF', 'Imagem de fundo encontrada', { bgPath });

  // ── Gera QR Code ──────────────────────────────────────────
  const verificationUrl = getVerificationUrl(data.codigo_verificacao);
  logger.info('PDF', 'Gerando QR Code', { verificationUrl });

  const t1 = Date.now();
  const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
    width:          200,
    margin:         1,
    color: {
      dark:  '#000000',
      light: '#ffffff',
    },
  });
  logger.perf('PDF', 'QR Code gerado', Date.now() - t1);

  // ── Gera hash ─────────────────────────────────────────────
  const hash        = generateHash(data);
  const hashPreview = hash.slice(0, 25).toUpperCase();
  const cpfMasked   = maskCPF(data.cpf);
  const dataFormatada = formatDateBR(data.data_emissao);

  logger.info('PDF', 'Metadados preparados', {
    cpfMasked,
    dataFormatada,
    hashPrefix: hashPreview.slice(0, 10) + '...',
  });

  // ── Monta o PDF ───────────────────────────────────────────
  logger.info('PDF', 'Montando documento PDFKit...');
  const t2  = Date.now();

  const doc    = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
  const chunks = [];

  doc.on('data', (chunk) => chunks.push(chunk));

  // ⚠️  CORREÇÃO: usamos uma Promise apenas para aguardar o
  //     evento 'end' do stream — padrão correto para PDFKit.
  const pdfReady = new Promise((resolve, reject) => {
    doc.on('end',   resolve);
    doc.on('error', reject);
  });

  // ── Conteúdo do PDF ───────────────────────────────────────

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

  // CPF mascarado
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

  // Informações adicionais
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

  // URL de verificação
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#cccccc')
    .text(verificationUrl, 0, 545, { align: 'center' });

  // Finaliza o stream do PDF
  doc.end();
  await pdfReady;

  logger.perf('PDF', 'PDFKit render completo', Date.now() - t2);

  // ── Upload para Cloudinary ────────────────────────────────
  const pdfBuffer   = Buffer.concat(chunks);
  const base64PDF   = pdfBuffer.toString('base64');
  const publicId    = `cert_${data.codigo_verificacao}_${Date.now()}`;

  logger.info('CLOUDINARY', 'Iniciando upload do PDF', {
    publicId,
    sizeKB: Math.round(pdfBuffer.length / 1024),
  });

  const t3 = Date.now();

  // ⚠️  CORREÇÃO #3 — try/catch explícito no upload Cloudinary
  //     O original deixava o erro propagar sem logar detalhes.
  //     Agora capturamos http_code e message antes de relançar,
  //     permitindo diagnóstico preciso no log quando o upload falha.
  let uploadResult;
  try {
    uploadResult = await cloudinary.uploader.upload(
      `data:application/pdf;base64,${base64PDF}`,
      {
        resource_type: 'raw',
        folder:        'certificados',
        public_id:     publicId,
        tags:          ['nexaspark', 'certificate', data.codigo_verificacao],
      }
    );
  } catch (uploadErr) {
    logger.error('CLOUDINARY', 'Falha no upload — detalhes completos', {
      message:   uploadErr.message,
      http_code: uploadErr.http_code,
      publicId,
      sizeKB:    Math.round(pdfBuffer.length / 1024),
      hint:      'Verifique credenciais Cloudinary e limite de plano',
    });
    throw uploadErr;
  }

  logger.perf('CLOUDINARY', 'Upload concluído', Date.now() - t3);

  const totalMs = Date.now() - t0;
  logger.perf('PDF', 'Fluxo completo (QR + render + upload)', totalMs);
  logger.success('PDF', 'Certificado gerado com sucesso', {
    url:             uploadResult.secure_url,
    publicId:        uploadResult.public_id,
    formato:         uploadResult.format,
    verificationUrl,
    totalMs,
  });

  return uploadResult.secure_url;
}

// ============================================================
module.exports = {
  generatePDF,
  generateHash,
  maskCPF,
  formatDateBR,
};