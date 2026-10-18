import { useEffect, useMemo, useState } from "react";
import { MAPS, type MapId } from "./maps";
import {
  addMarker, createPlan, deletePlan, loadPlans, removeMarker, savePlans,
  setRoute, upsertPlan, type MarkerKind, type TacticalPlan,
} from "./plans";
import { distance, toMeters } from "./geo";

const MARKER_KINDS: { id: MarkerKind; label: string; symbol: string }[] = [
  { id: "mark", label: "Mark", symbol: "⌖" },
  { id: "attack", label: "Attack", symbol: "⚔" },
  { id: "defend", label: "Defend", symbol: "⬟" },
  { id: "loot", label: "Loot", symbol: "◆" },
  { id: "vehicle", label: "Vehicle", symbol: "▰" },
  { id: "recall", label: "Recall", symbol: "↻" },
];

const initialPlan = (): TacticalPlan => createPlan("Squad plan", "rondo");

export default function App() {
  const [plans, setPlans] = useState<TacticalPlan[]>(() => {
    const stored = loadPlans();
    return stored.length ? stored : [initialPlan()];
  });
  const [activeId, setActiveId] = useState(() => plans[0]?.id ?? "");
  const [selectedMap, setSelectedMap] = useState<MapId>(() => plans[0]?.mapId ?? "rondo");
  const [tool, setTool] = useState<"marker" | "route" | "measure">("marker");
  const [markerKind, setMarkerKind] = useState<MarkerKind>("mark");
  const [routeDraft, setRouteDraft] = useState<{ x: number; y: number }[]>([]);
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [measureEnd, setMeasureEnd] = useState<{ x: number; y: number } | null>(null);
  const [metersPerPixel, setMetersPerPixel] = useState(1);
  const [showGrid, setShowGrid] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Ready");
  const [showIntel, setShowIntel] = useState(false);

  const activePlan = plans.find((plan) => plan.id === activeId) ?? plans[0];
  const map = MAPS[selectedMap];

  useEffect(() => {
    try { savePlans(plans); } catch { setStatus("Could not save plans in browser storage."); }
  }, [plans]);

  useEffect(() => {
    if (!activePlan) return;
    setSelectedMap(activePlan.mapId);
  }, [activePlan?.id]);

  const filteredMarkers = useMemo(() => (activePlan?.markers ?? []).filter((m) =>
    !search || m.label.toLowerCase().includes(search.toLowerCase()) || m.kind.includes(search.toLowerCase())
  ), [activePlan, search]);

  function updatePlan(next: TacticalPlan) {
    setPlans((previous) => upsertPlan(previous, next));
  }

  function pickPlan(id: string) {
    setActiveId(id);
    setRouteDraft([]);
    setMeasureStart(null);
    setMeasureEnd(null);
  }

  function changeMap(id: MapId) {
    if (activePlan && activePlan.mapId !== id) {
      const next = { ...activePlan, mapId: id, route: [], markers: [] };
      updatePlan(next);
      setStatus("Map changed. Markers and route were cleared to avoid misplaced coordinates.");
    }
    setSelectedMap(id);
    setRouteDraft([]);
  }

  function handleMapClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!activePlan) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };

    if (tool === "marker") {
      const label = window.prompt(`Label for ${markerKind} marker:`, markerKind === "mark" ? "Custom mark" : markerKind);
      if (label === null) return;
      updatePlan(addMarker(activePlan, { kind: markerKind, label, x: point.x, y: point.y }));
      setStatus(`${markerKind} marker added.`);
    } else if (tool === "route") {
      const next = [...routeDraft, point];
      setRouteDraft(next);
      updatePlan(setRoute(activePlan, next));
      setStatus(`Route point ${next.length} added. Click again to continue the route.`);
    } else if (!measureStart) {
      setMeasureStart(point);
      setMeasureEnd(null);
      setStatus("Measurement start selected. Click the end point.");
    } else {
      setMeasureEnd(point);
      setStatus("Measurement complete. Adjust the scale factor below if you have calibrated the map.");
    }
  }

  function undo() {
    if (!activePlan) return;
    if (routeDraft.length) {
      const next = routeDraft.slice(0, -1);
      setRouteDraft(next);
      updatePlan(setRoute(activePlan, next));
      setStatus("Last route point removed.");
      return;
    }
    if (activePlan.markers.length) {
      updatePlan(removeMarker(activePlan, activePlan.markers[activePlan.markers.length - 1].id));
      setStatus("Last marker removed.");
    }
  }

  function newPlan() {
    const name = window.prompt("Name your tactical plan:", `Plan ${plans.length + 1}`);
    if (name === null) return;
    const plan = createPlan(name, selectedMap);
    setPlans((previous) => upsertPlan(previous, plan));
    setActiveId(plan.id);
    setStatus("New plan created.");
  }

  function exportPlan() {
    if (!activePlan) return;
    const blob = new Blob([JSON.stringify(activePlan, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bgmimap-${activePlan.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "plan"}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatus("Plan exported as JSON.");
  }

  function importPlan(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 1_000_000) { setStatus("Import rejected: JSON file exceeds 1 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const value: unknown = JSON.parse(String(reader.result));
        if (!value || typeof value !== "object") throw new Error("Invalid JSON object");
        const candidate = value as Partial<TacticalPlan>;
        if (typeof candidate.name !== "string" || typeof candidate.mapId !== "string" ||
            !["erangel", "miramar", "rondo"].includes(candidate.mapId) ||
            !Array.isArray(candidate.markers) || !Array.isArray(candidate.route)) {
          throw new Error("File is not a BGMI Maps plan");
        }
        const plan = createPlan(candidate.name, candidate.mapId as MapId);
        const markers = candidate.markers.filter((m): m is TacticalPlan["markers"][number] =>
          !!m && typeof m === "object" && ["mark", "attack", "defend", "loot", "vehicle", "recall"].includes((m as {kind?: string}).kind ?? "") &&
          Number.isFinite((m as {x?: number}).x) && Number.isFinite((m as {y?: number}).y)
        ).map((m) => ({ ...m, id: crypto.randomUUID(), mapId: plan.mapId, x: Math.max(0, Math.min(1, m.x)), y: Math.max(0, Math.min(1, m.y)), createdAt: Date.now() }));
        const route = candidate.route.filter((p): p is {x:number;y:number} => !!p && Number.isFinite((p as {x?:number}).x) && Number.isFinite((p as {y?:number}).y))
          .map((p) => ({x:Math.max(0, Math.min(1,p.x)), y:Math.max(0, Math.min(1,p.y))}));
        const imported = { ...plan, markers, route };
        setPlans((previous) => upsertPlan(previous, imported));
        setActiveId(imported.id);
        setSelectedMap(imported.mapId);
        setStatus("Plan imported successfully.");
      } catch {
        setStatus("Import failed. Choose a valid BGMI Maps plan JSON file.");
      }
    };
    reader.readAsText(file);
  }

  const measurementPx = measureStart && measureEnd
    ? distance({ x: measureStart.x * map.width, y: measureStart.y * map.height }, { x: measureEnd.x * map.width, y: measureEnd.y * map.height })
    : 0;
  const measurementMeters = measurementPx ? toMeters(measurementPx, metersPerPixel) : 0;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="BGMI Maps home"><span className="brand-mark">B</span><span><strong>BGMI</strong><small>TACTICAL MAPS</small></span></a>
        <div className="topbar-right"><span className="live-dot" /> LOCAL PLANNER <span className="top-separator">/</span> ERANGEL · MIRAMAR · RONDO</div>
      </header>

      <section className="hero">
        <div><p className="eyebrow">SQUAD COMMAND CENTER</p><h1>Plan the drop.<br/><em>Own the circle.</em></h1><p className="hero-copy">Build routes, mark objectives, and coordinate your next BGMI match.</p></div>
        <div className="hero-actions"><button className="button primary" onClick={newPlan}>＋ New plan</button><button className="button secondary" onClick={exportPlan} disabled={!activePlan}>⇩ Export plan</button></div>
      </section>

      <section className="control-strip">
        <label className="control-label">ACTIVE PLAN<select value={activePlan?.id ?? ""} onChange={(e) => pickPlan(e.target.value)}>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="control-label">BATTLEFIELD<select value={selectedMap} onChange={(e) => changeMap(e.target.value as MapId)}>{Object.values(MAPS).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
        <div className="control-meta"><span>{activePlan?.markers.length ?? 0} MARKERS</span><span>{activePlan?.route.length ?? 0} ROUTE POINTS</span><button className="text-button danger" onClick={() => {if (!activePlan) return; if (window.confirm(`Delete "${activePlan.name}"?`)) {const remaining=deletePlan(plans,activePlan.id); const next=remaining.length?remaining:[initialPlan()]; setPlans(next); setActiveId(next[0].id); setStatus("Plan deleted.");}}}>Delete plan</button></div>
      </section>

      <section className="workspace">
        <aside className="sidebar">
          <div className="panel-heading"><span className="section-index">01</span><div><h2>Mission tools</h2><p>Choose your operation</p></div></div>
          <div className="tool-list">
            <button className={tool==="marker"?"tool-card selected":"tool-card"} onClick={()=>setTool("marker")}><span className="tool-icon">⌖</span><span><strong>Place marker</strong><small>Add tactical objectives</small></span><kbd>M</kbd></button>
            <button className={tool==="route"?"tool-card selected":"tool-card"} onClick={()=>{setTool("route");setRouteDraft(activePlan?.route??[]);}}><span className="tool-icon">⌁</span><span><strong>Draw route</strong><small>Click map to add waypoints</small></span><kbd>R</kbd></button>
            <button className={tool==="measure"?"tool-card selected":"tool-card"} onClick={()=>{setTool("measure");setMeasureStart(null);setMeasureEnd(null);}}><span className="tool-icon">↔</span><span><strong>Measure distance</strong><small>Measure between two points</small></span><kbd>D</kbd></button>
          </div>

          <div className="subsection"><div className="subsection-title">MARKER TYPE <span>SELECT</span></div><div className="marker-grid">{MARKER_KINDS.map(k=><button key={k.id} className={markerKind===k.id?"marker-type active":"marker-type"} onClick={()=>{setMarkerKind(k.id);setTool("marker");}}><span>{k.symbol}</span>{k.label}</button>)}</div></div>

          <div className="subsection"><div className="subsection-title">DISPLAY OPTIONS</div><label className="switch-row"><span><strong>Grid overlay</strong><small>Show tactical grid</small></span><input type="checkbox" checked={showGrid} onChange={(e)=>setShowGrid(e.target.checked)}/></label><button className="wide-button" onClick={undo}>↶ Undo last action</button><button className="wide-button" onClick={()=>{if(activePlan){updatePlan(setRoute(activePlan,[]));setRouteDraft([]);setStatus("Route cleared.");}}}>Clear route</button></div>

          <div className="subsection"><div className="subsection-title">DISTANCE CALIBRATION <span>OPTIONAL</span></div><label className="scale-label">Meters per map unit<input type="number" min="0.001" max="10000" step="0.1" value={metersPerPixel} onChange={(e)=>setMetersPerPixel(Math.max(0.001,Number(e.target.value)||1))}/></label><p className="muted-note">Measurement is approximate until you calibrate the scale for the selected map image.</p></div>

          <div className="sidebar-footer"><span className="save-indicator"/> Autosave enabled <span className="footer-note">ON THIS DEVICE</span></div>
        </aside>

        <section className="map-section">
          <div className="map-toolbar"><div><p className="eyebrow">TACTICAL OVERVIEW</p><h2>{map.label}<span className="map-badge">CLASSIC</span></h2></div><div className="map-toolbar-actions"><button className={showIntel?"icon-button active":"icon-button"} title="Tactical intel" onClick={()=>setShowIntel(!showIntel)}>ⓘ</button><label className="icon-button upload-label" title="Import plan JSON">⇧<input type="file" accept="application/json,.json" onChange={importPlan}/></label></div></div>
          <div className="map-instructions"><span className="instruction-symbol">i</span><span>{tool==="marker"?`Click the map to place a ${markerKind} marker`:tool==="route"?"Click multiple map points to draw your squad route":"Click a start point, then an end point to measure distance"}</span><button onClick={()=>{setRouteDraft([]);setMeasureStart(null);setMeasureEnd(null);}}>Reset tool</button></div>

          <div className={"map-canvas "+(showGrid?"with-grid":"")} onClick={handleMapClick} role="application" aria-label={`${map.label} tactical map. Click to place markers, routes, or measurement points.`}>
            <img className="map-image" src={map.image} alt={`${map.label} game map`} draggable={false}/>
            {showGrid&&<div className="grid-overlay"/>}
            {activePlan?.route.length ? <svg className="route-layer" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="Squad route"><polyline points={activePlan.route.map(p=>`${p.x*1000},${p.y*1000}`).join(" ")} fill="none" stroke="#ffcf54" strokeWidth="4" strokeDasharray="12 7" vectorEffect="non-scaling-stroke"/>{activePlan.route.map((p,i)=><circle key={i} cx={p.x*1000} cy={p.y*1000} r="7" fill="#ffcf54" stroke="#171a18" strokeWidth="2" vectorEffect="non-scaling-stroke"/>)}</svg>:null}
            {activePlan?.markers.map((m)=><button key={m.id} className={`map-marker marker-${m.kind}`} style={{left:`${m.x*100}%`,top:`${m.y*100}%`}} title={m.label} onClick={(e)=>{e.stopPropagation();if(window.confirm(`Remove marker "${m.label}"?`)){updatePlan(removeMarker(activePlan,m.id));setStatus("Marker removed.");}}}><span>{MARKER_KINDS.find(k=>k.id===m.kind)?.symbol??"⌖"}</span><small>{m.label}</small></button>)}
            {tool==="measure"&&measureStart&&<div className="measure-point" style={{left:`${measureStart.x*100}%`,top:`${measureStart.y*100}%`}}/>}
            {tool==="measure"&&measureEnd&&<><div className="measure-point end" style={{left:`${measureEnd.x*100}%`,top:`${measureEnd.y*100}%`}}/><div className="measure-line" style={{left:`${measureStart!.x*100}%`,top:`${measureStart!.y*100}%`,width:`${Math.hypot((measureEnd.x-measureStart!.x)*100,(measureEnd.y-measureStart!.y)*100)}%`,transform:`rotate(${Math.atan2(measureEnd.y-measureStart!.y,measureEnd.x-measureStart!.x)}rad)`}}/></>}
          </div>
          <div className="map-legend"><span><i className="legend-dot attack"/> Attack</span><span><i className="legend-dot defend"/> Defend</span><span><i className="legend-dot loot"/> Loot</span><span><i className="legend-dot vehicle"/> Vehicle</span><span><i className="legend-dot recall"/> Recall</span><span><i className="legend-dot mark"/> Custom mark</span></div>
          {tool==="measure"&&measureEnd&&<div className="measurement-result"><span>MEASURED DISTANCE</span><strong>{measurementMeters.toLocaleString(undefined,{maximumFractionDigits:1})} m</strong><small>{measurementPx.toLocaleString(undefined,{maximumFractionDigits:1})} map units · calibrated scale</small></div>}
          {showIntel&&<div className="intel-card"><button className="intel-close" onClick={()=>setShowIntel(false)}>×</button><strong>TACTICAL INTEL</strong><p>Reference notes are community strategy heuristics, not guaranteed spawn data. Loot, vehicles, and recall availability can vary by mode and update.</p><a href="https://pubg.com/" target="_blank" rel="noreferrer">Official PUBG resources ↗</a></div>}
          <div className="map-status"><span className="save-indicator"/>{status}<span className="status-right">CLICK MAP TO INTERACT</span></div>
        </section>
      </section>

      <section className="marker-table-section"><div className="panel-heading"><span className="section-index">02</span><div><h2>Mission markers</h2><p>All objectives in the current plan</p></div></div><div className="marker-table-toolbar"><span>{filteredMarkers.length} ITEMS</span><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search markers..." aria-label="Search markers"/></div><div className="table-scroll"><table><thead><tr><th>TYPE</th><th>LABEL</th><th>POSITION</th><th>ADDED</th><th/></tr></thead><tbody>{filteredMarkers.map(m=><tr key={m.id}><td><span className={`table-kind marker-${m.kind}`}>{MARKER_KINDS.find(k=>k.id===m.kind)?.symbol} {m.kind}</span></td><td>{m.label}</td><td>{(m.x*100).toFixed(1)}% / {(m.y*100).toFixed(1)}%</td><td>{new Date(m.createdAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</td><td><button className="text-button danger" onClick={()=>activePlan&&updatePlan(removeMarker(activePlan,m.id))}>Remove</button></td></tr>)}{filteredMarkers.length===0&&<tr><td colSpan={5} className="empty-state">No markers yet. Pick a marker type and click on the map to add one.</td></tr>}</tbody></table></div></section>
      <footer className="page-footer"><span>BGMI TACTICAL MAPS</span><span>Community planning tool · Not affiliated with KRAFTON</span><span>PLANS STORED LOCALLY</span></footer>
    </main>
  );
}
