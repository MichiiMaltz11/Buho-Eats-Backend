/**
 * Middleware de Rate Limiting
 * Previene ataques de fuerza bruta limitando intentos de login
 */

const { query } = require('../config/database');
const config = require('../config/env');
const logger = require('../utils/logger');

/**
 * Obtiene la IP del cliente
 */
function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() || 
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress || 
           'unknown';
}

/**
 * Limpia intentos antiguos (older than LOCKOUT_DURATION)
 */
function cleanOldAttempts() {
    try {
        const cutoffTime = new Date(Date.now() - config.security.lockoutDuration);
        const cutoffISO = cutoffTime.toISOString();

        query(`
            DELETE FROM login_attempts 
            WHERE attempt_time < ?
        `, [cutoffISO]);

    } catch (error) {
        logger.error('Error al limpiar intentos antiguos', { error: error.message });
    }
}

/**
 * Verifica si una IP está bloqueada por rate limiting
 */
function checkRateLimit(req) {
    try {
        const ip = getClientIP(req);
        const cutoffTime = new Date(Date.now() - config.security.lockoutDuration);
        const cutoffISO = cutoffTime.toISOString();

        // Limpiar intentos viejos primero
        cleanOldAttempts();

        // Contar intentos fallidos recientes
        const result = query(`
            SELECT COUNT(*) as count 
            FROM login_attempts 
            WHERE ip_address = ? 
            AND success = 0 
            AND attempt_time > ?
        `, [ip, cutoffISO]);

        const failedAttempts = result[0]?.count || 0;

        if (failedAttempts >= config.security.maxLoginAttempts) {
            // Obtener tiempo del último intento
            const lastAttempt = query(`
                SELECT attempt_time 
                FROM login_attempts 
                WHERE ip_address = ? 
                ORDER BY attempt_time DESC 
                LIMIT 1
            `, [ip]);

            if (lastAttempt.length > 0) {
                const lastAttemptTime = new Date(lastAttempt[0].attempt_time);
                const lockoutEnd = new Date(lastAttemptTime.getTime() + config.security.lockoutDuration);
                const now = new Date();

                if (now < lockoutEnd) {
                    const minutesRemaining = Math.ceil((lockoutEnd - now) / 60000);

                    logger.warn('IP bloqueada por rate limiting', {
                        ip,
                        failedAttempts,
                        minutesRemaining
                    });

                    return {
                        allowed: false,
                        statusCode: 429,
                        error: 'Demasiados intentos fallidos',
                        minutesRemaining,
                        retryAfter: Math.ceil((lockoutEnd - now) / 1000) // segundos
                    };
                }
            }
        }

        return {
            allowed: true,
            remainingAttempts: config.security.maxLoginAttempts - failedAttempts
        };

    } catch (error) {
        logger.error('Error al verificar rate limiting', { error: error.message });
        // En caso de error, permitir el intento (fail open)
        return { allowed: true };
    }
}

/**
 * Registra un intento de login
 */
function recordLoginAttempt(req, email, success) {
    try {
        const ip = getClientIP(req);

        query(`
            INSERT INTO login_attempts (ip_address, email, success, attempt_time)
            VALUES (?, ?, ?, datetime('now'))
        `, [ip, email || null, success ? 1 : 0]);

        logger.auth(
            'Login attempt',
            email || 'unknown',
            success,
            ip
        );

        // Si fue exitoso, limpiar intentos fallidos de esa IP
        if (success) {
            query(`
                DELETE FROM login_attempts 
                WHERE ip_address = ? AND success = 0
            `, [ip]);
        }

    } catch (error) {
        logger.error('Error al registrar intento de login', { error: error.message });
    }
}

/**
 * Obtiene estadísticas de rate limiting para una IP
 */
function getRateLimitStats(req) {
    try {
        const ip = getClientIP(req);
        const cutoffTime = new Date(Date.now() - config.security.lockoutDuration);
        const cutoffISO = cutoffTime.toISOString();

        const stats = query(`
            SELECT 
                COUNT(*) as totalAttempts,
                SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failedAttempts,
                SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successfulAttempts,
                MAX(attempt_time) as lastAttempt
            FROM login_attempts 
            WHERE ip_address = ? 
            AND attempt_time > ?
        `, [ip, cutoffISO]);

        return stats[0] || {
            totalAttempts: 0,
            failedAttempts: 0,
            successfulAttempts: 0,
            lastAttempt: null
        };

    } catch (error) {
        logger.error('Error al obtener estadísticas de rate limiting', { error: error.message });
        return null;
    }
}

module.exports = {
    checkRateLimit,
    recordLoginAttempt,
    getRateLimitStats,
    getClientIP
};
