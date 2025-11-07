// src/lib/makeLogin.ts
export function makeLogin(fullName: string) {
  if (!fullName) return '';
  const noAccents = fullName
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')      // tira acentos
    .replace(/[^a-zA-Z\s]/g, ' ')        // só letras e espaços
    .trim()
    .replace(/\s+/g, ' ');
  const parts = noAccents.split(' ');
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  return [first, last].filter(Boolean).join('.').toLowerCase();
}
