import { z } from "zod";

export const encodeSecretInputSchema = z.object({
  raw: z.string(),
  type: z.enum(["access", "refresh"]).optional(),
});
export type EncodeSecretInput = z.infer<typeof encodeSecretInputSchema>;
export const encodeSecretOutputSchema = z.instanceof(Uint8Array);
export type EncodeSecretOutput = z.infer<typeof encodeSecretOutputSchema>;

export const verifyTokenInputSchema = z.object({
  token: z.string(),
  secret: z.instanceof(Uint8Array),
});
export type VerifyTokenInput = z.infer<typeof verifyTokenInputSchema>;
export const verifyTokenOutputSchema = z
  .object({
    iss: z.string().optional(),
    sub: z.string().optional(),
    aud: z.union([z.string(), z.array(z.string())]).optional(),
    jti: z.string().optional(),
    nbf: z.number().optional(),
    exp: z.number().optional(),
    iat: z.number().optional(),
  })
  .catchall(z.unknown());
export type VerifyTokenOutput = z.infer<typeof verifyTokenOutputSchema>;

export const registerInputSchema = z.object({
  email: z.string(),
  password: z.string(),
  name: z.string(),
});
export type RegisterInput = z.infer<typeof registerInputSchema>;
export const registerOutputSchema = z.object({ userId: z.string() });
export type RegisterOutput = z.infer<typeof registerOutputSchema>;

export const loginInputSchema = z.object({ email: z.string(), password: z.string() });
export type LoginInput = z.infer<typeof loginInputSchema>;
export const loginOutputSchema = z.object({ userId: z.string() });
export type LoginOutput = z.infer<typeof loginOutputSchema>;

export const verifyCurrentPasswordInputSchema = z.object({
  userId: z.string(),
  currentPassword: z.string(),
});
export type VerifyCurrentPasswordInput = z.infer<typeof verifyCurrentPasswordInputSchema>;
export const verifyCurrentPasswordOutputSchema = z.void();
export type VerifyCurrentPasswordOutput = z.infer<typeof verifyCurrentPasswordOutputSchema>;

export const changePasswordInputSchema = z.object({
  userId: z.string(),
  currentPassword: z.string(),
  newPassword: z.string(),
});
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;
export const changePasswordOutputSchema = z.void();
export type ChangePasswordOutput = z.infer<typeof changePasswordOutputSchema>;

export const issueAccessTokenInputSchema = z.object({ userId: z.string() });
export type IssueAccessTokenInput = z.infer<typeof issueAccessTokenInputSchema>;
export const issueAccessTokenOutputSchema = z.string();
export type IssueAccessTokenOutput = z.infer<typeof issueAccessTokenOutputSchema>;
