const { query } = require('../config/database');

function print() {
    try {
        const rows = query(`
            SELECT rr.id as report_id, rr.review_id, rr.reporter_id, rr.reason, rr.description, rr.status, rr.created_at,
                   r.user_id as review_user_id, r.is_active as review_active, r.restaurant_id,
                   u.first_name || ' ' || u.last_name as reporter_name,
                   author.first_name || ' ' || author.last_name as review_author_name,
                   rest.name as restaurant_name
            FROM review_reports rr
            LEFT JOIN reviews r ON rr.review_id = r.id
            LEFT JOIN users u ON rr.reporter_id = u.id
            LEFT JOIN users author ON r.user_id = author.id
            LEFT JOIN restaurants rest ON r.restaurant_id = rest.id
            ORDER BY rr.created_at DESC
        `);

        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error('Error leyendo reportes:', err.message);
    }
}

print();
