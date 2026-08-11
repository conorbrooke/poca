import { BadRequestException } from "@nestjs/common";
import type { ZodType, z } from "zod";

export function parseOrThrow<T extends ZodType>(
  schema: T,
  input: unknown,
  label: string,
): z.output<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestException({
      message: label,
      errors: parsed.error.flatten(),
    });
  }
  return parsed.data;
}
