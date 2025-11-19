const { query } = require('../config/database');

function printAudit() {
    try {
        const rows = query(`
            SELECT aa.id, aa.action, aa.reason, aa.created_at,
                   aa.admin_id, (admin.first_name || ' ' || admin.last_name) as admin_name, admin.email as admin_email,
                   aa.target_user_id, (target.first_name || ' ' || target.last_name) as target_name, target.email as target_email
            FROM admin_audit aa
            LEFT JOIN users admin ON aa.admin_id = admin.id
            LEFT JOIN users target ON aa.target_user_id = target.id
            ORDER BY aa.created_at DESC
            LIMIT 250
        `);

        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error('Error leyendo admin_audit:', err.message);
    }
}

printAudit();
