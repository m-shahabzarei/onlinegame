import "server-only";

import {
  createHash,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const MAX_MEMORY = 32 * 1024 * 1024;

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(
      password,
      salt,
      KEY_LENGTH,
      {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
}

/**
 * Hash a password using Node's built-in scrypt implementation.
 *
 * The encoded format deliberately includes the parameters so a future
 * work-factor increase can be rolled out without invalidating existing users:
 * `scrypt$N=<n>$r=<r>$p=<p>$<salt>$<digest>`.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const digest = await scrypt(password, salt);

  return [
    "scrypt",
    `N=${SCRYPT_N}`,
    `r=${SCRYPT_R}`,
    `p=${SCRYPT_P}`,
    salt.toString("base64url"),
    digest.toString("base64url"),
  ].join("$");
}

interface EncodedPassword {
  readonly n: number;
  readonly r: number;
  readonly p: number;
  readonly salt: Buffer;
  readonly digest: Buffer;
}

function parseEncodedPassword(encoded: string): EncodedPassword | null {
  const [algorithm, nPart, rPart, pPart, saltPart, digestPart] =
    encoded.split("$");

  if (
    algorithm !== "scrypt" ||
    !nPart ||
    !rPart ||
    !pPart ||
    !saltPart ||
    !digestPart
  ) {
    return null;
  }

  const n = Number(nPart.slice(2));
  const r = Number(rPart.slice(2));
  const p = Number(pPart.slice(2));
  const salt = Buffer.from(saltPart, "base64url");
  const digest = Buffer.from(digestPart, "base64url");

  if (
    !Number.isSafeInteger(n) ||
    !Number.isSafeInteger(r) ||
    !Number.isSafeInteger(p) ||
    n < 2 ||
    n > 262_144 ||
    r < 1 ||
    r > 32 ||
    p < 1 ||
    p > 16 ||
    salt.length < 8 ||
    digest.length !== KEY_LENGTH
  ) {
    return null;
  }

  return { n, r, p, salt, digest };
}

/** Verify a password without exposing or returning the stored hash. */
export async function verifyPassword(
  password: string,
  encoded: string | null | undefined,
): Promise<boolean> {
  if (!encoded) return false;

  const parsed = parseEncodedPassword(encoded);
  if (!parsed) return false;

  try {
    const candidate = await new Promise<Buffer>((resolve, reject) => {
      nodeScrypt(
        password,
        parsed.salt,
        parsed.digest.length,
        {
          N: parsed.n,
          r: parsed.r,
          p: parsed.p,
          maxmem: MAX_MEMORY,
        },
        (error, derivedKey) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(derivedKey);
        },
      );
    });

    return (
      candidate.length === parsed.digest.length &&
      timingSafeEqual(candidate, parsed.digest)
    );
  } catch {
    // Malformed/overly expensive hashes should fail closed rather than leak
    // implementation details to a login caller.
    return false;
  }
}

/** Stable digest used by tests and diagnostics without retaining password data. */
export function fingerprintPasswordHash(encoded: string): string {
  return createHash("sha256").update(encoded).digest("hex");
}
