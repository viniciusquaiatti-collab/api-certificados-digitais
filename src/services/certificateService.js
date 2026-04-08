// src/services/certificateService.js
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const cloudinary = require('cloudinary').v2;
const crypto = require('crypto');

console.log('--- [CertificateService] Iniciando serviço de certificados ---');

// Configurar Cloudinary
const cloudinaryUrl = process.env.CLOUDINARY_URL;

if (!cloudinaryUrl) {
  console.error('❌ [Cloudinary] CLOUDINARY_URL não configurado no .env');
  console.error('❌ [Cloudinary] Configure a variável CLOUDINARY_URL com sua URL do Cloudinary');
  console.error('❌ [Cloudinary] Formato: cloudinary://API_KEY:API_SECRET@CLOUD_NAME');
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
// MASCARAR HASH (MOSTRAR APENAS INICIO E FIM)
// ===========================================
function maskHash(hash) {
  if (!hash || hash.length < 32) return hash;
  
  const primeiroParte = hash.substring(0, 8);
  const ultimoParte = hash.substring(hash.length - 8);
  
  return `${primeiroParte}........${ultimoParte}`;
}

// ===========================================
// GERAR QR CODE COM BACKGROUND DE SEGURANÇA
// ===========================================
async function generateQRCodeWithSecurityBackground(codigo_verificacao) {
  const verificationUrl = `${process.env.VERIFICATION_URL || 'http://localhost:8080'}/api/certificates/verify/${codigo_verificacao}`;
  
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
      // Verificar se Cloudinary está configurado
      if (!process.env.CLOUDINARY_URL) {
        console.error('❌ [CertificateService] CLOUDINARY_URL não configurado');
        return reject(new Error('CLOUDINARY_URL não configurado no .env'));
      }
      
      // Gerar QR Code
      console.log('[CertificateService] Gerando QR Code com background de segurança...');
      const qrCodeDataUrl = await generateQRCodeWithSecurityBackground(data.codigo_verificacao);
      console.log('[CertificateService] ✅ QR Code gerado');
      
      // Criar PDF
      console.log('[CertificateService] Criando PDF com QR Code estratégico...');
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 40
      });
      
      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      
      doc.on('end', async () => {
        try {
          console.log('[CertificateService] PDF gerado, enviando para Cloudinary...');
          
          const pdfBuffer = Buffer.concat(chunks);
          const pdfBase64 = pdfBuffer.toString('base64');
          
          console.log(`[CertificateService] Tamanho do PDF: ${pdfBuffer.length} bytes`);
          
          // Upload para Cloudinary
          const result = await cloudinary.uploader.upload(
            `data:application/pdf;base64,${pdfBase64}`,
            {
              resource_type: 'raw',
              folder: 'certificados',
              public_id: `certificado_${data.codigo_verificacao}`,
              overwrite: true
            }
          );
          
          console.log(`✅ [CertificateService] PDF enviado para Cloudinary: ${result.secure_url}`);
          
          resolve(result.secure_url);
        } catch (cloudinaryError) {
          console.error('❌ [CertificateService] Erro no Cloudinary:', cloudinaryError.message);
          console.error('❌ [CertificateService] Detalhes:', cloudinaryError);
          reject(cloudinaryError);
        }
      });
      
      doc.on('error', (pdfError) => {
        console.error('❌ [CertificateService] Erro no PDF:', pdfError.message);
        reject(pdfError);
      });
      
      // ===========================================
      // CONTEÚDO DO PDF - VERSÃO SEGURA
      // ===========================================
      
      // ===========================================
      // CABEÇALHO COM SELAR DE SEGURANÇA
      // ===========================================
      
      // Fundo branco
      doc.fillColor('#FFFFFF');
      doc.rect(0, 0, 842, 595).fill();
      
      // Borda de segurança externa (linha vermelha fina)
      doc.strokeColor('#cc0000');
      doc.lineWidth(3);
      doc.rect(20, 20, 802, 555).stroke();
      
      // Borda interna (linha preta)
      doc.strokeColor('#000000');
      doc.lineWidth(1);
      doc.rect(30, 30, 782, 535).stroke();
      
      // ===========================================
      // TÍTULO
      // ===========================================
      
      doc.fontSize(36).font('Helvetica-Bold');
      doc.fillColor('#1a1a1a');
      doc.text('CERTIFICADO', 0, 50, { align: 'center' });
      
      doc.moveDown();
      
      // ===========================================
      // TEXTO DE INTRODUÇÃO
      // ===========================================
      
      doc.fontSize(14).font('Helvetica');
      doc.text('Certificamos que', 0, 100, { align: 'center' });
      
      // ===========================================
      // NOME DO PARTICIPANTE
      // ===========================================
      
      doc.fontSize(28).font('Helvetica-Bold');
      doc.text(data.nome_participante, 0, 130, { align: 'center' });
      
      // ===========================================
      // CPF PARCIAL (LGPD)
      // ===========================================
      
      doc.fontSize(12).font('Helvetica');
      doc.text(`CPF: ${data.cpf_parcial}`, 0, 165, { align: 'center' });
      
      // ===========================================
      // TEXTO DO CURSO
      // ===========================================
      
      doc.fontSize(12).font('Helvetica');
      doc.text('concluiu com êxito o curso', 0, 185, { align: 'center' });
      
      // ===========================================
      // NOME DO CURSO
      // ===========================================
      
      doc.fontSize(22).font('Helvetica-Bold');
      doc.text(data.nome_curso, 0, 205, { align: 'center' });
      
      // ===========================================
      // CARGA HORÁRIA E DATA
      // ===========================================
      
      doc.fontSize(14).font('Helvetica');
      doc.text(`com carga horária de ${data.carga_horaria} horas`, 0, 235, { align: 'center' });
      
      doc.moveDown();
      
      doc.fontSize(12).font('Helvetica');
      doc.text(`Emitido em: ${new Date(data.data_emissao).toLocaleDateString('pt-BR')}`, 0, 255, { align: 'center' });
      
      // ===========================================
      // QR CODE ESTRATÉGICO - LADO ESQUERDO COM CAIXA DE SEGURANÇA
      // ===========================================
      
      // Fundo cinza para o QR Code (caixa de segurança)
      doc.fillColor('#f5f5f5');
      doc.rect(50, 290, 260, 260).fill();
      
      // Borda da caixa de segurança
      doc.strokeColor('#000000');
      doc.lineWidth(2);
      doc.rect(50, 290, 260, 260).stroke();
      
      // Linhas diagonais de fundo (proteção contra recorte)
      doc.strokeColor('#dddddd');
      doc.lineWidth(1);
      
      // Linha diagonal 1
      doc.moveTo(50, 290);
      doc.lineTo(310, 550);
      doc.stroke();
      
      // Linha diagonal 2
      doc.moveTo(310, 290);
      doc.lineTo(50, 550);
      doc.stroke();
      
      // QR CODE DENTRO DA CAIXA (centrado)
      console.log('[CertificateService] Desenhando QR Code na caixa de segurança...');
      doc.image(qrCodeDataUrl, 55, 295, {
        width: 250,
        height: 250
      });
      
      // ===========================================
      // PAINEL DE VERIFICAÇÃO - LADO DIREITO
      // ===========================================
      
      // Título do painel
      doc.fontSize(14).font('Helvetica-Bold');
      doc.fillColor('#1a1a1a');
      doc.text('Verificação de Autenticidade', 350, 300, { align: 'left' });
      
      doc.moveDown();
      
      // Instruções
      doc.fontSize(10).font('Helvetica');
      doc.fillColor('#666666');
      doc.text('Escaneie o QR Code ou acesse:', 350, 330, { align: 'left' });
      
      // URL de verificação
      doc.fontSize(9).font('Helvetica-Bold');
      doc.fillColor('#0066cc');
      const verificationUrl = `${process.env.VERIFICATION_URL || 'http://localhost:8080'}/api/certificates/verify/${data.codigo_verificacao}`;
      doc.text(verificationUrl, 350, 350, { align: 'left' });
      
      doc.moveDown();
      
      // Código de verificação
      doc.fontSize(11).font('Helvetica-Bold');
      doc.fillColor('#1a1a1a');
      doc.text('Código de Verificação:', 350, 380, { align: 'left' });
      
      doc.fontSize(16).font('Helvetica-Bold');
      doc.fillColor('#000000');
      doc.text(data.codigo_verificacao, 350, 400, { align: 'left' });
      
      doc.moveDown();
      
      // Hash parcial (mascarado)
      doc.fontSize(9).font('Helvetica');
      doc.fillColor('#999999');
      doc.text('Hash (segurança):', 350, 430, { align: 'left' });
      
      doc.fontSize(8).font('Helvetica');
      doc.text(maskHash(data.hash), 350, 445, { align: 'left' });
      
      // ===========================================
      // MENSAGEM DE SEGURANÇA (RODAPÉ)
      // ===========================================
      
      doc.fontSize(8).font('Helvetica-Oblique'); // CORREÇÃO: Helvetica-Oblique em vez de Helvetica-Italic
      doc.fillColor('#999999');
      doc.text('Este certificado possui proteção anti-falsificação. Qualquer alteração invalida o documento.', 0, 560, { align: 'center' });
      
      doc.end();
      
    } catch (error) {
      console.error('❌ [CertificateService] Erro ao gerar PDF:', error.message);
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