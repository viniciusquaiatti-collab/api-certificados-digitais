const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

class CertificateService {
  /**
   * Gera um código de verificação único e seguro.
   * @returns {Promise<string>} Uma string hexadecimal de 32 caracteres.
   */
  static async generateVerificationCode() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Gera um PDF de certificado visualmente profissional.
   * @param {object} data - Dados do certificado.
   * @returns {Promise<string>} O caminho do arquivo PDF gerado.
   */
  static async generatePDF(data) {
    console.log('--- [CertificateService.generatePDF] Iniciando geração de PDF profissional ---');
    
    const fileName = `certificate_${data.codigo_verificacao}.pdf`;
    const filePath = path.join(__dirname, '..', 'certificates', fileName);

    // Garante que o diretório de certificados exista
    const certificatesDir = path.dirname(filePath);
    if (!fs.existsSync(certificatesDir)) {
      fs.mkdirSync(certificatesDir, { recursive: true });
    }

    // Cria um novo documento PDF
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0
    });

    // Pipe o PDF para um arquivo
    doc.pipe(fs.createWriteStream(filePath));

    // --- DESIGN DO CERTIFICADO ---

    // Background
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f0f8ff');

    // Borda Decorativa
    doc.rect(40, 40, doc.page.width - 80, doc.page.height - 80).lineWidth(2).stroke('#0c4a6e');

    // Título Principal
    doc.fontSize(32).fill('#0c4a6e').font('Helvetica-Bold').text('Certificado de Conclusão', { align: 'center' });
    
    // Linha Decorativa
    doc.moveTo(doc.page.width / 2 - 100, doc.y + 5).lineTo(doc.page.width / 2 + 100, doc.y + 5).lineWidth(1).stroke('#0c4a6e');
    
    doc.moveDown();

    // Texto de Certificação
    doc.fontSize(16).fill('#333').font('Helvetica').text('Certificamos que', { align: 'center' });
    
    doc.moveDown(0.5);

    // Nome do Participante
    doc.fontSize(28).fill('#0c4a6e').font('Helvetica-Bold').text(data.nome_participante, { align: 'center' });
    
    doc.moveDown(0.5);

    // Texto de Conclusão
    doc.fontSize(16).fill('#333').font('Helvetica').text('concluiu com êxito o curso', { align: 'center' });
    
    doc.moveDown(0.5);

    // Nome do Curso
    doc.fontSize(24).fill('#0c4a6e').font('Helvetica-Bold').text(data.nome_curso, { align: 'center' });
    
    doc.moveDown();

    // Carga Horária
    doc.fontSize(16).fill('#333').font('Helvetica').text(`com carga horária de ${data.carga_horaria} horas.`, { align: 'center' });

    doc.moveDown(2);

    // Data de Emissão
    doc.fontSize(14).fill('#555').font('Helvetica-Oblique').text(`Emitido em ${new Date(data.data_emissao).toLocaleDateString('pt-BR')}`, { align: 'center' });

    // --- QR CODE ---
    const qrCodeDataURL = await QRCode.toDataURL(`http://localhost:8080/api/certificates/verify/${data.codigo_verificacao}`);
    
    // Posiciona o QR Code no canto inferior direito
    const qrSize = 80;
    const qrX = doc.page.width - 120;
    const qrY = doc.page.height - 120;
    
    doc.image(qrCodeDataURL, qrX, qrY, { width: qrSize, height: qrSize });
    
    // Texto abaixo do QR Code
    doc.fontSize(10).fill('#777').font('Helvetica').text('Verifique Autenticidade', qrX, qrY + qrSize + 5, { width: qrSize, align: 'center' });

    // Finaliza o PDF
    doc.end();

    console.log(`✅ [CertificateService.generatePDF] PDF profissional criado em: ${filePath}`);
    return filePath;
  }
}

module.exports = CertificateService;