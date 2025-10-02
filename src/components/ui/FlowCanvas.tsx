import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';

export type NodeData = {
  id: string;
  title: string;
  subtitle?: string;
  subtitleLines?: string[];
  color: 'primary' | 'accent' | 'lime' | 'sky' | 'slate';
  x: number;
  y: number;
};

type Edge = { from: string; to: string };

interface FlowCanvasProps {
  nodes: NodeData[];
  edges: Edge[];
  height?: number;
}

 export type FlowCanvasHandle = {
   fitToView: () => void;
   resetView: () => void;
   zoomIn: () => void;
   zoomOut: () => void;
   getSvgElement: () => SVGSVGElement | null;
   getCurrentNodes: () => NodeData[];
 };

// Paleta modernizada para fundo cinza suave
const colorMap: Record<NodeData['color'], { head: string; body: string }> = {
  primary: { head: '#8B5CF6', body: '#ffffff' },
  accent:  { head: '#A855F7', body: '#ffffff' },
  lime:    { head: '#A3E635', body: '#ffffff' },
  sky:     { head: '#38BDF8', body: '#ffffff' },
  slate:   { head: '#94A3B8', body: '#ffffff' }
};

const BG_SOLID = '#f1f5f9';

const MIN_SCALE = 0.4;
const MAX_SCALE = 2;
const ZOOM_STEP = 0.15;

