/**
 * Controlador de Reseñas
 * Maneja CRUD de reseñas de restaurantes
 */

const { query } = require('../config/database');
const { validateRequired, validateRange } = require('../utils/validator');
const logger = require('../utils/logger');

/**
 * Crear una nueva reseña
 * POST /api/reviews
 */
function createReview(req, body) {
    try {
        const { restaurantId, rating, comment, visitDate } = body;

        // Validaciones
        if (!restaurantId || typeof restaurantId !== 'number') {
            return {
                success: false,
                statusCode: 400,
                error: 'ID del restaurante es requerido y debe ser un número'
            };
        }

        const ratingValidation = validateRange(rating, 1, 5, 'Calificación');
        if (!ratingValidation.isValid) {
            return {
                success: false,
                statusCode: 400,
                error: ratingValidation.error
            };
        }

        if (!comment || comment.trim().length === 0) {
            return {
                success: false,
                statusCode: 400,
                error: 'El comentario es requerido'
            };
        }

        if (comment.length > 1000) {
            return {
                success: false,
                statusCode: 400,
                error: 'El comentario no puede exceder 1000 caracteres'
            };
        }

        // Verificar que el restaurante existe
        const restaurants = query('SELECT id FROM restaurants WHERE id = ? AND is_active = 1', [restaurantId]);
        if (restaurants.length === 0) {
            return {
                success: false,
                statusCode: 404,
                error: 'Restaurante no encontrado'
            };
        }

        // Verificar si el usuario ya tiene una reseña para este restaurante
        const existingReview = query(
            'SELECT id FROM reviews WHERE restaurant_id = ? AND user_id = ? AND is_active = 1',
            [restaurantId, req.user.id]
        );

        if (existingReview.length > 0) {
            // Actualizar reseña existente en lugar de crear una nueva
            query(`
                UPDATE reviews 
                SET rating = ?, 
                    comment = ?, 
                    visit_date = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [rating, comment, visitDate || null, existingReview[0].id]);

            // Recalcular rating promedio
            updateRestaurantRating(restaurantId);

            return {
                success: true,
                statusCode: 200,
                data: { 
                    message: 'Reseña actualizada exitosamente',
                    reviewId: existingReview[0].id
                }
            };
        }

        // Crear nueva reseña
        const result = query(`
            INSERT INTO reviews (restaurant_id, user_id, rating, comment, visit_date)
            VALUES (?, ?, ?, ?, ?)
        `, [restaurantId, req.user.id, rating, comment, visitDate || null]);

        const reviewId = result.lastInsertRowid;

        // Actualizar el rating promedio y total de reseñas del restaurante
        updateRestaurantRating(restaurantId);

        return {
            success: true,
            statusCode: 201,
            data: { 
                message: 'Reseña creada exitosamente',
                reviewId 
            }
        };

    } catch (error) {
        logger.exception(error, { action: 'createReview' });
        return {
            success: false,
            statusCode: 500,
            error: 'Error al crear reseña'
        };
    }
}

/**
 * Obtener reseñas de un restaurante
 * GET /api/reviews?restaurantId=X
 */
function getReviews(req) {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const restaurantId = url.searchParams.get('restaurantId');
        const limit = parseInt(url.searchParams.get('limit')) || 50;
        const offset = parseInt(url.searchParams.get('offset')) || 0;

        if (!restaurantId) {
            return {
                success: false,
                statusCode: 400,
                error: 'restaurantId es requerido'
            };
        }

        const reviews = query(`
            SELECT 
                r.id,
                r.rating,
                r.comment,
                r.visit_date,
                r.created_at,
                r.updated_at,
                u.first_name,
                u.last_name,
                u.profile_photo
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            WHERE r.restaurant_id = ? AND r.is_active = 1
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
        `, [restaurantId, limit, offset]);

        // Contar total de reseñas
        const totalResult = query(
            'SELECT COUNT(*) as total FROM reviews WHERE restaurant_id = ? AND is_active = 1',
            [restaurantId]
        );
        const total = totalResult[0]?.total || 0;

        logger.info('Reseñas obtenidas', { restaurantId, count: reviews.length });

        return {
            success: true,
            statusCode: 200,
            data: {
                reviews,
                pagination: {
                    total,
                    limit,
                    offset,
                    hasMore: offset + limit < total
                }
            }
        };

    } catch (error) {
        logger.exception(error, { action: 'getReviews' });
        return {
            success: false,
            statusCode: 500,
            error: 'Error al obtener reseñas'
        };
    }
}

/**
 * Actualizar una reseña existente
 * PUT /api/reviews/:id
 */
function updateReview(req, id, body) {
    try {
        const { rating, comment, visitDate } = body;

        // Verificar que la reseña existe y pertenece al usuario
        const reviews = query(
            'SELECT * FROM reviews WHERE id = ? AND is_active = 1',
            [id]
        );

        if (reviews.length === 0) {
            return {
                success: false,
                statusCode: 404,
                error: 'Reseña no encontrada'
            };
        }

        const review = reviews[0];

        // Verificar que el usuario es el dueño de la reseña
        if (review.user_id !== req.user.id) {
            return {
                success: false,
                statusCode: 403,
                error: 'No tienes permisos para editar esta reseña'
            };
        }

        // Validaciones
        if (rating !== undefined) {
            const ratingValidation = validateRange(rating, 1, 5, 'Calificación');
            if (!ratingValidation.isValid) {
                return {
                    success: false,
                    statusCode: 400,
                    error: ratingValidation.error
                };
            }
        }

        if (comment !== undefined && comment.length > 1000) {
            return {
                success: false,
                statusCode: 400,
                error: 'El comentario no puede exceder 1000 caracteres'
            };
        }

        // Actualizar reseña
        query(`
            UPDATE reviews 
            SET rating = COALESCE(?, rating),
                comment = COALESCE(?, comment),
                visit_date = COALESCE(?, visit_date),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [rating, comment, visitDate, id]);

        logger.info('Reseña actualizada', { reviewId: id, userId: req.user.id });

        // Recalcular rating del restaurante
        updateRestaurantRating(review.restaurant_id);

        return {
            success: true,
            statusCode: 200,
            data: { message: 'Reseña actualizada exitosamente' }
        };

    } catch (error) {
        logger.exception(error, { action: 'updateReview', id });
        return {
            success: false,
            statusCode: 500,
            error: 'Error al actualizar reseña'
        };
    }
}

/**
 * Eliminar una reseña (soft delete)
 * DELETE /api/reviews/:id
 */
function deleteReview(req, id) {
    try {
        // Verificar que la reseña existe
        const reviews = query('SELECT * FROM reviews WHERE id = ? AND is_active = 1', [id]);

        if (reviews.length === 0) {
            return {
                success: false,
                statusCode: 404,
                error: 'Reseña no encontrada'
            };
        }

        const review = reviews[0];

        // Verificar permisos (solo el dueño o admin)
        if (req.user.role !== 'admin' && review.user_id !== req.user.id) {
            return {
                success: false,
                statusCode: 403,
                error: 'No tienes permisos para eliminar esta reseña'
            };
        }

        // Soft delete
        query('UPDATE reviews SET is_active = 0 WHERE id = ?', [id]);

        logger.info('Reseña eliminada', { reviewId: id, userId: req.user.id });

        // Recalcular rating del restaurante
        updateRestaurantRating(review.restaurant_id);

        return {
            success: true,
            statusCode: 200,
            data: { message: 'Reseña eliminada exitosamente' }
        };

    } catch (error) {
        logger.exception(error, { action: 'deleteReview', id });
        return {
            success: false,
            statusCode: 500,
            error: 'Error al eliminar reseña'
        };
    }
}

/**
 * Función auxiliar para actualizar el rating promedio de un restaurante
 */
function updateRestaurantRating(restaurantId) {
    try {
        const stats = query(`
            SELECT 
                COUNT(*) as total_reviews,
                AVG(rating) as average_rating
            FROM reviews 
            WHERE restaurant_id = ? AND is_active = 1
        `, [restaurantId]);

        const totalReviews = stats[0]?.total_reviews || 0;
        const averageRating = stats[0]?.average_rating || 0;

        query(`
            UPDATE restaurants 
            SET total_reviews = ?,
                average_rating = ?
            WHERE id = ?
        `, [totalReviews, averageRating, restaurantId]);

        logger.info('Rating actualizado', { restaurantId, totalReviews, averageRating });

    } catch (error) {
        logger.exception(error, { action: 'updateRestaurantRating', restaurantId });
    }
}

module.exports = {
    createReview,
    getReviews,
    updateReview,
    deleteReview
};
