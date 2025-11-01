/**
 * Controlador de Autenticación
 * Maneja registro, login y logout de usuarios
 */

const { query } = require('../config/database');
const { hashPassword, verifyPassword } = require('../utils/hash');
const { generateToken } = require('../utils/jwt');
const { validateRegistrationData, isValidEmail } = require('../utils/validator');
const { recordLoginAttempt, checkRateLimit } = require('../middleware/rateLimit');
const logger = require('../utils/logger');

/**
 * Registrar nuevo usuario
 * POST /api/auth/register
 */
async function register(req, body) {
    try {
        const { firstName, lastName, email, password } = body;

        // Validar datos
        const validation = validateRegistrationData({ firstName, lastName, email, password });
        
        if (!validation.isValid) {
            logger.warn('Registro fallido: datos inválidos', { email, errors: validation.errors });
            return {
                success: false,
                statusCode: 400,
                error: 'Datos inválidos',
                errors: validation.errors
            };
        }

        // Verificar si el email ya existe
        const existingUser = query(
            'SELECT id FROM users WHERE email = ?',
            [email.toLowerCase()]
        );

        if (existingUser.length > 0) {
            logger.warn('Registro fallido: email ya existe', { email });
            return {
                success: false,
                statusCode: 409,
                error: 'El email ya está registrado'
            };
        }

        // Hashear contraseña
        const passwordHash = await hashPassword(password);

        // Insertar usuario
        const result = query(`
            INSERT INTO users (first_name, last_name, email, password_hash, role)
            VALUES (?, ?, ?, ?, ?)
        `, [firstName, lastName, email.toLowerCase(), passwordHash, 'user']);

        const userId = result.lastInsertRowid;

        logger.info('Usuario registrado exitosamente', { 
            userId, 
            email: email.toLowerCase() 
        });

        // Generar token
        const token = generateToken({
            id: userId,
            email: email.toLowerCase(),
            role: 'user'
        });

        return {
            success: true,
            statusCode: 201,
            data: {
                message: 'Usuario registrado exitosamente',
                user: {
                    id: userId,
                    firstName,
                    lastName,
                    email: email.toLowerCase(),
                    role: 'user'
                },
                token
            }
        };

    } catch (error) {
        logger.exception(error, { action: 'register', email: body?.email });
        return {
            success: false,
            statusCode: 500,
            error: 'Error al registrar usuario'
        };
    }
}

/**
 * Login de usuario
 * POST /api/auth/login
 */
async function login(req, body) {
    try {
        const { email, password } = body;

        // Validar que existan email y password
        if (!email || !password) {
            return {
                success: false,
                statusCode: 400,
                error: 'Email y contraseña son requeridos'
            };
        }

        // Validar email
        if (!isValidEmail(email)) {
            return {
                success: false,
                statusCode: 400,
                error: 'Email inválido'
            };
        }

        // Verificar rate limiting
        const rateLimitResult = checkRateLimit(req);
        
        if (!rateLimitResult.allowed) {
            return {
                success: false,
                statusCode: rateLimitResult.statusCode,
                error: rateLimitResult.error,
                minutesRemaining: rateLimitResult.minutesRemaining,
                retryAfter: rateLimitResult.retryAfter
            };
        }

        // Buscar usuario
        const users = query(
            'SELECT id, first_name, last_name, email, password_hash, role, is_active FROM users WHERE email = ?',
            [email.toLowerCase()]
        );

        if (users.length === 0) {
            recordLoginAttempt(req, email, false);
            logger.warn('Login fallido: usuario no encontrado', { email });
            
            return {
                success: false,
                statusCode: 401,
                error: 'Credenciales inválidas',
                remainingAttempts: rateLimitResult.remainingAttempts - 1
            };
        }

        const user = users[0];

        // Verificar si el usuario está activo
        if (!user.is_active) {
            recordLoginAttempt(req, email, false);
            logger.warn('Login fallido: usuario inactivo', { email });
            
            return {
                success: false,
                statusCode: 403,
                error: 'Cuenta desactivada'
            };
        }

        // Verificar contraseña
        const passwordMatch = await verifyPassword(password, user.password_hash);

        if (!passwordMatch) {
            recordLoginAttempt(req, email, false);
            logger.warn('Login fallido: contraseña incorrecta', { email });
            
            return {
                success: false,
                statusCode: 401,
                error: 'Credenciales inválidas',
                remainingAttempts: rateLimitResult.remainingAttempts - 1
            };
        }

        // Login exitoso
        recordLoginAttempt(req, email, true);
        logger.info('Login exitoso', { userId: user.id, email: user.email });

        // Generar token
        const token = generateToken({
            id: user.id,
            email: user.email,
            role: user.role
        });

        return {
            success: true,
            statusCode: 200,
            data: {
                message: 'Login exitoso',
                user: {
                    id: user.id,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    email: user.email,
                    role: user.role
                },
                token
            }
        };

    } catch (error) {
        logger.exception(error, { action: 'login', email: body?.email });
        return {
            success: false,
            statusCode: 500,
            error: 'Error al procesar login'
        };
    }
}

/**
 * Verificar token
 * GET /api/auth/verify
 */
function verifyTokenEndpoint(req) {
    try {
        // El middleware de auth ya verificó el token
        // req.user contiene la información del usuario
        
        if (!req.user) {
            return {
                success: false,
                statusCode: 401,
                error: 'Token inválido'
            };
        }

        // Buscar información actualizada del usuario
        const users = query(
            'SELECT id, first_name, last_name, email, role, is_active FROM users WHERE id = ?',
            [req.user.id]
        );

        if (users.length === 0 || !users[0].is_active) {
            return {
                success: false,
                statusCode: 401,
                error: 'Usuario no encontrado o inactivo'
            };
        }

        const user = users[0];

        return {
            success: true,
            statusCode: 200,
            data: {
                valid: true,
                user: {
                    id: user.id,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    email: user.email,
                    role: user.role
                }
            }
        };

    } catch (error) {
        logger.exception(error, { action: 'verify-token' });
        return {
            success: false,
            statusCode: 500,
            error: 'Error al verificar token'
        };
    }
}

/**
 * Logout (invalidar sesión)
 * POST /api/auth/logout
 */
function logout(req) {
    try {
        // En un sistema JWT stateless, el logout es principalmente client-side
        // El cliente debe eliminar el token
        
        logger.info('Usuario cerró sesión', { userId: req.user?.id });

        return {
            success: true,
            statusCode: 200,
            data: {
                message: 'Sesión cerrada exitosamente'
            }
        };

    } catch (error) {
        logger.exception(error, { action: 'logout' });
        return {
            success: false,
            statusCode: 500,
            error: 'Error al cerrar sesión'
        };
    }
}

module.exports = {
    register,
    login,
    verifyTokenEndpoint,
    logout
};
