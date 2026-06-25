import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer | null {
  const keyHex = process.env.AUDIO_ENCRYPTION_KEY;
  if (!keyHex) return null;

  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) {
    throw new Error(
      "AUDIO_ENCRYPTION_KEY must be a 32-byte (64-character) hex string",
    );
  }

  return key;
}

export function isEncryptionEnabled(): boolean {
  return !!getKey();
}

export function encrypt(data: Buffer): Buffer {
  const key = getKey();
  if (!key) throw new Error("Encryption key not configured");

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: [IV (12 bytes)] [Auth Tag (16 bytes)] [Encrypted Data]
  return Buffer.concat([iv, authTag, encrypted]);
}

export function decrypt(encryptedData: Buffer): Buffer {
  const key = getKey();
  if (!key) throw new Error("Encryption key not configured");

  if (encryptedData.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted data: too short");
  }

  const iv = encryptedData.subarray(0, IV_LENGTH);
  const authTag = encryptedData.subarray(
    IV_LENGTH,
    IV_LENGTH + AUTH_TAG_LENGTH,
  );
  const encrypted = encryptedData.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export function generateKey(): string {
  return crypto.randomBytes(32).toString("hex");
}
