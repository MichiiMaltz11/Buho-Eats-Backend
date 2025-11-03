-- Schema para Buho Eats Database
-- SQLite Database para sistema de reseñas de restaurantes

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'owner', 'admin')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1))
);

-- Índice para búsquedas por email
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Tabla de intentos de login (rate limiting)
CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL,
    email TEXT,
    attempt_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    success INTEGER DEFAULT 0 CHECK(success IN (0, 1))
);

-- Índice para búsquedas de intentos por IP
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address, attempt_time);
-- Índice para búsquedas de intentos por email (rate limiting combinado)
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email, attempt_time);

-- Tabla de tokens de sesión (opcional, para invalidación)
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Índice para búsqueda de sesiones
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);

-- Tabla de tokens invalidados (blacklist)
CREATE TABLE IF NOT EXISTS token_blacklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    user_id INTEGER,
    reason TEXT CHECK(reason IN ('logout', 'password_change', 'security', 'admin_revoke')),
    blacklisted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Índice para búsqueda rápida de tokens blacklisted
CREATE INDEX IF NOT EXISTS idx_blacklist_token ON token_blacklist(token_hash);
CREATE INDEX IF NOT EXISTS idx_blacklist_expires ON token_blacklist(expires_at);

-- Tabla de restaurantes
CREATE TABLE IF NOT EXISTS restaurants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    cuisine_type TEXT,
    price_range TEXT CHECK(price_range IN ('$', '$$', '$$$', '$$$$')),
    opening_hours TEXT,
    owner_id INTEGER,
    image_url TEXT,
    rating REAL DEFAULT 0.0,
    average_rating REAL DEFAULT 0.0,
    total_reviews INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Índices para restaurantes
CREATE INDEX IF NOT EXISTS idx_restaurants_owner ON restaurants(owner_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_cuisine ON restaurants(cuisine_type);

-- Tabla de reseñas
CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    comment TEXT,
    visit_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER DEFAULT 1 CHECK(is_active IN (0, 1)),
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(restaurant_id, user_id)
);

-- Índices para reseñas
CREATE INDEX IF NOT EXISTS idx_reviews_restaurant ON reviews(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);

-- Tabla de imágenes de reseñas
CREATE TABLE IF NOT EXISTS review_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
);

-- Índice para imágenes de reseñas
CREATE INDEX IF NOT EXISTS idx_review_images_review ON review_images(review_id);

-- Tabla de respuestas del dueño a reseñas
CREATE TABLE IF NOT EXISTS review_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id INTEGER NOT NULL UNIQUE,
    owner_id INTEGER NOT NULL,
    response_text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabla de elementos del menú
CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL CHECK(price >= 0),
    category TEXT CHECK(category IN ('Entrada', 'Plato Principal', 'Postre', 'Bebida', 'Otro')),
    image_url TEXT,
    is_available INTEGER DEFAULT 1 CHECK(is_available IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

-- Índice para elementos del menú por restaurante
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category);

-- Insertar usuario admin por defecto (contraseña: Admin123!)
-- Hash generado con bcrypt rounds=10
INSERT OR IGNORE INTO users (id, first_name, last_name, email, password_hash, role)
VALUES (
    1,
    'Admin',
    'Sistema',
    'admin@buhoeats.com',
    '$2b$10$rGdX8kN5Z.qVN7YXfZ5Riu8kJWxL5h3yfz9K7xY.2KYWQGfZqX0je',
    'admin'
);

-- Trigger para actualizar updated_at automáticamente en users
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger para actualizar updated_at automáticamente en restaurants
CREATE TRIGGER IF NOT EXISTS update_restaurants_timestamp 
AFTER UPDATE ON restaurants
BEGIN
    UPDATE restaurants SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger para actualizar updated_at automáticamente en menu_items
CREATE TRIGGER IF NOT EXISTS update_menu_items_timestamp 
AFTER UPDATE ON menu_items
BEGIN
    UPDATE menu_items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger para actualizar el rating promedio del restaurante
CREATE TRIGGER IF NOT EXISTS update_restaurant_rating_insert
AFTER INSERT ON reviews
BEGIN
    UPDATE restaurants
    SET 
        average_rating = (
            SELECT AVG(rating) 
            FROM reviews 
            WHERE restaurant_id = NEW.restaurant_id AND is_active = 1
        ),
        total_reviews = (
            SELECT COUNT(*) 
            FROM reviews 
            WHERE restaurant_id = NEW.restaurant_id AND is_active = 1
        )
    WHERE id = NEW.restaurant_id;
END;

CREATE TRIGGER IF NOT EXISTS update_restaurant_rating_update
AFTER UPDATE ON reviews
BEGIN
    UPDATE restaurants
    SET 
        average_rating = (
            SELECT AVG(rating) 
            FROM reviews 
            WHERE restaurant_id = NEW.restaurant_id AND is_active = 1
        ),
        total_reviews = (
            SELECT COUNT(*) 
            FROM reviews 
            WHERE restaurant_id = NEW.restaurant_id AND is_active = 1
        )
    WHERE id = NEW.restaurant_id;
END;

CREATE TRIGGER IF NOT EXISTS update_restaurant_rating_delete
AFTER DELETE ON reviews
BEGIN
    UPDATE restaurants
    SET 
        average_rating = (
            SELECT COALESCE(AVG(rating), 0) 
            FROM reviews 
            WHERE restaurant_id = OLD.restaurant_id AND is_active = 1
        ),
        total_reviews = (
            SELECT COUNT(*) 
            FROM reviews 
            WHERE restaurant_id = OLD.restaurant_id AND is_active = 1
        )
    WHERE id = OLD.restaurant_id;
END;
