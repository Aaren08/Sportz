import { z } from "zod";

// Schema for listing commentary query parameters
export const listCommentaryQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int({ message: "Limit must be an integer" })
    .positive({ message: "Limit must be a positive integer" })
    .max(100, { message: "Limit cannot exceed 100" })
    .optional(),
});

// Schema for creating a commentary event
export const createCommentarySchema = z.object({
  minute: z.coerce
    .number()
    .int({ message: "Minute must be an integer" })
    .nonnegative({ message: "Minute must be a non-negative integer" }),
  sequence: z.coerce.number().int({ message: "Sequence must be an integer" }),
  period: z.string().min(1, { message: "Period cannot be empty" }),
  eventType: z.string().min(1, { message: "Event type cannot be empty" }),
  actor: z.string().min(1, { message: "Actor cannot be empty" }),
  team: z.string().min(1, { message: "Team cannot be empty" }),
  message: z.string().min(1, { message: "Message cannot be empty" }),
  metadata: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});
