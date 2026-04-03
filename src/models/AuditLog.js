const db = require('../database/db');

class AuditLog {
    /**
     * Registra uma ação de usuário na tabela de auditoria.
     * @param {object} logData - Dados da log
     * @param {number} logData.usuario_id - ID do usuário.
     * @param {string} logData.acao - Ação executa (ex: 'CREATE_CERTIFICATE'),
     * @param { string} [logData.detalhe] - Detalhes adicionais sobre a ação.
     * @param {string} [logData.ip_address] - IP do usuário.
     * @param {string} [logData.user_agent] - User Agent do navegador.
     */

static async log({usuario_id, acao, detalhe, ip_address, user_agent }) {
    console.log(`--- [AuditLog] Iniciando registro de ação ---`);
    console.log(`Usuário ID: ${usuario_id}, Ação: ${acao}`);

    // Validações básicas para evitar logs vazias
    if (!usuario_id || !acao) {
        console.error( [AuditLog] `Erro: usuario_id ou acao nao fornecidos. Abortando log`);
        return; // Não quebra o fluxo, mas nao registra nada.
    }
    try {
        const [ result] = await db.execute(
            'INSERT INTO auditoria_acoes (usuario_id, acao,detalhe, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
            [usuario_id, acao, detalhe, ip_address, user_agent]
        );
        console.log(`[Auditlog] Ação registrada com sucesso. Id do log: ${result.insertId}`);

    } catch (error) {
        // Em um sistema de produção, isso poderia ir para um serviço como Sentry(PLATAFORMA DE APLICACOES E RASTREAMENTO DE ERROS EM TEMPO REAL, SERVE COMO UMA REDE DE SEGURANÇA)
        console.error('[Auditlog] Erro ao registrar ação na auditoria:', error.message);
        console.error('[Auditlog] Detalhes de erro:',error);
        //Não lançar o erro para nao quebrar o fluxo principal , mas logar é crucial.
    }   
}
/**
   * Busca os logs de auditoria para um usuário específico.
   * @param {number} usuario_id - ID do usuário.
   * @param {number} limit - Limite de registros a retornar.
   * @returns {Promise<Array>} - Array de logs.
   */

static async getAuditLogsByUserId(usuario_id, limit = 50) {
    console.log(`--- [Auditlog] Buscando logs para o usuário ID: ${usuario_id} ---`);
    try {
        const [rows] = await db.execute(
            'SELECT * FROM auditoria_acoes WHERE usuario_id = ? ORDER BY data_acao DESC LIMIT ?',
            [usuario_id, limit]
        );
        console.log(`[Auditlog] Encontrados ${rows.length} logs para o usuário.`);
        return rows;
    } catch (error) {
        console.log(`[Auditlog] Erro ao buscar logs para o usuário ${usuario_id}:`, error.message);
        throw error; // Aqui, lancei o erro para o controller tratar.
    }
}
}

module.exports = AuditLog;