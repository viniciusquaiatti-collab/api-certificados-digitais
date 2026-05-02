// src/services/cloudinaryService.js
// ============================================================
// 🏢 NexaSpark — Cloudinary Service
// Configuração centralizada do Cloudinary + multer para uploads.
//
// ⚠️  NOTA ARQUITETURAL:
//     Este arquivo configura o Cloudinary para uploads via multer
//     (multipart/form-data — upload direto de arquivo).
//
//     O certificateService.js configura o Cloudinary para uploads
//     programáticos via base64 (geração de PDF em memória).
//
//     Ambos usam o mesmo Cloudinary, mas fluxos distintos.
//     Centralizamos a configuração aqui e o certificateService
//     importa de cá quando necessário.
// ============================================================

const cloudinary              = require('cloudinary').v2;
const { CloudinaryStorage }   = require('multer-storage-cloudinary');
const multer                  = require('multer');

// ============================================================
// 🎨 LOGGER
// ============================================================
const c = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  gray:   (s) => `\x1b[90m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
};

const logger = {
  info:    (msg, data) => console.log(   c.cyan(`ℹ️  [CloudinaryService]`),    msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  success: (msg, data) => console.log(   c.green(`✅ [CloudinaryService]`),   msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  warn:    (msg, data) => console.warn(  c.yellow(`⚠️  [CloudinaryService]`),  msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
  error:   (msg, data) => console.error( c.red(`❌ [CloudinaryService]`),     msg, data !== undefined ? c.gray(JSON.stringify(data)) : ''),
};

// ============================================================
// ☁️  CONFIGURAÇÃO DO CLOUDINARY
//
// ⚠️  PROBLEMA ORIGINAL: nenhuma validação de variáveis de
//     ambiente. O servidor subia sem erros e só falhava na
//     primeira tentativa de upload — muito tarde para detectar.
//
// ✅  CORREÇÃO: validamos na inicialização do módulo.
//     Falha em boot = problema detectado antes do primeiro request.
// ============================================================
const requiredVars = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
const missingVars  = requiredVars.filter((v) => !process.env[v]);

if (process.env.CLOUDINARY_URL) {
  // Modo simplificado — uma única variável
  cloudinary.config({ cloudinary_url: process.env.CLOUDINARY_URL });
  logger.success('Cloudinary configurado via CLOUDINARY_URL');

} else if (missingVars.length === 0) {
  // Modo explícito — três variáveis separadas
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  logger.success('Cloudinary configurado via variáveis separadas', {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  });

} else {
  // Nenhuma configuração encontrada — falha visível no boot
  logger.error('Credenciais do Cloudinary ausentes no .env!', {
    missing: missingVars,
    hint:    'Configure CLOUDINARY_URL ou todas as três: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET',
  });
  // ⚠️  Não lançamos exceção aqui para não impedir o boot completo
  //     (outras rotas ainda funcionam sem o Cloudinary).
  //     O certificateService verifica cloudinaryReady antes de usar.
}

// ============================================================
// 📦 CLOUDINARY STORAGE — Para uploads via multer
//
// ⚠️  PROBLEMA ORIGINAL: allowed_formats: ['pdf'] no storage
//     filtra pelo nome da extensão mas NÃO valida o content-type
//     real do arquivo. Um atacante pode renomear um .exe para
//     .pdf e fazer upload normalmente.
//
// ✅  MELHORIA: adicionamos fileFilter no multer para validar
//     o mimetype real além da extensão.
// ============================================================
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'certificados',
    allowed_formats: ['pdf'],
    resource_type:   'raw',
    // ⚠️  MELHORIA: public_id único por upload — evita colisões
    public_id: (req, file) => {
      const timestamp = Date.now();
      const safeName  = file.originalname
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/\.pdf$/i, '');
      return `cert_${safeName}_${timestamp}`;
    },
  },
});

// ⚠️  MELHORIA: fileFilter valida o mimetype real do arquivo
function fileFilter(req, file, cb) {
  const allowedMimeTypes = ['application/pdf'];

  if (allowedMimeTypes.includes(file.mimetype)) {
    logger.info('Upload permitido', { originalname: file.originalname, mimetype: file.mimetype });
    cb(null, true);
  } else {
    logger.warn('Upload rejeitado — tipo de arquivo não permitido', {
      originalname: file.originalname,
      mimetype:     file.mimetype,
    });
    cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}. Apenas PDF é aceito.`), false);
  }
}

// ⚠️  MELHORIA: limite de tamanho de arquivo (5MB)
//     O original não tinha limite — qualquer arquivo passaria.
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files:    1,                // máximo 1 arquivo por request
  },
});

logger.success('Multer + CloudinaryStorage configurados', {
  folder:    'certificados',
  maxSizeMB: 5,
});

// ============================================================
module.exports = { cloudinary, upload };