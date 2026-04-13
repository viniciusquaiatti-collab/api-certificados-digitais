// src/services/certificateService.js
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const cloudinary = require('cloudinary').v2;
const crypto = require('crypto');

console.log('--- [CertificateService] Iniciando serviço de certificados ---');

// Configurar Cloudinary
const cloudinaryUrl = process.env.CLOUDINARY_URL;

if (!cloudinaryUrl) {
  console.error('[Cloudinary] CLOUDINARY_URL não configurado no .env');
  console.error(' [Cloudinary] Configure a variável CLOUDINARY_URL com sua URL do Cloudinary');
  console.error(' [Cloudinary] Formato: cloudinary://API_KEY:API_SECRET@CLOUD_NAME');
} else {
  cloudinary.config({ 
    cloudinary_url: cloudinaryUrl 
  });
  console.log('✅ [Cloudinary] Configurado com CLOUDINARY_URL');
}

// ===========================================
// GERAR HASH SHA-256 FORTE
// ===========================================
function generateHash(data) {
  const secret = process.env.CERTIFICATE_SECRET_KEY || 'default-secret-key-change-in-production';
  
  const payload = `${data.nome_participante}|${data.cpf}|${data.nome_curso}|${data.carga_horaria}|${data.data_emissao}|${data.codigo_verificacao}|${secret}`;
  
  return crypto.createHash('sha256').update(payload).digest('hex');
}

// ===========================================
// MASCARAR CPF (LGPD)
// ===========================================
function maskCPF(cpf) {
  const digits = cpf.replace(/\D/g, '');
  return `***.***.**${digits.substring(9, 11)}-${digits.substring(11, 13)}`;
}

// ===========================================
// MASCARAR HASH
// ===========================================
function maskHash(hash) {
  if (!hash || hash.length < 32) return hash;
  
  const primeiroParte = hash.substring(0, 8);
  const ultimoParte = hash.substring(hash.length - 8);
  
  return `${primeiroParte}........${ultimoParte}`;
}

// ===========================================
// 🔥 BASE URL CENTRALIZADA (CORREÇÃO DEFINITIVA)
// ===========================================
function getBaseUrl() {
  return process.env.BASE_URL || 'http://localhost:8080';
}

// ===========================================
// GERAR QR CODE (CORRIGIDO)
// ===========================================
async function generateQRCodeWithSecurityBackground(codigo_verificacao) {
  const baseUrl = getBaseUrl();
  const verificationUrl = `${baseUrl}/api/certificates/verify/${codigo_verificacao}`;
  
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
// GERAR PDF E ENVIAR PARA CLOUDINARY
// ===========================================
async function generatePDF(data) {
  return new Promise(async (resolve, reject) => {
    console.log(`[CertificateService] Gerando PDF para: ${data.nome_participante}`);
    
    try {
      if (!process.env.CLOUDINARY_URL) {
        return reject(new Error('CLOUDINARY_URL não configurado no .env'));
      }
      
      // QR Code
      const qrCodeDataUrl = await generateQRCodeWithSecurityBackground(data.codigo_verificacao);
      
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

      // Fundo
      doc.fillColor('#FFFFFF');
      doc.rect(0, 0, 842, 595).fill();

      // Bordas
      doc.strokeColor('#cc0000').lineWidth(3).rect(20, 20, 802, 555).stroke();
      doc.strokeColor('#000000').lineWidth(1).rect(30, 30, 782, 535).stroke();

      // Título
      doc.fontSize(36).font('Helvetica-Bold').fillColor('#1a1a1a');
      doc.text('CERTIFICADO', 0, 50, { align: 'center' });

      doc.fontSize(14).font('Helvetica');
      doc.text('Certificamos que', 0, 100, { align: 'center' });

      doc.fontSize(28).font('Helvetica-Bold');
      doc.text(data.nome_participante, 0, 130, { align: 'center' });

      doc.fontSize(12).font('Helvetica');
      doc.text(`CPF: ${data.cpf_parcial}`, 0, 165, { align: 'center' });

      doc.text('concluiu com êxito o curso', 0, 185, { align: 'center' });

      doc.fontSize(22).font('Helvetica-Bold');
      doc.text(data.nome_curso, 0, 205, { align: 'center' });

      doc.fontSize(14);
      doc.text(`com carga horária de ${data.carga_horaria} horas`, 0, 235, { align: 'center' });

      doc.fontSize(12);
      doc.text(`Emitido em: ${new Date(data.data_emissao).toLocaleDateString('pt-BR')}`, 0, 255, { align: 'center' });

      // QR Box
      doc.fillColor('#f5f5f5').rect(50, 290, 260, 260).fill();
      doc.strokeColor('#000').lineWidth(2).rect(50, 290, 260, 260).stroke();

      doc.image(qrCodeDataUrl, 55, 295, {
        width: 250,
        height: 250
      });

      // 🔥 URL CORRIGIDA NO PDF
      const baseUrl = getBaseUrl();
      const verificationUrlText = `${baseUrl}/api/certificates/verify/${data.codigo_verificacao}`;

      doc.fontSize(9).fillColor('#0066cc');
      doc.text(verificationUrlText, 350, 350);

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