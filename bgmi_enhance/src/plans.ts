import type { MapId } from "./maps";

export type MarkerKind = "attack" | "defend" | "loot" | "vehicle" | "recall" | "mark";
export type MapMarker = {
  id: string;
  mapId: MapId;
  kind: MarkerKind;
  x: number;
  y: number;
  label: string;
  createdAt: number;
};
export type RoutePoint = { x: number; y: number };
export type TacticalPlan = {
  id: string;
  name: string;
  mapId: MapId;
  markers: MapMarker[];
  route: RoutePoint[];
  updatedAt: number;
};

const STORAGE_KEY = "bgmimap.plans.v1";
const MAX_PLANS = 100;

function makeId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isValidPlan(value: unknown): value is TacticalPlan {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<TacticalPlan>;
  return typeof p.id === "string" && typeof p.name === "string" &&
    typeof p.mapId === "string" && ["erangel", "miramar", "rondo"].includes(p.mapId) &&
    Array.isArray(p.markers) && Array.isArray(p.route) &&
    typeof p.updatedAt === "number";
}

export function loadPlans(): TacticalPlan[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidPlan).slice(0, MAX_PLANS) : [];
  } catch {
    return [];
  }
}

export function savePlans(plans: TacticalPlan[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans.slice(0, MAX_PLANS)));
}

export function createPlan(name: string, mapId: MapId): TacticalPlan {
  const now = Date.now();
  return { id: makeId(), name: name.trim() || "Untitled plan", mapId, markers: [], route: [], updatedAt: now };
}

export function upsertPlan(plans: TacticalPlan[], plan: TacticalPlan): TacticalPlan[] {
  const next = plans.filter((candidate) => candidate.id !== plan.id);
  next.unshift({ ...plan, updatedAt: Date.now() });
  return next.slice(0, MAX_PLANS);
}

export function deletePlan(plans: TacticalPlan[], planId: string): TacticalPlan[] {
  return plans.filter((plan) => plan.id !== planId);
}

export function addMarker(plan: TacticalPlan, marker: Omit<MapMarker, "id" | "createdAt" | "mapId">): TacticalPlan {
  const safeMarker: MapMarker = {
    ...marker,
    id: makeId(),
    mapId: plan.mapId,
    createdAt: Date.now(),
    x: Math.min(1, Math.max(0, marker.x)),
    y: Math.min(1, Math.max(0, marker.y)),
    label: marker.label.trim().slice(0, 80),
  };
  return { ...plan, markers: [...plan.markers, safeMarker], updatedAt: Date.now() };
}

export function removeMarker(plan: TacticalPlan, markerId: string): TacticalPlan {
  return { ...plan, markers: plan.markers.filter((marker) => marker.id !== markerId), updatedAt: Date.now() };
}

export function setRoute(plan: TacticalPlan, route: RoutePoint[]): TacticalPlan {
  return {
    ...plan,
    route: route.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
      .map((point) => ({ x: Math.min(1, Math.max(0, point.x)), y: Math.min(1, Math.max(0, point.y)) })),
    updatedAt: Date.now(),
  };
}
