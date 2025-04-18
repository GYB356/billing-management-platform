/**
 * Security utilities to prevent common web vulnerabilities
 */

// Sanitize MongoDB query to prevent NoSQL injection
const sanitizeMongoQuery = (query) => {
  if (typeof query !== 'object' || query === null) {
    return query;
  }

  const sanitized = {};
  
  Object.keys(query).forEach(key => {
    // Check for MongoDB operator keys
    if (key.startsWith('$')) {
      // Either remove or escape operators in a real application
      // Here we're removing them for simplicity
      return;
    }
    
    const value = query[key];
    
    if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMongoQuery(value);
    } else {
      // Convert RegExp objects to strings to prevent ReDoS attacks
      sanitized[key] = value instanceof RegExp ? value.toString() : value;
    }
  });
  
  return sanitized;
};

// Sanitize user input to prevent XSS
const sanitizeInput = (input) => {
  if (typeof input !== 'string') {
    return input;
  }
  
  // Replace potentially dangerous characters
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// Validate and sanitize MongoDB ID
const validateMongoId = (id) => {
  // MongoDB ObjectId is a 24-character hex string
  return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id) ? id : null;
};

module.exports = {
  sanitizeMongoQuery,
  sanitizeInput,
  validateMongoId
}; 