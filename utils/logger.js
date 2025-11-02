/**
 * Sistema de Logging
 * Registra eventos, errores y actividad del servidor
 * Con rotación automática de logs por tamaño y fecha
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

// Configuración de rotación de logs
const LOG_ROTATION = {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB
    MAX_FILES: 5, // Mantener máximo 5 archivos archivados
    ROTATE_INTERVAL: 24 * 60 * 60 * 1000 // Rotar cada 24 horas
};

let lastRotationCheck = Date.now();

/**
 * Obtiene el tamaño de un archivo
 */
function getFileSize(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return stats.size;
    } catch (error) {
        return 0;
    }
}

/**
 * Rota el archivo de log
 * Renombra el log actual con timestamp y crea uno nuevo
 */
function rotateLogFile(logFile) {
    try {
        // Verificar si el archivo existe
        if (!fs.existsSync(logFile)) {
            return;
        }

        const logDir = path.dirname(logFile);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const rotatedFile = path.join(logDir, `server-${timestamp}.log`);

        // Renombrar archivo actual
        fs.renameSync(logFile, rotatedFile);

        // Comprimir archivo rotado (opcional, requiere zlib)
        try {
            const zlib = require('zlib');
            const gzip = zlib.createGzip();
            const source = fs.createReadStream(rotatedFile);
            const destination = fs.createWriteStream(`${rotatedFile}.gz`);

            source.pipe(gzip).pipe(destination);

            // Eliminar archivo sin comprimir después de comprimir
            destination.on('finish', () => {
                fs.unlinkSync(rotatedFile);
            });
        } catch (error) {
            // Si falla la compresión, continuar sin comprimir
            console.warn('No se pudo comprimir el log rotado:', error.message);
        }

        // Limpiar archivos antiguos
        cleanOldLogFiles(logDir);

        console.log(`Log rotado: ${rotatedFile}`);

    } catch (error) {
        console.error('Error al rotar log:', error.message);
    }
}

/**
 * Limpia archivos de log antiguos
 * Mantiene solo los N archivos más recientes
 */
function cleanOldLogFiles(logDir) {
    try {
        const files = fs.readdirSync(logDir)
            .filter(file => file.startsWith('server-') && (file.endsWith('.log') || file.endsWith('.log.gz')))
            .map(file => ({
                name: file,
                path: path.join(logDir, file),
                time: fs.statSync(path.join(logDir, file)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time); // Ordenar por más reciente primero

        // Eliminar archivos que excedan el límite
        if (files.length > LOG_ROTATION.MAX_FILES) {
            const filesToDelete = files.slice(LOG_ROTATION.MAX_FILES);
            filesToDelete.forEach(file => {
                try {
                    fs.unlinkSync(file.path);
                    console.log(`Log antiguo eliminado: ${file.name}`);
                } catch (error) {
                    console.error(`Error al eliminar ${file.name}:`, error.message);
                }
            });
        }

    } catch (error) {
        console.error('Error al limpiar logs antiguos:', error.message);
    }
}

/**
 * Verifica si es necesario rotar el log
 */
function checkLogRotation(logFile) {
    try {
        const now = Date.now();

        // Verificar si ha pasado el intervalo de rotación
        if (now - lastRotationCheck < LOG_ROTATION.ROTATE_INTERVAL) {
            return;
        }

        lastRotationCheck = now;

        // Verificar tamaño del archivo
        const fileSize = getFileSize(logFile);

        if (fileSize >= LOG_ROTATION.MAX_FILE_SIZE) {
            rotateLogFile(logFile);
        }

    } catch (error) {
        console.error('Error al verificar rotación de log:', error.message);
    }
}

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

        // Verificar rotación de logs antes de escribir
        checkLogRotation(logFile);

        fs.appendFileSync(logFile, message, 'utf8');
    } catch (error) {
        console.error('Error al escribir log:', error.message);
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
