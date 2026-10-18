export type MapId = "erangel" | "miramar" | "rondo";
export type MapDefinition = {
  id: MapId;
  label: string;
  image: string;
  width: number;
  height: number;
};

export const MAPS: Record<MapId, MapDefinition> = {
  erangel: { id: "erangel", label: "Erangel", image: "/maps/erangel.webp", width: 8192, height: 8192 },
  miramar: { id: "miramar", label: "Miramar", image: "/maps/miramar.webp", width: 8192, height: 8192 },
  rondo: { id: "rondo", label: "Rondo", image: "/maps/rondo.webp", width: 8192, height: 8192 },
};

export function isMapId(value: string): value is MapId {
  return Object.prototype.hasOwnProperty.call(MAPS, value);
}

export function mapImageUrl(id: MapId): string {
  return MAPS[id].image;
}
