/**
 * Script de Prueba de la API
 * Prueba los endpoints de autenticación
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

/**
 * Hace una petición HTTP
 */
function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'http://localhost:8000'
            }
        };

        const req = http.request(options, (res) => {
            let body = '';

            res.on('data', (chunk) => {
                body += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonBody = JSON.parse(body);
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: jsonBody
                    });
                } catch (error) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: body
                    });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

/**
 * Tests
 */
async function runTests() {
    console.log('\n🧪 Iniciando pruebas de la API...\n');
    let testToken = null;

    try {
        // Test 1: Registro de usuario
        console.log('📝 Test 1: Registro de usuario nuevo');
        const registerData = {
            firstName: 'Usuario',
            lastName: 'Prueba',
            email: `test${Date.now()}@example.com`,
            password: 'Test123!@#'
        };

        const registerResponse = await makeRequest('POST', '/api/auth/register', registerData);
        
        if (registerResponse.status === 201 && registerResponse.data.success) {
            console.log('   ✅ Usuario registrado exitosamente');
            console.log('   📧 Email:', registerData.email);
            console.log('   🔑 Token recibido:', registerResponse.data.token ? 'Sí' : 'No');
            testToken = registerResponse.data.token;
        } else {
            console.log('   ❌ Error al registrar:', registerResponse.data.error);
        }

        // Test 2: Registro duplicado (debe fallar)
        console.log('\n📝 Test 2: Intento de registro duplicado');
        const duplicateResponse = await makeRequest('POST', '/api/auth/register', registerData);
        
        if (duplicateResponse.status === 409) {
            console.log('   ✅ Correctamente rechazado (email duplicado)');
        } else {
            console.log('   ❌ No se detectó el email duplicado');
        }

        // Test 3: Login con credenciales correctas
        console.log('\n📝 Test 3: Login con credenciales correctas');
        const loginResponse = await makeRequest('POST', '/api/auth/login', {
            email: registerData.email,
            password: registerData.password
        });

        if (loginResponse.status === 200 && loginResponse.data.success) {
            console.log('   ✅ Login exitoso');
            console.log('   👤 Usuario:', loginResponse.data.user.email);
            console.log('   🎭 Rol:', loginResponse.data.user.role);
            testToken = loginResponse.data.token;
        } else {
            console.log('   ❌ Error en login:', loginResponse.data.error);
        }

        // Test 4: Login con contraseña incorrecta
        console.log('\n📝 Test 4: Login con contraseña incorrecta');
        const wrongPasswordResponse = await makeRequest('POST', '/api/auth/login', {
            email: registerData.email,
            password: 'WrongPassword123!'
        });

        if (wrongPasswordResponse.status === 401) {
            console.log('   ✅ Correctamente rechazado (contraseña incorrecta)');
            console.log('   🔢 Intentos restantes:', wrongPasswordResponse.data.remainingAttempts);
        } else {
            console.log('   ❌ No se detectó la contraseña incorrecta');
        }

        // Test 5: Verificar token
        console.log('\n📝 Test 5: Verificar token JWT');
        const verifyResponse = await makeRequest('GET', '/api/auth/verify');
        verifyResponse.headers = {
            ...verifyResponse.headers,
            'Authorization': `Bearer ${testToken}`
        };

        // Hacer una petición con el token en el header
        const verifyRequest = new Promise((resolve, reject) => {
            const options = {
                hostname: 'localhost',
                port: 3000,
                path: '/api/auth/verify',
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${testToken}`,
                    'Origin': 'http://localhost:8000'
                }
            };

            const req = http.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    resolve({
                        status: res.statusCode,
                        data: JSON.parse(body)
                    });
                });
            });

            req.on('error', reject);
            req.end();
        });

        const tokenVerify = await verifyRequest;

        if (tokenVerify.status === 200 && tokenVerify.data.valid) {
            console.log('   ✅ Token válido');
            console.log('   👤 Usuario verificado:', tokenVerify.data.user.email);
        } else {
            console.log('   ❌ Token inválido o expirado');
        }

        // Test 6: Login con usuario admin
        console.log('\n📝 Test 6: Login con usuario admin predeterminado');
        const adminLoginResponse = await makeRequest('POST', '/api/auth/login', {
            email: 'admin@buhoeats.com',
            password: 'Admin123!'
        });

        if (adminLoginResponse.status === 200 && adminLoginResponse.data.success) {
            console.log('   ✅ Admin login exitoso');
            console.log('   🎭 Rol:', adminLoginResponse.data.user.role);
        } else {
            console.log('   ⚠️  Usuario admin no disponible o credenciales incorrectas');
        }

        // Test 7: Ruta no existente
        console.log('\n📝 Test 7: Ruta no existente (404)');
        const notFoundResponse = await makeRequest('GET', '/api/nonexistent');

        if (notFoundResponse.status === 404) {
            console.log('   ✅ Correctamente retorna 404');
        } else {
            console.log('   ❌ No maneja correctamente rutas inexistentes');
        }

        // Test 8: Validación de email
        console.log('\n📝 Test 8: Validación de email inválido');
        const invalidEmailResponse = await makeRequest('POST', '/api/auth/register', {
            firstName: 'Test',
            lastName: 'User',
            email: 'invalid-email',
            password: 'Test123!@#'
        });

        if (invalidEmailResponse.status === 400) {
            console.log('   ✅ Email inválido correctamente rechazado');
        } else {
            console.log('   ❌ No se validó el formato de email');
        }

        // Test 9: Validación de contraseña débil
        console.log('\n📝 Test 9: Validación de contraseña débil');
        const weakPasswordResponse = await makeRequest('POST', '/api/auth/register', {
            firstName: 'Test',
            lastName: 'User',
            email: `weak${Date.now()}@example.com`,
            password: 'weak'
        });

        if (weakPasswordResponse.status === 400) {
            console.log('   ✅ Contraseña débil correctamente rechazada');
            if (weakPasswordResponse.data.errors) {
                console.log('   📋 Errores:', Object.values(weakPasswordResponse.data.errors).join(', '));
            }
        } else {
            console.log('   ❌ No se validaron los requisitos de contraseña');
        }

        console.log('\n✅ Todas las pruebas completadas!\n');

    } catch (error) {
        console.error('\n❌ Error durante las pruebas:', error.message);
        console.error(error);
    }
}

// Ejecutar tests
runTests().catch(console.error);
