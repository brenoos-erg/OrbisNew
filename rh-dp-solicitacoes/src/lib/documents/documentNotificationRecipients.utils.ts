const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeAndValidateEmails(emails: string[] = []) {
  return Array.from(new Set(emails.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean))).filter((email) =>
    EMAIL_REGEX.test(email),
  )
}

export function isValidNotificationEmail(email: string) {
  return EMAIL_REGEX.test(String(email || '').trim().toLowerCase())
}
