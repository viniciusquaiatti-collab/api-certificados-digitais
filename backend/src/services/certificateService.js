// src/services/certificateService.js
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const cloudinary = require('cloudinary').v2;
const crypto = require('crypto');

console.log('--- [CertificateService] Iniciando serviço de certificados ---');

const cloudinaryUrl = process.env.CLOUDINARY_URL;

if (!cloudinaryUrl) {
  console.error('[Cloudinary] CLOUDINARY_URL não configurado no .env');
} else {
  cloudinary.config({ 
    cloudinary_url: cloudinaryUrl 
  });
  console.log(' [Cloudinary] Configurado com CLOUDINARY_URL');
}

// ===========================================
// HASH (mantido por compatibilidade - NÃO USADO)
// ===========================================
function generateHash(data) {
  const secret = process.env.CERTIFICATE_SECRET_KEY || 'default-secret-key-change-in-production';
  
  const payload = `${data.nome_participante}|${data.cpf}|${data.nome_curso}|${data.carga_horaria}|${data.data_emissao}|${data.codigo_verificacao}|${secret}`;
  
  return crypto.createHash('sha256').update(payload).digest('hex');
}

// ===========================================
// CPF (AJUSTE 1 - PADRÃO PROFISSIONAL)
// ===========================================
function maskCPF(cpf) {
  if (!cpf) return "***.***.***-**";
  const digits = cpf.replace(/\D/g, "");
  return `***.***.***-${digits.slice(-2)}`;
}

// ===========================================
// HASH VISUAL (OK)
// ===========================================
function maskHash(hash) {
  if (!hash || hash.length < 32) return hash;
  
  const inicio = hash.substring(0, 8);
  const fim = hash.substring(hash.length - 8);
  
  return `${inicio}........${fim}`;
}

// ===========================================
// BASE URL (MANTIDO - NÃO ALTERADO)
// ===========================================
function getFrontendUrl() {
  return process.env.FRONTEND_URL || 'https://verificadoroficial.lovable.app';
}

// ===========================================
// QR CODE (MANTIDO)
// ===========================================
async function generateQRCodeWithSecurityBackground(codigo_verificacao) {
const frontendUrl = getFrontendUrl();
const verificationUrl = `${frontendUrl}/verify/${codigo_verificacao}`;
  
  return QRCode.toDataURL(verificationUrl, {
    width: 250,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#1a1a1a',
      light: '#ffffff'
    }
  });
}

// ===========================================
// PDF (MANTIDO)
// ===========================================
async function generatePDF(data) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!process.env.CLOUDINARY_URL) {
        return reject(new Error('CLOUDINARY_URL não configurado'));
      }

      const frontendUrl = getFrontendUrl();
const verificationUrl = `${frontendUrl}/verify/${data.codigo_verificacao}`;

      const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
        width: 220,
        margin: 1
      });

      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 40
      });

      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));

      doc.on('end', async () => {
        try {
          const pdfBuffer = Buffer.concat(chunks);
          const pdfBase64 = pdfBuffer.toString('base64');

          const result = await cloudinary.uploader.upload(
            `data:application/pdf;base64,${pdfBase64}`,
            {
              resource_type: 'raw',
              folder: 'certificados',
              public_id: `certificado_${data.codigo_verificacao}`,
              overwrite: true
            }
          );

          resolve(result.secure_url);
        } catch (err) {
          reject(err);
        }
      });

      doc.on('error', reject);

      // =====================================
      //  FUNDO LIMPO PREMIUM
      // =====================================
      doc.rect(0, 0, 842, 595).fill('#FFFFFF');

      // Moldura externa
      doc
        .lineWidth(2)
        .strokeColor('#0f172a')
        .rect(20, 20, 802, 555)
        .stroke();

      // =====================================
      //  HEADER EMPRESA
      // =====================================
      doc
        .fontSize(12)
        .fillColor('#64748b')
        .text('NexaSpark Tecnologia', 40, 40);

      doc
        .fontSize(10)
        .fillColor('#94a3b8')
        .text('Certificação Digital Segura', 40, 55);

      // =====================================
      //  TÍTULO
      // =====================================
      doc
        .fontSize(34)
        .font('Helvetica-Bold')
        .fillColor('#0f172a')
        .text('CERTIFICADO', 0, 90, { align: 'center' });

      doc
        .fontSize(14)
        .fillColor('#475569')
        .text('Certificamos que', 0, 130, { align: 'center' });

      // Nome
      doc
        .fontSize(26)
        .font('Helvetica-Bold')
        .fillColor('#020617')
        .text(data.nome_participante, 0, 160, { align: 'center' });

      // CPF
      doc
        .fontSize(12)
        .fillColor('#475569')
        .text(`CPF: ${data.cpf_parcial}`, 0, 195, { align: 'center' });

      doc
        .text('concluiu com êxito o curso', 0, 215, { align: 'center' });

      // Curso
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .fillColor('#020617')
        .text(data.nome_curso, 0, 235, { align: 'center' });

      doc
        .fontSize(13)
        .fillColor('#475569')
        .text(`Carga horária: ${data.carga_horaria} horas`, 0, 265, { align: 'center' });

      doc
        .text(`Emitido em: ${new Date(data.data_emissao).toLocaleDateString('pt-BR')}`, 0, 285, { align: 'center' });

      // =====================================
      //  QR CODE (CORRIGIDO)
      // =====================================
      doc
        .rect(60, 330, 200, 200)
        .fill('#f8fafc');

      doc.image(qrCodeDataUrl, 65, 335, {
        width: 190
      });

      doc
        .fontSize(8)
        .fillColor('#2563eb')
        .text(verificationUrl, 60, 535);

      // =====================================
      //  HASH (NOVO)
      // =====================================
      const hashPreview = data.hash.slice(0, 20).toUpperCase();

      doc
        .fontSize(10)
        .fillColor('#64748b')
        .text('Assinatura digital (SHA-256):', 350, 380);

      doc
        .fontSize(10)
        .fillColor('#020617')
        .text(`${hashPreview}...`, 350, 395);

      // =====================================
      //  RODAPÉ PROFISSIONAL
      // =====================================
      doc
        .fontSize(9)
        .fillColor('#94a3b8')
        .text('Este certificado é validado digitalmente.', 0, 520, { align: 'center' });

      doc
        .text('A autenticidade pode ser verificada via QR Code ou URL.', 0, 535, { align: 'center' });

      doc.end();

    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateHash,
  maskCPF,
  maskHash,
  generatePDF
};