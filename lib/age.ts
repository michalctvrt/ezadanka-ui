/**
 * Spočítá věk pacienta v celých letech k zadanému datu (default = dnes).
 *
 * @param birthDate — datum narození ve formátu YYYY-MM-DD
 * @param today — datum, ke kterému počítáme (default new Date())
 * @returns věk v letech, nebo null pokud datum narození není parsovatelné
 */
export function calculateAge(
  birthDate: string | null | undefined,
  today: Date = new Date()
): number | null {
  if (!birthDate) return null;

  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return null;

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birth.getDate())
  ) {
    age--;
  }
  return age;
}
