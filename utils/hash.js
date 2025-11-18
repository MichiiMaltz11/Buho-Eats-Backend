/**
 * Utilidades para Hash de Contraseñas
 * Manejo de bcrypt para hash y verificación de contraseñas
 */

const bcrypt = require('bcrypt');
const config = require('../config/env');

/**
 * Genera un hash de una contraseña
 * @param {string} password - Contraseña en texto plano
 * @returns {Promise<string>} Hash de la contraseña
 */
async function hashPassword(password) {
    try {
        const salt = await bcrypt.genSalt(config.security.bcryptRounds);
        const hash = await bcrypt.hash(password, salt);
        return hash;
    } catch (error) {
        console.error('Error al hashear contraseña:', error.message);
        throw new Error('Error al procesar contraseña');
    }
}

/**
 * Verifica una contraseña contra su hash
 * @param {string} password - Contraseña en texto plano
 * @param {string} hash - Hash almacenado
 * @returns {Promise<boolean>} True si coinciden
 */
async function verifyPassword(password, hash) {
    try {
        const match = await bcrypt.compare(password, hash);
        return match;
    } catch (error) {
        console.error('Error al verificar contraseña:', error.message);
        return false;
    }
}

/**
 * Genera un hash rápido para tokens
 * @param {string} str - String a hashear
 * @returns {string} Hash SHA256
 */
function quickHash(str) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(str).digest('hex');
}

module.exports = {
    hashPassword,
    verifyPassword,
    quickHash
};
