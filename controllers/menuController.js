/**
 * Controlador de Menú
 * Maneja CRUD de elementos del menú de restaurantes
 */

const { query } = require('../config/database');
const { validateRequired, validateLength } = require('../utils/validator');
const logger = require('../utils/logger');

/**
 * Obtener todos los elementos del menú de un restaurante
 * GET /api/menu?restaurantId=X
 */
function getMenuItems(req) {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const restaurantId = url.searchParams.get('restaurantId');
        const category = url.searchParams.get('category');
        const availableOnly = url.searchParams.get('availableOnly') === 'true';

        if (!restaurantId) {
            return {
                success: false,
                statusCode: 400,
                error: 'restaurantId es requerido'
            };
        }

        let sql = `
            SELECT 
                id,
                restaurant_id,
                name,
                description,
                price,
                category,
                image_url,
                is_available,
                created_at
            FROM menu_items 
            WHERE restaurant_id = ?
        `;

        const params = [restaurantId];

        // Filtrar por categoría
        if (category) {
            sql += ` AND category = ?`;
            params.push(category);
        }

        // Filtrar solo disponibles
        if (availableOnly) {
            sql += ` AND is_available = 1`;
        }

        sql += ` ORDER BY category, name`;

        const menuItems = query(sql, params);

        logger.info('Menú obtenido', { restaurantId, count: menuItems.length });

        return {
            success: true,
            statusCode: 200,
            data: menuItems
        };

    } catch (error) {
        logger.exception(error, { action: 'getMenuItems' });
        return {
            success: false,
            statusCode: 500,
            error: 'Error al obtener menú'
        };
    }
}

/**
 * Obtener un elemento del menú por ID
 * GET /api/menu/:id
 */
function getMenuItem(req, id) {
    try {
        const menuItems = query(
            'SELECT * FROM menu_items WHERE id = ?',
            [id]
        );

        if (menuItems.length === 0) {
            return {
                success: false,
                statusCode: 404,
                error: 'Elemento del menú no encontrado'
            };
        }

        logger.info('Elemento del menú obtenido', { menuItemId: id });

        return {
            success: true,
            statusCode: 200,
            data: { menuItem: menuItems[0] }
        };

    } catch (error) {
        logger.exception(error, { action: 'getMenuItem', id });
        return {
            success: false,
            statusCode: 500,
            error: 'Error al obtener elemento del menú'
        };
    }
}

/**
 * Crear un nuevo elemento del menú
 * POST /api/menu
 */
