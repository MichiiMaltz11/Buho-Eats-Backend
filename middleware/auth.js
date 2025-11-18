/**
 * Middleware de Autenticación
 * Verifica JWT y protege rutas
 */

const { verifyToken, extractTokenFromHeader } = require('../utils/jwt');
const { isBlacklisted } = require('../utils/tokenBlacklist');
const logger = require('../utils/logger');

/**
 * Middleware para verificar JWT
 */
async function authenticateToken(req, res) {
    try {
        const authHeader = req.headers.authorization;
        const token = extractTokenFromHeader(authHeader);

        if (!token) {
            return {
                authenticated: false,
                statusCode: 401,
                error: 'Token de autenticación requerido'
            };
        }

        // Verificar si el token está en la blacklist
        if (isBlacklisted(token)) {
            logger.warn('Token blacklisted intentó ser usado', {
                ip: req.headers['x-forwarded-for'] || req.connection?.remoteAddress
            });
            
            return {
                authenticated: false,
                statusCode: 401,
                error: 'Token inválido o revocado'
            };
        }

        // Verificar token
        const decoded = verifyToken(token);

        // Añadir usuario al request para uso posterior
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role
        };

        logger.debug('Token verificado correctamente', { 
            userId: decoded.id, 
            role: decoded.role 
        });

        return {
            authenticated: true,
            user: req.user
        };

    } catch (error) {
        logger.warn('Token inválido o expirado', { 
            error: error.message,
            ip: req.headers['x-forwarded-for'] || req.connection?.remoteAddress
        });

        return {
            authenticated: false,
            statusCode: 401,
            error: error.message
        };
    }
}

/**
 * Middleware para verificar roles específicos
 */
function requireRole(...allowedRoles) {
    return async (req, res) => {
        // Primero verificar autenticación
        const authResult = await authenticateToken(req, res);
        
        if (!authResult.authenticated) {
            return authResult;
        }

        // Verificar rol
        if (!allowedRoles.includes(req.user.role)) {
            logger.warn('Acceso denegado por rol insuficiente', {
                userId: req.user.id,
                userRole: req.user.role,
                requiredRoles: allowedRoles
            });

            return {
                authenticated: false,
                statusCode: 403,
                error: 'No tienes permisos para acceder a este recurso'
            };
        }

        return {
            authenticated: true,
            user: req.user
        };
    };
}

/**
 * Middleware opcional de autenticación (no falla si no hay token)
 */
async function optionalAuth(req, res) {
    try {
        const authHeader = req.headers.authorization;
        const token = extractTokenFromHeader(authHeader);

        if (!token) {
            return { authenticated: false };
        }

        const decoded = verifyToken(token);
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role
        };

        return {
            authenticated: true,
            user: req.user
        };

    } catch (error) {
        // No fallar, simplemente no autenticar
        return { authenticated: false };
    }
}

module.exports = {
    authenticateToken,
    requireRole,
    optionalAuth
};
