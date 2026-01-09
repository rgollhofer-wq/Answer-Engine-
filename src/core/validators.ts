import { z } from "zod";

const vehicleSchema = z
  .object({
    year: z.number().int().optional().nullable(),
    make: z.string().optional().nullable(),
    model: z.string().optional().nullable(),
    trim: z.string().optional().nullable(),
    engine: z.string().optional().nullable(),
    vin: z.string().optional().nullable(),
  })
  .partial();

const partSchema = z
  .object({
    name: z.string().optional().nullable(),
    oem_part_number: z.string().optional().nullable(),
  })
  .partial();

const locationSchema = z
  .object({
    postal_code: z.string().optional().nullable(),
    radius_miles: z.number().optional().nullable(),
  })
  .partial();

export const contextSchema = z
  .object({
    vehicle: vehicleSchema.optional().nullable(),
    part: partSchema.optional().nullable(),
    location: locationSchema.optional().nullable(),
  })
  .partial();

export const answerRequestSchema = z.object({
  question: z.string().min(1),
  context: contextSchema.optional().nullable(),
  mode: z.enum(["pilot", "internal_test"]).optional().default("pilot"),
});

export type AnswerRequest = z.infer<typeof answerRequestSchema>;
export type AnswerRequestContext = z.infer<typeof contextSchema>;
