// src/templates/certificateTemplate.js
// ============================================================
// 🏢 NexaSpark — Certificate HTML Template
// Template HTML para geração visual do certificado.
//
// ⚠️  NOTA ARQUITETURAL IMPORTANTE:
//     Este template é usado quando o PDF é gerado via
//     renderização de HTML → PDF (ex: Puppeteer/html-pdf).
//
//     O certificateService.js usa PDFKit (geração programática).
//     São duas abordagens diferentes para o mesmo resultado.
//
//     Se você usa certificateService.js (PDFKit), este template
//     não é utilizado. Se você usa um engine de HTML→PDF,
//     este template é o que define o visual.
//
//     Recomendação: escolha uma abordagem e padronize.
//     PDFKit = mais controle, sem dependência de browser headless.
//     HTML template = mais fácil de editar o visual.
// ============================================================

// ============================================================
// 🎨 LOGGER
// ============================================================
const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  cyan:  (s) => `\x1b[36m${s}\x1b[0m`,
  gray:  (s) => `\x1b[90m${s}\x1b[0m`,
  bold:  (s) => `\x1b[1m${s}\x1b[0m`,
  red:   (s) => `\x1b[31m${s}\x1b[0m`,
};

const logger = {
  info:  (msg, data) => console.log(   c.cyan(`ℹ️  [CertTemplate]`),  msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  warn:  (msg, data) => console.warn(  `\x1b[33m⚠️  [CertTemplate]\x1b[0m`, msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  error: (msg, data) => console.error( c.red(`❌ [CertTemplate]`),    msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
};

// ============================================================
// 🛡️  HELPER — Escapa HTML para prevenir XSS
//
// ⚠️  PROBLEMA ORIGINAL: os dados do certificado eram inseridos
//     diretamente no HTML via template literals sem sanitização.
//     Se nome_participante contivesse <script>alert(1)</script>,
//     seria renderizado como HTML e poderia executar JS.
//     Em um PDF gerado por browser headless (Puppeteer),
//     isso pode vazar dados ou executar código malicioso.
//
// ✅  CORREÇÃO: escapa todos os dados antes de inserir no HTML.
// ============================================================
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#x27;');
}

// ============================================================
// 📅 HELPER — Formata data YYYY-MM-DD → DD/MM/YYYY
// ============================================================
function formatDate(dateString) {
  if (!dateString || typeof dateString !== 'string') return '';
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// ============================================================
// 🖨️  CERTIFICATE TEMPLATE
//
// Recebe um objeto com os dados do certificado e retorna
// uma string HTML pronta para ser convertida em PDF.
//
// ⚠️  CAMPOS ESPERADOS:
//   - nome_participante: string (obrigatório)
//   - cpf_parcial:       string (obrigatório — NUNCA passe cpf completo)
//   - nome_curso:        string (obrigatório)
//   - carga_horaria:     number (obrigatório)
//   - data_emissao:      string YYYY-MM-DD (obrigatório)
//   - hash:              string (obrigatório)
//   - codigo_verificacao:string (obrigatório)
//   - qrCode:            string data URL (obrigatório)
//   - verificationUrl:   string (obrigatório)
//   - nome_instrutor:    string (opcional)
//
// ⚠️  PROBLEMA ORIGINAL: os campos esperados eram diferentes
//     dos usados pelo controller (nome vs nome_participante,
//     curso vs nome_curso, cargaHoraria vs carga_horaria).
//     Isso causaria campos em branco no certificado gerado.
//
// ✅  CORREÇÃO: nomes padronizados com o restante do projeto.
// ============================================================
module.exports = function certificateTemplate(data) {
  // Valida campos obrigatórios antes de gerar o HTML
  const required = [
    'nome_participante', 'cpf_parcial', 'nome_curso',
    'carga_horaria', 'data_emissao', 'hash',
    'codigo_verificacao', 'qrCode', 'verificationUrl',
  ];

  const missing = required.filter((field) => !data[field]);
  if (missing.length > 0) {
    logger.error('Campos obrigatórios ausentes no template', { missing });
    throw new Error(`certificateTemplate: campos obrigatórios ausentes — ${missing.join(', ')}`);
  }

  // Escapa todos os dados para prevenir XSS
  const nome        = escapeHtml(data.nome_participante).toUpperCase();
  const cpf         = escapeHtml(data.cpf_parcial);
  const curso       = escapeHtml(data.nome_curso);
  const carga       = escapeHtml(String(data.carga_horaria));
  const data_br     = escapeHtml(formatDate(data.data_emissao));
  const hash        = escapeHtml(data.hash);
  const hashPreview = hash.slice(0, 25).toUpperCase();
  const codigo      = escapeHtml(data.codigo_verificacao);
  const url         = escapeHtml(data.verificationUrl);
  const instrutor   = data.nome_instrutor ? escapeHtml(data.nome_instrutor) : null;

  // qrCode é uma data URL — não precisa de escape, mas validamos o prefixo
  const qrCode = String(data.qrCode || '');
  if (qrCode && !qrCode.startsWith('data:image/')) {
    logger.warn('qrCode não parece ser uma data URL válida', { prefix: qrCode.slice(0, 30) });
  }

  // bgPath — caminho local para o fundo do certificado
  // ⚠️  CORREÇÃO: o original usava process.cwd() direto no template.
  //     Isso falha se o processo for iniciado de um diretório diferente.
  //     Usamos __dirname para caminho absoluto confiável.
  const bgPath = `file://${__dirname}/../assets/certificate-bg.png`.replace(/\\/g, '/');

  logger.info('Template gerado', { nome, curso, codigo });

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Certificado — ${nome}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      margin: 0;
      padding: 0;
      background: #000;
    }

    .page {
      position: relative;
      width: 1123px;
      height: 794px;
      background-image: url('${bgPath}');
      background-repeat: no-repeat;
      background-position: center;
      background-size: cover;
      font-family: Arial, Helvetica, sans-serif;
      color: #ffffff;
      overflow: hidden;
    }

    .content {
      position: absolute;
      top: 180px;
      left: 0;
      width: 100%;
      text-align: center;
      padding: 0 60px;
    }

    .title {
      font-size: 42px;
      font-weight: bold;
      color: #d4af37;
      letter-spacing: 4px;
      margin-bottom: 20px;
      text-transform: uppercase;
    }

    .subtitle {
      font-size: 18px;
      color: #cccccc;
      margin-bottom: 14px;
    }

    .name {
      font-size: 34px;
      font-weight: bold;
      color: #ffffff;
      margin: 10px 0 8px;
      letter-spacing: 1px;
    }

    .cpf {
      font-size: 13px;
      color: #aaaaaa;
      margin-bottom: 18px;
    }

    .course-label {
      font-size: 16px;
      color: #cccccc;
      margin-bottom: 8px;
    }

    .course-name {
      font-size: 22px;
      font-weight: bold;
      color: #d4af37;
      margin-bottom: 16px;
    }

    .info {
      font-size: 14px;
      color: #cccccc;
      line-height: 1.8;
    }

    .instrutor {
      font-size: 13px;
      color: #aaaaaa;
      margin-top: 6px;
    }

    /* QR Code — canto inferior direito */
    .qr {
      position: absolute;
      bottom: 100px;
      right: 80px;
      width: 120px;
      height: 120px;
    }

    .qr img {
      width: 100%;
      height: 100%;
    }

    .qr-label {
      font-size: 9px;
      color: #aaaaaa;
      text-align: center;
      margin-top: 4px;
    }

    /* Assinatura digital — canto inferior direito, acima do QR */
    .hash {
      position: absolute;
      bottom: 230px;
      right: 80px;
      font-size: 10px;
      color: #aaaaaa;
      text-align: right;
      max-width: 220px;
      word-break: break-all;
    }

    /* Selo — canto inferior esquerdo */
    .seal {
      position: absolute;
      bottom: 80px;
      left: 80px;
      text-align: center;
      width: 130px;
    }

    .seal-text {
      font-size: 11px;
      font-weight: bold;
      color: #d4af37;
      letter-spacing: 1px;
      line-height: 1.6;
      text-transform: uppercase;
    }

    /* URL de verificação — rodapé centralizado */
    .verify {
      position: absolute;
      bottom: 40px;
      left: 0;
      width: 100%;
      text-align: center;
      font-size: 10px;
      color: #888888;
    }
  </style>
</head>

<body>
  <div class="page">

    <div class="content">
      <div class="title">CERTIFICADO</div>
      <div class="subtitle">Certificamos que</div>
      <div class="name">${nome}</div>
      <div class="cpf">CPF: ${cpf}</div>
      <div class="course-label">concluiu com êxito o curso</div>
      <div class="course-name">${curso}</div>
      <div class="info">
        Carga horária: ${carga} horas<br/>
        Data de Emissão: ${data_br}
      </div>
      ${instrutor ? `<div class="instrutor">Instrutor(a): ${instrutor}</div>` : ''}
    </div>

    <div class="seal">
      <div class="seal-text">CERTIFICADO<br/>AUTENTICADO</div>
    </div>

    <div class="hash">
      Assinatura digital (SHA-256):<br/>
      ${hashPreview}...
    </div>

    <div class="qr">
      <img src="${qrCode}" alt="QR Code de verificação" />
      <div class="qr-label">Verificar</div>
    </div>

    <div class="verify">
      Verifique a autenticidade em: ${url} &nbsp;|&nbsp; Código: ${codigo}
    </div>

  </div>
</body>
</html>`;
};