import { z } from 'zod';

export const extensionSchema = z.object({
  requestedDate: z.string().optional().nullable(),
  agreedDate: z.string().min(1),
  notes: z.string().optional().nullable(),
});

export function normaliseExtensionValue(value: string | null | undefined) {
  if (value == null) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}
