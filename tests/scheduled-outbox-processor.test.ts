import { describe, expect, it, vi } from "vitest";

import { createScheduledOutboxProcessor } from "@/features/notifications";

describe("scheduled outbox processor", () => {
  it("processes only a bounded snapshot of ready intents", async () => {
    const process = vi.fn().mockResolvedValue(undefined);
    const processor = createScheduledOutboxProcessor(
      {
        listReady: () => [{ id: "one" }, { id: "two" }, { id: "three" }],
        process: { process },
      },
      2
    );

    await expect(processor.run()).resolves.toEqual({
      processed: 2,
      stopped: "batch_limit",
    });
    expect(process).toHaveBeenCalledTimes(2);
    expect(process).toHaveBeenNthCalledWith(1, "one");
    expect(process).toHaveBeenNthCalledWith(2, "two");
  });

  it("skips non-ready intents and stops cleanly when no work is available", async () => {
    const process = vi.fn();
    const processor = createScheduledOutboxProcessor({
      listReady: () => [],
      process: { process },
    });

    await expect(processor.run()).resolves.toEqual({
      processed: 0,
      stopped: "no_ready",
    });
    expect(process).not.toHaveBeenCalled();
  });

  it("stops at its explicit serverless time budget", async () => {
    let elapsedMs = 0;
    const process = vi.fn().mockImplementation(async () => {
      elapsedMs = 10;
    });
    const processor = createScheduledOutboxProcessor(
      {
        listReady: () => [{ id: "one" }, { id: "two" }],
        now: () => new Date(elapsedMs),
        process: { process },
      },
      20,
      5
    );

    await expect(processor.run()).resolves.toEqual({
      processed: 1,
      stopped: "time_budget",
    });
    expect(process).toHaveBeenCalledOnce();
  });
});
