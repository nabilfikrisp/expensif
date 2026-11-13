import { z } from "zod";
import type { DbTx } from "@/pkg/db";

export const linkAccountInputSchema = z.object({
  userId: z.string(),
  platform: z.string(),
  platformUserId: z.string(),
  platformUsername: z.string().optional(),
  idempotencyKey: z.string().optional(),
});
export type LinkAccountInput = z.infer<typeof linkAccountInputSchema>;
export const linkAccountOutputSchema = z.object({
  id: z.string(),
  userId: z.string(),
  platform: z.string(),
  platformUserId: z.string(),
  platformUsername: z.string().nullable(),
  idempotencyKey: z.string().nullable(),
  linkedAt: z.string(),
});
export type LinkAccountOutput = z.infer<typeof linkAccountOutputSchema>;

export const findLinkedAccountForRetryInputSchema = z.object({ idempotencyKey: z.string() });
export type FindLinkedAccountForRetryInput = z.infer<typeof findLinkedAccountForRetryInputSchema>;
export const findLinkedAccountForRetryOutputSchema = z
  .object({ userId: z.string(), platform: z.string(), platformUserId: z.string() })
  .optional();
export type FindLinkedAccountForRetryOutput = z.infer<typeof findLinkedAccountForRetryOutputSchema>;

export const getLinkedAccountInputSchema = z.object({
  platform: z.string(),
  platformUserId: z.string(),
});
export type GetLinkedAccountInput = z.infer<typeof getLinkedAccountInputSchema>;
export const getLinkedAccountOutputSchema = z.object({
  id: z.string(),
  userId: z.string(),
  platform: z.string(),
  platformUserId: z.string(),
  platformUsername: z.string().nullable(),
  idempotencyKey: z.string().nullable(),
  linkedAt: z.string(),
});
export type GetLinkedAccountOutput = z.infer<typeof getLinkedAccountOutputSchema>;

export const getLinkedAccountForIngestionInputSchema = z.object({
  platform: z.string(),
  platformUserId: z.string(),
});
export type GetLinkedAccountForIngestionInput = z.infer<
  typeof getLinkedAccountForIngestionInputSchema
>;
export const getLinkedAccountForIngestionOutputSchema = z.object({
  id: z.string(),
  userId: z.string(),
  platform: z.string(),
  platformUserId: z.string(),
  platformUsername: z.string().nullable(),
  idempotencyKey: z.string().nullable(),
  linkedAt: z.string(),
});
export type GetLinkedAccountForIngestionOutput = z.infer<
  typeof getLinkedAccountForIngestionOutputSchema
>;

export const getUserByLinkedAccountInputSchema = z.object({
  platform: z.string(),
  platformUserId: z.string(),
});
export type GetUserByLinkedAccountInput = z.infer<typeof getUserByLinkedAccountInputSchema>;
export const getUserByLinkedAccountOutputSchema = z.object({
  userId: z.string(),
  linkedAccountId: z.string(),
  userName: z.string(),
  userEmail: z.string(),
});
export type GetUserByLinkedAccountOutput = z.infer<typeof getUserByLinkedAccountOutputSchema>;

export const listLinkedAccountsInputSchema = z.object({ userId: z.string() });
export type ListLinkedAccountsInput = z.infer<typeof listLinkedAccountsInputSchema>;
export const listLinkedAccountsOutputSchema = z.array(
  z.object({
    id: z.string(),
    platform: z.string(),
    platformUserId: z.string(),
    platformUsername: z.string().nullable(),
    linkedAt: z.string(),
  })
);
export type ListLinkedAccountsOutput = z.infer<typeof listLinkedAccountsOutputSchema>;

export const unlinkAccountInputSchema = z.object({ userId: z.string(), accountId: z.string() });
export type UnlinkAccountInput = z.infer<typeof unlinkAccountInputSchema>;
export const unlinkAccountOutputSchema = z.void();
export type UnlinkAccountOutput = z.infer<typeof unlinkAccountOutputSchema>;

export type LinkAccount = LinkAccountInput & { tx?: DbTx };
