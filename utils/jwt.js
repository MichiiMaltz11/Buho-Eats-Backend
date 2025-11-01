/**
 * Utilidades para Manejo de JWT
 * Creación, verificación y decodificación de tokens JWT
 */

const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Genera un JWT para un usuario
 * @param {Object} payload - Datos del usuario (id, email, role)
 * @returns {string} Token JWT
 */
function generateToken(payload) {
    try {
        const token = jwt.sign(
            {
                id: payload.id,
                email: payload.email,
                role: payload.role
            },
            config.jwt.secret,
            {
                expiresIn: config.jwt.expiration,
                issuer: 'buho-eats-api'
            }
        );

        return token;
    } catch (error) {
        console.error('Error al generar token:', error.message);
        throw new Error('Error al generar token de autenticación');
    }
}

/**
 * Verifica y decodifica un JWT
 * @param {string} token - Token JWT a verificar
 * @returns {Object} Payload decodificado
 */
function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, config.jwt.secret, {
            issuer: 'buho-eats-api'
        });

        return decoded;
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new Error('Token expirado');
        } else if (error.name === 'JsonWebTokenError') {
            throw new Error('Token inválido');
        } else {
            throw new Error('Error al verificar token');
        }
    }
}

/**
 * Decodifica un JWT sin verificar (útil para debugging)
 * @param {string} token - Token JWT
 * @returns {Object} Payload decodificado
 */
function decodeToken(token) {
    try {
        return jwt.decode(token);
    } catch (error) {
        return null;
    }
}

/**
 * Extrae el token del header Authorization
 * @param {string} authHeader - Header Authorization
 * @returns {string|null} Token o null
 */
function extractTokenFromHeader(authHeader) {
    if (!authHeader) {
        return null;
    }

    // Formato: "Bearer TOKEN"
    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return null;
    }

    return parts[1];
}

/**
 * Verifica si un token está cerca de expirar (últimos 5 minutos)
 * @param {Object} decoded - Token decodificado
 * @returns {boolean} True si está cerca de expirar
 */
function isTokenExpiringSoon(decoded) {
    if (!decoded.exp) {
        return false;
    }

    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - now;
    
    // Si quedan menos de 5 minutos (300 segundos)
    return timeUntilExpiry < 300 && timeUntilExpiry > 0;
}

module.exports = {
    generateToken,
    verifyToken,
    decodeToken,
    extractTokenFromHeader,
    isTokenExpiringSoon
};
