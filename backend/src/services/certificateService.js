// src/services/certificateService.js

const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const cloudinary = require('cloudinary').v2;
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

console.log('--- [CertificateService] Serviço iniciado ---');

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
// HASH
// ===========================================
function generateHash(data) {
  const secret = process.env.CERTIFICATE_SECRET_KEY || 'default-secret';

  const payload = `${data.nome_participante}|${data.cpf}|${data.nome_curso}|${data.carga_horaria}|${data.data_emissao}|${data.codigo_verificacao}|${secret}`;

  return crypto.createHash('sha256').update(payload).digest('hex');
}

// ===========================================
// CPF MASK (SEGURA)
// ===========================================
function maskCPF(cpf) {
  if (!cpf) return "***.***.***-**";

  const digits = cpf.replace(/\D/g, "").padStart(11, "0");

  return `${digits[0]}**.${digits[4]}**.***-${digits.slice(9)}`;
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
      console.log('[PDF] Gerando certificado...');
      console.log('CPF formatado:', maskCPF(data.cpf));

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
      // FUNDO
      // ===========================================
      const bgPath = path.join(__dirname, '../assets/certificate-bg.png');

      if (!fs.existsSync(bgPath)) {
        return reject(new Error('Imagem não encontrada: ' + bgPath));
      }

      doc.image(bgPath, 0, 0, {
        width: 842,
        height: 595
      });

      // ===========================================
      // SELO DOURADO (ALINHADO PROFISSIONAL)
      // ===========================================
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#000000')
        .text('CERTIFICADO', 105, 475, {
          width: 110,
          align: 'center'
        });

      doc
        .fontSize(10)
        .text('AUTENTICADO', 105, 490, {
          width: 110,
          align: 'center'
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

      // ✅ TEXTO PROFISSIONAL (SEM DUPLICAÇÃO)
      doc
        .text(`Data de Emissão: ${new Date(data.data_emissao).toLocaleDateString('pt-BR')}`, 0, 340, { align: 'center' });

      //  REMOVIDO: Certificado Autenticado duplicado

      // ===========================================
      // QR CODE
      // ===========================================
      doc.image(qrCodeDataUrl, 645, 480, {
        width: 85
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