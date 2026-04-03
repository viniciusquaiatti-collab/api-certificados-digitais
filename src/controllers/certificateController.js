const Certificate = require('../models/Certificate');
const CertificateService = require('../services/certificateService');
const AuditLog = require('../models/AuditLog');

class CertificateController {
  /**
   * Cria um novo certificado para um usuário autenticado.
   * @param {object} req - Objeto de requisição Express.
   * @param {object} res - Objeto de resposta Express.
   */
  static async createCertificate(req, res) {
    console.log('--- [CertificateController.createCertificate] Iniciando criação de certificado ---');
    try {
      // O ID do usuário vem do middleware de autenticação
      const usuario_id = req.userId;
      const { nome_participante, nome_curso, carga_horaria, data_emissao } = req.body;

      console.log(`Dados recebidos: Usuário ID: ${usuario_id}, Participante: ${nome_participante}, Curso: ${nome_curso}`);

      // Validação básica
      if (!nome_participante || !nome_curso || !carga_horaria || !data_emissao) {
        console.warn(' [CertificateController.createCertificate] Dados incompletos para criação de certificado.');
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
      }

      // Gera um código de verificação único (COM AWAIT!)
      const codigo_verificacao = await CertificateService.generateVerificationCode(); // <-- CORRIGIDO AQUI

      // Cria o certificado no banco de dados
      const certificateId = await Certificate.create({
        usuario_id,
        nome_participante,
        nome_curso,
        carga_horaria,
        data_emissao,
        codigo_verificacao
      });

      console.log(` [CertificateController.createCertificate] Certificado criado com sucesso. ID: ${certificateId}`);

      // Gera o arquivo PDF do certificado
      const filePath = await CertificateService.generatePDF({
        nome_participante,
        nome_curso,
        carga_horaria,
        data_emissao,
        codigo_verificacao
      });

      // Atualiza o caminho do arquivo no banco de dados
      await Certificate.updateFilePath(certificateId, filePath);

      // Registra a ação de criação na auditoria
      await AuditLog.log({
        usuario_id,
        acao: 'CREATE_CERTIFICATE',
        detalhe: `Certificado ID: ${certificateId} gerado para ${nome_participante} no curso ${nome_curso}.`,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      res.status(201).json({
        message: 'Certificado criado com sucesso.',
        certificate: {
          id: certificateId,
          codigo_verificacao,
          arquivo_path: filePath
        }
      });
    } catch (error) {
      console.error('[CertificateController.createCertificate] Erro ao criar certificado:', error.message);
      console.error('[CertificateController.createCertificate] Stack trace:', error.stack);
      res.status(500).json({ error: 'Erro interno do servidor ao criar certificado.' });
    }
  }

  /**
   * Verifica a autenticidade de um certificado pelo código.
   * @param {object} req - Objeto de requisição Express.
   * @param {object} res - Objeto de resposta Express.
   */
  static async verifyCertificate(req, res) {
    console.log('--- [CertificateController.verifyCertificate] Iniciando verificação de certificado ---');
    try {
      const { code } = req.params;
      const ip_address = req.ip;
      const user_agent = req.headers['user-agent'];

      console.log(`Verificando certificado com código: ${code} a partir do IP: ${ip_address}`);

      const certificate = await Certificate.findByVerificationCode(code);

      if (!certificate) {
        console.warn(` [CertificateController.verifyCertificate] Certificado não encontrado para o código: ${code}`);
        return res.status(404).json({ error: 'Certificado não encontrado ou inválido.' });
      }

      // Gera um novo código para a próxima verificação (anti-fraude)
      const novo_codigo_verificacao = await CertificateService.generateVerificationCode(); // <-- CORRIGIDO AQUI

      // Atualiza o certificado com o novo código e dados da verificação
      await Certificate.updateAfterVerification(certificate.id, novo_codigo_verificacao, ip_address, user_agent);

      // Registra a verificação no histórico
      await Certificate.addVerificationHistory(certificate.id, code, novo_codigo_verificacao, ip_address, user_agent);

      console.log(` [CertificateController.verifyCertificate] Certificado verificado com sucesso. ID: ${certificate.id}`);

      res.json({
        message: 'Certificado autêntico.',
        certificate: {
          nome_participante: certificate.nome_participante,
          nome_curso: certificate.nome_curso,
          carga_horaria: certificate.carga_horaria,
          data_emissao: certificate.data_emissao,
          verificacoes_count: certificate.verificacoes_count + 1
        }
      });
    } catch (error) {
      console.error(' [CertificateController.verifyCertificate] Erro ao verificar certificado:', error.message);
      console.error('[CertificateController.verifyCertificate] Stack trace:', error.stack);
      res.status(500).json({ error: 'Erro interno do servidor ao verificar certificado.' });
    }
  }
}

module.exports = CertificateController;