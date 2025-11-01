/**
 * Middleware de Sanitización
 * Limpia inputs para prevenir inyecciones SQL y XSS
 */

const { sanitizeInput } = require('../utils/validator');
const logger = require('../utils/logger');

/**
 * Sanitiza un objeto recursivamente
 */
function sanitizeObject(obj) {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj === 'string') {
        return sanitizeInput(obj);
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }

    if (typeof obj === 'object') {
        const sanitized = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                sanitized[key] = sanitizeObject(obj[key]);
            }
        }
        return sanitized;
    }

    return obj;
}

/**
 * Middleware para sanitizar el body de las peticiones
 */
function sanitizeBody(body) {
    if (!body || typeof body !== 'object') {
        return body;
    }

    try {
        const sanitized = sanitizeObject(body);
        logger.debug('Body sanitizado correctamente');
        return sanitized;
    } catch (error) {
        logger.error('Error al sanitizar body', { error: error.message });
        return body; // Retornar original en caso de error
    }
}

/**
 * Sanitiza parámetros de query string
 */
function sanitizeQuery(query) {
    if (!query || typeof query !== 'object') {
        return {};
    }

    try {
        const sanitized = sanitizeObject(query);
        logger.debug('Query params sanitizados');
        return sanitized;
    } catch (error) {
        logger.error('Error al sanitizar query params', { error: error.message });
        return query;
    }
}

/**
 * Lista negra de patrones peligrosos (SQL injection básica)
 */
const dangerousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(--)/,
    /(')/,
    /(;)/,
    /(\bOR\b.*=.*)/i,
    /(\bAND\b.*=.*)/i,
    /(\/\*|\*\/)/
];

/**
 * Detecta intentos obvios de SQL injection
 */
function detectSQLInjection(str) {
    if (typeof str !== 'string') {
        return false;
    }

    for (const pattern of dangerousPatterns) {
        if (pattern.test(str)) {
            return true;
        }
    }

    return false;
}

/**
 * Valida que el input no contenga SQL injection
 */

function validateNoSQLInjection(data) {
    const suspicious = [];

    function checkValue(value, path = '') {
        if (typeof value === 'string' && detectSQLInjection(value)) {
            suspicious.push({ path, value });
        } else if (typeof value === 'object' && value !== null) {
            for (const key in value) {
                checkValue(value[key], path ? `${path}.${key}` : key);
            }
        }
    }

    checkValue(data);

    if (suspicious.length > 0) {
        logger.warn('Posible intento de SQL injection detectado', { suspicious });
        return {
            safe: false,
            suspicious
        };
    }

    return { safe: true };
}

module.exports = {
    sanitizeBody,
    sanitizeQuery,
    sanitizeObject,
    validateNoSQLInjection,
    detectSQLInjection
};
