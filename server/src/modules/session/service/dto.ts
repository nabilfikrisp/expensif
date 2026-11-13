import { z } from "zod";

export const cleanupExpiredSessionsInputSchema = z.void();
export type CleanupExpiredSessionsInput = z.infer<typeof cleanupExpiredSessionsInputSchema>;
export const cleanupExpiredSessionsOutputSchema = z.void();
export type CleanupExpiredSessionsOutput = z.infer<typeof cleanupExpiredSessionsOutputSchema>;

export const createSessionInputSchema = z.object({ userId: z.string() });
export type CreateSessionInput = z.infer<typeof createSessionInputSchema>;
export const createSessionOutputSchema = z.object({
  refreshToken: z.string(),
  expiresAt: z.string(),
});
export type CreateSessionOutput = z.infer<typeof createSessionOutputSchema>;

export const findValidSessionInputSchema = z.object({ token: z.string() });
export type FindValidSessionInput = z.infer<typeof findValidSessionInputSchema>;
export const findValidSessionOutputSchema = z
  .object({
    session: z.object({
      id: z.string(),
      userId: z.string(),
      tokenHash: z.string(),
      prevTokenHash: z.string().nullable(),
      rotatedAt: z.string().nullable(),
      lastUsedAt: z.string(),
      absoluteExpiresAt: z.string(),
      revokedAt: z.string().nullable(),
    }),
    matchedToken: z.enum(["current", "previousWithinGrace", "previousOutsideGrace"]),
  })
  .nullable();
export type FindValidSessionOutput = z.infer<typeof findValidSessionOutputSchema>;

export const rotateSessionTokenInputSchema = z.object({ sessionId: z.string() });
export type RotateSessionTokenInput = z.infer<typeof rotateSessionTokenInputSchema>;
export const rotateSessionTokenOutputSchema = z
  .object({ newRefreshToken: z.string(), expiresAt: z.string() })
  .nullable();
export type RotateSessionTokenOutput = z.infer<typeof rotateSessionTokenOutputSchema>;

export const acceptPreviousSessionTokenInputSchema = z.object({ sessionId: z.string() });
export type AcceptPreviousSessionTokenInput = z.infer<typeof acceptPreviousSessionTokenInputSchema>;
export const acceptPreviousSessionTokenOutputSchema = z.object({ id: z.string() }).nullable();
export type AcceptPreviousSessionTokenOutput = z.infer<
  typeof acceptPreviousSessionTokenOutputSchema
>;

export const findSessionForRevocationInputSchema = z.object({ token: z.string() });
export type FindSessionForRevocationInput = z.infer<typeof findSessionForRevocationInputSchema>;
export const findSessionForRevocationOutputSchema = z.object({ id: z.string() }).nullable();
export type FindSessionForRevocationOutput = z.infer<typeof findSessionForRevocationOutputSchema>;

export const revokeAllSessionsInputSchema = z.object({ userId: z.string() });
export type RevokeAllSessionsInput = z.infer<typeof revokeAllSessionsInputSchema>;
export const revokeAllSessionsOutputSchema = z.void();
export type RevokeAllSessionsOutput = z.infer<typeof revokeAllSessionsOutputSchema>;

export const revokeSessionInputSchema = z.object({ sessionId: z.string() });
export type RevokeSessionInput = z.infer<typeof revokeSessionInputSchema>;
export const revokeSessionOutputSchema = z.void();
export type RevokeSessionOutput = z.infer<typeof revokeSessionOutputSchema>;
