/**
 * Definición de Rutas de la API
 * Mapea URLs a controladores
 */

const authController = require('../controllers/authController');
const restaurantController = require('../controllers/restaurantController');
const reviewController = require('../controllers/reviewController');
const menuController = require('../controllers/menuController');
const userController = require('../controllers/userController');
const favoritesController = require('../controllers/favoritesController');
const uploadController = require('../controllers/uploadController');
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
    },
    'GET /api/restaurants': {
        handler: restaurantController.getAllRestaurants,
        requireAuth: false
    },
    'GET /api/restaurants/:id': {
        handler: restaurantController.getRestaurantById,
        requireAuth: false
    },
    'GET /api/reviews': {
        handler: reviewController.getReviews,
        requireAuth: false
    },
    'GET /api/menu': {
        handler: menuController.getMenuItems,
        requireAuth: false
    },
    'GET /api/menu/:id': {
        handler: menuController.getMenuItem,
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
    },
    'POST /api/restaurants': {
        handler: restaurantController.createRestaurant,
        requireAuth: true,
        middleware: authenticateToken
    },
    'PUT /api/restaurants/:id': {
        handler: restaurantController.updateRestaurant,
        requireAuth: true,
        middleware: authenticateToken
    },
    'DELETE /api/restaurants/:id': {
        handler: restaurantController.deleteRestaurant,
        requireAuth: true,
        middleware: authenticateToken
    },
    'POST /api/reviews': {
        handler: reviewController.createReview,
        requireAuth: true,
        middleware: authenticateToken
    },
    'PUT /api/reviews/:id': {
        handler: reviewController.updateReview,
        requireAuth: true,
        middleware: authenticateToken
    },
    'DELETE /api/reviews/:id': {
        handler: reviewController.deleteReview,
        requireAuth: true,
        middleware: authenticateToken
    },
    'POST /api/menu': {
        handler: menuController.createMenuItem,
        requireAuth: true,
        middleware: authenticateToken
    },
    'PUT /api/menu/:id': {
        handler: menuController.updateMenuItem,
        requireAuth: true,
        middleware: authenticateToken
    },
    'DELETE /api/menu/:id': {
        handler: menuController.deleteMenuItem,
        requireAuth: true,
        middleware: authenticateToken
    },
    'GET /api/users/profile': {
        handler: userController.getProfile,
        requireAuth: true,
        middleware: authenticateToken
    },
    'PUT /api/users/profile': {
        handler: userController.updateProfile,
        requireAuth: true,
        middleware: authenticateToken
    },
    'PUT /api/users/password': {
        handler: userController.updatePassword,
        requireAuth: true,
        middleware: authenticateToken
    },
    'PUT /api/users/photo': {
        handler: userController.updateProfilePhoto,
        requireAuth: true,
        middleware: authenticateToken
    },
    'DELETE /api/users/photo': {
        handler: userController.deleteProfilePhoto,
        requireAuth: true,
        middleware: authenticateToken
    },
    'GET /api/favorites': {
        handler: favoritesController.getUserFavorites,
        requireAuth: true,
        middleware: authenticateToken
    },
    'POST /api/favorites': {
        handler: favoritesController.addFavorite,
        requireAuth: true,
        middleware: authenticateToken
    },
    'DELETE /api/favorites': {
        handler: favoritesController.removeFavorite,
        requireAuth: true,
        middleware: authenticateToken
    },
    'POST /api/favorites/check': {
        handler: favoritesController.checkFavorite,
        requireAuth: true,
        middleware: authenticateToken
    },
    'POST /api/upload/image': {
        handler: uploadController.uploadImage,
        requireAuth: true,
        middleware: authenticateToken
    },
    'DELETE /api/upload/image/:filename': {
        handler: uploadController.deleteImage,
        requireAuth: true,
        middleware: authenticateToken
    }
};

/**
 * Rutas de admin (requieren rol admin)
 */
const adminRoutes = {
    'POST /api/admin/users/:id/roles': {
        handler: userController.assignOwnerRole,
        requireAuth: true,
        middleware: authenticateToken
    }
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

    // Buscar rutas con parámetros dinámicos (ej: /api/restaurants/:id)
    const urlParts = cleanUrl.split('/').filter(p => p);
    
    for (const [pattern, route] of Object.entries(allRoutes)) {
        const [routeMethod, routePath] = pattern.split(' ');
        
        // Verificar que el método coincida
        if (routeMethod !== method) continue;
        
        const routeParts = routePath.split('/').filter(p => p);
        
        // Verificar que tengan la misma cantidad de segmentos
        if (routeParts.length !== urlParts.length) continue;
        
        // Verificar cada segmento
        const params = {};
        let matches = true;
        
        for (let i = 0; i < routeParts.length; i++) {
            if (routeParts[i].startsWith(':')) {
                // Es un parámetro dinámico
                const paramName = routeParts[i].substring(1);
                params[paramName] = urlParts[i];
            } else if (routeParts[i] !== urlParts[i]) {
                // No coincide
                matches = false;
                break;
            }
        }
        
        if (matches) {
            return {
                found: true,
                route,
                params
            };
        }
    }

    return {
        found: false,
        route: null,
        params: {}
    };
}

/**
 * Ejecuta el handler de una ruta con middlewares
 */
async function executeRoute(route, req, body, params = {}) {
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
        // Si hay parámetros (ej: :id), pasarlos como argumentos adicionales
        let result;
        if (Object.keys(params).length > 0) {
            // Para rutas como PUT /api/restaurants/:id
            result = await route.handler(req, params.id, body);
        } else {
            result = await route.handler(req, body);
        }
        
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