function createMenuItem(req, body) {
    try {
        const { restaurantId, name, description, price, category, imageUrl } = body;

        // Validaciones
        if (!restaurantId) {
            return {
                success: false,
                statusCode: 400,
                error: 'restaurantId es requerido'
            };
        }

        const nameValidation = validateLength(name, 2, 100, 'Nombre del platillo');
        if (!nameValidation.isValid) {
            return {
                success: false,
                statusCode: 400,
                error: nameValidation.error
            };
        }

        if (!price || isNaN(price) || price < 0) {
            return {
                success: false,
                statusCode: 400,
                error: 'Precio debe ser un número válido mayor o igual a 0'
            };
        }

        // Validar categoría
        const validCategories = ['Entrada', 'Plato Principal', 'Postre', 'Bebida', 'Otro'];
        if (category && !validCategories.includes(category)) {
            return {
                success: false,
                statusCode: 400,
                error: `Categoría inválida. Debe ser una de: ${validCategories.join(', ')}`
            };
        }

        // Verificar que el restaurante existe
        const restaurants = query(
            'SELECT id, owner_id FROM restaurants WHERE id = ? AND is_active = 1',
            [restaurantId]
        );

        if (restaurants.length === 0) {
            return {
                success: false,
                statusCode: 404,
                error: 'Restaurante no encontrado'
            };
        }

        const restaurant = restaurants[0];

        // Verificar permisos (solo el dueño o admin)
        if (req.user.role !== 'admin' && restaurant.owner_id !== req.user.id) {
            return {
                success: false,
                statusCode: 403,
                error: 'No tienes permisos para agregar elementos al menú de este restaurante'
            };
        }

        // Crear elemento del menú
        const result = query(`
            INSERT INTO menu_items (restaurant_id, name, description, price, category, image_url)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [restaurantId, name, description || null, price, category || 'Otro', imageUrl || null]);

        const menuItemId = result.lastInsertRowid;

        logger.info('Elemento del menú creado', { menuItemId, restaurantId, userId: req.user.id });

        return {
            success: true,
            statusCode: 201,
            data: { 
                message: 'Elemento del menú creado exitosamente',
                menuItemId 
            }
        };

    } catch (error) {
        logger.exception(error, { action: 'createMenuItem' });
        return {
            success: false,
            statusCode: 500,
            error: 'Error al crear elemento del menú'
        };
    }
}

/**
 * Actualizar un elemento del menú
 * PUT /api/menu/:id
 */
function updateMenuItem(req, id, body) {
    try {
        const { name, description, price, category, imageUrl, isAvailable } = body;

        // Verificar que el elemento existe
        const menuItems = query('SELECT * FROM menu_items WHERE id = ?', [id]);

        if (menuItems.length === 0) {
            return {
                success: false,
                statusCode: 404,
                error: 'Elemento del menú no encontrado'
            };
        }

        const menuItem = menuItems[0];

        // Verificar permisos (obtener el dueño del restaurante)
        const restaurants = query(
            'SELECT owner_id FROM restaurants WHERE id = ?',
            [menuItem.restaurant_id]
        );

        if (restaurants.length === 0) {
            return {
                success: false,
                statusCode: 404,
                error: 'Restaurante no encontrado'
            };
        }

        const restaurant = restaurants[0];

        if (req.user.role !== 'admin' && restaurant.owner_id !== req.user.id) {
            return {
                success: false,
                statusCode: 403,
                error: 'No tienes permisos para editar este elemento del menú'
            };
        }

        // Validaciones
        if (name !== undefined) {
            const nameValidation = validateLength(name, 2, 100, 'Nombre del platillo');
            if (!nameValidation.isValid) {
                return {
                    success: false,
                    statusCode: 400,
                    error: nameValidation.error
                };
            }
        }

        if (price !== undefined && (isNaN(price) || price < 0)) {
            return {
                success: false,
                statusCode: 400,
                error: 'Precio debe ser un número válido mayor o igual a 0'
            };
        }

        if (category !== undefined) {
            const validCategories = ['Entrada', 'Plato Principal', 'Postre', 'Bebida', 'Otro'];
            if (!validCategories.includes(category)) {
                return {
                    success: false,
                    statusCode: 400,
                    error: `Categoría inválida. Debe ser una de: ${validCategories.join(', ')}`
                };
            }
        }

        // Actualizar elemento
        query(`
            UPDATE menu_items 
            SET name = COALESCE(?, name),
                description = COALESCE(?, description),
                price = COALESCE(?, price),
                category = COALESCE(?, category),
                image_url = COALESCE(?, image_url),
                is_available = COALESCE(?, is_available),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [name, description, price, category, imageUrl, isAvailable, id]);

        logger.info('Elemento del menú actualizado', { menuItemId: id, userId: req.user.id });

        return {
            success: true,
            statusCode: 200,
            data: { message: 'Elemento del menú actualizado exitosamente' }
        };

    } catch (error) {
        logger.exception(error, { action: 'updateMenuItem', id });
        return {
            success: false,
            statusCode: 500,
            error: 'Error al actualizar elemento del menú'
        };
    }
}

/**
 * Eliminar un elemento del menú
 * DELETE /api/menu/:id
 */
function deleteMenuItem(req, id) {
    try {
        // Verificar que el elemento existe
        const menuItems = query('SELECT * FROM menu_items WHERE id = ?', [id]);

        if (menuItems.length === 0) {
            return {
                success: false,
                statusCode: 404,
                error: 'Elemento del menú no encontrado'
            };
        }

        const menuItem = menuItems[0];

        // Verificar permisos
        const restaurants = query(
            'SELECT owner_id FROM restaurants WHERE id = ?',
            [menuItem.restaurant_id]
        );

        if (restaurants.length === 0) {
            return {
                success: false,
                statusCode: 404,
                error: 'Restaurante no encontrado'
            };
        }

        const restaurant = restaurants[0];

        if (req.user.role !== 'admin' && restaurant.owner_id !== req.user.id) {
            return {
                success: false,
                statusCode: 403,
                error: 'No tienes permisos para eliminar este elemento del menú'
            };
        }

        // Eliminar permanentemente
        query('DELETE FROM menu_items WHERE id = ?', [id]);

        logger.info('Elemento del menú eliminado', { menuItemId: id, userId: req.user.id });

        return {
            success: true,
            statusCode: 200,
            data: { message: 'Elemento del menú eliminado exitosamente' }
        };

    } catch (error) {
        logger.exception(error, { action: 'deleteMenuItem', id });
        return {
            success: false,
            statusCode: 500,
            error: 'Error al eliminar elemento del menú'
        };
    }
}

module.exports = {
    getMenuItems,
    getMenuItem,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem
};