const FlowCanvas = forwardRef<FlowCanvasHandle, FlowCanvasProps>(({ nodes, edges }, ref) => {
  const [localNodes, setLocalNodes] = useState<NodeData[]>(nodes);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const panRef = useRef<{ x: number; y: number } | null>(null);
  const isPanning = useRef(false);
  const dragging = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => { setLocalNodes(nodes); }, [nodes]);

  const NODE_W = 280;
  const NODE_H = 140;
  const pad = 60;

  const xs = localNodes.map(n => n.x);
  const ys = localNodes.map(n => n.y);
  const minX = Math.min(...xs) - NODE_W / 2 - pad;
  const minY = Math.min(...ys) - NODE_H / 2 - pad;
  const maxX = Math.max(...xs) + NODE_W / 2 + pad;
  const maxY = Math.max(...ys) + NODE_H / 2 + pad;
  const width = maxX - minX;
  const svgHeight = maxY - minY;

  const find = (id: string) => localNodes.find(n => n.id === id);

  const getSvgCoords = (clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: clientX, y: clientY };
    const pt = svgRef.current.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
    return { x: svgP.x, y: svgP.y };
  };

  const onNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    const svgCoords = getSvgCoords(e.clientX, e.clientY);
    const node = find(id);
    if (!node) return;
    dragging.current = {
      id,
      offsetX: svgCoords.x - node.x,
      offsetY: svgCoords.y - node.y
    };
    window.addEventListener('mousemove', onNodeDrag as any);
    window.addEventListener('mouseup', onNodeUp as any);
  };

  // Touch drag node (mobile)
  const onNodeTouchStart = (e: React.TouchEvent, id: string) => {
    e.stopPropagation();
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const svgCoords = getSvgCoords(t.clientX, t.clientY);
    const node = find(id);
    if (!node) return;
    dragging.current = {
      id,
      offsetX: svgCoords.x - node.x,
      offsetY: svgCoords.y - node.y
    };
    window.addEventListener('touchmove', onNodeTouchMove as any, { passive: false } as any);
    window.addEventListener('touchend', onNodeTouchEnd as any);
  };
  const onNodeTouchMove = (e: TouchEvent) => {
    if (!dragging.current) return;
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const t = e.touches[0];
    const { id, offsetX, offsetY } = dragging.current;
    const svgCoords = getSvgCoords(t.clientX, t.clientY);
    setLocalNodes(prev => prev.map(n => n.id === id ? { ...n, x: svgCoords.x - offsetX, y: svgCoords.y - offsetY } : n));
  };
  const onNodeTouchEnd = () => {
    dragging.current = null;
    window.removeEventListener('touchmove', onNodeTouchMove as any);
    window.removeEventListener('touchend', onNodeTouchEnd as any);
  };

  const onNodeDrag = (e: MouseEvent) => {
    if (!dragging.current) return;
    const { id, offsetX, offsetY } = dragging.current;
    const svgCoords = getSvgCoords(e.clientX, e.clientY);
    setLocalNodes(prev =>
      prev.map(n =>
        n.id === id ? { ...n, x: svgCoords.x - offsetX, y: svgCoords.y - offsetY } : n
      )
    );
  };

  const onNodeUp = () => {
    dragging.current = null;
    window.removeEventListener('mousemove', onNodeDrag as any);
    window.removeEventListener('mouseup', onNodeUp as any);
  };

  const onPanStart = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-node-id]')) return; // não iniciar pan quando clicando no nó
    e.preventDefault();
    isPanning.current = true;
    panRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    window.addEventListener('mousemove', onPanMove as any);
    window.addEventListener('mouseup', onPanEnd as any);
  };

  // Touch pan (mobile)
  const onPanTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-node-id]')) return;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    e.preventDefault();
    isPanning.current = true;
    panRef.current = { x: t.clientX - offset.x, y: t.clientY - offset.y };
    window.addEventListener('touchmove', onPanTouchMove as any, { passive: false } as any);
    window.addEventListener('touchend', onPanTouchEnd as any);
  };
  const onPanTouchMove = (e: TouchEvent) => {
    if (!isPanning.current || !panRef.current) return;
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const t = e.touches[0];
    setOffset({ x: t.clientX - panRef.current.x, y: t.clientY - panRef.current.y });
  };
  const onPanTouchEnd = () => {
    isPanning.current = false;
    window.removeEventListener('touchmove', onPanTouchMove as any);
    window.removeEventListener('touchend', onPanTouchEnd as any);
  };

  const onPanMove = (e: MouseEvent) => {
    if (!isPanning.current || !panRef.current) return;
    setOffset({
      x: e.clientX - panRef.current.x,
      y: e.clientY - panRef.current.y
    });
  };

  const onPanEnd = () => {
    isPanning.current = false;
    window.removeEventListener('mousemove', onPanMove as any);
    window.removeEventListener('mouseup', onPanEnd as any);
  };

  useImperativeHandle(ref, () => ({
    fitToView: () => { setScale(1); setOffset({ x: 0, y: 0 }); },
    resetView: () => { setScale(1); setOffset({ x: 0, y: 0 }); },
    zoomIn: () => setScale(s => Math.min(s + ZOOM_STEP, MAX_SCALE)),
    zoomOut: () => setScale(s => Math.max(s - ZOOM_STEP, MIN_SCALE)),
    getSvgElement: () => svgRef.current,
    getCurrentNodes: () => nodes,
  }), [nodes]);

  const onWheel = (e: React.WheelEvent) => {
    if (dragging.current) return;
    e.preventDefault();
    setScale(prev => {
      let next = e.deltaY < 0 ? prev + ZOOM_STEP : prev - ZOOM_STEP;
      next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next));
      return next;
    });
  };

  return (
    <div className="w-full h-full relative select-none"
      style={{ background: BG_SOLID }}
    >
      <svg
        ref={svgRef}
        viewBox={`${minX} ${minY} ${width} ${svgHeight}`}
        className="w-full h-full"
        style={{
          display: 'block',
          minHeight: 300,
          height: '100%',
          width: '100%',
          touchAction: 'none',
          userSelect: 'none',
          background: BG_SOLID
        }}
        onMouseDown={onPanStart}
        onTouchStart={onPanTouchStart}
        onWheel={onWheel}
      >
        {/* Fundo com padrão de pontinhos */}
        <rect
          x={minX}
          y={minY}
          width={width}
          height={svgHeight}
          fill={BG_SOLID}
        />
        {/* Padrão de pontinhos */}
        <defs>
          <pattern
            id="dots"
            x="0"
            y="0"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="10" cy="10" r="1" fill="#e2e8f0" opacity="0.3" />
          </pattern>
        </defs>
        <rect
          x={minX}
          y={minY}
          width={width}
          height={svgHeight}
          fill="url(#dots)"
        />
        <g
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0'
          }}
        >
          {/* Edges - brancas, bem visíveis */}
          {edges.map((e, i) => {
            const a = find(e.from);
            const b = find(e.to);
            if (!a || !b) return null;
            const dx = (b.x - a.x) * 0.5;
            const path = `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
            return (
              <path
                key={i}
                d={path}
                fill="none"
                stroke="#374151"
                strokeOpacity={0.8}
                strokeWidth={2}
                style={{ filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.1))' }}
              />
            );
          })}
          {localNodes.map(n => (
            <foreignObject
              key={n.id}
              x={n.x - NODE_W/2}
              y={n.y - NODE_H/2}
              width={NODE_W}
              height={NODE_H}
              style={{ cursor: 'grab', overflow: 'visible' }}
              onMouseDown={e => onNodeMouseDown(e, n.id)}
              onTouchStart={e => onNodeTouchStart(e, n.id)}
            >
                <div>
                <div style={{
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  borderRadius: "14px",
                  border: "1px solid rgba(0,0,0,0.1)",
                  overflow: "hidden",
                  background: "#ffffff"
                }}>
                  <div style={{
                    background: colorMap[n.color].head,
                    color: "#ffffff",
                    fontWeight: 600,
                    padding: "8px 12px",
                    fontSize: "0.8rem",
                    borderBottom: "1px solid rgba(0,0,0,0.1)"
                  }}>
                    {n.title}
                  </div>
                  <div style={{
                    background: colorMap[n.color].body,
                    color: "#334155",
                    fontSize: "0.75rem",
                    padding: "10px 12px"
                  }}>
                    {n.subtitleLines && n.subtitleLines.length > 0
                      ? n.subtitleLines.map((line, idx) => <div key={idx}>{line}</div>)
                      : n.subtitle}
                  </div>
                </div>
              </div>
            </foreignObject>
          ))}
        </g>
      </svg>
      {/* Controle de zoom integrado */}
      <div className="absolute bottom-4 left-4 z-10" data-export-ignore="true">
        <div style={{
          background: "#ffffff",
          borderRadius: "8px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          overflow: "hidden",
          width: "40px",
          height: "120px"
        }}>
          {/* Botão fit to view */}
          <button
            onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}
            style={{
              width: "100%",
              height: "40px",
              background: "#ffffff",
              border: "none",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#334155"
            }}
            aria-label="Ajustar à tela"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="4" y="4" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M2 2h2v2M14 2h-2v2M2 14h2v-2M14 14h-2v-2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            </svg>
          </button>
          
          {/* Controles de zoom */}
          <div style={{ height: "80px", display: "flex", flexDirection: "column" }}>
            <button
              onClick={() => setScale(s => Math.min(s + ZOOM_STEP, MAX_SCALE))}
              style={{
                flex: 1,
                background: "#ffffff",
                border: "none",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#334155",
                fontSize: "16px",
                fontWeight: "500"
              }}
              aria-label="Aumentar zoom"
            >+</button>
            <button
              onClick={() => setScale(s => Math.max(s - ZOOM_STEP, MIN_SCALE))}
              style={{
                flex: 1,
                background: "#ffffff",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#334155",
                fontSize: "16px",
                fontWeight: "500"
              }}
              aria-label="Diminuir zoom"
            >-</button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default FlowCanvas;
