/**
 * Controlador de Admin
 * Maneja review_reports: listar, aprobar, rechazar (con o sin strike)
 */

const { query, transaction } = require('../config/database');
const logger = require('../utils/logger');

/**
 * GET /api/admin/reports?status=pendiente&page=1&limit=10
 */
function getReports(req) {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const status = url.searchParams.get('status') || 'pendiente';
        const page = parseInt(url.searchParams.get('page')) || 1;
        const limit = parseInt(url.searchParams.get('limit')) || 20;
        const offset = (page - 1) * limit;

        const reports = query(`
            SELECT rr.id as report_id, rr.reason, rr.description, rr.status, rr.created_at,
                   u.id as reporter_id, u.first_name as reporter_first, u.last_name as reporter_last, u.email as reporter_email,
                   r.id as review_id, r.rating as review_rating, r.comment as review_comment, r.user_id as review_user_id,
                   rest.id as restaurant_id, rest.name as restaurant_name
            FROM review_reports rr
            JOIN users u ON rr.reporter_id = u.id
            JOIN reviews r ON rr.review_id = r.id
            JOIN restaurants rest ON r.restaurant_id = rest.id
            WHERE rr.status = ?
            ORDER BY rr.created_at DESC
            LIMIT ? OFFSET ?
        `, [status, limit, offset]);

        const totalResult = query('SELECT COUNT(*) as total FROM review_reports WHERE status = ?', [status]);
        const total = totalResult[0]?.total || 0;

        return {
            success: true,
            statusCode: 200,
            data: {
                data: reports,
                total,
                page,
                pages: Math.ceil(total / limit)
            }
        };

    } catch (error) {
        logger.exception(error, { action: 'getReports' });
        return { success: false, statusCode: 500, error: 'Error al obtener reportes' };
    }
}

/**
 * POST /api/admin/reports/:reportId/approve
 */
function approveReport(req, reportId) {
    try {
        // Verificar reporte
        const reports = query('SELECT * FROM review_reports WHERE id = ?', [reportId]);
        if (reports.length === 0) return { success: false, statusCode: 404, error: 'Reporte no encontrado' };

        const report = reports[0];
        if (report.status !== 'pendiente') return { success: false, statusCode: 400, error: 'Reporte ya fue procesado' };

        // Verificar que la review exista
        const revRows = query('SELECT id, is_active FROM reviews WHERE id = ?', [report.review_id]);
        if (revRows.length === 0) return { success: false, statusCode: 404, error: 'Reseña asociada no encontrada' };

        // No hacer nada más que marcar como aprobado (la política puede ser que el admin sólo marque)
        query(`UPDATE review_reports SET status = 'aprobado', resolved_at = CURRENT_TIMESTAMP, resolved_by = ? WHERE id = ?`, [req.user.id, reportId]);

        return { success: true, statusCode: 200, data: { message: 'Reporte aprobado' } };

    } catch (error) {
        logger.exception(error, { action: 'approveReport', reportId });
        return { success: false, statusCode: 500, error: 'Error al aprobar reporte' };
    }
}

/**
 * POST /api/admin/reports/:reportId/reject-review
 * Elimina la reseña y marca reporte como rechazado (sin strike)
 */
function rejectReview(req, reportId) {
    try {
        const reports = query('SELECT * FROM review_reports WHERE id = ?', [reportId]);
        if (reports.length === 0) return { success: false, statusCode: 404, error: 'Reporte no encontrado' };

        const report = reports[0];
        if (report.status !== 'pendiente') return { success: false, statusCode: 400, error: 'Reporte ya fue procesado' };

        // Verificar que la review exista y su estado
        const revRows = query('SELECT id, user_id, restaurant_id, is_active FROM reviews WHERE id = ?', [report.review_id]);
        if (revRows.length === 0) return { success: false, statusCode: 404, error: 'Reseña asociada no encontrada' };
        const review = revRows[0];

        if (review.is_active === 0) {
            // Si la reseña ya estaba inactiva, solamente marcar el reporte
            query(`UPDATE review_reports SET status = 'rechazado', resolved_at = CURRENT_TIMESTAMP, resolved_by = ? WHERE id = ?`, [req.user.id, reportId]);
            return { success: true, statusCode: 200, data: { message: 'Reporte marcado como rechazado (reseña ya inactiva)' } };
        }

        // Hard delete de la review y marca reporte como rechazado
        transaction(() => {
            query('DELETE FROM reviews WHERE id = ?', [report.review_id]);
            query(`UPDATE review_reports SET status = 'rechazado', resolved_at = CURRENT_TIMESTAMP, resolved_by = ? WHERE id = ?`, [req.user.id, reportId]);
            // Recalcula el restaurant rating (ahora cuenta solo las activas que quedan)
            const restaurantId = review.restaurant_id;
            if (restaurantId) {
                const stats = query('SELECT COUNT(*) as total, COALESCE(AVG(rating),0) as avg FROM reviews WHERE restaurant_id = ? AND is_active = 1', [restaurantId]);
                query('UPDATE restaurants SET total_reviews = ?, average_rating = ? WHERE id = ?', [stats[0].total, stats[0].avg, restaurantId]);
            }
        });

        return { success: true, statusCode: 200, data: { message: 'Reseña eliminada y reporte marcado como rechazado' } };

    } catch (error) {
        logger.exception(error, { action: 'rejectReview', reportId });
        return { success: false, statusCode: 500, error: 'Error al rechazar reporte y eliminar reseña' };
    }
}

