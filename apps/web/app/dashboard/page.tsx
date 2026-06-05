'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';


type FabricModule = typeof import('fabric');

const STORAGE_KEY = 'whiteboard_data';

const BLANK_CANVAS_JSON = {
  version: '6.0.0',
  objects: [],
  background: '#000000',
};

// ─── Tool types ───────────────────────────────────────────────────────────────
type Tool = 'pen' | 'eraser' | 'select' | 'pan' | 'line' | 'rect' | 'circle' | 'text';

const COLORS = [
  '#ffffff', '#f87171', '#fb923c', '#facc15',
  '#4ade80', '#38bdf8', '#a78bfa', '#f472b6',
  '#000000', '#6b7280',
];

const STROKE_SIZES = [2, 4, 8, 16];

// ─── SVG icons (inline, no external dep) ─────────────────────────────────────
const Icons: Record<string, React.ReactElement> = {
  pen: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
    </svg>
  ),
  eraser: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 20H7L3 16l10-10 7 7-2.5 2.5"/><path d="M6.0 11.0 L13 18"/>
    </svg>
  ),
  select: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3l14 9-7 1-4 7z"/>
    </svg>
  ),
  pan: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>
    </svg>
  ),
  line: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="5" y1="19" x2="19" y2="5"/>
    </svg>
  ),
  rect: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
    </svg>
  ),
  circle: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9"/>
    </svg>
  ),
  text: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>
    </svg>
  ),
  undo: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
    </svg>
  ),
  redo: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/>
    </svg>
  ),
  trash: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  ),
  download: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
};

