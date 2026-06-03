import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { normalizeVisitSchedulingConfig } from "./visitScheduling.ts";

Deno.test("normalizeVisitSchedulingConfig — defaults", () => {
  const cfg = normalizeVisitSchedulingConfig(null);
  assertEquals(cfg.mode, "queue");
  assertEquals(cfg.priorityCriterion, "numeric");
  assertEquals(cfg.brokerPriorities, {});
});

Deno.test("normalizeVisitSchedulingConfig — valores válidos", () => {
  const cfg = normalizeVisitSchedulingConfig({
    ai_visit_broker_mode: "manual",
    ai_visit_priority_criterion: "plantao_order",
    ai_visit_broker_priorities: { "550e8400-e29b-41d4-a716-446655440000": 150 },
  });
  assertEquals(cfg.mode, "manual");
  assertEquals(cfg.priorityCriterion, "plantao_order");
  assertEquals(
    cfg.brokerPriorities["550e8400-e29b-41d4-a716-446655440000"],
    100,
  );
});

Deno.test("normalizeVisitSchedulingConfig — inválidos caem no default", () => {
  const cfg = normalizeVisitSchedulingConfig({
    ai_visit_broker_mode: "invalid",
    ai_visit_priority_criterion: "x",
  });
  assertEquals(cfg.mode, "queue");
  assertEquals(cfg.priorityCriterion, "numeric");
});
