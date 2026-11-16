import { z } from "zod";

export const createThoughtInput = z.object({
  body: z.string().trim().min(1, "Write a thought first.").max(3000, "Keep thoughts under 3,000 characters."),
}).strict();

export const updateThoughtInput = z.object({
  body: z.string().trim().min(1).max(3000).optional(),
  notes: z.string().trim().max(5000).optional(),
  discussed: z.boolean().optional(),
}).strict().refine(value => Object.keys(value).length > 0, "No changes supplied.");
