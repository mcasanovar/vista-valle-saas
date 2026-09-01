import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { describe, expect, it, vi } from "vitest";

vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));

import { proxy } from "../proxy";

describe("admin proxy", () => {
  it("short-circuits in explicit mock context without network activity", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const response = await proxy(new NextRequest("http://localhost/admin"));

    expect(response.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(createServerClient).not.toHaveBeenCalled();
  });
});
