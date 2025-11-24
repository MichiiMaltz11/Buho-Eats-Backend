-- ========================================
-- MIGRACIÓN: Agregar tablas y columnas para Owner y Admin
-- ========================================

-- 1. Agregar columna 'strikes' a la tabla users
ALTER TABLE users ADD COLUMN strikes INTEGER DEFAULT 0;

-- 2. Crear tabla de reportes de reseñas (para que owners reporten y admin modere)
CREATE TABLE IF NOT EXISTS review_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id INTEGER NOT NULL,
    reporter_id INTEGER NOT NULL,
    reason TEXT NOT NULL CHECK(reason IN ('spam', 'ofensivo', 'falso', 'inapropiado', 'otro')),
    description TEXT,
    status TEXT DEFAULT 'pendiente' CHECK(status IN ('pendiente', 'aprobado', 'rechazado')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    resolved_by INTEGER,
    FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Índices para review_reports
CREATE INDEX IF NOT EXISTS idx_review_reports_review ON review_reports(review_id);
CREATE INDEX IF NOT EXISTS idx_review_reports_reporter ON review_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_review_reports_status ON review_reports(status);

-- 3. Crear tabla de auditoría de admin (opcional pero útil)
CREATE TABLE IF NOT EXISTS admin_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER,
    action TEXT NOT NULL,
    target_user_id INTEGER,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Índices para admin_audit
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit(target_user_id);

-- 4. Agregar columna is_active a reviews si no existe (para soft delete)
-- Ya debería existir en init.sql, pero por si acaso
-- ALTER TABLE reviews ADD COLUMN is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1));

-- ========================================
-- INSERTAR USUARIO ADMIN DE PRUEBA
-- ========================================
-- Contraseña: Admin123!
-- Hash generado con bcrypt
INSERT OR IGNORE INTO users (id, first_name, last_name, email, password_hash, role, strikes, is_active)
VALUES (1, 'Admin', 'Sistema', 'admin@buhoeats.com', '$2b$10$rGdX8kN5Z.qVN7YXfZ5Riu8kJWxL5h3yfz9K7xY.2KYWQGfZqX0je', 'admin', 0, 1);

-- ========================================
-- COMPLETADO
-- ========================================
