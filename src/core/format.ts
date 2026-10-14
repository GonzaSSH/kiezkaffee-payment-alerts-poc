export function formatAmount(amountMinor: number, currency: string): string {
  const value = (amountMinor / 100).toFixed(2);
  return currency.toLowerCase() === 'eur' ? `€${value}` : `${value} ${currency.toUpperCase()}`;
}

/** "jana.m@example.com" → "j•••@example.com". Enough to recognise, not to copy. */
export function maskEmail(email: string | null): string | null {
  if (email === null) return null;
  const at = email.indexOf('@');
  if (at < 1) return '•••';
  return `${email[0]}•••${email.slice(at)}`;
}

export function orderLabel(orderId: string | null): string {
  return orderId ?? '(no order number)';
}
