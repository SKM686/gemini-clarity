import { Request, Response, NextFunction } from "express";
import { adminAuth } from "../lib/firebaseAdmin";
import "../types/express";

/**
 * Server-side authentication middleware for Cloud Run boundary.
 *
 * Verifies Firebase ID Token using Firebase Admin SDK with revoked token verification.
 * Extracts authoritative UID directly from the cryptographically verified JWT payload.
 * Completely ignores and discards any client-supplied UID parameters in body/query/headers.
 */
export async function verifyFirebaseAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || typeof authHeader !== "string") {
    res.status(401).json({
      status: "error",
      message: "Authentication required",
    });
    return;
  }

  const parts = authHeader.trim().split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    res.status(401).json({
      status: "error",
      message: "Authentication required",
    });
    return;
  }

  const token = parts[1];
  if (!token || token.length < 10) {
    res.status(401).json({
      status: "error",
      message: "Authentication required",
    });
    return;
  }

  try {
    let decodedToken;
    try {
      // Cryptographically verify ID token and attempt revocation check
      decodedToken = await adminAuth.verifyIdToken(token, true);
    } catch (revocationErr: unknown) {
      const err = revocationErr as { code?: string; message?: string };
      // Explicitly reject revoked or disabled user tokens
      if (
        err?.code === "auth/id-token-revoked" ||
        err?.code === "auth/user-disabled"
      ) {
        res.status(401).json({
          status: "error",
          message: "Authentication required",
        });
        return;
      }
      // If revocation check fails due to IAM permissions or network,
      // fall back to cryptographic JWT signature verification (checkRevoked = false)
      decodedToken = await adminAuth.verifyIdToken(token, false);
    }

    if (!decodedToken || !decodedToken.uid) {
      res.status(401).json({
        status: "error",
        message: "Authentication required",
      });
      return;
    }

    // Attach minimal authoritative identity object
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };

    next();
  } catch (_err) {
    // Return standard generic safe response without leaking token contents,
    // stack traces, or internal Firebase/GCP error details.
    res.status(401).json({
      status: "error",
      message: "Authentication required",
    });
  }
}
