import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";

export type SealableOwner = {
  id: string;
  name: string;
  aliases: string[] | null;
  phone: string;
  imessage_handle: string | null;
};

function encryptionKey(): Buffer {
  const raw = process.env.ACCOUNT_ENCRYPTION_KEY?.trim() ?? "";
  if (!raw) {
    throw new Error("ACCOUNT_ENCRYPTION_KEY is required");
  }
  const hex = raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw);
  const key = hex ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64url");
  if (key.length !== 32) {
    throw new Error("ACCOUNT_ENCRYPTION_KEY must decode to 32 bytes");
  }
  return key;
}

function fieldAad(ownerId: string, field: string): string {
  return `owner:${ownerId}:${field}`;
}

export function isSealed(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function sealText(plain: string, aad: string): string {
  if (!plain || isSealed(plain)) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function openText(stored: string, aad: string): string {
  if (!stored || !isSealed(stored)) return stored;
  const parts = stored.slice(PREFIX.length).split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    throw new Error("Account data could not be decrypted");
  }
  const [ivPart, tagPart, dataPart] = parts;
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Account data could not be decrypted");
  }
}

export function sealOwner<T extends SealableOwner>(row: T): T {
  const aliases = row.aliases ?? [];
  return {
    ...row,
    name: sealText(row.name, fieldAad(row.id, "name")),
    phone: sealText(row.phone, fieldAad(row.id, "phone")),
    imessage_handle: row.imessage_handle
      ? sealText(row.imessage_handle, fieldAad(row.id, "imessage_handle"))
      : row.imessage_handle,
    aliases: aliases.map((alias) => sealText(alias, fieldAad(row.id, "alias"))),
  };
}

export function openOwner<T extends SealableOwner>(row: T): T {
  const aliases = row.aliases ?? [];
  return {
    ...row,
    name: openText(row.name, fieldAad(row.id, "name")),
    phone: openText(row.phone, fieldAad(row.id, "phone")),
    imessage_handle: row.imessage_handle
      ? openText(row.imessage_handle, fieldAad(row.id, "imessage_handle"))
      : row.imessage_handle,
    aliases: aliases.map((alias) => openText(alias, fieldAad(row.id, "alias"))),
  };
}

// Returns the ciphertext columns when a stored row still has plaintext.
// Already-sealed rows return null so reads do not rewrite them.
export function ownerSealPatch(
  row: SealableOwner,
): Pick<SealableOwner, "name" | "aliases" | "phone" | "imessage_handle"> | null {
  const sealed = sealOwner(row);
  const aliases = row.aliases ?? [];
  const sealedAliases = sealed.aliases ?? [];
  const sameAliases =
    aliases.length === sealedAliases.length &&
    aliases.every((alias, index) => alias === sealedAliases[index]);
  if (
    sealed.name === row.name &&
    sealed.phone === row.phone &&
    sealed.imessage_handle === row.imessage_handle &&
    sameAliases
  ) {
    return null;
  }
  return {
    name: sealed.name,
    aliases: sealedAliases,
    phone: sealed.phone,
    imessage_handle: sealed.imessage_handle,
  };
}
