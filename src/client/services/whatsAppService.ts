import { db } from './database';

function stripNonDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function getWhatsAppLink(phone: string): string {
  const digits = stripNonDigits(phone);

  if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) {
    return `https://wa.me/${digits}`;
  }

  return `https://wa.me/55${digits}`;
}

export async function confirmWhatsApp(serviceId: string): Promise<boolean> {
  const service = await db.services.get(serviceId);
  if (!service) return false;

  await db.services.update(serviceId, {
    whatsAppConfirmed: true,
    updatedAt: Date.now(),
  });

  return true;
}
