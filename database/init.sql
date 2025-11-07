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
    profile_photo TEXT,
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
    address TEXT NOT NULL,
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

-- Tabla de favoritos de usuarios
CREATE TABLE IF NOT EXISTS user_favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    restaurant_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    UNIQUE(user_id, restaurant_id)
);

-- Índices para favoritos
CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_restaurant ON user_favorites(restaurant_id);

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

-- ========================================
-- DATOS DE DEMOSTRACIÓN
-- ========================================

-- Insertar usuario owner de prueba (contraseña: Admin123!)
INSERT OR IGNORE INTO users (id, first_name, last_name, email, password_hash, role)
VALUES 
    (2, 'Marco', 'Rossi', 'owner@buhoeats.com', '$2b$10$rGdX8kN5Z.qVN7YXfZ5Riu8kJWxL5h3yfz9K7xY.2KYWQGfZqX0je', 'owner');

-- Insertar restaurantes de demostración (con imágenes locales)
-- Todos pertenecen al owner_id 2
INSERT OR IGNORE INTO restaurants (id, name, description, address, phone, email, cuisine_type, price_range, opening_hours, owner_id, image_url)
VALUES 
    (1, 'La Bella Notte', 'Auténtica cocina italiana con recetas tradicionales de la Toscana. Ambiente acogedor y romántico perfecto para cenas especiales.', 'Av. Revolución 1234, Col. Centro', '555-0101', 'info@labellanotte.com', 'Italiana', '$$$', 'Lun-Dom: 13:00-23:00', 2, '/assets/img/restaurants/default/italian-1.jpg'),
    
    (2, 'Burger Paradise', 'Las mejores hamburguesas gourmet de la ciudad. Carne 100% Angus, pan artesanal y ingredientes frescos.', 'Calle Juárez 567, Col. Americana', '555-0102', 'contact@burgerparadise.com', 'Americana', '$$', 'Lun-Dom: 12:00-22:00', 2, '/assets/img/restaurants/default/burger-1.jpg'),
    
    (3, 'Pizza Napoletana', 'Pizza al estilo napolitano con horno de leña. Masa fermentada 48 horas y ingredientes importados de Italia.', 'Av. Chapultepec 890, Col. Juárez', '555-0103', 'hola@pizzanapoli.com', 'Italiana', '$$', 'Mar-Dom: 13:00-23:00', 2, '/assets/img/restaurants/default/pizza-1.jpg'),
    
    (4, 'Sushi Master', 'Sushi y sashimi preparado por chef japonés con 20 años de experiencia. Pescado fresco diariamente.', 'Av. Insurgentes 2341, Col. Del Valle', '555-0104', 'reservas@sushimaster.com', 'Japonesa', '$$$', 'Lun-Sáb: 13:00-22:30', 2, '/assets/img/restaurants/default/sushi-1.jpg'),
    
    (5, 'Taquería El Güero', 'Tacos al pastor, carnitas y más. Recetas familiares transmitidas por generaciones.', 'Calle Morelos 123, Col. Centro', '555-0105', 'elguero@tacos.com', 'Mexicana', '$', 'Lun-Dom: 10:00-23:00', 2, '/assets/img/restaurants/default/mexican-1.jpg');

-- Insertar menú para "La Bella Notte" (Restaurante ID 1)
-- 2 platos por categoría
INSERT OR IGNORE INTO menu_items (restaurant_id, name, description, price, category, image_url)
VALUES 
    -- ENTRADAS
    (1, 'Bruschetta al Pomodoro', 'Pan tostado con tomates frescos, albahaca, ajo y aceite de oliva extra virgen', 89.00, 'Entrada', '/assets/img/menu/bruschetta.jpg'),
    (1, 'Insalata Caprese', 'Tomate, mozzarella di bufala, albahaca fresca y reducción de balsámico', 125.00, 'Entrada', '/assets/img/menu/caprese.jpg'),
    
    -- PLATOS PRINCIPALES
    (1, 'Spaghetti alla Carbonara', 'Pasta con pancetta, huevo, pecorino romano y pimienta negra', 185.00, 'Plato Principal', '/assets/img/menu/pasta-carbonara.jpg'),
    (1, 'Lasagna alla Bolognese', 'Lasagna casera con ragú de carne, bechamel y parmesano', 195.00, 'Plato Principal', '/assets/img/menu/lasagna.jpg'),
    
    -- POSTRES
    (1, 'Tiramisù Classico', 'El auténtico postre italiano con café, mascarpone y cacao', 95.00, 'Postre', '/assets/img/menu/tiramisu.jpg'),
    (1, 'Panna Cotta ai Frutti di Bosco', 'Crema de vainilla con coulis de frutos rojos', 85.00, 'Postre', '/assets/img/menu/panna-cotta.jpg'),
    
    -- BEBIDAS
    (1, 'Espresso Italiano', 'Café espresso preparado con granos importados de Italia', 45.00, 'Bebida', '/assets/img/menu/espresso.jpg'),
    (1, 'Vino Tinto de la Casa', 'Chianti Classico DOCG (copa)', 95.00, 'Bebida', '/assets/img/menu/wine.jpg');