// ─── Toolbar button ────────────────────────────────────────────────────────────
function ToolBtn({
  icon, label, active, onClick, danger = false, disabled = false,
}: {
  icon: React.ReactElement; label: string; active?: boolean; onClick: () => void;
  danger?: boolean; disabled?: boolean;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 38, height: 38,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 8, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        background: active ? '#3b82f6' : danger ? 'transparent' : 'transparent',
        color: disabled ? '#555' : danger ? '#ef4444' : active ? '#fff' : '#ccc',
        transition: 'background 0.15s, color 0.15s',
        opacity: disabled ? 0.4 : 1,
      }}
      onMouseEnter={e => {
        if (!active && !disabled)
          (e.currentTarget as HTMLButtonElement).style.background = danger ? '#3b000080' : '#ffffff18';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = active ? '#3b82f6' : 'transparent';
      }}
    >
      {icon}
    </button>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 28, background: '#333', margin: '0 4px', flexShrink: 0 }} />;
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function Page() {
  const router = useRouter();
  useEffect(()=>{
  const token=localStorage.getItem('roomid');
  const user=localStorage.getItem('token');
  if(!(token && user)){
   router.push('/signin');
  }
},[]);

  const [token, setToken] = useState<string | null>(null);
  const [roomid, setRoomid] = useState<string | null>(null);
  const roomidRef = useRef<string | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedRoom = localStorage.getItem('roomid');
    setToken(savedToken);
    setRoomid(savedRoom);
    roomidRef.current = savedRoom;
    if (!savedToken) { router.push('/signup'); return; }
    if (!savedRoom) { router.push('/room'); return; }
  }, [router]);

  useEffect(() => { roomidRef.current = roomid; }, [roomid]);

  // ─── Refs ──────────────────────────────────────────────────────────────────
  const socketRef      = useRef<WebSocket | null>(null);
  const canvasElRef    = useRef<HTMLCanvasElement | null>(null);
  const fabricRef      = useRef<import('fabric').Canvas | null>(null);
  const pendingDataRef = useRef<any>(null);
  const saveTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyRef     = useRef<string[]>([]);   // undo stack (JSON strings)
  const redoRef        = useRef<string[]>([]);   // redo stack
  const isPanningRef   = useRef(false);
  const lastPanRef     = useRef<{ x: number; y: number } | null>(null);
  // Shape drawing state
  const isDrawingShapeRef  = useRef(false);
  const shapeStartRef      = useRef<{ x: number; y: number } | null>(null);
  const activeShapeRef     = useRef<any>(null);

  // ─── UI state ──────────────────────────────────────────────────────────────
  const [activeTool, setActiveTool]   = useState<Tool>('pen');
  const [color, setColor]             = useState('#ffffff');
  const [strokeSize, setStrokeSize]   = useState(3);
  const [zoom, setZoom]               = useState(100);
  const [canUndo, setCanUndo]         = useState(false);
  const [canRedo, setCanRedo]         = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Keep latest tool/color/stroke accessible inside event closures without re-binding
  const toolRef        = useRef<Tool>('pen');
  const colorRef       = useRef('#ffffff');
  const strokeSizeRef  = useRef(3);

  useEffect(() => { toolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { strokeSizeRef.current = strokeSize; }, [strokeSize]);

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function safeLSSet(data: any) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
  }

  function safeLSGet(): any | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw || raw === 'undefined') return null;
      return JSON.parse(raw);
    } catch (_) { return null; }
  }

  function pushHistory(canvas: import('fabric').Canvas) {
    const json = JSON.stringify(canvas.toJSON());
    historyRef.current.push(json);
    if (historyRef.current.length > 80) historyRef.current.shift();
    redoRef.current = [];
    setCanUndo(historyRef.current.length > 1);
    setCanRedo(false);
  }

  function renderOnCanvas(data: any) {
    if (!data) return;
    const canvas = fabricRef.current;
    if (!canvas) { pendingDataRef.current = data; return; }
    canvas.loadFromJSON(data, () => {
      canvas.backgroundColor = '#000000';
      canvas.requestRenderAll();
    });
    safeLSSet(data);
  }

  function scheduleSave(canvas: import('fabric').Canvas) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        const canvasData = canvas.toJSON();
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ roomid: roomidRef.current, data: canvasData }));
        }
        safeLSSet(canvasData);
      } catch (err) { console.log(err); }
    }, 50);
  }

  // ─── Socket init ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomid) return;

    async function initSocket() {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
      if (!wsUrl) throw new Error('WebSocket URL is not defined');

      socketRef.current = new WebSocket(wsUrl);
      socketRef.current.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (!parsed?.data) return;
          renderOnCanvas(parsed.data);
        } catch (err) { console.log(err); }
      };

      try {
        const backendUrl = process.env.NEXT_PUBLIC_Backend_URL;
        if (!backendUrl) throw new Error('Backend URL is not defined');
        const response = await axios.post(backendUrl, { roomid });
        const savedData = response?.data?.data?.whiteboard_data;
        if (savedData) renderOnCanvas(savedData);
      } catch (err) {
        console.log(err);
        const cached = safeLSGet();
        if (cached) renderOnCanvas(cached);
      }
    }

    initSocket();
    return () => { socketRef.current?.close(); };
  }, [roomid]);

  // ─── Canvas init ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvasEl = canvasElRef.current;
    if (!canvasEl) return;

    let canvas: import('fabric').Canvas;
    let onResize: () => void;
    let onTouchStart: (e: TouchEvent) => void;
    let onTouchMove: (e: TouchEvent) => void;
    let onTouchEnd: () => void;
    let upperCanvas: HTMLElement | null = null;

    import('fabric').then((fabric: FabricModule) => {
      const { Canvas, PencilBrush, Point, Rect, Circle, Line, IText } = fabric;

      canvas = new Canvas(canvasEl, {
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundColor: '#000000',
        selection: false,
      });
      fabricRef.current = canvas;

      // ── Default drawing brush ──
      const brush = new PencilBrush(canvas);
      brush.width = strokeSizeRef.current;
      brush.color = colorRef.current;
      canvas.freeDrawingBrush = brush;
      canvas.isDrawingMode = true;

      // ── Restore from localStorage / pending WS data ──
      const cached = safeLSGet();
      if (cached) renderOnCanvas(cached);
      if (pendingDataRef.current) {
        renderOnCanvas(pendingDataRef.current);
        pendingDataRef.current = null;
      }

      // ── Seed undo history ──
      historyRef.current = [JSON.stringify(canvas.toJSON())];
      setCanUndo(false);

      // ─────────────────────────────────────────────────────────────────────────
      // EVENTS
      // ─────────────────────────────────────────────────────────────────────────

      // Path created (freehand pen / eraser)
      canvas.on('path:created', (e: any) => {
        if (toolRef.current === 'eraser') {
          // Style the eraser path as an eraser
          const path = e.path;
          if (path) {
            path.set({
              stroke: '#000000',
              strokeWidth: strokeSizeRef.current * 3,
              globalCompositeOperation: 'destination-out',
            });
            canvas.requestRenderAll();
          }
        }
        pushHistory(canvas);
        scheduleSave(canvas);
      });

      // Object moved / modified (select mode)
      canvas.on('object:modified', () => {
        pushHistory(canvas);
        scheduleSave(canvas);
      });

      // ── Shape drawing (mousedown / mousemove / mouseup) ──
      canvas.on('mouse:down', (opt: any) => {
        const tool = toolRef.current;

        // PAN
        if (tool === 'pan') {
          isPanningRef.current = true;
          lastPanRef.current = { x: opt.e.clientX, y: opt.e.clientY };
          canvas.setCursor('grabbing');
          return;
        }

        // SHAPES
        if (tool === 'line' || tool === 'rect' || tool === 'circle') {
          canvas.isDrawingMode = false;
          canvas.selection = false;
          isDrawingShapeRef.current = true;
          const pointer = canvas.getScenePoint(opt.e);
          shapeStartRef.current = { x: pointer.x, y: pointer.y };

          const opts = {
            left: pointer.x,
            top: pointer.y,
            stroke: colorRef.current,
            strokeWidth: strokeSizeRef.current,
            fill: 'transparent',
            selectable: false,
            evented: false,
          };

          let shape: any;
          if (tool === 'rect') {
            shape = new Rect({ ...opts, width: 0, height: 0 });
          } else if (tool === 'circle') {
            shape = new Circle({ ...opts, radius: 0, originX: 'center', originY: 'center' });
          } else {
            shape = new Line([pointer.x, pointer.y, pointer.x, pointer.y], {
              ...opts, fill: undefined,
            });
          }

          canvas.add(shape);
          activeShapeRef.current = shape;
        }

        // TEXT
        if (tool === 'text') {
          canvas.isDrawingMode = false;
          const pointer = canvas.getScenePoint(opt.e);
          const textObj = new IText('', {
            left: pointer.x,
            top: pointer.y,
            fill: colorRef.current,
            fontSize: strokeSizeRef.current * 6 + 10,
            selectable: true,
            evented: true,
          });
          canvas.add(textObj);
          canvas.setActiveObject(textObj);
          textObj.enterEditing();
          textObj.on('editing:exited', () => {
            if (!textObj.text || textObj.text === '') canvas.remove(textObj);
            pushHistory(canvas);
            scheduleSave(canvas);
          });
        }
      });

      canvas.on('mouse:move', (opt: any) => {
        const tool = toolRef.current;

        // PAN
        if (tool === 'pan' && isPanningRef.current && lastPanRef.current) {
          const dx = opt.e.clientX - lastPanRef.current.x;
          const dy = opt.e.clientY - lastPanRef.current.y;
          const vpt = canvas.viewportTransform!;
          vpt[4] += dx;
          vpt[5] += dy;
          canvas.requestRenderAll();
          lastPanRef.current = { x: opt.e.clientX, y: opt.e.clientY };
          return;
        }

        // SHAPES
        if (!isDrawingShapeRef.current || !shapeStartRef.current || !activeShapeRef.current) return;

        const pointer = canvas.getScenePoint(opt.e);
        const { x: sx, y: sy } = shapeStartRef.current;
        const shape = activeShapeRef.current;

        if (tool === 'rect') {
          const left   = Math.min(sx, pointer.x);
          const top    = Math.min(sy, pointer.y);
          const width  = Math.abs(pointer.x - sx);
          const height = Math.abs(pointer.y - sy);
          shape.set({ left, top, width, height });
        } else if (tool === 'circle') {
          const r = Math.sqrt((pointer.x - sx) ** 2 + (pointer.y - sy) ** 2) / 2;
          shape.set({
            left: (sx + pointer.x) / 2,
            top: (sy + pointer.y) / 2,
            radius: r,
          });
        } else if (tool === 'line') {
          shape.set({ x2: pointer.x, y2: pointer.y });
        }

        shape.setCoords();
        canvas.requestRenderAll();
      });

      canvas.on('mouse:up', () => {
        if (toolRef.current === 'pan') {
          isPanningRef.current = false;
          lastPanRef.current = null;
          canvas.setCursor('grab');
          return;
        }

        if (isDrawingShapeRef.current) {
          isDrawingShapeRef.current = false;
          shapeStartRef.current = null;
          if (activeShapeRef.current) {
            activeShapeRef.current.set({ selectable: true, evented: true });
            activeShapeRef.current = null;
          }
          pushHistory(canvas);
          scheduleSave(canvas);
        }
      });

      // ── ZOOM (wheel) ──
      const MIN_ZOOM = 0.1;
      const MAX_ZOOM = 10;

      canvas.on('mouse:wheel', (opt: any) => {
        let z = canvas.getZoom();
        z *= 0.999 ** opt.e.deltaY;
        z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
        canvas.zoomToPoint(new Point(opt.e.offsetX, opt.e.offsetY), z);
        setZoom(Math.round(z * 100));
        opt.e.preventDefault();
        opt.e.stopPropagation();
      });

      // ── MOBILE PINCH ZOOM ──
      let lastDist = 0;

      onTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 2) {
          const t1 = e.touches[0]!, t2 = e.touches[1]!;
          lastDist = Math.sqrt((t1.clientX - t2.clientX) ** 2 + (t1.clientY - t2.clientY) ** 2);
        }
      };

      onTouchMove = (e: TouchEvent) => {
        if (e.touches.length === 2) {
          const t1 = e.touches[0]!, t2 = e.touches[1]!;
          e.preventDefault();
          const dist = Math.sqrt((t1.clientX - t2.clientX) ** 2 + (t1.clientY - t2.clientY) ** 2);
          if (lastDist > 0) {
            let z = canvas.getZoom() * (dist / lastDist);
            z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
            canvas.zoomToPoint(
              { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 } as any,
              z
            );
            setZoom(Math.round(z * 100));
          }
          lastDist = dist;
        }
      };

      onTouchEnd = () => { lastDist = 0; };

      upperCanvas = (canvas as any).upperCanvasEl as HTMLElement;
      upperCanvas.addEventListener('touchstart', onTouchStart, { passive: false });
      upperCanvas.addEventListener('touchmove', onTouchMove, { passive: false });
      upperCanvas.addEventListener('touchend', onTouchEnd);

      onResize = () => {
        canvas.setDimensions({ width: window.innerWidth, height: window.innerHeight });
        canvas.requestRenderAll();
      };
      window.addEventListener('resize', onResize);
    });

    return () => {
      if (onResize) window.removeEventListener('resize', onResize);
      if (upperCanvas) {
        if (onTouchStart) upperCanvas.removeEventListener('touchstart', onTouchStart);
        if (onTouchMove) upperCanvas.removeEventListener('touchmove', onTouchMove);
        if (onTouchEnd) upperCanvas.removeEventListener('touchend', onTouchEnd);
      }
      if (fabricRef.current) { fabricRef.current.dispose(); fabricRef.current = null; }
    };
  }, []);

  // ─── Apply tool changes to fabric canvas ───────────────────────────────────
  const applyTool = useCallback((tool: Tool, col: string, size: number) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = false;
    canvas.selection = false;
    canvas.setCursor('default');

    if (tool === 'pen') {
      import('fabric').then((fabric: FabricModule) => {
        const { PencilBrush } = fabric;
        const brush = new PencilBrush(canvas);
        brush.width = size;
        brush.color = col;
        canvas.freeDrawingBrush = brush;
        canvas.isDrawingMode = true;
      });
    } else if (tool === 'eraser') {
      import('fabric').then((fabric: FabricModule) => {
        const { PencilBrush } = fabric;
        const brush = new PencilBrush(canvas);
        brush.width = size * 3;
        brush.color = '#000000';
        canvas.freeDrawingBrush = brush;
        canvas.isDrawingMode = true;
      });
    } else if (tool === 'select') {
      canvas.selection = true;
      canvas.setCursor('default');
      canvas.getObjects().forEach(obj => obj.set({ selectable: true, evented: true }));
      canvas.requestRenderAll();
    } else if (tool === 'pan') {
      canvas.setCursor('grab');
    }
    // line / rect / circle / text handled in mouse:down
  }, []);

  // Re-apply whenever tool, color, or size changes
  useEffect(() => { applyTool(activeTool, color, strokeSize); }, [activeTool, color, strokeSize, applyTool]);

  // ─── Toolbar actions ───────────────────────────────────────────────────────
  function undo() {
    const canvas = fabricRef.current;
    if (!canvas || historyRef.current.length <= 1) return;
    const current = historyRef.current.pop()!;
    redoRef.current.push(current);
    const prev = historyRef.current[historyRef.current.length - 1]!;
    canvas.loadFromJSON(JSON.parse(prev), () => {
      canvas.backgroundColor = '#000000';
      canvas.requestRenderAll();
    });
    setCanUndo(historyRef.current.length > 1);
    setCanRedo(true);
    scheduleSave(canvas);
  }

  function redo() {
    const canvas = fabricRef.current;
    if (!canvas || redoRef.current.length === 0) return;
    const next = redoRef.current.pop()!;
    historyRef.current.push(next);
    canvas.loadFromJSON(JSON.parse(next), () => {
      canvas.backgroundColor = '#000000';
      canvas.requestRenderAll();
    });
    setCanUndo(historyRef.current.length > 1);
    setCanRedo(redoRef.current.length > 0);
    scheduleSave(canvas);
  }

  function clearBoard() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.clear();
    canvas.backgroundColor = '#000000';
    canvas.setZoom(1);
    canvas.requestRenderAll();
    setZoom(100);
    historyRef.current = [JSON.stringify(BLANK_CANVAS_JSON)];
    redoRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
    safeLSSet(BLANK_CANVAS_JSON);
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ roomid: roomidRef.current, data: BLANK_CANVAS_JSON }));
    }
  }

  function downloadCanvas() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const dataURL = canvas.toDataURL({ format: 'png', multiplier: 1 });
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = 'whiteboard.png';
    a.click();
  }

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if (e.key === 'p' || e.key === 'b') setActiveTool('pen');
      if (e.key === 'e') setActiveTool('eraser');
      if (e.key === 'v') setActiveTool('select');
      if (e.key === 'h') setActiveTool('pan');
      if (e.key === 'l') setActiveTool('line');
      if (e.key === 'r') setActiveTool('rect');
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey) setActiveTool('circle');
      if (e.key === 't') setActiveTool('text');
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const active = canvas.getActiveObjects();
        if (active.length) {
          active.forEach(obj => canvas.remove(obj));
          canvas.discardActiveObject();
          pushHistory(canvas);
          scheduleSave(canvas);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ─── Styles ────────────────────────────────────────────────────────────────
  const toolbarStyle: React.CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: 16,
    transform: 'translateY(-50%)',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '10px 6px',
    background: '#161616',
    border: '1px solid #2a2a2a',
    borderRadius: 14,
    boxShadow: '0 4px 24px #00000066',
  };

  const bottomBarStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 12px',
    background: '#161616',
    border: '1px solid #2a2a2a',
    borderRadius: 12,
    boxShadow: '0 4px 24px #00000066',
  };

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#000' }}>

      {/* ── LEFT TOOLBAR ───────────────────────────────────────────────────── */}
      <div style={toolbarStyle}>

        {/* Drawing tools */}
        <ToolBtn icon={Icons.pen}    label="Pen (P)"    active={activeTool === 'pen'}    onClick={() => setActiveTool('pen')} />
        <ToolBtn icon={Icons.eraser} label="Eraser (E)" active={activeTool === 'eraser'} onClick={() => setActiveTool('eraser')} />
        <Divider />

        {/* Shape tools */}
        <ToolBtn icon={Icons.line}   label="Line (L)"   active={activeTool === 'line'}   onClick={() => setActiveTool('line')} />
        <ToolBtn icon={Icons.rect}   label="Rect (R)"   active={activeTool === 'rect'}   onClick={() => setActiveTool('rect')} />
        <ToolBtn icon={Icons.circle} label="Circle (C)" active={activeTool === 'circle'} onClick={() => setActiveTool('circle')} />
        <ToolBtn icon={Icons.text}   label="Text (T)"   active={activeTool === 'text'}   onClick={() => setActiveTool('text')} />
        <Divider />

        {/* Select / Pan */}
        <ToolBtn icon={Icons.select} label="Select (V)" active={activeTool === 'select'} onClick={() => setActiveTool('select')} />
        <ToolBtn icon={Icons.pan}    label="Pan (H)"    active={activeTool === 'pan'}    onClick={() => setActiveTool('pan')} />
        <Divider />

        {/* Undo / Redo */}
        <ToolBtn icon={Icons.undo} label="Undo (⌘Z)"  onClick={undo}  disabled={!canUndo} />
        <ToolBtn icon={Icons.redo} label="Redo (⌘⇧Z)" onClick={redo}  disabled={!canRedo} />
        <Divider />

        {/* Download / Clear */}
        <ToolBtn icon={Icons.download} label="Download"   onClick={downloadCanvas} />
        <ToolBtn icon={Icons.trash}    label="Clear board" danger onClick={clearBoard} />
      </div>

      {/* ── BOTTOM BAR: colors + stroke sizes ─────────────────────────────── */}
      <div style={bottomBarStyle}>

        {/* Color swatches */}
        {COLORS.map(c => (
          <button
            key={c}
            title={c}
            onClick={() => { setColor(c); if (activeTool !== 'pen') setActiveTool('pen'); }}
            style={{
              width: c === color ? 26 : 22,
              height: c === color ? 26 : 22,
              borderRadius: '50%',
              border: c === color ? '2px solid #fff' : '2px solid #333',
              background: c,
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s',
              boxShadow: c === color ? '0 0 0 2px #3b82f6' : 'none',
            }}
          />
        ))}

        {/* Custom color picker */}
        <div style={{ position: 'relative' }}>
          <button
            title="Custom color"
            onClick={() => setShowColorPicker(v => !v)}
            style={{
              width: 22, height: 22, borderRadius: '50%',
              border: '2px dashed #555',
              background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
              cursor: 'pointer', flexShrink: 0,
            }}
          />
          {showColorPicker && (
            <div style={{ position: 'absolute', bottom: 36, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
              <input
                type="color"
                value={color}
                onChange={e => { setColor(e.target.value); setActiveTool('pen'); }}
                style={{ width: 44, height: 44, border: 'none', background: 'none', cursor: 'pointer' }}
              />
            </div>
          )}
        </div>

        <Divider />

        {/* Stroke sizes */}
        {STROKE_SIZES.map(s => (
          <button
            key={s}
            title={`Stroke ${s}px`}
            onClick={() => setStrokeSize(s)}
            style={{
              width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 6, border: strokeSize === s ? '1px solid #3b82f6' : '1px solid transparent',
              background: strokeSize === s ? '#1d3a5f' : 'transparent',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <div style={{
              width: Math.min(s * 2.5, 24),
              height: Math.min(s * 2.5, 24),
              borderRadius: '50%',
              background: color,
              transition: 'all 0.15s',
            }} />
          </button>
        ))}
      </div>

      {/* ── ZOOM INDICATOR ────────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 16, right: 16, zIndex: 1000,
        background: '#161616', border: '1px solid #2a2a2a',
        borderRadius: 10, padding: '6px 12px',
        color: '#888', fontSize: 13, fontVariantNumeric: 'tabular-nums',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ color: '#555', fontSize: 11 }}>zoom</span>
        <span style={{ color: '#ccc' }}>{zoom}%</span>
      </div>

      {/* ── ACTIVE TOOL INDICATOR (top right) ─────────────────────────────── */}
      <div style={{
        position: 'fixed', top: 16, right: 16, zIndex: 1000,
        background: '#161616', border: '1px solid #2a2a2a',
        borderRadius: 10, padding: '6px 12px',
        color: '#888', fontSize: 13,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ color: '#aaa', textTransform: 'capitalize' }}>{activeTool}</span>
      </div>

      {/* ── CANVAS ────────────────────────────────────────────────────────── */}
      <canvas ref={canvasElRef} />
    </div>
  );
}