/**
 * POST /api/admin/reports/:reportId/reject-with-strike
 * Body: { userId }
 */
function rejectWithStrike(req, reportId, body) {
    try {
        // Permitir pasar userId en body, pero si no está, derivarlo desde la review
        const { userId: bodyUserId } = body || {};

        const reports = query('SELECT * FROM review_reports WHERE id = ?', [reportId]);
        if (reports.length === 0) return { success: false, statusCode: 404, error: 'Reporte no encontrado' };

        const report = reports[0];
        if (report.status !== 'pendiente') return { success: false, statusCode: 400, error: 'Reporte ya fue procesado' };

        // Verificar que la review exista
        const revRows = query('SELECT id, user_id, restaurant_id, is_active FROM reviews WHERE id = ?', [report.review_id]);
        if (revRows.length === 0) return { success: false, statusCode: 404, error: 'Reseña asociada no encontrada' };
        const review = revRows[0];

        const targetId = bodyUserId || review.user_id;
        if (!targetId) return { success: false, statusCode: 400, error: 'No se pudo determinar usuario objetivo' };

        // Obtener usuario objetivo
        const targetUsers = query('SELECT id, role, strikes FROM users WHERE id = ?', [targetId]);
        if (targetUsers.length === 0) return { success: false, statusCode: 404, error: 'Usuario no encontrado' };

        const target = targetUsers[0];

        // No aplicar strike a admins
        if (target.role === 'admin') {
            return { success: false, statusCode: 400, error: 'No se puede dar strike a admin' };
        }

        // No aplicar strike al owner del restaurante si el review.user_id es el owner of the restaurant
        const restaurant = query('SELECT owner_id FROM restaurants WHERE id = ?', [review.restaurant_id]);
        const ownerId = restaurant[0]?.owner_id;
        if (ownerId && target.id === ownerId) {
            return { success: false, statusCode: 400, error: 'No se puede dar strike al propietario del restaurante' };
        }

        // Si la reseña ya está inactiva, solo marcar reporte
        if (review.is_active === 0) {
            query(`UPDATE review_reports SET status = 'rechazado', resolved_at = CURRENT_TIMESTAMP, resolved_by = ? WHERE id = ?`, [req.user.id, reportId]);
            return { success: true, statusCode: 200, data: { message: 'Reporte marcado como rechazado (reseña ya inactiva)' } };
        }

        // Transaction: elimina review permanentemente, incrementa strikes, quiza ban, marca reporte
        transaction(() => {
            query('DELETE FROM reviews WHERE id = ?', [report.review_id]);

            // Incrementar strikes
            const newStrikes = (target.strikes || 0) + 1;
            query('UPDATE users SET strikes = ? WHERE id = ?', [newStrikes, target.id]);

            // Si alcanza >=3, banear usuario (is_active = 0) y eliminar todas sus reseñas
            if (newStrikes >= 3) {
                query('UPDATE users SET is_active = 0 WHERE id = ?', [target.id]);
                query('DELETE FROM reviews WHERE user_id = ?', [target.id]);
            }

            query(`UPDATE review_reports SET status = 'rechazado', resolved_at = CURRENT_TIMESTAMP, resolved_by = ? WHERE id = ?`, [req.user.id, reportId]);

            // Recalcula el restaurant rating
            const restaurantId = review.restaurant_id;
            if (restaurantId) {
                const stats = query('SELECT COUNT(*) as total, COALESCE(AVG(rating),0) as avg FROM reviews WHERE restaurant_id = ? AND is_active = 1', [restaurantId]);
                query('UPDATE restaurants SET total_reviews = ?, average_rating = ? WHERE id = ?', [stats[0].total, stats[0].avg, restaurantId]);
            }
        });

        return { success: true, statusCode: 200, data: { message: 'Reseña eliminada, strike aplicado', strikes: (target.strikes || 0) + 1 } };

    } catch (error) {
        logger.exception(error, { action: 'rejectWithStrike', reportId });
        return { success: false, statusCode: 500, error: 'Error al rechazar con strike' };
    }
}

