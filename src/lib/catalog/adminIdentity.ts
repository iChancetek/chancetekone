/**
 * ChanceTEK One — Shared admin identity list.
 * Safe to import from BOTH client and server code (no framework imports).
 */

export const AUTHORIZED_ADMIN_EMAILS = [
  'antgreene@chancetekone.com',
  'antgreene@chancetekone.us',
  'chancellor@ichancetek.com',
  'chancellorminus@gmail.com',
  'admin@chancetekone.com',
  'admin@chancetekone.us',
  'support@chancetekone.com',
  'support@chancetekone.us',
  'master@chancetekone.com',
  'master@chancetekone.us',
  'info@chancetekone.com',
  'info@chancetekone.us',
];

export const SUPER_ADMIN_EMAILS = [
  'chancellor@ichancetek.com',
  'chancellorminus@gmail.com',
  'antgreene@chancetekone.com',
  'antgreene@chancetekone.us',
];

export const isSuperAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  return SUPER_ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === lower);
};

export const isAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  return (
    AUTHORIZED_ADMIN_EMAILS.includes(lower) ||
    lower.endsWith('@chancetekone.com') ||
    lower.endsWith('@chancetekone.us') ||
    lower.endsWith('@ichancetek.com')
  );
};

