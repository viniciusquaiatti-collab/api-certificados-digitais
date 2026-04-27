// src/services/certificateService.js

const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const cloudinary = require('cloudinary').v2;
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
console.log('--- [CertificateService] Iniciando serviço de certificados ---');



// ===========================================
// CLOUDINARY
// ===========================================
if (!process.env.CLOUDINARY_URL) {
  console.error('[Cloudinary] CLOUDINARY_URL não configurado');
} else {
  cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL
  });
}

// ===========================================
// HASH REAL (IMPORTANTE)
// ===========================================
function generateHash(data) {
  const secret = process.env.CERTIFICATE_SECRET_KEY || 'default-secret';

  const payload = `${data.nome_participante}|${data.cpf}|${data.nome_curso}|${data.carga_horaria}|${data.data_emissao}|${data.codigo_verificacao}|${secret}`;

  return crypto.createHash('sha256').update(payload).digest('hex');
}

// ===========================================
// CPF MASK
// ===========================================
function maskCPF(cpf) {
  if (!cpf) return "***.***.***-**";
  const digits = cpf.replace(/\D/g, "");
  return `***.***.***-${digits.slice(-2)}`;
}

// ===========================================
// FRONTEND URL
// ===========================================
function getFrontendUrl() {
  return process.env.FRONTEND_URL || 'https://verificadoroficial.lovable.app';
}

// ===========================================
// PDF PRINCIPAL
// ===========================================
async function generatePDF(data) {
  return new Promise(async (resolve, reject) => {
    try {

      if (!process.env.CLOUDINARY_URL) {
        return reject(new Error('CLOUDINARY_URL não configurado'));
      }

      const verificationUrl = `${getFrontendUrl()}/verify/${data.codigo_verificacao}`;

      const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
        width: 200,
        margin: 1
      });

      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 0
      });

      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));

      doc.on('end', async () => {
        try {
          const pdfBuffer = Buffer.concat(chunks);

          const result = await cloudinary.uploader.upload(
            `data:application/pdf;base64,${pdfBuffer.toString('base64')}`,
            {
              resource_type: 'raw',
              folder: 'certificados',
              public_id: `cert_${data.codigo_verificacao}_${Date.now()}`
            }
          );

          resolve(result.secure_url);

        } catch (err) {
          reject(err);
        }
      });

      doc.on('error', reject);

      // ===========================================
      // FUNDO (CRÍTICO - CORRIGIDO)
      // ===========================================
     const bgPath = path.join(__dirname, '../assets/certificate-bg.png');

// ===========================================
// DEBUG PROFISSIONAL (ANÁLISE COMPLETA)
// ===========================================
console.log(' Caminho da imagem:', bgPath);
console.log(' EXISTE?', fs.existsSync(bgPath));

if (!fs.existsSync(bgPath)) {
  return reject(new Error('Imagem não encontrada: ' + bgPath));
}

// INFO DO ARQUIVO
const stats = fs.statSync(bgPath);
console.log(' Tamanho (bytes):', stats.size);

// LEITURA DO ARQUIVO
const buffer = fs.readFileSync(bgPath);

// ASSINATURA DO ARQUIVO (CRÍTICO)
console.log('🔍 Header:', buffer.slice(0, 8));

      doc.image(bgPath, 0, 0, {
        width: 842,
        height: 595
      });

      // ===========================================
      // TEXTO CENTRAL
      // ===========================================

      doc
        .font('Helvetica-Bold')
        .fontSize(36)
        .fillColor('#d4af37')
        .text('CERTIFICADO', 0, 120, { align: 'center' });

      doc
        .fontSize(16)
        .fillColor('#ffffff')
        .text('Certificamos que', 0, 160, { align: 'center' });

      doc
        .fontSize(28)
        .font('Helvetica-Bold')
        .text(data.nome_participante, 0, 200, { align: 'center' });

      doc
        .fontSize(12)
        .fillColor('#cccccc')
        .text(`CPF: ${maskCPF(data.cpf)}`, 0, 235, { align: 'center' });

      doc
        .fontSize(14)
        .fillColor('#ffffff')
        .text('concluiu com êxito o curso', 0, 260, { align: 'center' });

      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .text(data.nome_curso, 0, 285, { align: 'center' });

      doc
        .fontSize(14)
        .fillColor('#cccccc')
        .text(`Carga horária: ${data.carga_horaria} horas`, 0, 320, { align: 'center' });

      doc
        .text(`Emitido em: ${new Date(data.data_emissao).toLocaleDateString('pt-BR')}`, 0, 340, { align: 'center' });

      // ===========================================
      // QR CODE (SELO)
      // ===========================================
      doc.image(qrCodeDataUrl, 110, 375, {
        width: 120
      });

      // ===========================================
      // HASH
      // ===========================================
      const hash = generateHash(data);
      const hashPreview = hash.slice(0, 25).toUpperCase();

      doc
        .fontSize(10)
        .fillColor('#ffffff')
        .text('Assinatura digital (SHA-256):', 480, 380);

      doc
        .text(`${hashPreview}...`, 480, 395);

      // ===========================================
      // LINK
      // ===========================================
      doc
        .fontSize(9)
        .fillColor('#cccccc')
        .text(verificationUrl, 0, 540, { align: 'center' });

      doc.end();

    } catch (error) {
      reject(error);
    }
  });
}

// ===========================================
module.exports = {
  generateHash,
  maskCPF,
  generatePDF
};