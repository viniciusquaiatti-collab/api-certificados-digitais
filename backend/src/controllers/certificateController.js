// src/controllers/certificateController.js
const Certificate = require('../models/Certificate');
const CertificateService = require('../services/certificateService');
const AuditLog = require('../models/AuditLog');
const crypto = require('crypto');

console.log('🔥 [CertificateController] CARREGADO 🔥');

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
      
      if (!process.env.CLOUDINARY_URL) {
        console.error('[CertificateController] CLOUDINARY_URL não configurado');
        return res.status(500).json({
          success: false,
          error: 'CLOUDINARY_URL não configurado no .env. Configure sua conta Cloudinary.'
        });
      }
      
      // Código único
      const codigo_verificacao = crypto.randomBytes(8).toString('hex').toUpperCase();
      
      //  HASH PROFISSIONAL (AJUSTE 2)
      const hash = crypto
        .createHash('sha256')
        .update(
          `${nome_participante}|${cpf}|${nome_curso}|${carga_horaria}|${data_emissao}|${codigo_verificacao}`
        )
        .digest('hex');
      
      //  CPF MASCARADO CORRETO (AJUSTE 1)
      const digits = cpf.replace(/\D/g, "");
      const cpf_parcial = `***.***.***-${digits.slice(-2)}`;
      
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
        
        await Certificate.updateFilePath(certificateId, pdfUrl);
        
        console.log(`[CertificateController] PDF atualizado: ${pdfUrl}`);
      } catch (pdfError) {
        console.error('[CertificateController] Erro ao gerar PDF:', pdfError.message);
      }
      
      await AuditLog.create({
        usuario_id,
        acao: 'CREATE_CERTIFICATE',
        detalhe: `Certificado criado para ${nome_participante} - Curso: ${nome_curso}`,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      console.log(`[CertificateController]  Certificado criado: ID ${certificateId}`);
      
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
  // VERIFICAR CERTIFICADO (PÚBLICO)
  // ===========================================
  static async verifyCertificate(req, res) {
    console.log('--- [CertificateController.verifyCertificate] Iniciando verificação ---');
    
    try {
      const { codigo } = req.params;
      
      console.log(`[CertificateController] Verificando código: ${codigo}`);
      
      const certificate = await Certificate.findByVerificationCode(codigo);
      
      if (!certificate) {
        console.warn(`[CertificateController] Certificado não encontrado: ${codigo}`);
        return res.status(404).json({
          success: false,
          error: 'Certificado não encontrado ou código inválido'
        });
      }
      
      await Certificate.incrementVerification(certificate.id);
      
      await Certificate.addVerificationHistory({
        certificate_id: certificate.id,
        codigo_verificacao: codigo,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      await AuditLog.create({
        usuario_id: null,
        acao: 'VERIFY_CERTIFICATE',
        detalhe: `Certificado verificado: ${codigo} - Participante: ${certificate.nome_participante}`,
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
      
      console.log(`[CertificateController]  Certificado verificado: ${codigo}`);
      
      res.json({
        success: true,
        data: {
          participante: {
            nome: certificate.nome_participante.toUpperCase(),
            cpf: certificate.cpf_parcial
          },
          curso: {
            nome: certificate.nome_curso,
            carga_horaria: certificate.carga_horaria,
            data_emissao: certificate.data_emissao
          },
          verificacao: {
            codigo: certificate.codigo_verificacao,
            hash: certificate.hash,
            
            //  AJUSTE 3 (HASH PREVIEW)
            hash_preview: certificate.hash.slice(0, 12).toUpperCase(),
            
            total_verificacoes: certificate.verificacoes_count + 1,
            hora_verificacao: new Date().toISOString()
          },
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
  
  static async getUserCertificates(req, res) {
    try {
      const usuario_id = req.user.id;
      const certificates = await Certificate.findByUserId(usuario_id);
      
      res.json({
        success: true,
        data: certificates
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Erro ao listar certificados'
      });
    }
  }
  
  static async getCertificateById(req, res) {
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
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar certificado'
      });
    }
  }
}

module.exports = CertificateController;