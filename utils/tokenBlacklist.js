/**
 * Utilidades para Blacklist de Tokens
 * Permite invalidar tokens JWT antes de su expiración natural
 */

const crypto = require('crypto');
const { query } = require('../config/database');
const { decodeToken } = require('./jwt');
const logger = require('./logger');

/**
 * Genera un hash del token para almacenarlo de forma segura
 * @param {string} token - Token JWT
 * @returns {string} Hash SHA256 del token
 */
function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Agrega un token a la blacklist
 * @param {string} token - Token JWT a invalidar
 * @param {number} userId - ID del usuario
 * @param {string} reason - Razón de invalidación
 * @returns {boolean} True si se agregó correctamente
 */
function addToBlacklist(token, userId = null, reason = 'logout') {
    try {
        const tokenHash = hashToken(token);
        
        // Decodificar token para obtener fecha de expiración
        const decoded = decodeToken(token);
        
        if (!decoded || !decoded.exp) {
            logger.warn('Intento de agregar token inválido a blacklist', { userId });
            return false;
        }

        // Convertir timestamp de expiración a formato ISO
        const expiresAt = new Date(decoded.exp * 1000).toISOString();

        // Verificar si ya existe en blacklist
        const existing = query(
            'SELECT id FROM token_blacklist WHERE token_hash = ?',
            [tokenHash]
        );

        if (existing.length > 0) {
            logger.debug('Token ya estaba en blacklist', { userId, reason });
            return true;
        }

        // Insertar en blacklist
        query(`
            INSERT INTO token_blacklist (token_hash, user_id, reason, expires_at)
            VALUES (?, ?, ?, ?)
        `, [tokenHash, userId, reason, expiresAt]);

        logger.info('Token agregado a blacklist', { 
            userId, 
            reason,
            expiresAt 
        });

        return true;

    } catch (error) {
        logger.error('Error al agregar token a blacklist', { 
            error: error.message, 
            userId 
        });
        return false;
    }
}

/**
 * Verifica si un token está en la blacklist
 * @param {string} token - Token JWT a verificar
 * @returns {boolean} True si está blacklisted
 */
function isBlacklisted(token) {
    try {
        const tokenHash = hashToken(token);

        const result = query(`
            SELECT id FROM token_blacklist 
            WHERE token_hash = ? 
            AND expires_at > datetime('now')
        `, [tokenHash]);

        return result.length > 0;

    } catch (error) {
        logger.error('Error al verificar blacklist', { error: error.message });
        // En caso de error, no bloquear el token (fail open)
        // En un ambiente de alta seguridad, podrías preferir fail closed (return true)
        return false;
    }
}

/**
 * Invalida todos los tokens de un usuario
 * @param {number} userId - ID del usuario
 * @param {string} reason - Razón de invalidación
 * @returns {number} Cantidad de tokens invalidados
 */
function invalidateAllUserTokens(userId, reason = 'security') {
    try {
        // Obtener todos los tokens activos del usuario desde sessions
        const sessions = query(`
            SELECT token_hash, expires_at 
            FROM sessions 
            WHERE user_id = ? 
            AND is_active = 1
            AND expires_at > datetime('now')
        `, [userId]);

        if (sessions.length === 0) {
            logger.info('No hay tokens activos para invalidar', { userId });
            return 0;
        }

        // Agregar cada token a la blacklist
        let count = 0;
        sessions.forEach(session => {
            try {
                query(`
                    INSERT OR IGNORE INTO token_blacklist (token_hash, user_id, reason, expires_at)
                    VALUES (?, ?, ?, ?)
                `, [session.token_hash, userId, reason, session.expires_at]);
                count++;
            } catch (error) {
                logger.error('Error al invalidar token individual', { 
                    error: error.message, 
                    userId 
                });
            }
        });

        // Marcar sesiones como inactivas
        query(`
            UPDATE sessions 
            SET is_active = 0 
            WHERE user_id = ? AND is_active = 1
        `, [userId]);

        logger.info('Tokens de usuario invalidados', { 
            userId, 
            count, 
            reason 
        });

        return count;

    } catch (error) {
        logger.error('Error al invalidar tokens de usuario', { 
            error: error.message, 
            userId 
        });
        return 0;
    }
}

/**
 * Limpia tokens expirados de la blacklist
 * Se recomienda ejecutar periódicamente (ej: cron job)
 * @returns {number} Cantidad de tokens eliminados
 */
function cleanExpiredTokens() {
    try {
        const result = query(`
            DELETE FROM token_blacklist 
            WHERE expires_at < datetime('now')
        `);

        const deletedCount = result.changes || 0;

        if (deletedCount > 0) {
            logger.info('Tokens expirados eliminados de blacklist', { 
                count: deletedCount 
            });
        }

        return deletedCount;

    } catch (error) {
        logger.error('Error al limpiar tokens expirados', { 
            error: error.message 
        });
        return 0;
    }
}

/**
 * Obtiene estadísticas de la blacklist
 * @returns {Object} Estadísticas de la blacklist
 */
function getBlacklistStats() {
    try {
        const total = query('SELECT COUNT(*) as count FROM token_blacklist');
        const active = query(`
            SELECT COUNT(*) as count FROM token_blacklist 
            WHERE expires_at > datetime('now')
        `);
        const byReason = query(`
            SELECT reason, COUNT(*) as count 
            FROM token_blacklist 
            WHERE expires_at > datetime('now')
            GROUP BY reason
        `);

        return {
            total: total[0]?.count || 0,
            active: active[0]?.count || 0,
            byReason: byReason.reduce((acc, row) => {
                acc[row.reason] = row.count;
                return acc;
            }, {})
        };

    } catch (error) {
        logger.error('Error al obtener estadísticas de blacklist', { 
            error: error.message 
        });
        return null;
    }
}

module.exports = {
    addToBlacklist,
    isBlacklisted,
    invalidateAllUserTokens,
    cleanExpiredTokens,
    getBlacklistStats,
    hashToken
};
