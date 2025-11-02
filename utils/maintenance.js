/**
 * Tareas de Mantenimiento del Sistema
 * Ejecuta tareas periódicas de limpieza y optimización
 */

const { cleanExpiredTokens, getBlacklistStats } = require('./tokenBlacklist');
const { cleanOldAttempts } = require('../middleware/rateLimit');
const logger = require('./logger');

/**
 * Limpia tokens expirados de la blacklist
 */
function cleanBlacklist() {
    try {
        logger.info('Ejecutando limpieza de blacklist...');
        const deleted = cleanExpiredTokens();
        
        if (deleted > 0) {
            logger.info(`Limpieza completada: ${deleted} tokens eliminados`);
        }

        // Mostrar estadísticas
        const stats = getBlacklistStats();
        if (stats) {
            logger.debug('Estadísticas de blacklist', stats);
        }

    } catch (error) {
        logger.error('Error en limpieza de blacklist', { error: error.message });
    }
}

/**
 * Limpia intentos de login antiguos
 */
function cleanLoginAttempts() {
    try {
        logger.info('Ejecutando limpieza de intentos de login antiguos...');
        cleanOldAttempts();
    } catch (error) {
        logger.error('Error en limpieza de intentos de login', { error: error.message });
    }
}

/**
 * Ejecuta todas las tareas de mantenimiento
 */
function runMaintenance() {
    logger.info('=== Iniciando tareas de mantenimiento ===');
    
    cleanBlacklist();
    cleanLoginAttempts();
    
    logger.info('=== Tareas de mantenimiento completadas ===');
}

/**
 * Programa tareas de mantenimiento periódicas
 * @param {number} intervalHours - Intervalo en horas
 */
function scheduleMaintenance(intervalHours = 1) {
    const intervalMs = intervalHours * 60 * 60 * 1000;

    // Ejecutar inmediatamente al inicio
    runMaintenance();

    // Programar ejecuciones periódicas
    setInterval(() => {
        runMaintenance();
    }, intervalMs);

    logger.info(`Tareas de mantenimiento programadas cada ${intervalHours} hora(s)`);
}

module.exports = {
    cleanBlacklist,
    cleanLoginAttempts,
    runMaintenance,
    scheduleMaintenance
};
