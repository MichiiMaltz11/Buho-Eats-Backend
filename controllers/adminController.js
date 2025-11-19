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

        // Soft delete review and mark report as rejected
        transaction(() => {
            query('UPDATE reviews SET is_active = 0 WHERE id = ?', [report.review_id]);
            query(`UPDATE review_reports SET status = 'rechazado', resolved_at = CURRENT_TIMESTAMP, resolved_by = ? WHERE id = ?`, [req.user.id, reportId]);
            // Recompute restaurant rating
            const rev = query('SELECT restaurant_id FROM reviews WHERE id = ?', [report.review_id]);
            const restaurantId = rev[0]?.restaurant_id;
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
        const { userId } = body || {};

        const reports = query('SELECT * FROM review_reports WHERE id = ?', [reportId]);
        if (reports.length === 0) return { success: false, statusCode: 404, error: 'Reporte no encontrado' };

        const report = reports[0];
        if (report.status !== 'pendiente') return { success: false, statusCode: 400, error: 'Reporte ya fue procesado' };

        if (!userId) return { success: false, statusCode: 400, error: 'userId es requerido en el body' };

        // No aplicar strike a admins o owners
        const targetUsers = query('SELECT id, role, strikes FROM users WHERE id = ?', [userId]);
        if (targetUsers.length === 0) return { success: false, statusCode: 404, error: 'Usuario no encontrado' };

        const target = targetUsers[0];
        if (target.role === 'admin' || target.role === 'owner') {
            return { success: false, statusCode: 400, error: 'No se puede dar strike a admin/owner' };
        }

        // Transaction: delete review (soft), increment strikes, maybe ban, mark report
        transaction(() => {
            query('UPDATE reviews SET is_active = 0 WHERE id = ?', [report.review_id]);

            // Incrementar strikes
            const newStrikes = (target.strikes || 0) + 1;
            query('UPDATE users SET strikes = ? WHERE id = ?', [newStrikes, userId]);

            // Si alcanza >=3, banear usuario (is_active = 0)
            if (newStrikes >= 3) {
                query('UPDATE users SET is_active = 0 WHERE id = ?', [userId]);
            }

            query(`UPDATE review_reports SET status = 'rechazado', resolved_at = CURRENT_TIMESTAMP, resolved_by = ? WHERE id = ?`, [req.user.id, reportId]);

            // Recompute restaurant rating
            const rev = query('SELECT restaurant_id FROM reviews WHERE id = ?', [report.review_id]);
            const restaurantId = rev[0]?.restaurant_id;
            if (restaurantId) {
                const stats = query('SELECT COUNT(*) as total, COALESCE(AVG(rating),0) as avg FROM reviews WHERE restaurant_id = ? AND is_active = 1', [restaurantId]);
                query('UPDATE restaurants SET total_reviews = ?, average_rating = ? WHERE id = ?', [stats[0].total, stats[0].avg, restaurantId]);
            }
        });

        return { success: true, statusCode: 200, data: { message: 'Reseña eliminada, strike aplicado' } };

    } catch (error) {
        logger.exception(error, { action: 'rejectWithStrike', reportId });
        return { success: false, statusCode: 500, error: 'Error al rechazar con strike' };
    }
}

module.exports = {
    getReports,
    approveReport,
    rejectReview,
    rejectWithStrike
};
