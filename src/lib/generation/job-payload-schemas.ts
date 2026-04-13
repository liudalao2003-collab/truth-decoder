import { z } from 'zod';

export const dossierJobPayloadSchema = z.object({
  rawContent: z.string().min(1),
  lang: z.enum(['cn', 'en']).optional(),
  retryAttempt: z.number().min(0).max(3).optional(),
});

export const terminalJobPayloadSchema = z.object({
  signalId: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
      })
    )
    .min(1),
});

export const intelProfileJobPayloadSchema = z.object({
  signalId: z.string().min(1),
  forceRegenerate: z.boolean().optional(),
});

export const translateJobPayloadSchema = z.object({
  content: z.string().min(1),
  targetLang: z.enum(['cn', 'en']),
});

export const createGenerationJobBodySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('dossier'),
    payload: dossierJobPayloadSchema,
  }),
  z.object({
    kind: z.literal('terminal'),
    payload: terminalJobPayloadSchema,
  }),
  z.object({
    kind: z.literal('intel_profile'),
    payload: intelProfileJobPayloadSchema,
  }),
  z.object({
    kind: z.literal('translate'),
    payload: translateJobPayloadSchema,
  }),
]);
