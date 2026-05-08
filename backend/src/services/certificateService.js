// src/services/certificateService.js
// ============================================================
// 🏢 NexaSpark — Certificate Service v2.0 ENTERPRISE
//
// Responsável por:
//   🖨️  Geração do PDF do certificado (PDFKit, A4 landscape)
//   ☁️  Upload para Cloudinary (resource_type raw, format pdf)
//   🔐 Assinatura digital SHA-256 do certificado
//   🔍 Retorno do hash_preview para exibição na verificação
//   🛡️  Máscara de CPF (LGPD Art. 37)
//   📊 Logger enterprise com emoticons, cores e telemetria
//
// ⚠️  CORREÇÃO v2: hash_preview agora retornado no objeto de
//     resultado — disponível para o controller salvar no banco
//     e para a rota de verify retornar ao frontend.
// ============================================================

const PDFDocument = require('pdfkit');
const QRCode      = require('qrcode');
const cloudinary  = require('cloudinary').v2;
const crypto      = require('crypto');
const path        = require('path');
const fs          = require('fs');
const os          = require('os');

// ============================================================
// 🎨 ENTERPRISE LOGGER — NexaSpark Global Debug System v2
//
// Design inspirado em Datadog, Linear e Railway logs.
// Cada categoria tem:
//   — emoticon único para escaneamento visual rápido
//   — cor ANSI consistente por domínio
//   — prefixo padronizado para grep/filter no Railway
//   — timestamp ISO para correlação com outros serviços
//   — separadores visuais para delimitar operações
//
// Filosofia: logs não são só para debug. São documentação viva
// do sistema em produção. Um SRE que vê esses logs pela primeira
// vez deve entender o que está acontecendo em < 5 segundos.
// ============================================================

