const { query } = require('../config/database');

function printRestaurants() {
    try {
        const rows = query(`
            SELECT rest.id, rest.name, rest.description, rest.address, rest.cuisine_type, rest.price_range,
                   rest.image_url, rest.average_rating, rest.total_reviews, rest.is_active,
                   u.id as owner_id, u.first_name || ' ' || u.last_name as owner_name, u.email as owner_email
            FROM restaurants rest
            LEFT JOIN users u ON rest.owner_id = u.id
            ORDER BY rest.created_at DESC
            LIMIT 100
        `);

        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error('Error leyendo restaurantes:', err.message);
    }
}

printRestaurants();
