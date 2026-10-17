/**
 * envValidator.js — Environment and Configuration Validator for MindMesh Backend
 *
 * Validates critical environment variables on startup and enforces security
 * policies for production deployments (e.g. strong JWT secrets, CORS allowlists).
 */

const KNOWN_WEAK_SECRETS = new Set([
  "secret",
  "jwtsecret",
  "changeme",
  "123456",
  "password",
  "mindmesh-jwt-secret-dev-2026",
  "mindmesh-test-jwt-secret-2026",
]);

/**
 * Validates the current process.env configuration.
 *
 * @param {object} [options]
 * @param {boolean} [options.throwOnFatal=false] - Whether to throw an Error on fatal misconfiguration
 * @param {object} [options.env=process.env] - Environment object to validate
 * @returns {{ isValid: boolean, fatalErrors: string[], warnings: string[] }}
 */
function validateEnv(options = {}) {
  const env = options.env || process.env;
  const isProduction = env.NODE_ENV === "production";
  const isTest = env.NODE_ENV === "test";
  const fatalErrors = [];
  const warnings = [];

  // 1. MONGODB_URI validation
  if (!env.MONGODB_URI && !isTest) {
    fatalErrors.push(
      "MONGODB_URI is required. Please set a valid MongoDB Atlas connection string (mongodb:// or mongodb+srv://)."
    );
  } else if (env.MONGODB_URI && !env.MONGODB_URI.startsWith("mongodb://") && !env.MONGODB_URI.startsWith("mongodb+srv://")) {
    fatalErrors.push(
      "MONGODB_URI must start with 'mongodb://' or 'mongodb+srv://'."
    );
  }

  // 2. JWT_SECRET validation
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    if (isProduction) {
      fatalErrors.push(
        "JWT_SECRET is strictly required in production mode. Set a cryptographically random secret with at least 32 characters."
      );
    } else {
      warnings.push(
        "JWT_SECRET is not set; falling back to default development secret. DO NOT USE IN PRODUCTION."
      );
    }
  } else {
    if (isProduction) {
      if (jwtSecret.length < 32) {
        fatalErrors.push(
          "JWT_SECRET must be at least 32 characters long in production mode."
        );
      }
      if (KNOWN_WEAK_SECRETS.has(jwtSecret.toLowerCase())) {
        fatalErrors.push(
          "JWT_SECRET is set to a well-known insecure default. Please generate a secure random secret."
        );
      }
    }
  }

  // 3. GEMINI_API_KEY validation
  if (!env.GEMINI_API_KEY) {
    warnings.push(
      "GEMINI_API_KEY is not set. Vector embeddings, semantic search, and AI Q&A will run in fallback mode."
    );
  }

  // 4. PORT validation
  if (env.PORT) {
    const portNum = parseInt(env.PORT, 10);
    if (isNaN(portNum) || portNum <= 0 || portNum > 65535) {
      fatalErrors.push(`PORT must be an integer between 1 and 65535. Received: ${env.PORT}`);
    }
  }

  const isValid = fatalErrors.length === 0;

  if (!isValid && options.throwOnFatal) {
    throw new Error(`Environment validation failed:\n• ${fatalErrors.join("\n• ")}`);
  }

  return {
    isValid,
    fatalErrors,
    warnings,
  };
}

module.exports = {
  validateEnv,
  KNOWN_WEAK_SECRETS,
};
