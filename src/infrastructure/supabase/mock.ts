import type {
  ApplicationSession,
  MockSupabaseAdapter,
} from "@/infrastructure/supabase/contracts";

export const mockAdministrativeSession: ApplicationSession = Object.freeze({
  user: Object.freeze({
    email: "mock-admin@example.test",
    id: "00000000-0000-4000-8000-000000000001",
    role: "authenticated",
  }),
});

export function createMockSupabaseAdapter(
  session: ApplicationSession | null = mockAdministrativeSession
): MockSupabaseAdapter {
  return Object.freeze({
    context: "mock",
    session: Object.freeze({
      getSession: async () => session,
    }),
  });
}