/**
 * GET /api/admin/users?page=1&limit=20&search=&filter=
 * filter: all|banned|with-strikes
 */
function getUsers(req) {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const page = parseInt(url.searchParams.get('page')) || 1;
        const limit = parseInt(url.searchParams.get('limit')) || 20;
        const offset = (page - 1) * limit;
        const search = (url.searchParams.get('search') || '').trim();
        const filter = url.searchParams.get('filter') || 'all';

        const where = [];
        const params = [];

        if (filter === 'banned') {
            where.push('is_active = 0');
        } else if (filter === 'with-strikes') {
            where.push('strikes > 0');
        }

        if (search) {
            where.push("(first_name || ' ' || last_name LIKE ? OR email LIKE ?)");
            params.push(`%${search}%`, `%${search}%`);
        }

        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const users = query(
            `SELECT id, first_name, last_name, email, role, strikes, is_active, created_at FROM users ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        const totalRes = query(`SELECT COUNT(*) as total FROM users ${whereSql}`, params);
        const total = totalRes[0]?.total || 0;

        return {
            success: true,
            statusCode: 200,
            data: {
                data: users,
                total,
                page,
                pages: Math.ceil(total / limit)
            }
        };

    } catch (error) {
        logger.exception(error, { action: 'getUsers' });
        return { success: false, statusCode: 500, error: 'Error al obtener usuarios' };
    }
}

/**
 * GET /api/admin/stats
 * Devuelve estadísticas generales del sistema
 */
function getStats(req) {
    try {
        const totalUsersRes = query('SELECT COUNT(*) as total FROM users');
        const totalRestaurantsRes = query('SELECT COUNT(*) as total FROM restaurants');
        const totalReviewsRes = query("SELECT COUNT(*) as total FROM reviews WHERE is_active = 1");
        const pendingReportsRes = query("SELECT COUNT(*) as total FROM review_reports WHERE status = 'pendiente'");
        const bannedUsersRes = query('SELECT COUNT(*) as total FROM users WHERE is_active = 0');

        const data = {
            totalUsers: totalUsersRes[0]?.total || 0,
            totalRestaurants: totalRestaurantsRes[0]?.total || 0,
            totalReviews: totalReviewsRes[0]?.total || 0,
            pendingReports: pendingReportsRes[0]?.total || 0,
            bannedUsers: bannedUsersRes[0]?.total || 0
        };

        return { success: true, statusCode: 200, data };

    } catch (error) {
        logger.exception(error, { action: 'getStats' });
        return { success: false, statusCode: 500, error: 'Error al obtener estadísticas' };
    }
}

/**
 * GET /api/admin/restaurants?page=1&limit=20&search=&ownerId=
 * Devuelve lista de restaurantes con owner y estadísticas básicas
 */
function getRestaurants(req) {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const page = parseInt(url.searchParams.get('page')) || 1;
        const limit = parseInt(url.searchParams.get('limit')) || 20;
        const offset = (page - 1) * limit;
        const search = (url.searchParams.get('search') || '').trim();
        const ownerId = url.searchParams.get('ownerId');

        const where = [];
        const params = [];

        if (ownerId) {
            where.push('rest.owner_id = ?');
            params.push(ownerId);
        }

        if (search) {
            where.push('(rest.name LIKE ? OR rest.cuisine_type LIKE ? OR rest.address LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        // Seleccionamos campos del restaurante, owner y las estadísticas ya guardadas
        const rows = query(
            `SELECT rest.id, rest.name, rest.description, rest.address, rest.cuisine_type, rest.price_range,
                    rest.image_url, rest.rating, rest.average_rating, rest.total_reviews, rest.is_active,
                    rest.created_at, rest.updated_at,
                    u.id as owner_id, u.first_name as owner_first, u.last_name as owner_last, u.email as owner_email
             FROM restaurants rest
             LEFT JOIN users u ON rest.owner_id = u.id
             ${whereSql}
             ORDER BY rest.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        const totalRes = query(`SELECT COUNT(*) as total FROM restaurants rest ${whereSql}`, params);
        const total = totalRes[0]?.total || 0;

        return {
            success: true,
            statusCode: 200,
            data: {
                data: rows,
                total,
                page,
                pages: Math.ceil(total / limit)
            }
        };

    } catch (error) {
        logger.exception(error, { action: 'getRestaurants' });
        return { success: false, statusCode: 500, error: 'Error al obtener restaurantes' };
    }
}

    /**
     * POST /api/admin/users/:userId/ban
     * Body: { reason }
     * Acción: desactiva usuario y opcionalmente elimina sus reseñas (soft delete). No permite banear admins.
     */
    function banUser(req, userId, body) {
        try {
            const targetId = parseInt(userId, 10);
            if (!targetId) return { success: false, statusCode: 400, error: 'userId inválido' };

            // No permitir que un admin se auto-banee
            if (req.user && req.user.id === targetId) return { success: false, statusCode: 400, error: 'No puedes banear tu propia cuenta' };

            const users = query('SELECT id, role, is_active FROM users WHERE id = ?', [targetId]);
            if (users.length === 0) return { success: false, statusCode: 404, error: 'Usuario no encontrado' };

            const target = users[0];
            if (target.role === 'admin') return { success: false, statusCode: 400, error: 'No se puede banear a otro admin' };

            // Realizar baneo en transacción: desactivar usuario, establecer strikes a 3, eliminar reseñas permanentemente
            transaction(() => {
                query('UPDATE users SET is_active = 0, strikes = 3 WHERE id = ?', [targetId]);
                // Hard delete para evitar problemas de UNIQUE constraint al reactivar
                query('DELETE FROM reviews WHERE user_id = ?', [targetId]);
                
                // Si es owner, desactivar también su restaurante
                if (target.role === 'owner') {
                    query('UPDATE restaurants SET is_active = 0 WHERE owner_id = ?', [targetId]);
                }
                // Insertar registro de auditoría
                try {
                    query(`INSERT INTO admin_audit (admin_id, action, target_user_id, reason) VALUES (?, 'ban', ?, ?)` , [req.user?.id || null, targetId, body?.reason || null]);
                } catch (e) {
                    // Si la tabla no existe, ignorar y continuar (se creará con el script de migración)
                    logger.warn('admin_audit insert fallo (tabla puede no existir)', { error: e.message });
                }
            });

            logger.info('Usuario baneado manualmente', { adminId: req.user?.id, targetId });

            return { success: true, statusCode: 200, data: { message: 'Usuario baneado correctamente', userId: targetId } };
        } catch (error) {
            logger.exception(error, { action: 'banUser', userId });
            return { success: false, statusCode: 500, error: 'Error al banear usuario' };
        }
    }


    /**
     * POST /api/admin/users/:userId/unban
     * Body: { resetStrikes: boolean }
     * Acción: reactiva usuario y opcionalmente resetea strikes
     */
    function unbanUser(req, userId, body) {
        try {
            const targetId = parseInt(userId, 10);
            if (!targetId) return { success: false, statusCode: 400, error: 'userId inválido' };

            const users = query('SELECT id, role, is_active, strikes FROM users WHERE id = ?', [targetId]);
            if (users.length === 0) return { success: false, statusCode: 404, error: 'Usuario no encontrado' };

            const target = users[0];
            if (target.role === 'admin') return { success: false, statusCode: 400, error: 'Este usuario es admin' };

            const resetStrikes = body && body.resetStrikes === true;

            // Actualizar estado del usuario en una transacción
            transaction(() => {
                if (resetStrikes) {
                    query('UPDATE users SET is_active = 1, strikes = 0 WHERE id = ?', [targetId]);
                } else {
                    query('UPDATE users SET is_active = 1 WHERE id = ?', [targetId]);
                }
                
                // Si es propietario, reactivar su restaurante también
                if (target.role === 'owner') {
                    query('UPDATE restaurants SET is_active = 1 WHERE owner_id = ?', [targetId]);
                }
            });

            // Opcional: reactivar reseñas requiere política; por ahora no se reactiva automáticamente
            try {
                const reason = resetStrikes ? 'unban_reset_strikes' : 'unban';
                query(`INSERT INTO admin_audit (admin_id, action, target_user_id, reason) VALUES (?, 'unban', ?, ?)` , [req.user?.id || null, targetId, reason]);
            } catch (e) {
                logger.warn('admin_audit insert fallo (tabla puede no existir)', { error: e.message });
            }

            logger.info('Usuario desbaneado manualmente', { adminId: req.user?.id, targetId, resetStrikes });

            return { success: true, statusCode: 200, data: { message: 'Usuario reactivado correctamente', userId: targetId } };
        } catch (error) {
            logger.exception(error, { action: 'unbanUser', userId });
            return { success: false, statusCode: 500, error: 'Error al reactivar usuario' };
        }
    }

module.exports = {
    getReports,
    approveReport,
    rejectReview,
    rejectWithStrike,
    getUsers,
    getStats,
    getRestaurants,
    banUser,
    unbanUser
};

