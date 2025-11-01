/**
 * Sistema de Logging
 * Registra eventos, errores y actividad del servidor
 */

const fs = require('fs');
const path = require('path');
const config = require('../config/env');

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

const CURRENT_LEVEL = LOG_LEVELS[config.logging.level.toUpperCase()] || LOG_LEVELS.INFO;

/**
 * Formatea un mensaje de log
 */
function formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    
    return `[${timestamp}] [${level}] ${message}${metaStr}\n`;
}

/**
 * Escribe en el archivo de log
 */
function writeToFile(message) {
    try {
        const logDir = path.join(__dirname, '..', 'logs');
        const logFile = path.join(logDir, 'server.log');

        // Crear directorio si no existe
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        fs.appendFileSync(logFile, message, 'utf8');
    } catch (error) {
        console.error('❌ Error al escribir log:', error.message);
    }
}

/**
 * Escribe en consola con color
 */
function writeToConsole(level, message) {
    const colors = {
        DEBUG: '\x1b[36m',  // Cyan
        INFO: '\x1b[32m',   // Verde
        WARN: '\x1b[33m',   // Amarillo
        ERROR: '\x1b[31m'   // Rojo
    };
    const reset = '\x1b[0m';

    const color = colors[level] || '';
    console.log(`${color}${message.trim()}${reset}`);
}

/**
 * Función principal de logging
 */
function log(level, message, meta = {}) {
    if (LOG_LEVELS[level] < CURRENT_LEVEL) {
        return; // No loguear si está por debajo del nivel actual
    }

    const formattedMessage = formatMessage(level, message, meta);
    
    writeToConsole(level, formattedMessage);
    writeToFile(formattedMessage);
}

/**
 * Métodos de conveniencia
 */
const logger = {
    debug: (message, meta) => log('DEBUG', message, meta),
    info: (message, meta) => log('INFO', message, meta),
    warn: (message, meta) => log('WARN', message, meta),
    error: (message, meta) => log('ERROR', message, meta),

    // Log de requests HTTP
    request: (req, statusCode, duration) => {
        const meta = {
            method: req.method,
            url: req.url,
            status: statusCode,
            duration: `${duration}ms`,
            ip: req.headers['x-forwarded-for'] || req.connection?.remoteAddress
        };

        const level = statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO';
        log(level, `${req.method} ${req.url} - ${statusCode}`, meta);
    },

    // Log de autenticación
    auth: (action, email, success, ip) => {
        const meta = {
            action,
            email,
            success,
            ip
        };

        const level = success ? 'INFO' : 'WARN';
        const message = success ? 
            `Autenticación exitosa: ${action}` : 
            `Intento fallido: ${action}`;

        log(level, message, meta);
    },

    // Log de errores con stack trace
    exception: (error, context = {}) => {
        const meta = {
            ...context,
            stack: error.stack
        };

        log('ERROR', error.message, meta);
    }
};

module.exports = logger;
