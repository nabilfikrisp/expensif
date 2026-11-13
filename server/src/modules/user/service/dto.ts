import { z } from "zod";

export const deleteUserInputSchema = z.object({ userId: z.string() });
export type DeleteUserInput = z.infer<typeof deleteUserInputSchema>;
export const deleteUserOutputSchema = z.void();
export type DeleteUserOutput = z.infer<typeof deleteUserOutputSchema>;

export const getUserInputSchema = z.object({ userId: z.string() });
export type GetUserInput = z.infer<typeof getUserInputSchema>;
export const getUserOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
});
export type GetUserOutput = z.infer<typeof getUserOutputSchema>;

export const getUserByEmailInputSchema = z.object({ email: z.string() });
export type GetUserByEmailInput = z.infer<typeof getUserByEmailInputSchema>;
export const getUserByEmailOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
});
export type GetUserByEmailOutput = z.infer<typeof getUserByEmailOutputSchema>;
