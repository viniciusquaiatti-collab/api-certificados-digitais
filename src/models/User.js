const db = require('../database/db');
const bcrypt = require('bcrypt');

class User {
    static async create(userData) {
        const { nome, email, senha } = userData;
        const senha_hash = await bcrypt.hash(senha, 10);

        const [result] = await db.execute(
            'INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)',
            [nome, email, senha_hash]
        );
        return result.insertId;
    } 
    static async findByEmail(email) {
        const [rows] = await db.execute(
            'SELECT * FROM usuarios WHERE email = ?',
            [email]
        );
        return rows[0];
    }
    static async findById(id) {
        const [rows] = await db.execute(
            'SELECT id, nome, email FROM usuarios WHERE id = ?',
            [id]
        );
        return rows[0];
    }
}

module.exports = User;