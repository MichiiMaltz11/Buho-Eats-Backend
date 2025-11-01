/**
 * Middleware de CORS
 * Manejo de Cross-Origin Resource Sharing
 */

const config = require('../config/env');
const logger = require('../utils/logger');

/**
 * Verifica si un origin está permitido
 */
function isOriginAllowed(origin) {
    if (!origin) {
        return true; // Permitir requests sin origin (ej: Postman)
    }

    return config.cors.allowedOrigins.includes(origin) || 
           config.cors.allowedOrigins.includes('*');
}

/**
 * Aplica headers CORS a la respuesta
 */
function applyCorsHeaders(req, res) {
    const origin = req.headers.origin;

    if (isOriginAllowed(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400'); // 24 horas

        return { allowed: true };
    } else {
        logger.warn('CORS: Origin no permitido', { origin });
        return { 
            allowed: false,
            statusCode: 403,
            error: 'Origin no permitido'
        };
    }
}

/**
 * Maneja preflight requests (OPTIONS)
 */
function handlePreflight(req, res) {
    const corsResult = applyCorsHeaders(req, res);
    
    if (!corsResult.allowed) {
        return {
            handled: true,
            statusCode: 403,
            error: 'Origin no permitido'
        };
    }

    return {
        handled: true,
        statusCode: 204,
        headers: {
            'Content-Length': '0'
        }
    };
}

module.exports = {
    applyCorsHeaders,
    handlePreflight,
    isOriginAllowed
};
