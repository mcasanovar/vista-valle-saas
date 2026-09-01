import { z } from "zod";

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_VISTA_VALLE_CONFIG_CONTEXT: z.enum(["mock", "production"]),
});

const browserEnvironment = {
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_VISTA_VALLE_CONFIG_CONTEXT:
    process.env.NEXT_PUBLIC_VISTA_VALLE_CONFIG_CONTEXT,
};

export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;

function describeIssue(issue: z.core.$ZodIssue) {
  const key = issue.path.join(".") || "environment";

  switch (issue.code) {
    case "invalid_type":
      return `${key} is required or has an invalid type`;
    case "invalid_format":
      return `${key} has an invalid format`;
    case "too_small":
      return `${key} must not be empty`;
    default:
      return `${key} is invalid`;
  }
}

export function formatEnvironmentError(scope: string, error: z.ZodError) {
  const issues = error.issues.map(describeIssue).join("; ");

  return new Error(`Invalid ${scope} environment configuration: ${issues}`);
}

export function getPublicEnvironment(
  environment: Record<string, string | undefined> = browserEnvironment
): PublicEnvironment {
  const parsed = publicEnvironmentSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_ANON_KEY: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_URL: environment.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_VISTA_VALLE_CONFIG_CONTEXT:
      environment.NEXT_PUBLIC_VISTA_VALLE_CONFIG_CONTEXT,
  });

  if (!parsed.success) {
    throw formatEnvironmentError("public", parsed.error);
  }

  return parsed.data;
}
