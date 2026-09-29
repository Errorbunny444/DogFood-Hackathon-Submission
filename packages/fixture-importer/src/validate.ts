import { z } from 'zod';

export const fixtureEventSchema = z.object({
  id: z.string(),
  name: z.string(),
  submissions_close: z.string(),
});

export const fixtureTrackSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const fixtureJudgeSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  tracks: z.array(z.string()),
});

export const fixtureTeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  members: z.array(z.string().email()),
});

export const fixtureProjectSchema = z.object({
  id: z.string(),
  team: z.string(),
  track: z.string(),
  title: z.string(),
  summary: z.string().default(''),
  repo_url: z.string().optional(),
  submitted_at: z.string().optional(),
});

export const fixtureScoreSchema = z.object({
  judge: z.string(),
  project: z.string(),
  criteria: z.record(z.number()),
  comment: z.string().default(''),
});

export const fixtureFileSchema = z.object({
  event: fixtureEventSchema,
  tracks: z.array(fixtureTrackSchema),
  judges: z.array(fixtureJudgeSchema),
  teams: z.array(fixtureTeamSchema),
  projects: z.array(fixtureProjectSchema),
  scores: z.array(fixtureScoreSchema),
});

export type FixtureFile = z.infer<typeof fixtureFileSchema>;
