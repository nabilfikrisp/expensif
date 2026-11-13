import { z } from "zod";

export const registerInputSchema = z.object({
  email: z.string(),
  password: z.string(),
  name: z.string(),
});
export type RegisterInput = z.infer<typeof registerInputSchema>;
export const registerOutputSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.string(),
});
export type RegisterOutput = z.infer<typeof registerOutputSchema>;

export const loginInputSchema = z.object({ email: z.string(), password: z.string() });
export type LoginInput = z.infer<typeof loginInputSchema>;
export const loginOutputSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.string(),
});
export type LoginOutput = z.infer<typeof loginOutputSchema>;

export const refreshSessionInputSchema = z.object({ token: z.string() });
export type RefreshSessionInput = z.infer<typeof refreshSessionInputSchema>;
export const refreshSessionOutputSchema = z.object({
  accessToken: z.string(),
  refresh: z.object({ token: z.string(), expiresAt: z.string() }).nullable(),
});
export type RefreshSessionOutput = z.infer<typeof refreshSessionOutputSchema>;

export const changePasswordInputSchema = z.object({
  userId: z.string(),
  currentPassword: z.string(),
  newPassword: z.string(),
});
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;
export const changePasswordOutputSchema = z.void();
export type ChangePasswordOutput = z.infer<typeof changePasswordOutputSchema>;

export const logoutAllInputSchema = z.object({ userId: z.string(), currentPassword: z.string() });
export type LogoutAllInput = z.infer<typeof logoutAllInputSchema>;
export const logoutAllOutputSchema = z.void();
export type LogoutAllOutput = z.infer<typeof logoutAllOutputSchema>;

export const logoutInputSchema = z.object({ token: z.string().optional() });
export type LogoutInput = z.infer<typeof logoutInputSchema>;
export const logoutOutputSchema = z.void();
export type LogoutOutput = z.infer<typeof logoutOutputSchema>;
