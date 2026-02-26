import { Router } from "express";
import { db } from "../db/db.js";
import { commentary } from "../db/schema.js";
import {
  createCommentarySchema,
  listCommentaryQuerySchema,
} from "../validation/commentary.js";
import { matchIdParamSchema } from "../validation/matches.js";
import { desc, eq } from "drizzle-orm";

export const commentaryRouter = Router({ mergeParams: true });

commentaryRouter.get("/", async (req, res) => {
  const parsedParams = matchIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({
      error: "Invalid route parameters.",
      details: JSON.stringify(parsedParams.error),
    });
  }

  const parsedQuery = listCommentaryQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({
      error: "Invalid query parameters.",
      details: JSON.stringify(parsedQuery.error),
    });
  }

  const MAX_LIMIT = 100;
  const limit = Math.min(parsedQuery.data.limit ?? 100, MAX_LIMIT);

  try {
    const results = await db
      .select()
      .from(commentary)
      .where(eq(commentary.matchId, parsedParams.data.id))
      .orderBy(desc(commentary.createdAt))
      .limit(limit);

    return res.json({ data: results });
  } catch (error) {
    console.error("Error retrieving commentary:", error);
    return res.status(500).json({
      error: "Failed to retrieve commentary.",
    });
  }
});

commentaryRouter.post("/", async (req, res) => {
  const parsedParams = matchIdParamSchema.safeParse(req.params);

  if (!parsedParams.success) {
    return res.status(400).json({
      error: "Invalid route parameters.",
      details: JSON.stringify(parsedParams.error),
    });
  }

  const parsedBody = createCommentarySchema.safeParse(req.body);

  if (!parsedBody.success) {
    return res.status(400).json({
      error: "Invalid payload.",
      details: JSON.stringify(parsedBody.error),
    });
  }

  try {
    const [createdCommentary] = await db
      .insert(commentary)
      .values({
        matchId: parsedParams.data.id,
        ...parsedBody.data,
      })
      .returning();

    if (res.app.locals.broadcastCommentaryUpdate) {
      res.app.locals.broadcastCommentaryUpdate(
        createdCommentary.matchId,
        createdCommentary,
      );
    }

    return res.status(201).json({ data: createdCommentary });
  } catch (error) {
    console.error("Error creating commentary:", error);
    return res.status(500).json({
      error: "Failed to create commentary.",
    });
  }
});
