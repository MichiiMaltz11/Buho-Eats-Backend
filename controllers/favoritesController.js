const { query } = require('../config/database');

/**
 * Obtener todos los favoritos de un usuario
 */
function getUserFavorites(req, body) {
    const userId = req.user.id;

    try {
        // Obtener favoritos con información del restaurante
        const favorites = query(`
            SELECT 
                r.id,
                r.name,
                r.description,
                r.cuisine_type,
                r.price_range,
                r.image_url,
                r.average_rating,
                r.total_reviews,
                r.address,
                uf.created_at as favorited_at
            FROM user_favorites uf
            INNER JOIN restaurants r ON uf.restaurant_id = r.id
            WHERE uf.user_id = ? AND r.is_active = 1
            ORDER BY uf.created_at DESC
        `, [userId]);

        return {
            success: true,
            statusCode: 200,
            data: favorites
        };
    } catch (error) {
        console.error('Error al obtener favoritos:', error);
        return {
            success: false,
            statusCode: 500,
            error: 'Error al obtener los favoritos'
        };
    }
}

/**
 * Agregar un restaurante a favoritos
 */
function addFavorite(req, body) {
    const userId = req.user.id;
    const { restaurantId } = body;

    // Validar que se envió el ID del restaurante
    if (!restaurantId) {
        return {
            success: false,
            statusCode: 400,
            error: 'El ID del restaurante es requerido'
        };
    }

    try {
        // Verificar que el restaurante existe y está activo
        const restaurants = query(
            'SELECT id FROM restaurants WHERE id = ? AND is_active = 1',
            [restaurantId]
        );

        if (restaurants.length === 0) {
            return {
                success: false,
                statusCode: 404,
                error: 'Restaurante no encontrado'
            };
        }

        // Verificar si ya está en favoritos
        const existing = query(
            'SELECT id FROM user_favorites WHERE user_id = ? AND restaurant_id = ?',
            [userId, restaurantId]
        );

        if (existing.length > 0) {
            return {
                success: false,
                statusCode: 400,
                error: 'El restaurante ya está en tus favoritos'
            };
        }

        // Agregar a favoritos
        query(
            'INSERT INTO user_favorites (user_id, restaurant_id) VALUES (?, ?)',
            [userId, restaurantId]
        );

        return {
            success: true,
            statusCode: 201,
            data: { message: 'Restaurante agregado a favoritos' }
        };
    } catch (error) {
        console.error('Error al agregar favorito:', error);
        return {
            success: false,
            statusCode: 500,
            error: 'Error al agregar a favoritos'
        };
    }
}

/**
 * Eliminar un restaurante de favoritos
 */
function removeFavorite(req, body) {
    const userId = req.user.id;
    const { restaurantId } = body;

    // Validar que se envió el ID del restaurante
    if (!restaurantId) {
        return {
            success: false,
            statusCode: 400,
            error: 'El ID del restaurante es requerido'
        };
    }

    try {
        // Verificar que el favorito existe
        const existing = query(
            'SELECT id FROM user_favorites WHERE user_id = ? AND restaurant_id = ?',
            [userId, restaurantId]
        );

        if (existing.length === 0) {
            return {
                success: false,
                statusCode: 404,
                error: 'El restaurante no está en tus favoritos'
            };
        }

        // Eliminar de favoritos
        query(
            'DELETE FROM user_favorites WHERE user_id = ? AND restaurant_id = ?',
            [userId, restaurantId]
        );

        return {
            success: true,
            statusCode: 200,
            data: { message: 'Restaurante eliminado de favoritos' }
        };
    } catch (error) {
        console.error('Error al eliminar favorito:', error);
        return {
            success: false,
            statusCode: 500,
            error: 'Error al eliminar de favoritos'
        };
    }
}

/**
 * Verificar si un restaurante está en favoritos
 */
function checkFavorite(req, body) {
    const userId = req.user.id;
    const { restaurantId } = body;

    if (!restaurantId) {
        return {
            success: false,
            statusCode: 400,
            error: 'Se requiere el ID del restaurante'
        };
    }

    try {
        const existing = query(
            'SELECT id FROM user_favorites WHERE user_id = ? AND restaurant_id = ?',
            [userId, restaurantId]
        );

        return {
            success: true,
            statusCode: 200,
            data: { isFavorite: existing.length > 0 }
        };
    } catch (error) {
        console.error('Error al verificar favorito:', error);
        return {
            success: false,
            statusCode: 500,
            error: 'Error al verificar favorito'
        };
    }
}

module.exports = {
    getUserFavorites,
    addFavorite,
    removeFavorite,
    checkFavorite
};
