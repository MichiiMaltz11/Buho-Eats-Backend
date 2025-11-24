/**
 * Controlador de Owner
 * Maneja operaciones del dueño de restaurante
 */

const { query, transaction } = require('../config/database');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

/**
 * GET /api/owner/restaurant
 * Obtiene el restaurante del owner autenticado
 */
function getMyRestaurant(req) {
    try {
        const userId = req.user.id;
        
        // Buscar restaurante del owner
        const restaurants = query(
            'SELECT * FROM restaurants WHERE owner_id = ?',
            [userId]
        );
        
        if (restaurants.length === 0) {
            return {
                success: false,
                statusCode: 404,
                error: 'No tienes un restaurante asociado'
            };
        }
        
        return {
            success: true,
            statusCode: 200,
            data: restaurants[0]
        };
        
    } catch (error) {
        logger.exception(error, { action: 'getMyRestaurant', userId: req.user?.id });
        return {
            success: false,
            statusCode: 500,
            error: 'Error al obtener restaurante'
        };
    }
}

/**
 * PUT /api/owner/restaurant
 * Actualiza información del restaurante del owner
 */
function updateRestaurant(req, body) {
    try {
        const userId = req.user.id;
        
        // Verificar que el owner tenga un restaurante
        const restaurants = query(
            'SELECT id FROM restaurants WHERE owner_id = ?',
            [userId]
        );
        
        if (restaurants.length === 0) {
            return {
                success: false,
                statusCode: 404,
                error: 'No tienes un restaurante asociado'
            };
        }
        
        const restaurantId = restaurants[0].id;
        
        // Validaciones de campos
        if (body.name !== undefined) {
            if (typeof body.name !== 'string' || body.name.trim().length < 3 || body.name.length > 100) {
                return {
                    success: false,
                    statusCode: 400,
                    error: 'El nombre debe tener entre 3 y 100 caracteres'
                };
            }
        }
        
        if (body.description !== undefined && body.description) {
            if (body.description.length > 500) {
                return {
                    success: false,
                    statusCode: 400,
                    error: 'La descripción no puede exceder 500 caracteres'
                };
            }
        }
        
        if (body.phone !== undefined && body.phone) {
            if (!/^\+?[0-9\s\-()]{7,20}$/.test(body.phone)) {
                return {
                    success: false,
                    statusCode: 400,
                    error: 'Formato de teléfono inválido'
                };
            }
        }
        
        if (body.email !== undefined && body.email) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
                return {
                    success: false,
                    statusCode: 400,
                    error: 'Formato de email inválido'
                };
            }
        }
        
        if (body.price_range !== undefined && body.price_range) {
            if (!['$', '$$', '$$$', '$$$$'].includes(body.price_range)) {
                return {
                    success: false,
                    statusCode: 400,
                    error: 'Rango de precio inválido (debe ser $, $$, $$$ o $$$$)'
                };
            }
        }
        
        // Campos permitidos para actualizar
        const allowedFields = [
            'name', 'description', 'address', 'phone', 'email',
            'cuisine_type', 'price_range', 'opening_hours'
        ];
        
        const updates = [];
        const values = [];
        
        allowedFields.forEach(field => {
            if (body[field] !== undefined) {
                updates.push(`${field} = ?`);
                values.push(body[field]);
            }
        });
        
        if (updates.length === 0) {
            return {
                success: false,
                statusCode: 400,
                error: 'No hay campos para actualizar'
            };
        }
        
        // Agregar timestamp de actualización
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(restaurantId);
        
        const sql = `UPDATE restaurants SET ${updates.join(', ')} WHERE id = ?`;
        query(sql, values);
        
        // Obtener datos actualizados
        const updated = query('SELECT * FROM restaurants WHERE id = ?', [restaurantId]);
        
        logger.info('Restaurante actualizado', { ownerId: userId, restaurantId });
        
        return {
            success: true,
            statusCode: 200,
            data: updated[0],
            message: 'Restaurante actualizado correctamente'
        };
        
    } catch (error) {
        logger.exception(error, { action: 'updateRestaurant', userId: req.user?.id });
        return {
            success: false,
            statusCode: 500,
            error: 'Error al actualizar restaurante'
        };
    }
}

