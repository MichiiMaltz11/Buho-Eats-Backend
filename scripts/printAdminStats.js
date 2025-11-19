const { query } = require('../config/database');

function printStats() {
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

        console.log(JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error obteniendo estadísticas:', err.message);
    }
}

printStats();
