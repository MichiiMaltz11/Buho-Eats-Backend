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

-- Tabla de restaurantes
CREATE TABLE IF NOT EXISTS restaurants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    address TEXT,
    phone TEXT,
    cuisine_type TEXT,
    price_range TEXT CHECK(price_range IN ('$', '$$', '$$$', '$$$$')),
    owner_id INTEGER,
    image_url TEXT,
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
