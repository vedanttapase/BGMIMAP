import { beforeEach, describe, expect, it } from "vitest";
import { addMarker, createPlan, deletePlan, loadPlans, removeMarker, savePlans, setRoute, upsertPlan } from "./plans";

describe("tactical plans", () => {
  beforeEach(() => {
    const memory = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
      removeItem: (key: string) => { memory.delete(key); },
      clear: () => memory.clear(),
    }});
    localStorage.clear();
  });
  it("creates named plans and defaults empty names", () => {
    expect(createPlan(" Alpha ", "rondo").name).toBe("Alpha");
    expect(createPlan("", "erangel").name).toBe("Untitled plan");
  });
  it("clamps marker coordinates and removes markers", () => {
    const plan = createPlan("Test", "rondo");
    const next = addMarker(plan, { kind: "mark", label: " hello ", x: 2, y: -1 });
    expect(next.markers[0].x).toBe(1);
    expect(next.markers[0].y).toBe(0);
    expect(next.markers[0].label).toBe("hello");
    expect(removeMarker(next, next.markers[0].id).markers).toHaveLength(0);
  });
  it("clamps route values, upserts plans and deletes safely", () => {
    const plan = createPlan("Route", "miramar");
    const routed = setRoute(plan, [{ x: 1.5, y: -1 }, { x: 0.2, y: 0.8 }]);
    expect(routed.route).toEqual([{ x: 1, y: 0 }, { x: 0.2, y: 0.8 }]);
    expect(upsertPlan([plan], routed)).toHaveLength(1);
    expect(deletePlan([routed], routed.id)).toEqual([]);
  });
  it("persists and reloads plans", () => {
    const plan = createPlan("Saved", "erangel");
    savePlans([plan]);
    expect(loadPlans()[0].name).toBe("Saved");
  });
});