// Códigos ANSI de cor
const ANSI = {
  reset:     '\x1b[0m',
  bold:      '\x1b[1m',
  dim:       '\x1b[2m',
  underline: '\x1b[4m',

  // Cores de texto
  black:   '\x1b[30m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',
  gray:    '\x1b[90m',

  // Cores brilhantes
  brightRed:     '\x1b[91m',
  brightGreen:   '\x1b[92m',
  brightYellow:  '\x1b[93m',
  brightBlue:    '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan:    '\x1b[96m',
  brightWhite:   '\x1b[97m',

  // Fundos
  bgRed:    '\x1b[41m',
  bgGreen:  '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue:   '\x1b[44m',
};

// Helpers de cor
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
  success:       (s) => `${ANSI.bgGreen}${ANSI.black}${ANSI.bold} ${s} ${ANSI.reset}`,
  warn:          (s) => `${ANSI.bgYellow}${ANSI.black}${ANSI.bold} ${s} ${ANSI.reset}`,
};

// Timestamp ISO compacto para correlação de logs
const ts = () => c.gray(`[${new Date().toISOString()}]`);

// Serializa data para log (JSON compacto, não-nulo)
const fmt = (data) => {
  if (data === undefined || data === null) return '';
  try {
    return c.gray(JSON.stringify(data, null, 0));
  } catch {
    return c.gray(String(data));
  }
};

// Logger enterprise global — cada domínio tem seu emoticon e cor
const logger = {
  // ── Informativos ─────────────────────────────────────────
  info:    (scope, msg, data) => console.log(
    ts(), c.brightCyan(`ℹ️  [${scope}]`), c.white(msg), fmt(data)
  ),

  // ── Sucesso ──────────────────────────────────────────────
  success: (scope, msg, data) => console.log(
    ts(), c.brightGreen(`✅ [${scope}]`), c.brightWhite(msg), fmt(data)
  ),

  // ── Aviso ────────────────────────────────────────────────
  warn:    (scope, msg, data) => console.warn(
    ts(), c.brightYellow(`⚠️  [${scope}]`), c.yellow(msg), fmt(data)
  ),

  // ── Erro ─────────────────────────────────────────────────
  error:   (scope, msg, data) => console.error(
    ts(), c.brightRed(`❌ [${scope}]`), c.red(c.bold(msg)), fmt(data)
  ),

  // ── Performance ──────────────────────────────────────────
  perf:    (scope, label, ms) => console.log(
    ts(), c.magenta(`⏱️  [${scope}]`),
    c.white(label), '—',
    ms < 500  ? c.brightGreen(`${ms}ms ⚡`) :
    ms < 2000 ? c.brightYellow(`${ms}ms 🟡`) :
                c.brightRed(`${ms}ms 🔴 LENTO`)
  ),

  // ── Segurança ────────────────────────────────────────────
  sec:     (msg, data) => console.warn(
    ts(), c.danger('🚨 SECURITY'), c.red(c.bold(msg)), fmt(data)
  ),

  // ── Cloudinary ───────────────────────────────────────────
  cloud:   (msg, data) => console.log(
    ts(), c.brightBlue(`☁️  [CLOUDINARY]`), c.white(msg), fmt(data)
  ),

  // ── PDF ──────────────────────────────────────────────────
  pdf:     (msg, data) => console.log(
    ts(), c.brightMagenta(`🖨️  [PDF]`), c.white(msg), fmt(data)
  ),

  // ── Hash / Criptografia ──────────────────────────────────
  hash:    (msg, data) => console.log(
    ts(), c.brightCyan(`🔐 [CRYPTO]`), c.white(msg), fmt(data)
  ),

  // ── QR Code ──────────────────────────────────────────────
  qr:      (msg, data) => console.log(
    ts(), c.cyan(`📱 [QRCODE]`), c.white(msg), fmt(data)
  ),

  // ── Upload ───────────────────────────────────────────────
  upload:  (msg, data) => console.log(
    ts(), c.blue(`📤 [UPLOAD]`), c.white(msg), fmt(data)
  ),

  // ── Database hint ─────────────────────────────────────────
  db:      (msg, data) => console.log(
    ts(), c.brightYellow(`🗄️  [DB]`), c.white(msg), fmt(data)
  ),

  // ── Sistema / Ambiente ───────────────────────────────────
  sys:     (msg, data) => console.log(
    ts(), c.gray(`🖥️  [SYS]`), c.gray(msg), fmt(data)
  ),

  // ── Separadores visuais ──────────────────────────────────
  sep:     ()          => console.log(c.gray('─'.repeat(72))),
  sepBold: ()          => console.log(c.brightGreen('═'.repeat(72))),
  sepWarn: ()          => console.log(c.brightYellow('─'.repeat(72))),

  // ── Banner de operação ───────────────────────────────────
  banner:  (title, emoji = '🏢') => {
    const line = '═'.repeat(72);
    console.log(`\n${ANSI.brightGreen}${line}${ANSI.reset}`);
    console.log(`${ANSI.brightGreen}${emoji}  ${ANSI.bold}${ANSI.brightWhite}${title}${ANSI.reset}`);
    console.log(`${ANSI.brightGreen}${line}${ANSI.reset}\n`);
  },

  // ── Tabela de key-value para contexto ────────────────────
  table:   (scope, data) => {
    console.log(ts(), c.cyan(`📊 [${scope}]`));
    Object.entries(data).forEach(([k, v]) => {
      const key = c.gray(`   ${k.padEnd(24)}`);
      const val = c.brightWhite(String(v ?? '—'));
      console.log(`${key} ${val}`);
    });
  },

  // ── Resultado final de operação ──────────────────────────
  result:  (scope, status, data) => {
    const icon   = status === 'ok'   ? '✅' : status === 'warn' ? '⚠️ ' : '❌';
    const colFn  = status === 'ok'   ? c.brightGreen : status === 'warn' ? c.brightYellow : c.brightRed;
    const label  = status === 'ok'   ? 'SUCCESS' : status === 'warn' ? 'WARNING' : 'FAILURE';
    console.log(ts(), colFn(`${icon} [${scope}] ${label}`), fmt(data));
  },
};

// ============================================================
// 🖥️  BOOT — Informações do ambiente ao inicializar
// ============================================================
logger.banner('NexaSpark Certificate Service v2.0 ENTERPRISE', '🎓');
logger.sys('Ambiente de execução', {
  node:     process.version,
  platform: process.platform,
  arch:     process.arch,
  cpus:     os.cpus().length,
  memGB:    (os.totalmem() / 1024 / 1024 / 1024).toFixed(1) + ' GB',
  env:      process.env.NODE_ENV || 'development',
  pid:      process.pid,
  cwd:      process.cwd(),
});
logger.sep();

// ============================================================
// ☁️  CLOUDINARY — Configuração com validação enterprise
// ============================================================
function initCloudinary() {
  logger.banner('Inicializando Cloudinary', '☁️');

  // Estratégia 1: CLOUDINARY_URL (variável completa)
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({ cloudinary_url: process.env.CLOUDINARY_URL });

    const url     = process.env.CLOUDINARY_URL;
    const isValid = url.startsWith('cloudinary://') && url.includes('@');

    if (!isValid) {
      logger.warn('CLOUDINARY:CONFIG', '⚠️  CLOUDINARY_URL com formato suspeito', {
        esperado:  'cloudinary://API_KEY:API_SECRET@CLOUD_NAME',
        recebido:  url.substring(0, 20) + '...',
        impacto:   'Uploads podem falhar silenciosamente',
      });
    } else {
      logger.success('CLOUDINARY:CONFIG', 'Configurado via CLOUDINARY_URL ✅', {
        cloud_name: url.split('@')[1] || '?',
        estrategia: 'CLOUDINARY_URL (recomendado)',
      });
    }

    logger.sep();
    return true;
  }

  // Estratégia 2: variáveis separadas
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

    logger.success('CLOUDINARY:CONFIG', 'Configurado via variáveis separadas ✅', {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      estrategia: 'Variáveis separadas (fallback)',
    });

    logger.sep();
    return true;
  }

  // Falha crítica — sem credenciais
  logger.error('CLOUDINARY:CONFIG', '🚨 NENHUMA CREDENCIAL CLOUDINARY ENCONTRADA', {
    hint:      'Configure CLOUDINARY_URL no Railway → Variables',
    impacto:   'TODOS os uploads de PDF falharão',
    formato:   'cloudinary://API_KEY:API_SECRET@CLOUD_NAME',
    variaveis: {
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
// 🔐 HELPER — Gera hash SHA-256 + preview do certificado
//
// ✅ v2: retorna objeto { hash, hashPreview } em vez de só hash
//    — o hashPreview é salvo no banco e retornado na verificação
//    — garante que o frontend pode exibir o DNA visual do hash
//
// Payload normalizado para determinismo:
//   — nome em UPPERCASE sem espaços extras
//   — CPF apenas dígitos
//   — carga_horaria como string
//   — data_emissao no formato original (sem conversão de timezone)
// ============================================================
function generateHash(data) {
  const t0 = Date.now();

  const {
    nome_participante,
    cpf,
    nome_curso,
    carga_horaria,
    data_emissao,
    codigo_verificacao,
  } = data;

  // Normalização para garantir mesmo hash independente de formatação
  const nomeLimpo     = nome_participante.trim().toUpperCase().replace(/\s+/g, ' ');
  const cpfDigitos    = String(cpf).replace(/\D/g, '');
  const cursoLimpo    = nome_curso.trim().toUpperCase().replace(/\s+/g, ' ');
  const cargaStr      = String(carga_horaria);
  const dataStr       = data_emissao;
  const codigoLimpo   = codigo_verificacao.trim().toUpperCase();

  const payload = [
    nomeLimpo,
    cpfDigitos,
    cursoLimpo,
    cargaStr,
    dataStr,
    codigoLimpo,
  ].join('|');

  const hash        = crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
  const hashPreview = hash.slice(0, 32).toUpperCase(); // 32 chars para visualização DNA

  logger.hash('SHA-256 gerado com sucesso', {
    payloadLength:   payload.length,
    hashCompleto:    hash,
    hashPreview:     hashPreview + '...',
    previewLength:   hashPreview.length,
    algoritmo:       'SHA-256',
    encoding:        'utf8 → hex',
    geradoEm:        `${Date.now() - t0}ms`,
  });

  logger.table('CRYPTO:PAYLOAD', {
    '01 · nome':     nomeLimpo,
    '02 · cpf':      cpfDigitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '***.***.***-$4'),
    '03 · curso':    cursoLimpo.substring(0, 40) + (cursoLimpo.length > 40 ? '...' : ''),
    '04 · horas':    cargaStr + 'h',
    '05 · data':     dataStr,
    '06 · codigo':   codigoLimpo,
    '─────────────': '──────────────────────────────────────────────',
    'hash (início)': hash.substring(0, 32) + '...',
    'hash (fim)':    '...' + hash.substring(32),
  });

  return { hash, hashPreview };
}

// ============================================================
// 🛡️  HELPER — Máscara de CPF (LGPD Art. 37)
//
// Exibe apenas os 2 últimos dígitos — suficiente para o
// titular confirmar que é seu CPF sem risco de exposição.
// Logs de CPF NUNCA exibem o número completo.
// ============================================================
function maskCPF(cpf) {
  if (!cpf) {
    logger.warn('LGPD:CPF', 'CPF vazio recebido — retornando máscara padrão');
    return '***.***.***-**';
  }

  const digits = String(cpf).replace(/\D/g, '').padStart(11, '0');
  const masked = `***.***.***-${digits.slice(-2)}`;

  logger.info('LGPD:CPF', 'CPF mascarado para exibição (LGPD Art. 37)', {
    entrada:   '[REDACTED]',
    mascara:   masked,
    sufixo:    digits.slice(-2),
    compliant: '✅ LGPD Art. 37 — apenas 2 dígitos exibidos',
  });

  return masked;
}

// ============================================================
// 📅 HELPER — Formata data YYYY-MM-DD → DD/MM/YYYY
//
// Trata edge cases: data com timezone, data malformada,
// data com separadores inconsistentes.
// ============================================================
function formatDateBR(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    logger.warn('DATE:FORMAT', 'Data inválida recebida', { dateString });
    return '';
  }

  // Remove parte de timezone se existir (ex: 2026-05-08T03:00:00.000Z → 2026-05-08)
  const datePart = dateString.split('T')[0];
  const parts    = datePart.split('-');

  if (parts.length !== 3) {
    logger.warn('DATE:FORMAT', 'Formato de data não reconhecido — usando original', {
      dateString,
      esperado: 'YYYY-MM-DD',
      hint:     'Verifique o formato enviado pelo frontend',
    });
    return dateString;
  }

  const [year, month, day] = parts;
  const formatted = `${day}/${month}/${year}`;

  logger.info('DATE:FORMAT', 'Data formatada', {
    entrada:  dateString,
    saida:    formatted,
    timezone: 'Brasil (sem conversão)',
  });

  return formatted;
}

// ============================================================
// 🌐 HELPER — URL de verificação pública do certificado
//
// ✅ Usa FRONTEND_URL do Railway env — não hardcoded.
//    Em dev: http://localhost:3000/verificar/[codigo]
//    Em prod: https://nexaspark.com.br/verificar/[codigo]
// ============================================================
function getVerificationUrl(codigo) {
  const base = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const url  = `${base}/verificar/${codigo}`;

  logger.info('URL:VERIFY', 'URL de verificação gerada', {
    base,
    url,
    fonte:   process.env.FRONTEND_URL ? 'FRONTEND_URL (env ✅)' : '⚠️  fallback localhost — configure FRONTEND_URL no Railway',
    qrAponta: url,
  });

  return url;
}

// ============================================================
// ☁️  HELPER — Valida e retorna URL final do PDF
//
// ⚠️  NÃO usar fl_inline em resource_type 'raw' → HTTP 400
// ✅  format:'pdf' no upload garante Content-Type correto
// ✅  buildCloudinaryPdfUrl apenas valida e garante a extensão
// ============================================================
function buildCloudinaryPdfUrl(secureUrl, codigoVerificacao) {
  if (!secureUrl) {
    logger.error('CLOUDINARY:URL', '🚨 secure_url vazia — URL inválida', { codigoVerificacao });
    return secureUrl;
  }

  let url = secureUrl;

  // Garante extensão .pdf
  if (!url.endsWith('.pdf')) {
    url = url + '.pdf';
    logger.warn('CLOUDINARY:URL', '.pdf adicionado defensivamente à URL', {
      original:  secureUrl,
      corrigida: url,
      hint:      'format:"pdf" no upload deveria resolver automaticamente',
    });
  }

  // Remove transformation flags inválidas para raw
  if (url.includes('/fl_')) {
    logger.error('CLOUDINARY:URL', '🚨 Flags de transformação detectadas em URL raw — removendo', { url });
    url = url.replace(/\/fl_[^/]+/g, '');
    logger.warn('CLOUDINARY:URL', 'Flags removidas', { urlCorrigida: url });
  }

  logger.success('CLOUDINARY:URL', 'URL final do PDF validada ✅', {
    url,
    terminaComPdf: url.endsWith('.pdf'),
    semFlags:      !url.includes('/fl_'),
    mobile:        '✅ iOS/Android — Content-Type: application/pdf',
  });

  return url;
}

// ============================================================
// 🖨️  GENERATE PDF — Core do serviço enterprise
//
// ✅ v2: retorna objeto { pdfUrl, hash, hashPreview }
//    — hashPreview disponível para o controller salvar no banco
//    — isso resolve o hash_preview: null na página de verificação
//
// Fluxo completo:
//   1. 🔍 Valida dependências (Cloudinary, imagem de fundo)
//   2. 📱 Gera QR Code com URL de verificação
//   3. 🔐 Gera hash SHA-256 + preview (32 chars)
//   4. 🖨️  Monta PDF com PDFKit (A4 landscape)
//   5. ☁️  Faz upload para Cloudinary
//   6. ✅ Retorna { pdfUrl, hash, hashPreview }
// ============================================================
async function generatePDF(data) {
  const t0        = Date.now();
  const requestId = `cert_${data.codigo_verificacao}_${Date.now()}`;

  logger.banner(`GERANDO CERTIFICADO — ${data.codigo_verificacao}`, '🎓');
  logger.table('CERT:INPUT', {
    'requestId':         requestId,
    'nome_participante': data.nome_participante,
    'nome_curso':        data.nome_curso,
    'carga_horaria':     data.carga_horaria + 'h',
    'data_emissao':      data.data_emissao,
    'codigo':            data.codigo_verificacao,
    'timestamp':         new Date().toISOString(),
    'node_env':          process.env.NODE_ENV || 'development',
  });
  logger.sep();

  // ── STEP 1: Pré-validação de dependências ──────────────────
  logger.info('CERT:INIT', '🔍 Validando dependências do serviço...');

  if (!cloudinaryReady) {
    logger.error('CERT:INIT', '🚨 Cloudinary não configurado — abortando', {
      hint:      'Configure CLOUDINARY_URL no Railway → Variables',
      requestId,
    });
    throw new Error('Cloudinary não configurado — verifique as variáveis de ambiente');
  }

  logger.success('CERT:INIT', 'Cloudinary ✅ disponível');

  const bgPath = path.join(__dirname, '../assets/certificate-bg.png');

  if (!fs.existsSync(bgPath)) {
    logger.error('CERT:INIT', '🚨 Imagem de fundo não encontrada', {
      bgPath,
      cwd:       process.cwd(),
      hint:      'Copie certificate-bg.png para src/assets/',
      requestId,
    });
    throw new Error(`Imagem de fundo não encontrada: ${bgPath}`);
  }

  const bgStats = fs.statSync(bgPath);
  logger.success('CERT:INIT', 'Imagem de fundo ✅ encontrada', {
    bgPath,
    sizeKB: Math.round(bgStats.size / 1024) + ' KB',
    mtime:  bgStats.mtime.toISOString(),
  });

  logger.sep();

  // ── STEP 2: QR Code ───────────────────────────────────────
  logger.info('CERT:QR', '📱 Gerando QR Code...');
  const t1             = Date.now();
  const verificationUrl = getVerificationUrl(data.codigo_verificacao);

  const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
    width:  200,
    margin: 1,
    color:  { dark: '#000000', light: '#ffffff' },
  });

  logger.perf('CERT:QR', 'QR Code gerado', Date.now() - t1);
  logger.qr('QR Code pronto ✅', {
    url:           verificationUrl,
    dataUrlLength: qrCodeDataUrl.length + ' chars',
    formato:       'PNG base64 via qrcode lib',
    dimensao:      '200x200px',
  });

  logger.sep();

  // ── STEP 3: Hash SHA-256 + preview ────────────────────────
  logger.info('CERT:HASH', '🔐 Gerando assinatura digital SHA-256...');
  const { hash, hashPreview } = generateHash(data);

  logger.success('CERT:HASH', 'Hash gerado ✅', {
    hash:        hash.substring(0, 16) + '...' + hash.substring(48),
    hashPreview: hashPreview + '...',
    bits:        256,
    algoritmo:   'SHA-256 (FIPS 180-4)',
    preview_len: hashPreview.length + ' chars (para DNA visual no frontend)',
  });

  logger.sep();

  // ── STEP 4: Metadados formatados para o PDF ───────────────
  const cpfMasked     = maskCPF(data.cpf);
  const dataFormatada = formatDateBR(data.data_emissao);

  logger.table('CERT:METADATA', {
    'cpf_mascarado': cpfMasked,
    'data_emissao':  dataFormatada,
    'carga_horaria': data.carga_horaria + 'h',
    'instrutor':     data.nome_instrutor || '(não informado)',
    'hash_preview':  hashPreview.substring(0, 16) + '...',
  });

  logger.sep();

  // ── STEP 5: Monta o PDF com PDFKit ────────────────────────
  logger.info('CERT:PDF', '🖨️  Montando documento PDF (A4 landscape)...');
  const t2     = Date.now();
  const doc    = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
  const chunks = [];

  doc.on('data', (chunk) => {
    chunks.push(chunk);
    logger.info('CERT:PDF:STREAM', '📦 Chunk recebido', {
      chunkSize: chunk.length + ' bytes',
      total:     chunks.length + ' chunks até agora',
    });
  });

  const pdfReady = new Promise((resolve, reject) => {
    doc.on('end',   () => {
      logger.success('CERT:PDF:STREAM', '✅ Stream finalizado — PDF completo em memória');
      resolve();
    });
    doc.on('error', (err) => {
      logger.error('CERT:PDF:STREAM', '❌ Erro no stream PDFKit', {
        message:   err.message,
        requestId,
      });
      reject(err);
    });
  });

  // ── Conteúdo visual do PDF ────────────────────────────────

  // Fundo
  doc.image(bgPath, 0, 0, { width: 842, height: 595 });
  logger.pdf('🖼️  Fundo aplicado', { width: 842, height: 595 });

  // Título
  doc.font('Helvetica-Bold').fontSize(36).fillColor('#d4af37')
    .text('CERTIFICADO', 0, 120, { align: 'center' });

  // Subtítulo
  doc.fontSize(16).fillColor('#ffffff').font('Helvetica')
    .text('Certificamos que', 0, 165, { align: 'center' });

  // Nome do participante
  doc.font('Helvetica-Bold').fontSize(28).fillColor('#ffffff')
    .text(data.nome_participante.toUpperCase(), 0, 200, { align: 'center' });

  // CPF mascarado (LGPD)
  doc.font('Helvetica').fontSize(12).fillColor('#cccccc')
    .text(`CPF: ${cpfMasked}`, 0, 238, { align: 'center' });

  // Texto do curso
  doc.fontSize(14).fillColor('#ffffff')
    .text('concluiu com êxito o curso', 0, 265, { align: 'center' });

  // Nome do curso
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#d4af37')
    .text(data.nome_curso, 0, 288, { align: 'center' });

  // Carga horária
  doc.font('Helvetica').fontSize(13).fillColor('#cccccc')
    .text(`Carga horária: ${data.carga_horaria} horas`, 0, 322, { align: 'center' });

  // Data de emissão
  doc.text(`Data de Emissão: ${dataFormatada}`, 0, 340, { align: 'center' });

  // Instrutor (opcional)
  if (data.nome_instrutor) {
    doc.fontSize(12).text(`Instrutor: ${data.nome_instrutor}`, 0, 358, { align: 'center' });
    logger.pdf('👨‍🏫 Instrutor adicionado', { instrutor: data.nome_instrutor });
  }

  // Assinatura digital — hash preview
  doc.font('Helvetica').fontSize(9).fillColor('#aaaaaa')
    .text('Assinatura digital (SHA-256):', 480, 385);
  doc.fontSize(8).text(`${hashPreview}...`, 480, 397);

  // Selo CERTIFICADO AUTENTICADO
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#d4af37')
    .text('CERTIFICADO', 105, 476, { width: 110, align: 'center' });
  doc.fontSize(9).text('AUTENTICADO', 105, 490, { width: 110, align: 'center' });

  // QR Code
  doc.image(qrCodeDataUrl, 645, 478, { width: 85 });
  logger.qr('📱 QR Code inserido no PDF', { posicao: 'x:645 y:478', tamanho: '85px' });

  // URL de verificação no rodapé
  doc.font('Helvetica').fontSize(8).fillColor('#cccccc')
    .text(verificationUrl, 0, 545, { align: 'center' });

  // Finaliza o stream
  doc.end();
  await pdfReady;

  const pdfBuffer = Buffer.concat(chunks);
  logger.perf('CERT:PDF', 'PDF renderizado em memória', Date.now() - t2);
  logger.table('CERT:PDF:STATS', {
    'chunks':     chunks.length,
    'buffer':     Math.round(pdfBuffer.length / 1024) + ' KB',
    'paginas':    '1',
    'formato':    'A4 landscape (842x595pt)',
    'hash_no_pdf': hashPreview.substring(0, 16) + '...',
  });

  logger.sep();

  // ── STEP 6: Upload para Cloudinary ────────────────────────
  logger.info('CERT:UPLOAD', '☁️  Iniciando upload para Cloudinary...');
  const t3       = Date.now();
  const base64PDF = pdfBuffer.toString('base64');
  const publicId  = `cert_${data.codigo_verificacao}_${Date.now()}`;

  logger.upload('Preparando payload de upload', {
    publicId,
    sizeKB:        Math.round(pdfBuffer.length / 1024) + ' KB',
    base64Length:  base64PDF.length + ' chars',
    resource_type: 'raw',
    format:        'pdf',
    folder:        'certificados',
    requestId,
  });

  let uploadResult;

  try {
    uploadResult = await cloudinary.uploader.upload(
      `data:application/pdf;base64,${base64PDF}`,
      {
        resource_type:   'raw',
        format:          'pdf',
        folder:          'certificados',
        public_id:       publicId,
        use_filename:    true,
        unique_filename: false,
        overwrite:       false,
        tags:            ['nexaspark', 'certificate', 'pdf', data.codigo_verificacao],
        context:         {
          codigo:     data.codigo_verificacao,
          curso:      data.nome_curso,
          gerado_em:  new Date().toISOString(),
          request_id: requestId,
        },
      }
    );

    logger.perf('CERT:UPLOAD', 'Upload concluído', Date.now() - t3);
    logger.result('CLOUDINARY:UPLOAD', 'ok', {
      public_id:     uploadResult.public_id,
      secure_url:    uploadResult.secure_url,
      format:        uploadResult.format,
      resource_type: uploadResult.resource_type,
      bytes:         Math.round((uploadResult.bytes || 0) / 1024) + ' KB',
      version:       uploadResult.version,
      created_at:    uploadResult.created_at,
    });

  } catch (uploadErr) {
    logger.error('CERT:UPLOAD', '🚨 FALHA CRÍTICA NO UPLOAD', {
      message:    uploadErr.message,
      http_code:  uploadErr.http_code,
      publicId,
      sizeKB:     Math.round(pdfBuffer.length / 1024) + ' KB',
      requestId,
      hints: [
        'Verifique CLOUDINARY_URL no Railway',
        'Verifique limite de armazenamento do plano',
        'Verifique conflito de public_id',
      ],
    });
    throw uploadErr;
  }

  logger.sep();

  // ── STEP 7: Constrói URL final ────────────────────────────
  const pdfUrl   = buildCloudinaryPdfUrl(uploadResult.secure_url, data.codigo_verificacao);
  const totalMs  = Date.now() - t0;

  logger.banner(`CERTIFICADO GERADO COM SUCESSO ✅ — ${data.codigo_verificacao}`, '🎉');
  logger.table('CERT:RESULT', {
    'requestId':     requestId,
    'codigo':        data.codigo_verificacao,
    'pdfUrl':        pdfUrl,
    'hash':          hash.substring(0, 16) + '...',
    'hashPreview':   hashPreview.substring(0, 16) + '...',
    'verifyUrl':     verificationUrl,
    'totalMs':       totalMs + 'ms',
    'pdfSizeKB':     Math.round(pdfBuffer.length / 1024) + ' KB',
    'cloudinaryKB':  Math.round((uploadResult.bytes || 0) / 1024) + ' KB',
    'mobile':        '✅ iOS/Android — Content-Type: application/pdf',
    'dna_visual':    '✅ hashPreview disponível para frontend',
  });
  logger.sep();

  // ── ✅ v2: retorna objeto com hash e hashPreview ──────────
  // IMPORTANTE: o controller deve usar hash_preview no INSERT
  // para que a rota de verify retorne ao frontend corretamente.
  return {
    pdfUrl,       // URL do PDF no Cloudinary
    hash,         // Hash SHA-256 completo (salvar no banco)
    hashPreview,  // 32 chars para exibição DNA no frontend
  };
}

// ============================================================
module.exports = {
  generatePDF,
  generateHash,
  maskCPF,
  formatDateBR,
};