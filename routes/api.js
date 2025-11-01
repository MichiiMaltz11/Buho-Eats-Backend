/**
 * Definición de Rutas de la API
 * Mapea URLs a controladores
 */

const authController = require('../controllers/authController');
const { authenticateToken, requireRole } = require('../middleware/auth');

/**
 * Rutas públicas (no requieren autenticación)
 */
const publicRoutes = {
    'POST /api/auth/register': {
        handler: authController.register,
        requireAuth: false
    },
    'POST /api/auth/login': {
        handler: authController.login,
        requireAuth: false
    }
};

/**
 * Rutas protegidas (requieren autenticación)
 */
const protectedRoutes = {
    'GET /api/auth/verify': {
        handler: authController.verifyTokenEndpoint,
        requireAuth: true,
        middleware: authenticateToken
    },
    'POST /api/auth/logout': {
        handler: authController.logout,
        requireAuth: true,
        middleware: authenticateToken
    }
};

/**
 * Rutas de admin (requieren rol admin)
 */
const adminRoutes = {
    // Agregar aquí rutas de admin cuando sea necesario
};

/**
 * Combinar todas las rutas
 */
const allRoutes = {
    ...publicRoutes,
    ...protectedRoutes,
    ...adminRoutes
};

/**
 * Busca una ruta que coincida con el método y URL
 */
function findRoute(method, url) {
    // Limpiar query params de la URL
    const cleanUrl = url.split('?')[0];
    const routeKey = `${method} ${cleanUrl}`;

    // Buscar coincidencia exacta
    if (allRoutes[routeKey]) {
        return {
            found: true,
            route: allRoutes[routeKey],
            params: {}
        };
    }

    // TODO: Agregar soporte para rutas con parámetros dinámicos
    // Por ejemplo: GET /api/restaurants/:id

    return {
        found: false,
        route: null,
        params: {}
    };
}

/**
 * Ejecuta el handler de una ruta con middlewares
 */
async function executeRoute(route, req, body) {
    try {
        // Si requiere autenticación, ejecutar middleware
        if (route.requireAuth && route.middleware) {
            const authResult = await route.middleware(req, null);
            
            if (!authResult.authenticated) {
                return {
                    success: false,
                    statusCode: authResult.statusCode || 401,
                    error: authResult.error || 'No autorizado'
                };
            }

            // El middleware añade req.user
        }

        // Ejecutar el handler del controlador
        const result = await route.handler(req, body);
        return result;

    } catch (error) {
        console.error('Error al ejecutar ruta:', error);
        return {
            success: false,
            statusCode: 500,
            error: 'Error interno del servidor'
        };
    }
}

/**
 * Lista todas las rutas disponibles (útil para documentación)
 */
function listRoutes() {
    return Object.keys(allRoutes).map(key => {
        const [method, path] = key.split(' ');
        const route = allRoutes[key];
        
        return {
            method,
            path,
            requireAuth: route.requireAuth || false,
            description: route.description || 'Sin descripción'
        };
    });
}

module.exports = {
    findRoute,
    executeRoute,
    listRoutes,
    publicRoutes,
    protectedRoutes,
    adminRoutes
};
