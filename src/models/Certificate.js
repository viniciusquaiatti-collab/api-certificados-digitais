const db = require('../database/db');

class Certificate {
  /**
   * Cria um novo certificado no banco de dados.
   * @param {object} certificateData - Dados do certificado.
   * @returns {Promise<number>} O ID do certificado recém-criado.
   */
  static async create(certificateData) {
    console.log('--- [Certificate.create] Iniciando criação do certificado ---');
    console.log('Dados recebidos:', certificateData);

    // Desestrutura os dados, garantindo que campos undefined se tornem null
    const {
      usuario_id,
      nome_participante,
      nome_curso,
      carga_horaria,
      data_emissao,
      codigo_verificacao,
      arquivo_path = null // Define um valor padrão null se não for fornecido
    } = certificateData;

    const [result] = await db.execute(
      `INSERT INTO certificados 
        (usuario_id, nome_participante, nome_curso, carga_horaria, data_emissao, codigo_verificacao, arquivo_path) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        usuario_id,
        nome_participante,
        nome_curso,
        carga_horaria,
        data_emissao,
        codigo_verificacao,
        arquivo_path // Usa null se arquivo_path for undefined
      ]
    );

    console.log(`✅ [Certificate.create] Certificado inserido com ID: ${result.insertId}`);
    return result.insertId;
  }

  /**
   * Encontra um certificado pelo código de verificação.
   * @param {string} code - O código de verificação.
   * @returns {Promise<object|null>} O objeto do certificado ou null se não encontrado.
   */
  static async findByVerificationCode(code) {
    console.log(`--- [Certificate.findByVerificationCode] Buscando certificado com código: ${code} ---`);
    const [rows] = await db.execute('SELECT * FROM certificados WHERE codigo_verificacao = ?', [code]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Atualiza o caminho do arquivo de um certificado.
   * @param {number} certificateId - O ID do certificado.
   * @param {string} filePath - O novo caminho do arquivo.
   */
  static async updateFilePath(certificateId, filePath) {
    console.log(`--- [Certificate.updateFilePath] Atualizando caminho do arquivo para o certificado ID: ${certificateId} ---`);
    await db.execute('UPDATE certificados SET arquivo_path = ? WHERE id = ?', [filePath, certificateId]);
  }

  /**
   * Atualiza o certificado após uma verificação (anti-fraude).
   * @param {number} certificateId - O ID do certificado.
   * @param {string} newCode - O novo código de verificação.
   * @param {string} ip - O IP da verificação.
   * @param {string} userAgent - O User-Agent da verificação.
   */
  static async updateAfterVerification(certificateId, newCode, ip, userAgent) {
    console.log(`--- [Certificate.updateAfterVerification] Atualizando certificado ID: ${certificateId} ---`);
    await db.execute(
      `UPDATE certificados 
       SET codigo_verificacao = ?, 
           verificacoes_count = verificacoes_count + 1, 
           ultima_verificacao = NOW(),
           primeiro_ip_verificacao = IF(primeiro_ip_verificacao IS NULL, ?, primeiro_ip_verificacao),
           primeiro_dispositivo = IF(primeiro_dispositivo IS NULL, ?, primeiro_dispositivo)
       WHERE id = ?`,
      [newCode, ip, userAgent, certificateId]
    );
  }

  /**
   * Adiciona um registro ao histórico de verificações.
   * @param {number} certificateId - O ID do certificado.
   * @param {string} oldCode - O código antigo.
   * @param {string} newCode - O novo código.
   * @param {string} ip - O IP da verificação.
   * @param {string} userAgent - O User-Agent.
   */
  static async addVerificationHistory(certificateId, oldCode, newCode, ip, userAgent) {
    console.log(`--- [Certificate.addVerificationHistory] Adicionando ao histórico do certificado ID: ${certificateId} ---`);
    await db.execute(
      'INSERT INTO historico_verificacoes (certificado_id, codigo_verificacao, novo_codigo_verificacao, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
      [certificateId, oldCode, newCode, ip, userAgent]
    );
  }
}

module.exports = Certificate;