const db = require('../database/db');
const AuditLog = require('../models/AuditLog');

class AdminController {
  /**
   * Obtém dados gerais para o dashboard do administrador.
   * @param {object} req - Objeto de requisição Express.
   * @param {object} res - Objeto de resposta Express.
   */
  static async getDashboardData(req, res) {
    console.log('--- [AdminController.getDashboardData] Iniciando busca de dados do dashboard ---');
    try {
      // Usamos Promise.all para executar as queries em paralelo, o que é mais performático
      const [totalUsers] = await db.execute('SELECT COUNT(*) as count FROM usuarios');
      const [totalCerts] = await db.execute('SELECT COUNT(*) as count FROM certificados');
      const [verificationsToday] = await db.execute(
        'SELECT COUNT(*) as count FROM historico_verificacoes WHERE DATE(data_verificacao) = CURDATE()'
      );
      
      const dashboardData = {
        totalUsers: totalUsers[0].count,
        totalCerts: totalCerts[0].count,
        verificationsToday: verificationsToday[0].count // Corrigido o nome da variável
      };

      console.log(' [AdminController.getDashboardData] Dados do dashboard obtidos com sucesso:', dashboardData);
      res.json(dashboardData);
    } catch (error) {
      console.error(' [AdminController.getDashboardData] Erro ao buscar dados do dashboard:', error.message);
      console.error('[AdminController.getDashboardData] Stack trace:', error.stack);
      res.status(500).json({ error: 'Erro interno do servidor ao buscar dados do dashboard.' });
    }
  }

  /**
   * Obtém todos os logs de auditoria, com paginação.
   * @param {object} req - Objeto de requisição Express.
   * @param {object} res - Objeto de resposta Express.
   */
  static async getAllAuditLogs(req, res) { // <-- CORRIGIDO O NOME DA FUNÇÃO
    console.log('--- [AdminController.getAllAuditLogs] Iniciando busca de todos os logs de auditoria ---');
    try {
      const limit = parseInt(req.query.limit) || 100;
      const page = parseInt(req.query.page) || 1;
      const offset = (page - 1) * limit;

      console.log(`[AdminController.getAllAuditLogs] Parâmetros - Limit: ${limit}, Page: ${page}, Offset: ${offset}`);

      // CORRIGIDO O NOME DA TABELA NA QUERY
      const [logs] = await db.execute(
        'SELECT * FROM auditoria_acoes ORDER BY data_acao DESC LIMIT ? OFFSET ?',
        [limit, offset]
      );
      
      // Busca o total de registros para calcular o total de páginas
      const [countResult] = await db.execute('SELECT COUNT(*) as total FROM auditoria_acoes');
      const totalRecords = countResult[0].total;
      const totalPages = Math.ceil(totalRecords / limit);

      console.log(`[AdminController.getAllAuditLogs] Encontrados ${logs.length} logs. Total de registros: ${totalRecords}`);
      
      res.json({
        logs,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords,
          limit
        }
      });
    } catch (error) {
      console.error(' [AdminController.getAllAuditLogs] Erro ao buscar logs de auditoria:', error.message);
      console.error('[AdminController.getAllAuditLogs] Stack trace:', error.stack);
      res.status(500).json({ error: 'Erro interno do servidor ao buscar logs de auditoria.' });
    }
  }

  /**
   * Obtém os logs de auditoria para um usuário específico.
   * @param {object} req - Objeto de requisição Express.
   * @param {object} res - Objeto de resposta Express.
   */
  static async getUserAuditLogs(req, res) { // <-- CORRIGIDO O NOME DA FUNÇÃO
    console.log('--- [AdminController.getUserAuditLogs] Iniciando busca de logs para um usuário específico ---');
    try {
      const { id } = req.params;
      if (!id || isNaN(id)) {
        console.warn(` [AdminController.getUserAuditLogs] ID de usuário inválido fornecido: ${id}`);
        return res.status(400).json({ error: 'ID de usuário inválido.' });
      }

      const limit = parseInt(req.query.limit) || 50;
      console.log(`[AdminController.getUserAuditLogs] Buscando logs para o usuário ID: ${id} com limite: ${limit}`);

      const logs = await AuditLog.getAuditLogsByUserId(id, limit);
      
      console.log(`✅ [AdminController.getUserAuditLogs] Logs encontrados e enviados como resposta.`);
      res.json(logs);
    } catch (error) {
      console.error(`[AdminController.getUserAuditLogs] Erro ao buscar logs do usuário ${req.params.id}:`, error.message);
      console.error(' [AdminController.getUserAuditLogs] Stack trace:', error.stack);
      res.status(500).json({ error: 'Erro interno do servidor ao buscar logs do usuário.' });
    }
  }
}

module.exports = AdminController;