import { createHmac, randomInt } from 'node:crypto';

export const VERIFICATION_CODE_TTL_MS = 30 * 60 * 1000;
export const PENDING_SIGNUP_TTL_MS = 24 * 60 * 60 * 1000;
export const VERIFICATION_MAX_ATTEMPTS = 5;
export const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
export const VERIFICATION_MAX_RESENDS_PER_HOUR = 5;

export const generateVerificationCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

export const hashVerificationCode = (code) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET must be configured to protect verification codes.');
  return createHmac('sha256', secret).update(String(code)).digest('hex');
};

export const isStrongPassword = (password) => (
  typeof password === 'string'
  && password.length >= 8
  && /[A-Z]/.test(password)
  && /[a-z]/.test(password)
  && /[0-9]/.test(password)
  && /[^A-Za-z0-9]/.test(password)
);