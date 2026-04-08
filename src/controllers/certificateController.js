// src/controllers/certificateController.js
const Certificate = require('../models/Certificate');
const CertificateService = require('../services/certificateService');
const AuditLog = require('../models/AuditLog');
const crypto = require('crypto');

console.log('--- [CertificateController] Iniciando controller de certificados ---');

class CertificateController {
  
  // ===========================================
  // CRIAR CERTIFICADO (AUTENTICADO)
  // ===========================================
  static async createCertificate(req, res) {
    console.log('--- [CertificateController.createCertificate] Iniciando criação ---');
    
    try {
      const usuario_id = req.user.id;
      const { nome_participante, cpf, nome_curso, carga_horaria, data_emissao } = req.body;
      
      console.log(`[CertificateController] Usuário ${usuario_id} criando certificado para: ${nome_participante}`);
      
      // Verificar se CLOUDINARY_URL está configurado
      if (!process.env.CLOUDINARY_URL) {
        console.error('[CertificateController] CLOUDINARY_URL não configurado');
        return res.status(500).json({
          success: false,
          error: 'CLOUDINARY_URL não configurado no .env. Configure sua conta Cloudinary.'
        });
      }
      
      // Gerar código de verificação permanente (16 caracteres)
      const codigo_verificacao = crypto.randomBytes(8).toString('hex').toUpperCase();
      
      // Gerar hash SHA-256 forte
      const hash = CertificateService.generateHash({
        nome_participante,
        cpf,
        nome_curso,
        carga_horaria,
        data_emissao,
        codigo_verificacao
      });
      
      // Mascara CPF para LGPD
      const cpf_parcial = CertificateService.maskCPF(cpf);
      
      // Criar certificado no banco
      const certificateId = await Certificate.create({
        usuario_id,
        nome_participante,
        cpf,
        cpf_parcial,
        nome_curso,
        carga_horaria,
        data_emissao,
        codigo_verificacao,
        hash
      });
      
      console.log(`[CertificateController] Certificado criado no banco: ID ${certificateId}`);
      
      // Gerar PDF com QRCode EMBEDDED
      let pdfUrl = null;
      
      try {
        pdfUrl = await CertificateService.generatePDF({
          nome_participante,
          cpf_parcial,
          nome_curso,
          carga_horaria,
          data_emissao,
          codigo_verificacao,
          hash
        });
        
        // Atualizar URL do PDF
        await Certificate.updateFilePath(certificateId, pdfUrl);
        
        console.log(`[CertificateController] PDF atualizado: ${pdfUrl}`);
      } catch (pdfError) {
        console.error('[CertificateController] Erro ao gerar PDF:', pdfError.message);
        // Continua mesmo sem PDF - o certificado foi criado no banco
      }
      
      // Registrar auditoria
      await AuditLog.create({
        usuario_id,
        acao: 'CREATE_CERTIFICATE',
        detalhe: `Certificado criado para ${nome_participante} - Curso: ${nome_curso}`,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      console.log(`[CertificateController] ✅ Certificado criado: ID ${certificateId}`);
      
      res.status(201).json({
        success: true,
        data: {
          id: certificateId,
          codigo_verificacao,
          hash,
          pdf_url: pdfUrl
        }
      });
      
    } catch (error) {
      console.error('[CertificateController.createCertificate] Erro:', error.message);
      res.status(500).json({
        success: false,
        error: 'Erro ao criar certificado: ' + error.message
      });
    }
  }
  
  // ===========================================
  // VERIFICAR CERTIFICADO (PÚBLICO - COM TIMESTAMP)
  // ===========================================
  static async verifyCertificate(req, res) {
    console.log('--- [CertificateController.verifyCertificate] Iniciando verificação ---');
    
    try {
      const { codigo } = req.params;
      
      console.log(`[CertificateController] Verificando código: ${codigo}`);
      
      // Buscar certificado pelo código
      const certificate = await Certificate.findByVerificationCode(codigo);
      
      if (!certificate) {
        console.warn(`[CertificateController] Certificado não encontrado: ${codigo}`);
        return res.status(404).json({
          success: false,
          error: 'Certificado não encontrado ou código inválido'
        });
      }
      
      // Incrementar contador de verificações
      await Certificate.incrementVerification(certificate.id);
      
      // Registrar histórico de verificação
      await Certificate.addVerificationHistory({
        certificate_id: certificate.id,
        codigo_verificacao: codigo,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      // Registrar auditoria
      await AuditLog.create({
        usuario_id: null,
        acao: 'VERIFY_CERTIFICATE',
        detalhe: `Certificado verificado: ${codigo} - Participante: ${certificate.nome_participante}`,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      console.log(`[CertificateController] ✅ Certificado verificado: ${codigo}`);
      
      // Resposta com timestamp da verificação
      res.json({
        success: true,
        data: {
          // Dados do participante (LGPD - CPF mascarado)
          participante: {
            nome: certificate.nome_participante.toUpperCase(),
            cpf: certificate.cpf_parcial
          },
          // Dados do curso
          curso: {
            nome: certificate.nome_curso,
            carga_horaria: certificate.carga_horaria,
            data_emissao: certificate.data_emissao
          },
          // Verificação
          verificacao: {
            codigo: certificate.codigo_verificacao,
            hash: certificate.hash,
            total_verificacoes: certificate.verificacoes_count + 1,
            hora_verificacao: new Date().toISOString()
          },
          // PDF
          pdf_url: certificate.pdf_path
        }
      });
      
    } catch (error) {
      console.error('[CertificateController.verifyCertificate] Erro:', error.message);
      res.status(500).json({
        success: false,
        error: 'Erro ao verificar certificado'
      });
    }
  }
  
  // ===========================================
  // LISTAR CERTIFICADOS DO USUÁRIO (AUTENTICADO)
  // ===========================================
  static async getUserCertificates(req, res) {
    console.log('--- [CertificateController.getUserCertificates] Listando certificados ---');
    
    try {
      const usuario_id = req.user.id;
      
      const certificates = await Certificate.findByUserId(usuario_id);
      
      res.json({
        success: true,
        data: certificates
      });
    } catch (error) {
      console.error('[CertificateController.getUserCertificates] Erro:', error.message);
      res.status(500).json({
        success: false,
        error: 'Erro ao listar certificados'
      });
    }
  }
  
  // ===========================================
  // BUSCAR CERTIFICADO POR ID (AUTENTICADO)
  // ===========================================
  static async getCertificateById(req, res) {
    console.log('--- [CertificateController.getCertificateById] Buscando certificado ---');
    
    try {
      const { id } = req.params;
      const usuario_id = req.user.id;
      
      const certificate = await Certificate.findById(id, usuario_id);
      
      if (!certificate) {
        return res.status(404).json({
          success: false,
          error: 'Certificado não encontrado'
        });
      }
      
      res.json({
        success: true,
        data: certificate
      });
    } catch (error) {
      console.error('[CertificateController.getCertificateById] Erro:', error.message);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar certificado'
      });
    }
  }
}

module.exports = CertificateController;