import { z } from 'zod';

/**
 * 情报体征（Intel Signature）全站契约：四维雷达 + 依据 + 沙盘 + 核验清单 + 审计元数据。
 * 与 metadata.intelProfile 存储结构一致。
 */

export const INTEL_PROFILE_SCHEMA_VERSION = 1 as const;

const BilingualLineSchema = z.object({
  cn: z.array(z.string()).min(1).max(2),
  en: z.array(z.string()).min(1).max(2),
});

export const IntelProfileRadarKeys = [
  'narrativeIncitement',
  'stakeholderEntanglement',
  'verifiability',
  'actionUrging',
] as const;

export type IntelProfileRadarKey = (typeof IntelProfileRadarKeys)[number];

const Score0to100 = z.coerce.number().min(0).max(100);

const RadarScoresSchema = z.object({
  narrativeIncitement: Score0to100,
  stakeholderEntanglement: Score0to100,
  verifiability: Score0to100,
  actionUrging: Score0to100,
});

const StakeholderRowSchema = z.object({
  subject: z.object({ cn: z.string().min(1), en: z.string().min(1) }),
  role: z.object({ cn: z.string().min(1), en: z.string().min(1) }),
  impact: z.object({ cn: z.string().min(1), en: z.string().min(1) }),
  anchor: z.object({ cn: z.string().min(1), en: z.string().min(1) }),
});

const VerificationItemSchema = z.object({
  item: z.object({ cn: z.string().min(1), en: z.string().min(1) }),
});

const RationaleBlockSchema = z.object({
  narrativeIncitement: BilingualLineSchema,
  stakeholderEntanglement: BilingualLineSchema,
  verifiability: BilingualLineSchema,
  actionUrging: BilingualLineSchema,
});

export const IntelProfileSchema = z.object({
  schemaVersion: z
    .union([z.literal(INTEL_PROFILE_SCHEMA_VERSION), z.literal('1')])
    .transform(() => INTEL_PROFILE_SCHEMA_VERSION),
  radar: RadarScoresSchema,
  rationale: RationaleBlockSchema,
  stakeholders: z.array(StakeholderRowSchema).min(1).max(12),
  verificationChecklist: z.array(VerificationItemSchema).min(3).max(5),
  audit: z.object({
    model: z.string().min(1),
    generatedAt: z.string().min(1),
    promptVersion: z.string().min(1),
  }),
});

export type IntelProfile = z.infer<typeof IntelProfileSchema>;

export const IntelProfileErrorSchema = z.object({
  message: z.string(),
  at: z.string(),
});

export type IntelProfileError = z.infer<typeof IntelProfileErrorSchema>;