/**
 * PUT /api/owner/restaurant/photo
 * Sube la foto del restaurante (Base64)
 */
async function updateRestaurantPhoto(req, body) {
    try {
        const userId = req.user.id;
        
        // Verificar que el owner tenga un restaurante
        const restaurants = query(
            'SELECT id, image_url FROM restaurants WHERE owner_id = ?',
            [userId]
        );
        
        if (restaurants.length === 0) {
            return {
                success: false,
                statusCode: 404,
                error: 'No tienes un restaurante asociado'
            };
        }
        
        const restaurant = restaurants[0];
        
        // Verificar que se envió la imagen
        if (!body.image) {
            return {
                success: false,
                statusCode: 400,
                error: 'Campo "image" requerido (Base64)'
            };
        }
        
        // Validar formato Base64
        const regex = /^data:image\/(jpeg|jpg|png|webp|gif);base64,(.+)$/;
        const matches = body.image.match(regex);
        
        if (!matches) {
            return {
                success: false,
                statusCode: 400,
                error: 'Formato de imagen inválido'
            };
        }
        
        const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const base64Data = matches[2];
        
        // Generar nombre único
        const uniqueName = `restaurant-${restaurant.id}-${Date.now()}.${extension}`;
        const uploadDir = path.join(__dirname, '../public/uploads');
        
        // Asegurar que existe el directorio
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        const uploadPath = path.join(uploadDir, uniqueName);
        
        // Convertir Base64 a Buffer y guardar
        const imageBuffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(uploadPath, imageBuffer);
        
        // Eliminar foto anterior si existe
        if (restaurant.image_url && !restaurant.image_url.includes('default')) {
            const oldPhotoPath = path.join(__dirname, '../public', restaurant.image_url.replace(/^\//, ''));
            if (fs.existsSync(oldPhotoPath)) {
                try {
                    fs.unlinkSync(oldPhotoPath);
                } catch (e) {
                    logger.warn('No se pudo eliminar foto anterior', { error: e.message });
                }
            }
        }
        
        // Actualizar BD
        const imageUrl = `/uploads/${uniqueName}`;
        query(
            'UPDATE restaurants SET image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [imageUrl, restaurant.id]
        );
        
        logger.info('Foto de restaurante actualizada', { ownerId: userId, restaurantId: restaurant.id });
        
        return {
            success: true,
            statusCode: 200,
            data: { imageUrl },
            message: 'Foto actualizada correctamente'
        };
        
    } catch (error) {
        logger.exception(error, { action: 'updateRestaurantPhoto' });
        return {
            success: false,
            statusCode: 500,
            error: 'Error al subir foto'
        };
    }
}

/**
 * GET /api/owner/menu
 * Obtiene el menú del restaurante del owner
 */
function getMenu(req) {
    try {
        const userId = req.user.id;
        
        // Obtener restaurante del owner
        const restaurants = query(
            'SELECT id FROM restaurants WHERE owner_id = ?',
            [userId]
        );
        
        if (restaurants.length === 0) {
            return {
                success: false,
                statusCode: 404,
                error: 'No tienes un restaurante asociado'
            };
        }
        
        const restaurantId = restaurants[0].id;
        
        // Obtener items del menú
        const menuItems = query(
            'SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY category, name',
            [restaurantId]
        );
        
        return {
            success: true,
            statusCode: 200,
            data: menuItems
        };
        
    } catch (error) {
        logger.exception(error, { action: 'getMenu', userId: req.user?.id });
        return {
            success: false,
            statusCode: 500,
            error: 'Error al obtener menú'
        };
    }
}

/**
 * POST /api/owner/menu
 * Agrega un nuevo item al menú
 */
async function addMenuItem(req, body) {
    try {
        const userId = req.user.id;
        
        // Verificar restaurante
        const restaurants = query(
            'SELECT id FROM restaurants WHERE owner_id = ?',
            [userId]
        );
        
        if (restaurants.length === 0) {
            return {
                success: false,
                statusCode: 404,
                error: 'No tienes un restaurante asociado'
            };
        }
        
        const restaurantId = restaurants[0].id;
        
        // Validar campos requeridos
        if (!body.name || !body.price || !body.category) {
            return {
                success: false,
                statusCode: 400,
                error: 'Faltan campos requeridos: name, price, category'
            };
        }
        
        // Validar formato de campos
        if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.length > 100) {
            return {
                success: false,
                statusCode: 400,
                error: 'El nombre debe tener entre 2 y 100 caracteres'
            };
        }
        
        const price = parseFloat(body.price);
        if (isNaN(price) || price <= 0 || price > 999999) {
            return {
                success: false,
                statusCode: 400,
                error: 'El precio debe ser un número positivo válido'
            };
        }
        
        if (body.description && body.description.length > 500) {
            return {
                success: false,
                statusCode: 400,
                error: 'La descripción no puede exceder 500 caracteres'
            };
        }
        
        if (typeof body.category !== 'string' || body.category.trim().length < 2) {
            return {
                success: false,
                statusCode: 400,
                error: 'La categoría es inválida'
            };
        }
        
        let imageUrl = null;
        
        // Procesar imagen Base64 si existe
        if (body.image) {
            const regex = /^data:image\/(jpeg|jpg|png|webp|gif);base64,(.+)$/;
            const matches = body.image.match(regex);
            
            if (matches) {
                const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
                const base64Data = matches[2];
                
                // Generar nombre único
                const uniqueName = `menu-${restaurantId}-${Date.now()}.${extension}`;
                const uploadDir = path.join(__dirname, '../public/uploads');
                
                // Asegurar directorio
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }
                
                const uploadPath = path.join(uploadDir, uniqueName);
                
                // Guardar imagen
                const imageBuffer = Buffer.from(base64Data, 'base64');
                fs.writeFileSync(uploadPath, imageBuffer);
                
                imageUrl = `/uploads/${uniqueName}`;
            }
        }
        
        // Insertar item
        const result = query(
            `INSERT INTO menu_items (restaurant_id, name, description, price, category, image_url, is_available)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                restaurantId,
                body.name,
                body.description || null,
                parseFloat(body.price),
                body.category,
                imageUrl,
                body.is_available !== undefined ? body.is_available : 1
            ]
        );
        
        // Obtener item creado
        const newItem = query('SELECT * FROM menu_items WHERE id = ?', [result.lastInsertRowid]);
        
        logger.info('Item de menú agregado', { ownerId: userId, restaurantId, itemId: result.lastInsertRowid });
        
        return {
            success: true,
            statusCode: 201,
            data: newItem[0],
            message: 'Item agregado correctamente'
        };
        
    } catch (error) {
        logger.exception(error, { action: 'addMenuItem', userId: req.user?.id });
        return {
            success: false,
            statusCode: 500,
            error: 'Error al agregar item'
        };
    }
}

/**
 * PUT /api/owner/menu/:id
 * Actualiza un item del menú
 */
async function updateMenuItem(req, itemId, body) {
    try {
        const userId = req.user.id;
        const menuItemId = parseInt(itemId);
        
        if (!menuItemId) {
            return {
                success: false,
                statusCode: 400,
                error: 'ID de item inválido'
            };
        }
        
        // Verificar que el item pertenece al restaurante del owner
        const items = query(
            `SELECT mi.id, mi.restaurant_id, mi.image_url 
             FROM menu_items mi
             JOIN restaurants r ON mi.restaurant_id = r.id
             WHERE mi.id = ? AND r.owner_id = ?`,
            [menuItemId, userId]
        );
        
        if (items.length === 0) {
            return {
                success: false,
                statusCode: 404,
                error: 'Item no encontrado o no tienes permisos'
            };
        }
        
        const item = items[0];
        
        // Validar campos si se están actualizando
        if (body.name !== undefined) {
            if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.length > 100) {
                return {
                    success: false,
                    statusCode: 400,
                    error: 'El nombre debe tener entre 2 y 100 caracteres'
                };
            }
        }
        
        if (body.price !== undefined) {
            const price = parseFloat(body.price);
            if (isNaN(price) || price <= 0 || price > 999999) {
                return {
                    success: false,
                    statusCode: 400,
                    error: 'El precio debe ser un número positivo válido'
                };
            }
        }
        
        if (body.description !== undefined && body.description && body.description.length > 500) {
            return {
                success: false,
                statusCode: 400,
                error: 'La descripción no puede exceder 500 caracteres'
            };
        }
        
        if (body.category !== undefined) {
            if (typeof body.category !== 'string' || body.category.trim().length < 2) {
                return {
                    success: false,
                    statusCode: 400,
                    error: 'La categoría es inválida'
                };
            }
        }
        
        // Procesar imagen Base64 si existe
        if (body.image) {
            const regex = /^data:image\/(jpeg|jpg|png|webp|gif);base64,(.+)$/;
            const matches = body.image.match(regex);
            
            if (matches) {
                const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
                const base64Data = matches[2];
                
                // Generar nombre único
                const uniqueName = `menu-${item.restaurant_id}-${Date.now()}.${extension}`;
                const uploadDir = path.join(__dirname, '../public/uploads');
                
                // Asegurar directorio
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }
                
                const uploadPath = path.join(uploadDir, uniqueName);
                
                // Guardar nueva imagen
                const imageBuffer = Buffer.from(base64Data, 'base64');
                fs.writeFileSync(uploadPath, imageBuffer);
                
                // Eliminar imagen anterior si existe
                if (item.image_url) {
                    const oldPath = path.join(__dirname, '../public', item.image_url.replace(/^\//, ''));
                    if (fs.existsSync(oldPath)) {
                        try {
                            fs.unlinkSync(oldPath);
                        } catch (e) {
                            logger.warn('No se pudo eliminar imagen anterior', { error: e.message });
                        }
                    }
                }
                
                body.image_url = `/uploads/${uniqueName}`;
            }
            delete body.image; // Remover campo image, usamos image_url
        }
        
        // Campos permitidos
        const allowedFields = ['name', 'description', 'price', 'category', 'image_url', 'is_available'];
        
        const updates = [];
        const values = [];
        
        allowedFields.forEach(field => {
            if (body[field] !== undefined) {
                updates.push(`${field} = ?`);
                values.push(field === 'price' ? parseFloat(body[field]) : body[field]);
            }
        });
        
        if (updates.length === 0) {
            return {
                success: false,
                statusCode: 400,
                error: 'No hay campos para actualizar'
            };
        }
        
        values.push(menuItemId);
        
        const sql = `UPDATE menu_items SET ${updates.join(', ')} WHERE id = ?`;
        query(sql, values);
        
        // Obtener item actualizado
        const updated = query('SELECT * FROM menu_items WHERE id = ?', [menuItemId]);
        
        logger.info('Item de menú actualizado', { ownerId: userId, itemId: menuItemId });
        
        return {
            success: true,
            statusCode: 200,
            data: updated[0],
            message: 'Item actualizado correctamente'
        };
        
    } catch (error) {
        logger.exception(error, { action: 'updateMenuItem', userId: req.user?.id });
        return {
            success: false,
            statusCode: 500,
            error: 'Error al actualizar item'
        };
    }
}

/**
 * DELETE /api/owner/menu/:id
 * Elimina un item del menú
 */
function deleteMenuItem(req, itemId) {
    try {
        const userId = req.user.id;
        const menuItemId = parseInt(itemId);
        
        if (!menuItemId) {
            return {
                success: false,
                statusCode: 400,
                error: 'ID de item inválido'
            };
        }
        
        // Verificar permisos
        const items = query(
            `SELECT mi.id 
             FROM menu_items mi
             JOIN restaurants r ON mi.restaurant_id = r.id
             WHERE mi.id = ? AND r.owner_id = ?`,
            [menuItemId, userId]
        );
        
        if (items.length === 0) {
            return {
                success: false,
                statusCode: 404,
                error: 'Item no encontrado o no tienes permisos'
            };
        }
        
        query('DELETE FROM menu_items WHERE id = ?', [menuItemId]);
        
        logger.info('Item de menú eliminado', { ownerId: userId, itemId: menuItemId });
        
        return {
            success: true,
            statusCode: 200,
            message: 'Item eliminado correctamente'
        };
        
    } catch (error) {
        logger.exception(error, { action: 'deleteMenuItem', userId: req.user?.id });
        return {
            success: false,
            statusCode: 500,
            error: 'Error al eliminar item'
        };
    }
}

/**
 * POST /api/owner/reviews/:reviewId/report
 * Reporta una reseña inapropiada
 */
function reportReview(req, reviewId, body) {
    try {
        const userId = req.user.id;
        const reviewIdNum = parseInt(reviewId);
        
        if (!reviewIdNum) {
            return {
                success: false,
                statusCode: 400,
                error: 'ID de reseña inválido'
            };
        }
        
        // Verificar que la reseña existe y pertenece a un restaurante del owner
        const reviews = query(
            `SELECT r.id, r.restaurant_id
             FROM reviews r
             JOIN restaurants rest ON r.restaurant_id = rest.id
             WHERE r.id = ? AND rest.owner_id = ?`,
            [reviewIdNum, userId]
        );
        
        if (reviews.length === 0) {
            return {
                success: false,
                statusCode: 404,
                error: 'Reseña no encontrada o no pertenece a tu restaurante'
            };
        }
        
        // Validar razón
        const validReasons = ['spam', 'ofensivo', 'falso', 'inapropiado', 'otro'];
        if (!body.reason || !validReasons.includes(body.reason)) {
            return {
                success: false,
                statusCode: 400,
                error: `Razón inválida. Debe ser una de: ${validReasons.join(', ')}`
            };
        }
        
        // Verificar si ya fue reportada
        const existing = query(
            'SELECT id FROM review_reports WHERE review_id = ? AND reporter_id = ?',
            [reviewIdNum, userId]
        );
        
        if (existing.length > 0) {
            return {
                success: false,
                statusCode: 400,
                error: 'Ya reportaste esta reseña'
            };
        }
        
        // Crear reporte
        const result = query(
            `INSERT INTO review_reports (review_id, reporter_id, reason, description, status)
             VALUES (?, ?, ?, ?, 'pendiente')`,
            [reviewIdNum, userId, body.reason, body.description || null]
        );
        
        logger.info('Reseña reportada', { ownerId: userId, reviewId: reviewIdNum, reason: body.reason });
        
        return {
            success: true,
            statusCode: 201,
            data: { reportId: result.lastInsertRowid },
            message: 'Reseña reportada correctamente. Un administrador la revisará'
        };
        
    } catch (error) {
        logger.exception(error, { action: 'reportReview', userId: req.user?.id });
        return {
            success: false,
            statusCode: 500,
            error: 'Error al reportar reseña'
        };
    }
}

/**
 * GET /api/owner/stats
 * Obtiene estadísticas del restaurante
 */
function getStats(req) {
    try {
        const userId = req.user.id;
        
        // Obtener restaurante
        const restaurants = query(
            'SELECT id, average_rating, total_reviews FROM restaurants WHERE owner_id = ?',
            [userId]
        );
        
        if (restaurants.length === 0) {
            return {
                success: false,
                statusCode: 404,
                error: 'No tienes un restaurante asociado'
            };
        }
        
        const restaurant = restaurants[0];
        
        // Estadísticas adicionales
        const menuCount = query(
            'SELECT COUNT(*) as total FROM menu_items WHERE restaurant_id = ?',
            [restaurant.id]
        );
        
        const ratingDistribution = query(
            `SELECT rating, COUNT(*) as count 
             FROM reviews 
             WHERE restaurant_id = ? AND is_active = 1
             GROUP BY rating
             ORDER BY rating DESC`,
            [restaurant.id]
        );
        
        const recentReviews = query(
            `SELECT r.*, u.first_name, u.last_name
             FROM reviews r
             JOIN users u ON r.user_id = u.id
             WHERE r.restaurant_id = ? AND r.is_active = 1
             ORDER BY r.created_at DESC
             LIMIT 5`,
            [restaurant.id]
        );
        
        return {
            success: true,
            statusCode: 200,
            data: {
                averageRating: restaurant.average_rating || 0,
                totalReviews: restaurant.total_reviews || 0,
                totalMenuItems: menuCount[0].total || 0,
                ratingDistribution,
                recentReviews
            }
        };
        
    } catch (error) {
        logger.exception(error, { action: 'getStats', userId: req.user?.id });
        return {
            success: false,
            statusCode: 500,
            error: 'Error al obtener estadísticas'
        };
    }
}

module.exports = {
    getMyRestaurant,
    updateRestaurant,
    updateRestaurantPhoto,
    getMenu,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    reportReview,
    getStats
};
