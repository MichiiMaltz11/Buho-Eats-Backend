/**
 * Buho Eats Backend - Servidor Principal
 * API REST con Node.js vanilla
 */

const http = require('http');
const url = require('url');
const config = require('./config/env');
const { initDatabase } = require('./config/database');
const { findRoute, executeRoute } = require('./routes/api');
const { applyCorsHeaders, handlePreflight } = require('./middleware/cors');
const { sanitizeBody, validateNoSQLInjection } = require('./middleware/sanitize');
const { scheduleMaintenance } = require('./utils/maintenance');
const logger = require('./utils/logger');

// Inicializar base de datos
initDatabase();

// Programar tareas de mantenimiento (cada 1 hora)
scheduleMaintenance(1);

/**
 * Parsea el body de una petición
 */
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
            
            // Limitar tamaño del body a 1MB
            if (body.length > 1e6) {
                req.connection.destroy();
                reject(new Error('Body demasiado grande'));
            }
        });

        req.on('end', () => {
            try {
                if (body.length > 0) {
                    const parsed = JSON.parse(body);
                    resolve(parsed);
                } else {
                    resolve({});
                }
            } catch (error) {
                reject(new Error('JSON inválido'));
            }
        });

        req.on('error', error => {
            reject(error);
        });
    });
}

/**
 * Envía una respuesta JSON
 */
function sendJSON(res, statusCode, data) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(data));
}

/**
 * Manejador principal de peticiones
 */
async function requestHandler(req, res) {
    const startTime = Date.now();
    const parsedUrl = url.parse(req.url, true);

    try {
        // Aplicar CORS
        const corsResult = applyCorsHeaders(req, res);
        
        if (!corsResult.allowed) {
            sendJSON(res, 403, {
                success: false,
                error: 'Origin no permitido'
            });
            return;
        }

        // Manejar preflight OPTIONS
        if (req.method === 'OPTIONS') {
            const preflightResult = handlePreflight(req, res);
            res.statusCode = preflightResult.statusCode;
            res.end();
            return;
        }

        // Parsear body si existe
        let body = {};
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            try {
                body = await parseBody(req);
                
                // Sanitizar body
                body = sanitizeBody(body);
                
                // Validar SQL injection
                const sqlValidation = validateNoSQLInjection(body);
                if (!sqlValidation.safe) {
                    logger.warn('Intento de SQL injection bloqueado', {
                        ip: req.connection?.remoteAddress,
                        suspicious: sqlValidation.suspicious
                    });
                    
                    sendJSON(res, 400, {
                        success: false,
                        error: 'Input inválido detectado'
                    });
                    return;
                }
                
            } catch (error) {
                sendJSON(res, 400, {
                    success: false,
                    error: 'Body inválido: ' + error.message
                });
                return;
            }
        }

        // Buscar ruta
        const routeMatch = findRoute(req.method, parsedUrl.pathname);

        if (!routeMatch.found) {
            sendJSON(res, 404, {
                success: false,
                error: 'Ruta no encontrada'
            });
            
            logger.warn('Ruta no encontrada', {
                method: req.method,
                url: parsedUrl.pathname
            });
            return;
        }

        // Ejecutar ruta
        const result = await executeRoute(routeMatch.route, req, body, routeMatch.params);

        // Enviar respuesta
        // Mantener la estructura completa del resultado
        const responsePayload = {
            success: result.success
        };

        if (result.success) {
            // Si es exitoso, incluir data si existe
            if (result.data) {
                responsePayload.data = result.data;
            }
            // También incluir message si existe
            if (result.message) {
                responsePayload.message = result.message;
            }
        } else {
            // Si hay error, incluir todos los detalles del error
            if (result.error) responsePayload.error = result.error;
            if (result.errors) responsePayload.errors = result.errors;
            if (result.minutesRemaining) responsePayload.minutesRemaining = result.minutesRemaining;
            if (result.remainingAttempts !== undefined) responsePayload.remainingAttempts = result.remainingAttempts;
        }

        // Agregar header Retry-After si existe
        if (result.retryAfter) {
            res.setHeader('Retry-After', result.retryAfter);
        }

        sendJSON(res, result.statusCode, responsePayload);

        // Log del request
        const duration = Date.now() - startTime;
        logger.request(req, result.statusCode, duration);

    } catch (error) {
        logger.exception(error, {
            method: req.method,
            url: req.url,
            ip: req.connection?.remoteAddress
        });

        sendJSON(res, 500, {
            success: false,
            error: 'Error interno del servidor'
        });
    }
}

/**
 * Crear y arrancar el servidor
 */
const server = http.createServer(requestHandler);

server.listen(config.port, () => {
    console.log('\n╔═══════════════════════════════════════════════════╗');
    console.log('║           Buho Eats Server                        ║');
    console.log('╚═══════════════════════════════════════════════════╝\n');
    console.log(`Servidor corriendo en: http://localhost:${config.port}`);
    console.log(`Base de datos: ${config.database.path}`);
    console.log(`Rate limiting: ${config.security.maxLoginAttempts} intentos, ${config.security.lockoutDuration / 60000} min bloqueo`);
    console.log(`CORS permitido desde: ${config.cors.allowedOrigins.join(', ')}`);
    console.log(`Nivel de logs: ${config.logging.level}`);
    console.log('\nServidor listo para recibir peticiones\n');
    
    logger.info('Servidor iniciado', { port: config.port });
});

/**
 * Manejo de errores del servidor
 */
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`\nError: El puerto ${config.port} ya está en uso`);
    } else {
        console.error('\nError del servidor:', error.message, '\n');
    }
    
    logger.exception(error, { context: 'server-startup' });
    process.exit(1);
});

/**
 * Manejo de cierre graceful
 */
process.on('SIGINT', () => {
    console.log('\n\nCerrando servidor...');
    
    server.close(() => {
        console.log('Servidor cerrado correctamente');
        logger.info('Servidor detenido');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n\nSeñal SIGTERM recibida, cerrando servidor...');
    
    server.close(() => {
        console.log('Servidor cerrado correctamente');
        logger.info('Servidor detenido por SIGTERM');
        process.exit(0);
    });
});

module.exports = server;
