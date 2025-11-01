/**
 * Utilidades de Validación
 * Validación de datos de entrada (email, contraseñas, etc.)
 */

/**
 * Valida formato de email
 * @param {string} email - Email a validar
 * @returns {boolean} True si es válido
 */
function isValidEmail(email) {
    if (!email || typeof email !== 'string') {
        return false;
    }

    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

/**
 * Valida contraseña según requisitos de seguridad
 * @param {string} password - Contraseña a validar
 * @returns {Object} {isValid: boolean, errors: string[]}
 */
function validatePassword(password) {
    const errors = [];

    if (!password || typeof password !== 'string') {
        return { isValid: false, errors: ['Contraseña requerida'] };
    }

    // Mínimo 8 caracteres
    if (password.length < 8) {
        errors.push('La contraseña debe tener al menos 8 caracteres');
    }

    // Al menos una mayúscula
    if (!/[A-Z]/.test(password)) {
        errors.push('Debe contener al menos una letra mayúscula');
    }

    // Al menos una minúscula
    if (!/[a-z]/.test(password)) {
        errors.push('Debe contener al menos una letra minúscula');
    }

    // Al menos un número
    if (!/[0-9]/.test(password)) {
        errors.push('Debe contener al menos un número');
    }

    // Al menos un carácter especial
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Debe contener al menos un carácter especial');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Sanitiza una cadena para prevenir XSS
 * @param {string} str - String a sanitizar
 * @returns {string} String sanitizado
 */
function sanitizeInput(str) {
    if (!str || typeof str !== 'string') {
        return '';
    }

    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;')
        .trim();
}

/**
 * Valida que un string no esté vacío
 * @param {string} str - String a validar
 * @param {string} fieldName - Nombre del campo (para mensaje de error)
 * @returns {Object} {isValid: boolean, error: string}
 */
function validateRequired(str, fieldName = 'Campo') {
    if (!str || typeof str !== 'string' || str.trim().length === 0) {
        return {
            isValid: false,
            error: `${fieldName} es requerido`
        };
    }

    return { isValid: true };
}

/**
 * Valida longitud de un string
 * @param {string} str - String a validar
 * @param {number} min - Longitud mínima
 * @param {number} max - Longitud máxima
 * @param {string} fieldName - Nombre del campo
 * @returns {Object} {isValid: boolean, error: string}
 */
function validateLength(str, min, max, fieldName = 'Campo') {
    if (!str || typeof str !== 'string') {
        return {
            isValid: false,
            error: `${fieldName} es requerido`
        };
    }

    const length = str.trim().length;

    if (length < min) {
        return {
            isValid: false,
            error: `${fieldName} debe tener al menos ${min} caracteres`
        };
    }

    if (max && length > max) {
        return {
            isValid: false,
            error: `${fieldName} no puede exceder ${max} caracteres`
        };
    }

    return { isValid: true };
}

/**
 * Valida que un valor sea un número entero válido
 * @param {any} value - Valor a validar
 * @param {number} min - Valor mínimo (opcional)
 * @param {number} max - Valor máximo (opcional)
 * @returns {Object} {isValid: boolean, error: string}
 */
function validateInteger(value, min = null, max = null) {
    const num = parseInt(value);

    if (isNaN(num)) {
        return {
            isValid: false,
            error: 'Debe ser un número válido'
        };
    }

    if (min !== null && num < min) {
        return {
            isValid: false,
            error: `El valor mínimo es ${min}`
        };
    }

    if (max !== null && num > max) {
        return {
            isValid: false,
            error: `El valor máximo es ${max}`
        };
    }

    return { isValid: true, value: num };
}

/**
 * Valida un rol de usuario
 * @param {string} role - Rol a validar
 * @returns {boolean} True si es válido
 */
function isValidRole(role) {
    const validRoles = ['user', 'owner', 'admin'];
    return validRoles.includes(role);
}

/**
 * Valida datos de registro
 * @param {Object} data - Datos del usuario
 * @returns {Object} {isValid: boolean, errors: Object}
 */
function validateRegistrationData(data) {
    const errors = {};

    // Validar firstName
    const firstNameCheck = validateLength(data.firstName, 2, 50, 'Nombre');
    if (!firstNameCheck.isValid) {
        errors.firstName = firstNameCheck.error;
    }

    // Validar lastName
    const lastNameCheck = validateLength(data.lastName, 2, 50, 'Apellido');
    if (!lastNameCheck.isValid) {
        errors.lastName = lastNameCheck.error;
    }

    // Validar email
    if (!isValidEmail(data.email)) {
        errors.email = 'Email inválido';
    }

    // Validar contraseña
    const passwordCheck = validatePassword(data.password);
    if (!passwordCheck.isValid) {
        errors.password = passwordCheck.errors.join(', ');
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
}

module.exports = {
    isValidEmail,
    validatePassword,
    sanitizeInput,
    validateRequired,
    validateLength,
    validateInteger,
    isValidRole,
    validateRegistrationData
};
