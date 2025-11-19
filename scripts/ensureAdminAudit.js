const { query } = require('../config/database');

function ensureTable() {
    try {
        query(`
            CREATE TABLE IF NOT EXISTS admin_audit (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_id INTEGER,
                action TEXT NOT NULL CHECK(action IN ('ban','unban')),
                target_user_id INTEGER NOT NULL,
                reason TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        query('CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit(admin_id)');
        query('CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit(target_user_id)');

        console.log('Tabla admin_audit asegurada.');
    } catch (err) {
        console.error('Error creando tabla admin_audit:', err.message);
        process.exit(1);
    }
}

ensureTable();
