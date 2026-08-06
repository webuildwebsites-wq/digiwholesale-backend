import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

const getKey = () => {
  const secret = process.env.PASSWORD_SECRET;
  if (!secret) throw new Error('PASSWORD_SECRET environment variable is not set');
  return crypto.createHash('sha256').update(secret).digest();
};

export const encryptPassword = (plain) => {
  try {
    const iv        = crypto.randomBytes(IV_LENGTH);
    const cipher    = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch {
    return null;
  }
};

export const decryptPassword = (encryptedText) => {
  try {
    if (!encryptedText) return null;
    const [ivHex, encHex] = encryptedText.split(':');
    if (!ivHex || !encHex) return null;
    const iv        = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encHex, 'hex');
    const decipher  = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
};
