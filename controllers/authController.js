/**
 * Controlador de Autenticación
 * Maneja registro, login y logout de usuarios
 */

const { query } = require('../config/database');
const { hashPassword, verifyPassword } = require('../utils/hash');
const { generateToken, extractTokenFromHeader } = require('../utils/jwt');
const { addToBlacklist } = require('../utils/tokenBlacklist');
const { validateRegistrationData, isValidEmail } = require('../utils/validator');
const { recordLoginAttempt, checkRateLimit } = require('../middleware/rateLimit');
const logger = require('../utils/logger');

/**
 * Registrar nuevo usuario
 * POST /api/auth/register
 */
async function register(req, body) {
    try {
        const { firstName, lastName, email, password, role, businessName, businessAddress } = body;

        // Debug: Ver qué llega en body
        console.log('[DEBUG] Register body:', { firstName, lastName, email, role, businessName, businessAddress });

        // Validar datos básicos
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

        // Validar rol
        const userRole = role || 'user';
        if (!['user', 'owner', 'admin'].includes(userRole)) {
            return {
                success: false,
                statusCode: 400,
                error: 'Rol inválido'
            };
        }

        // Si es owner, validar datos del restaurante
        if (userRole === 'owner') {
            if (!businessName || businessName.trim().length < 3) {
                return {
                    success: false,
                    statusCode: 400,
                    error: 'El nombre del restaurante debe tener al menos 3 caracteres'
                };
            }
            if (!businessAddress || businessAddress.trim().length < 5) {
                return {
                    success: false,
                    statusCode: 400,
                    error: 'La dirección del restaurante debe tener al menos 5 caracteres'
                };
            }
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
        const userResult = query(`
            INSERT INTO users (first_name, last_name, email, password_hash, role)
            VALUES (?, ?, ?, ?, ?)
        `, [firstName, lastName, email.toLowerCase(), passwordHash, userRole]);

        const userId = userResult.lastInsertRowid;

        let restaurantId = null;

        // Si es owner, crear el restaurante
        if (userRole === 'owner') {
            const restaurantResult = query(`
                INSERT INTO restaurants (name, address, owner_id, is_active)
                VALUES (?, ?, ?, 1)
            `, [businessName.trim(), businessAddress.trim(), userId]);

            restaurantId = restaurantResult.lastInsertRowid;

            logger.info('Restaurante creado para owner', { 
                userId, 
                restaurantId,
                restaurantName: businessName 
            });
        }

        logger.info('Usuario registrado exitosamente', { 
            userId, 
            email: email.toLowerCase(),
            role: userRole
        });

        // Generar token
        const token = generateToken({
            id: userId,
            email: email.toLowerCase(),
            role: userRole,
            firstName,
            lastName
        });

        const userData = {
            id: userId,
            firstName,
            lastName,
            email: email.toLowerCase(),
            role: userRole
        };

        if (restaurantId) {
            userData.restaurantId = restaurantId;
        }

        return {
            success: true,
            statusCode: 201,
            data: {
                message: userRole === 'owner' 
                    ? 'Cuenta de owner y restaurante creados exitosamente' 
                    : 'Usuario registrado exitosamente',
                user: userData,
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

        // Verificar rate limiting (ahora incluye verificación por email)
        const rateLimitResult = checkRateLimit(req, email);
        
        if (!rateLimitResult.allowed) {
            return {
                success: false,
                statusCode: rateLimitResult.statusCode,
                error: rateLimitResult.error,
                minutesRemaining: rateLimitResult.minutesRemaining,
                retryAfter: rateLimitResult.retryAfter,
                blockedBy: rateLimitResult.blockedBy
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
            logger.warn('Login fallido: usuario inactivo', { email, role: user.role });
            
            // Mensaje personalizado según el rol
            const errorMessage = user.role === 'owner' 
                ? 'Tu cuenta de propietario ha sido desactivada. Tu restaurante también está inactivo.'
                : 'Tu cuenta ha sido baneada por violar nuestras políticas.';
            
            return {
                success: false,
                statusCode: 403,
                error: errorMessage
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

        // Si es owner, obtener su restaurant_id
        let restaurantId = null;
        if (user.role === 'owner') {
            console.log('🔍 Buscando restaurante para owner:', user.id);
            const restaurants = query(
                'SELECT id FROM restaurants WHERE owner_id = ? LIMIT 1',
                [user.id]
            );
            console.log('🍽️ Restaurantes encontrados:', restaurants);
            if (restaurants.length > 0) {
                restaurantId = restaurants[0].id;
                console.log('✅ Restaurant ID asignado:', restaurantId);
            } else {
                console.log('⚠️ No se encontró restaurante para este owner');
            }
        }

        // Generar token (incluir restaurantId para owners)
        const tokenPayload = {
            id: user.id,
            email: user.email,
            role: user.role
        };
        
        if (restaurantId) {
            tokenPayload.restaurantId = restaurantId;
        }

        const token = generateToken(tokenPayload);

        const userData = {
            id: user.id,
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
            role: user.role
        };

        if (restaurantId) {
            userData.restaurantId = restaurantId;
        }

        return {
            success: true,
            statusCode: 200,
            data: {
                message: 'Login exitoso',
                user: userData,
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
        // Extraer token del header
        const authHeader = req.headers?.authorization;
        const token = extractTokenFromHeader(authHeader);
        
        if (token) {
            // Agregar token a la blacklist
            const blacklisted = addToBlacklist(token, req.user?.id, 'logout');
            
            if (blacklisted) {
                logger.info('Usuario cerró sesión y token invalidado', { 
                    userId: req.user?.id 
                });
            } else {
                logger.warn('Token no pudo ser agregado a blacklist en logout', { 
                    userId: req.user?.id 
                });
            }
        }

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
