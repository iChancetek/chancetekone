/**
 * 8 Of Spades Works — Shared admin identity list.
 * Safe to import from BOTH client and server code (no framework imports).
 */

export const AUTHORIZED_ADMIN_EMAILS = [
  'antgreene@8ofspadesworks.com',
  'antgreene@8ofspadesworks.us',
  'chancellor@ichancetek.com',
  'chancellorminus@gmail.com',
  'admin@8ofspadesworks.com',
  'admin@8ofspadesworks.us',
  'support@8ofspadesworks.com',
  'support@8ofspadesworks.us',
  'master@8ofspadesworks.com',
  'master@8ofspadesworks.us',
  'info@8ofspadesworks.com',
  'info@8ofspadesworks.us',
];

export const isAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  return (
    AUTHORIZED_ADMIN_EMAILS.includes(lower) ||
    lower.endsWith('@8ofspadesworks.com') ||
    lower.endsWith('@8ofspadesworks.us') ||
    lower.endsWith('@ichancetek.com')
  );
};

