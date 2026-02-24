import { z } from "zod";

// Constant for match status values
export const MATCH_STATUS = {
  SCHEDULED: "scheduled",
  LIVE: "live",
  FINISHED: "finished",
};

// Schema for list matches query parameters
export const listMatchesQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int({ message: "Limit must be an integer" })
    .positive({ message: "Limit must be a positive integer" })
    .max(100, { message: "Limit cannot exceed 100" })
    .optional(),
});

// Schema for match ID route parameter
export const matchIdParamSchema = z.object({
  id: z.coerce
    .number()
    .int({ message: "ID must be an integer" })
    .positive({ message: "ID must be a positive integer" }),
});

// ISO date string refinement helper
const isoDateStringSchema = z.string().refine(
  (val) => {
    const parsedDate = new Date(val);
    return !isNaN(parsedDate.getTime()) && val === parsedDate.toISOString();
  },
  { message: "Must be a valid ISO date string" },
);

// Schema for creating a new match
export const createMatchSchema = z
  .object({
    sport: z.string().min(1, { message: "Sport cannot be empty" }),
    homeTeam: z.string().min(1, { message: "Home team cannot be empty" }),
    awayTeam: z.string().min(1, { message: "Away team cannot be empty" }),
    startTime: isoDateStringSchema,
    endTime: isoDateStringSchema,
    homeScore: z.coerce
      .number()
      .int({ message: "Home score must be an integer" })
      .nonnegative({ message: "Home score must be a non-negative integer" })
      .optional(),
    awayScore: z.coerce
      .number()
      .int({ message: "Away score must be an integer" })
      .nonnegative({ message: "Away score must be a non-negative integer" })
      .optional(),
  })
  .superRefine((data, ctx) => {
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);

    if (endTime <= startTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endTime must be chronologically after startTime",
        path: ["endTime"],
      });
    }
  });

// Schema for updating match scores
export const updateScoreSchema = z.object({
  homeScore: z.coerce
    .number()
    .int({ message: "Home score must be an integer" })
    .nonnegative({ message: "Home score must be a non-negative integer" }),
  awayScore: z.coerce
    .number()
    .int({ message: "Away score must be an integer" })
    .nonnegative({ message: "Away score must be a non-negative integer" }),
});
