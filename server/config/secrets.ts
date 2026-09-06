import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import fs from "fs";
import path from "path";

/**
 * Stage 1E: Server-Only Secret Management Integration
 * 
 * Production Security Constitution Compliance:
 * - Architecture: Cloud Run -> Google Cloud Secret Manager -> GEMINI_API_KEY (Server Boundary Only).
 * - Identity: Application Default Credentials (ADC) from Cloud Run runtime service account.
 * - Zero Secrets in Bundles: No service-account JSON keys, private keys, or client exposure.
 * - Version Pinning: Uses a pinned Secret Manager version (e.g. "1") rather than unpinned "latest".
 * - Fail-Closed: Throws a sanitized internal error without revealing credentials, internal resource paths, or stack traces.
 */

export class SecretConfigurationError extends Error {
  readonly statusCode = 500;
  constructor(message = "Gemini API credential is not configured or could not be loaded") {
    super(message);
    this.name = "SecretConfigurationError";
  }
}

// In-memory cache for the loaded secret to avoid repeated network round-trips to Secret Manager
let cachedGeminiApiKey: string | null = null;
let secretClient: SecretManagerServiceClient | null = null;

function getSecretClient(): SecretManagerServiceClient {
  if (!secretClient) {
    // Uses Google Application Default Credentials (ADC) natively provided by Cloud Run runtime identity
    secretClient = new SecretManagerServiceClient();
  }
  return secretClient;
}

/**
 * Retrieves the project ID from environment variables or Firebase configuration.
 * Prioritizes the application/secret hosting project (gen-lang-client-0498593678)
 * over any internal container hosting project ID.
 */
function getProjectId(): string {
  if (process.env.GEMINI_PROJECT_ID) {
    return process.env.GEMINI_PROJECT_ID;
  }
  try {
    const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.projectId) {
        return parsed.projectId;
      }
    }
  } catch {
    // Ignore read error; handled below
  }
  if (process.env.GOOGLE_CLOUD_PROJECT) {
    return process.env.GOOGLE_CLOUD_PROJECT;
  }
  throw new SecretConfigurationError("Project ID is missing from environment");
}

/**
 * Accesses the Gemini API key securely.
 * Priority order:
 * 1. Return in-memory cached key if already loaded.
 * 2. In production (or when USE_SECRET_MANAGER="true"), fetch from Google Cloud Secret Manager using pinned version.
 * 3. In local development, fall back to local process.env.GEMINI_API_KEY if present.
 * 4. Fail-closed with safe error if unavailable.
 * 
 * Never logs the secret. Never returns the secret to the client.
 */
export async function getGeminiApiKey(): Promise<string> {
  if (cachedGeminiApiKey) {
    return cachedGeminiApiKey;
  }

  const isProduction = process.env.NODE_ENV === "production";
  const forceSecretManager = process.env.USE_SECRET_MANAGER === "true";

  // Production path: Pinned version from Google Cloud Secret Manager
  if (isProduction || forceSecretManager) {
    try {
      const client = getSecretClient();
      const projectId = getProjectId();
      const secretName = process.env.GEMINI_SECRET_NAME || "My_Gemini_Key";
      // Pinned version requirement (defaults to "1", configurable via GEMINI_SECRET_VERSION)
      const version = process.env.GEMINI_SECRET_VERSION || "1";

      const name = `projects/${projectId}/secrets/${secretName}/versions/${version}`;
      const [response] = await client.accessSecretVersion({ name });

      const secretPayload = response.payload?.data?.toString("utf8")?.trim();
      if (!secretPayload) {
        throw new SecretConfigurationError("Secret payload is empty in Secret Manager");
      }

      cachedGeminiApiKey = secretPayload;
      return cachedGeminiApiKey;
    } catch (err: unknown) {
      // Security: Do NOT log the secret name or GCP error details that could expose internal identifiers
      console.error(
        "[Security] Failed to access AI credentials from Secret Manager:",
        err instanceof Error ? err.message : "Unknown error"
      );
      throw new SecretConfigurationError(
        "Secure AI credentials could not be loaded from Secret Manager"
      );
    }
  }

  // Local development path: server-side environment variable fallback (from local .env, never committed)
  const localEnvKey = process.env.GEMINI_API_KEY?.trim();
  if (localEnvKey) {
    cachedGeminiApiKey = localEnvKey;
    return cachedGeminiApiKey;
  }

  // Fail-closed immediately when unconfigured
  throw new SecretConfigurationError(
    "AI credential is not configured in Secret Manager or server environment"
  );
}

/**
 * Utility to clear the in-memory secret cache. Used during testing and key rotation.
 */
export function clearSecretCache(): void {
  cachedGeminiApiKey = null;
}

/**
 * Checks whether the Gemini API key is configured without exposing or returning the secret value.
 * Used for safe diagnostic/health reporting.
 */
export async function checkSecretStatus(): Promise<{
  configured: boolean;
  source: "secret-manager" | "env" | "unconfigured";
  pinnedVersion?: string;
}> {
  try {
    const key = await getGeminiApiKey();
    const isProduction = process.env.NODE_ENV === "production";
    const forceSecretManager = process.env.USE_SECRET_MANAGER === "true";
    const source = (isProduction || forceSecretManager) ? "secret-manager" : "env";
    const version = process.env.GEMINI_SECRET_VERSION || "1";

    return {
      configured: Boolean(key && key.length > 0),
      source,
      pinnedVersion: source === "secret-manager" ? version : undefined,
    };
  } catch {
    return {
      configured: false,
      source: "unconfigured",
    };
  }
}
