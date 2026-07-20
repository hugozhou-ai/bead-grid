"use client";

import { ChangeEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Clock3,
  Download,
  Eraser,
  FileDown,
  FileJson,
  FileSpreadsheet,
  FolderOpen,
  ImagePlus,
  Info,
  Link2,
  Link2Off,
  Maximize2,
  Minus,
  MousePointer2,
  Palette,
  PaintBucket,
  Pencil,
  Pipette,
  Plus,
  Redo2,
  RefreshCw,
  Scan,
  ShieldCheck,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { addSelectionLine, getRectangleSelection } from "./selection";
import { beadLabelColor, LEGACY_CODE_MAP, LEGACY_PALETTE_NAME, PALETTE, PALETTE_NAME, RGB_PALETTE } from "./bead-palette";
import { createPatternFromPixels, getExportLayout } from "./image-processing";

type Tool = "paint" | "erase" | "pick" | "select";

type StoredProject = {
  version: 3;
  name: string;
  width: number;
  height: number;
  colorLimit: number;
  autoRemoveBackground: boolean;
  palette: string;
  cells: Array<string | null>;
  savedAt: string;
};

type GridSnapshot = {
  cells: Array<string | null>;
  width: number;
  height: number;
};

type SelectionGesture = {
  pointerId: number;
  startIndex: number;
  lastIndex: number;
  startX: number;
  startY: number;
  baseSelection: Set<number>;
  additive: boolean;
  mode: "pending" | "rectangle" | "trace";
};

const PROJECT_STORAGE_KEY = "bead-grid.project.v2";
const MIN_GRID_SIZE = 8;
const MAX_GRID_SIZE = 160;
const SIZE_PRESETS = [16, 32, 64, 128];
const IMAGE_SAMPLES_PER_CELL = 4;
const PEGBOARD_SIZE_OPTIONS = [52, 78, 104, 120] as const;

function createDemo(width: number, height: number): Array<string | null> {
  return Array.from({ length: width * height }, (_, index) => {
    const x = (index % width) / width;
    const y = Math.floor(index / width) / height;
    const px = x * 2 - 1;
    const py = y * 2 - 0.25;
    const heart = (px * px + py * py - 0.58) ** 3 - px * px * py ** 3 < 0;
    if (!heart) return null;
    if (py < -0.35 && px < 0.1) return LEGACY_CODE_MAP.A06;
    if (py > 0.35) return LEGACY_CODE_MAP.A05;
    return LEGACY_CODE_MAP.A04;
  });
}

function resizeGrid(cells: Array<string | null>, fromWidth: number, fromHeight: number, toWidth: number, toHeight: number) {
  return Array.from({ length: toWidth * toHeight }, (_, index) => {
    const x = index % toWidth;
    const y = Math.floor(index / toWidth);
    const sourceX = Math.min(fromWidth - 1, Math.floor(((x + .5) / toWidth) * fromWidth));
    const sourceY = Math.min(fromHeight - 1, Math.floor(((y + .5) / toHeight) * fromHeight));
    return cells[sourceY * fromWidth + sourceX] ?? null;
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function clampGridSize(value: number) {
  return Math.max(MIN_GRID_SIZE, Math.min(MAX_GRID_SIZE, Math.round(value || MIN_GRID_SIZE)));
}

function parseStoredProject(value: unknown): StoredProject {
  if (!value || typeof value !== "object") throw new Error("项目内容不是对象");
  const candidate = value as Partial<StoredProject>;
  const width = clampGridSize(Number(candidate.width));
  const height = clampGridSize(Number(candidate.height));
  if (candidate.width !== width || candidate.height !== height) throw new Error(`图纸尺寸超出 ${MIN_GRID_SIZE}–${MAX_GRID_SIZE} 范围`);
  if (!Array.isArray(candidate.cells) || candidate.cells.length !== width * height) throw new Error("图纸格子数量与尺寸不一致");
  const usesLegacyPalette = Number(candidate.version) === 2 || candidate.palette === LEGACY_PALETTE_NAME;
  const migratedCells = candidate.cells.map((cell) => {
    if (cell === null) return null;
    if (typeof cell !== "string") throw new Error("图纸包含无效色号");
    return usesLegacyPalette ? LEGACY_CODE_MAP[cell] : cell;
  });
  const validCodes = new Set(PALETTE.map((color) => color.code));
  if (migratedCells.some((cell) => !cell || !validCodes.has(cell))) throw new Error("图纸包含未知色号");
  return {
    version: 3,
    name: typeof candidate.name === "string" && candidate.name.trim() ? candidate.name.trim().slice(0, 80) : "未命名拼豆项目",
    width,
    height,
    colorLimit: Math.max(3, Math.min(PALETTE.length, Math.round(Number(candidate.colorLimit) || 10))),
    autoRemoveBackground: candidate.autoRemoveBackground === true,
    palette: PALETTE_NAME,
    cells: migratedCells,
    savedAt: typeof candidate.savedAt === "string" ? candidate.savedAt : new Date().toISOString(),
  };
}

export function BeadStudio() {
  const [width, setWidth] = useState(32);
  const [height, setHeight] = useState(32);
  const [draftWidth, setDraftWidth] = useState(32);
  const [draftHeight, setDraftHeight] = useState(32);
  const [colorLimit, setColorLimit] = useState(10);
  const [autoRemoveBackground, setAutoRemoveBackground] = useState(false);
  const [lockAspectRatio, setLockAspectRatio] = useState(true);
  const [lockedAspectRatio, setLockedAspectRatio] = useState(1);
  const [grid, setGrid] = useState<Array<string | null>>(() => createDemo(32, 32));
  const [sourceName, setSourceName] = useState("示例爱心");
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState(LEGACY_CODE_MAP.A04);
  const [tool, setTool] = useState<Tool>("paint");
  const [zoom, setZoom] = useState(1);
  const [fitZoom, setFitZoom] = useState(1);
  const [isFitZoom, setIsFitZoom] = useState(true);
  const [showCodes, setShowCodes] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toast, setToast] = useState("示例图案已就绪，可以上传照片开始创作");
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<GridSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<GridSnapshot[]>([]);
  const [selectedCells, setSelectedCells] = useState<Set<number>>(() => new Set());
  const [canvasFontReady, setCanvasFontReady] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [saveNameDraft, setSaveNameDraft] = useState("");
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportBoardSize, setExportBoardSize] = useState<number>(PEGBOARD_SIZE_OPTIONS[0]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const draftReadyRef = useRef(false);
  const touchPointersRef = useRef(new Map<number, { x: number; y: number }>());
  const touchGestureRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
    moved: boolean;
  } | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const safariGestureZoomRef = useRef(1);
  const activeZoomRef = useRef(1);
  const selectedCellsRef = useRef(new Set<number>());
  const selectionGestureRef = useRef<SelectionGesture | null>(null);
  const selectionLongPressTimerRef = useRef<number | null>(null);
  const canvasCellSize = Math.max(10, Math.min(24, 720 / Math.max(width, height)));
  const canvasBaseWidth = Math.round(width * canvasCellSize);
  const canvasBaseHeight = Math.round(height * canvasCellSize);
  const activeZoom = isFitZoom ? fitZoom : zoom;
  const canvasDisplayWidth = Math.round(canvasBaseWidth * activeZoom);
  const canvasDisplayHeight = Math.round(canvasBaseHeight * activeZoom);

  const colorMap = useMemo(() => new Map(PALETTE.map((color) => [color.code, color])), []);
  const counts = useMemo(() => {
    const result = new Map<string, number>();
    for (const code of grid) if (code) result.set(code, (result.get(code) ?? 0) + 1);
    return [...result.entries()]
      .map(([code, count]) => ({ color: colorMap.get(code)!, count }))
      .sort((a, b) => b.count - a.count);
  }, [grid, colorMap]);
  const total = counts.reduce((sum, item) => sum + item.count, 0);
  const pendingSizeChanged = draftWidth !== width || draftHeight !== height;
  const physicalWidth = (draftWidth * .5).toFixed(draftWidth % 2 ? 1 : 0);
  const physicalHeight = (draftHeight * .5).toFixed(draftHeight % 2 ? 1 : 0);

  useEffect(() => {
    let active = true;
    Promise.all([
      document.fonts.load('400 16px "LXGW WenKai"', "豆格拼豆图纸"),
      document.fonts.load('700 16px "LXGW WenKai"', "色号A1B1C1D1E1F1G1H1M1"),
    ])
      .then(() => {
        if (active) setCanvasFontReady(true);
      })
      .catch((error) => {
        console.error("[BEAD_FONT]", JSON.stringify({ action: "load", message: error instanceof Error ? error.message : String(error) }));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(PROJECT_STORAGE_KEY);
        if (raw) {
          const project = parseStoredProject(JSON.parse(raw));
          setWidth(project.width);
          setHeight(project.height);
          setDraftWidth(project.width);
          setDraftHeight(project.height);
          setLockedAspectRatio(project.width / project.height);
          setColorLimit(project.colorLimit);
          setAutoRemoveBackground(project.autoRemoveBackground);
          setGrid(project.cells);
          setSourceName(project.name);
          setDraftSavedAt(project.savedAt);
          setToast("已恢复上次自动保存的图纸");
        }
      } catch (error) {
        console.error("[BEAD_DRAFT]", JSON.stringify({ action: "restore", message: error instanceof Error ? error.message : String(error) }));
      } finally {
        draftReadyRef.current = true;
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!draftReadyRef.current) return;
    const timer = window.setTimeout(() => {
      try {
        const savedAt = new Date().toISOString();
        const project: StoredProject = { version: 3, name: sourceName, width, height, colorLimit, autoRemoveBackground, palette: PALETTE_NAME, cells: grid, savedAt };
        window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
        setDraftSavedAt(savedAt);
      } catch (error) {
        console.error("[BEAD_DRAFT]", JSON.stringify({ action: "save", message: error instanceof Error ? error.message : String(error) }));
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [sourceName, width, height, colorLimit, autoRemoveBackground, grid]);

  useEffect(() => {
    activeZoomRef.current = activeZoom;
  }, [activeZoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pixelRatio = window.devicePixelRatio || 1;
    const cell = canvasCellSize * activeZoom;
    canvas.width = Math.round(canvasDisplayWidth * pixelRatio);
    canvas.height = Math.round(canvasDisplayHeight * pixelRatio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.fillStyle = "#fbf7e9";
    context.fillRect(0, 0, canvasDisplayWidth, canvasDisplayHeight);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const code = grid[y * width + x];
        if (code) {
          const color = colorMap.get(code);
          const wobble = ((x * 17 + y * 31) % 7 - 3) / 100;
          const centerX = x * cell + cell / 2 + wobble * cell;
          const centerY = y * cell + cell / 2 - wobble * cell * .7;
          context.fillStyle = color?.hex ?? "#ffffff";
          context.beginPath();
          context.ellipse(centerX, centerY, cell * (.4 + wobble * .2), cell * (.4 - wobble * .16), wobble * 2, 0, Math.PI * 2);
          context.fill();
          context.strokeStyle = "rgba(38,35,29,.72)";
          context.lineWidth = Math.max(.65, cell * .035);
          context.stroke();
          context.fillStyle = "rgba(255,255,255,.32)";
          context.beginPath();
          context.ellipse(centerX - cell * .12, centerY - cell * .13, cell * .09, cell * .055, -.55, 0, Math.PI * 2);
          context.fill();
          if (showCodes && cell >= 18) {
            context.fillStyle = beadLabelColor(color);
            context.font = `700 ${Math.max(7, cell * 0.28)}px "LXGW WenKai", "Kaiti SC", "KaiTi", serif`;
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText(code.slice(1), centerX, centerY + 0.5);
          }
        }
        if (selectedCells.has(y * width + x)) {
          const inset = Math.max(1.5, cell * .08);
          context.fillStyle = "rgba(240,100,52,.2)";
          context.fillRect(x * cell, y * cell, cell, cell);
          context.strokeStyle = "#f06434";
          context.lineWidth = Math.max(1.5, cell * .07);
          context.setLineDash([Math.max(2, cell * .18), Math.max(1, cell * .1)]);
          context.strokeRect(x * cell + inset, y * cell + inset, cell - inset * 2, cell - inset * 2);
          context.setLineDash([]);
        }
      }
    }
    if (showGrid) {
      context.strokeStyle = "rgba(55,50,40,.19)";
      context.lineWidth = Math.max(.55, activeZoom * .55);
      for (let x = 0; x <= width; x += 1) {
        const drift = ((x * 13) % 5 - 2) * .16 * activeZoom;
        context.beginPath();
        context.moveTo(x * cell + drift, 0);
        context.lineTo(x * cell - drift, canvasDisplayHeight);
        context.stroke();
      }
      for (let y = 0; y <= height; y += 1) {
        const drift = ((y * 11) % 5 - 2) * .16 * activeZoom;
        context.beginPath();
        context.moveTo(0, y * cell - drift);
        context.lineTo(canvasDisplayWidth, y * cell + drift);
        context.stroke();
      }
    }
  }, [grid, width, height, colorMap, showCodes, showGrid, selectedCells, canvasCellSize, activeZoom, canvasDisplayWidth, canvasDisplayHeight, canvasFontReady]);

  useEffect(() => {
    const scrollArea = canvasScrollRef.current;
    if (!scrollArea) return;

    const updateFitZoom = () => {
      const style = window.getComputedStyle(scrollArea);
      const horizontalPadding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
      const verticalPadding = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
      const availableWidth = Math.max(1, scrollArea.clientWidth - horizontalPadding);
      const availableHeight = Math.max(1, scrollArea.clientHeight - verticalPadding);
      const nextFitZoom = Math.max(.2, Math.min(2.2, availableWidth / canvasBaseWidth, availableHeight / canvasBaseHeight));
      setFitZoom(nextFitZoom);
    };

    updateFitZoom();
    const observer = new ResizeObserver(updateFitZoom);
    observer.observe(scrollArea);
    return () => observer.disconnect();
  }, [canvasBaseWidth, canvasBaseHeight]);

  useEffect(() => {
    if (!isFitZoom) return;
    const scrollArea = canvasScrollRef.current;
    if (!scrollArea) return;
    scrollArea.scrollTo({ left: 0, top: 0 });
  }, [isFitZoom, fitZoom]);

  useEffect(() => {
    const scrollArea = canvasScrollRef.current;
    if (!scrollArea) return;

    const applyZoom = (nextZoom: number) => {
      const clampedZoom = Math.max(.2, Math.min(2.2, nextZoom));
      activeZoomRef.current = clampedZoom;
      setZoom(clampedZoom);
      setIsFitZoom(false);
    };
    const preventPageZoom = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    const handleWheel = (event: WheelEvent) => {
      if (!event.metaKey && !event.ctrlKey) return;
      preventPageZoom(event);
      applyZoom(activeZoomRef.current * Math.exp(-event.deltaY * .002));
    };
    const handleGestureStart = (event: Event) => {
      preventPageZoom(event);
      safariGestureZoomRef.current = activeZoomRef.current;
    };
    const handleGestureChange = (event: Event) => {
      preventPageZoom(event);
      const scale = (event as Event & { scale?: number }).scale ?? 1;
      applyZoom(safariGestureZoomRef.current * scale);
    };
    const handleGestureEnd = (event: Event) => {
      preventPageZoom(event);
    };

    scrollArea.addEventListener("wheel", handleWheel, { passive: false });
    scrollArea.addEventListener("gesturestart", handleGestureStart, { passive: false });
    scrollArea.addEventListener("gesturechange", handleGestureChange, { passive: false });
    scrollArea.addEventListener("gestureend", handleGestureEnd, { passive: false });
    return () => {
      scrollArea.removeEventListener("wheel", handleWheel);
      scrollArea.removeEventListener("gesturestart", handleGestureStart);
      scrollArea.removeEventListener("gesturechange", handleGestureChange);
      scrollArea.removeEventListener("gestureend", handleGestureEnd);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function updateSelection(next: Set<number>) {
    selectedCellsRef.current = next;
    setSelectedCells(next);
  }

  function clearSelectionTimer() {
    if (selectionLongPressTimerRef.current !== null) {
      window.clearTimeout(selectionLongPressTimerRef.current);
      selectionLongPressTimerRef.current = null;
    }
  }

  function cancelSelectionGesture() {
    clearSelectionTimer();
    selectionGestureRef.current = null;
  }

  function commitGrid(next: Array<string | null>, message?: string, preserveSelection = false, nextWidth = width, nextHeight = height) {
    setUndoStack((stack) => [...stack.slice(-29), { cells: grid, width, height }]);
    setRedoStack([]);
    if (nextWidth !== width || nextHeight !== height) {
      setWidth(nextWidth);
      setHeight(nextHeight);
      setDraftWidth(nextWidth);
      setDraftHeight(nextHeight);
      setLockedAspectRatio(nextWidth / nextHeight);
    }
    setGrid(next);
    if (!preserveSelection) updateSelection(new Set());
    if (message) setToast(message);
  }

  function undo() {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setRedoStack((stack) => [...stack, { cells: grid, width, height }]);
    setWidth(previous.width);
    setHeight(previous.height);
    setDraftWidth(previous.width);
    setDraftHeight(previous.height);
    setLockedAspectRatio(previous.width / previous.height);
    setGrid(previous.cells);
    setUndoStack((stack) => stack.slice(0, -1));
  }

  function redo() {
    const next = redoStack.at(-1);
    if (!next) return;
    setUndoStack((stack) => [...stack, { cells: grid, width, height }]);
    setWidth(next.width);
    setHeight(next.height);
    setDraftWidth(next.width);
    setDraftHeight(next.height);
    setLockedAspectRatio(next.width / next.height);
    setGrid(next.cells);
    setRedoStack((stack) => stack.slice(0, -1));
  }

  function getCellAt(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((clientX - rect.left) / rect.width) * width);
    const y = Math.floor(((clientY - rect.top) / rect.height) * height);
    if (x < 0 || y < 0 || x >= width || y >= height) return null;
    return { x, y, index: y * width + x };
  }

  function selectRectangle(startIndex: number, endIndex: number, baseSelection: Set<number>, additive: boolean) {
    updateSelection(getRectangleSelection(startIndex, endIndex, width, grid, baseSelection, additive));
  }

  function selectLine(fromIndex: number, toIndex: number) {
    updateSelection(addSelectionLine(fromIndex, toIndex, width, grid, selectedCellsRef.current));
  }

  function fillSelection() {
    if (!selectedCellsRef.current.size) return;
    const next = [...grid];
    selectedCellsRef.current.forEach((index) => { next[index] = selectedColor; });
    commitGrid(next, `已将 ${selectedCellsRef.current.size} 颗豆子填为 ${selectedColor}`, true);
  }

  function eraseSelection() {
    if (!selectedCellsRef.current.size) return;
    const count = selectedCellsRef.current.size;
    const next = [...grid];
    selectedCellsRef.current.forEach((index) => { next[index] = null; });
    commitGrid(next, `已移除 ${count} 颗豆子`);
  }

  function selectAllBeads() {
    updateSelection(new Set(grid.flatMap((code, index) => code ? [index] : [])));
    setTool("select");
  }

  function handleCanvasKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (event.key === "Escape") {
      updateSelection(new Set());
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      selectAllBeads();
      return;
    }
    if ((event.key === "Backspace" || event.key === "Delete") && selectedCellsRef.current.size) {
      event.preventDefault();
      eraseSelection();
    }
  }

  function updateCellAt(clientX: number, clientY: number) {
    const cell = getCellAt(clientX, clientY);
    if (!cell) return;
    const { index } = cell;
    if (tool === "pick") {
      const code = grid[index];
      if (code) {
        setSelectedColor(code);
        setTool("paint");
        setToast(`已吸取 ${code} ${colorMap.get(code)?.name}`);
      }
      return;
    }
    const value = tool === "erase" ? null : selectedColor;
    if (grid[index] === value) return;
    const next = [...grid];
    next[index] = value;
    commitGrid(next);
  }

  function startSelectionGesture(event: PointerEvent<HTMLDivElement>, index: number) {
    event.currentTarget.setPointerCapture(event.pointerId);
    clearSelectionTimer();
    selectionGestureRef.current = {
      pointerId: event.pointerId,
      startIndex: index,
      lastIndex: index,
      startX: event.clientX,
      startY: event.clientY,
      baseSelection: new Set(selectedCellsRef.current),
      additive: event.shiftKey || event.metaKey || event.ctrlKey,
      mode: "pending",
    };
    selectionLongPressTimerRef.current = window.setTimeout(() => {
      const gesture = selectionGestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId || gesture.mode !== "pending") return;
      gesture.mode = "trace";
      const next = new Set(gesture.baseSelection);
      if (grid[gesture.startIndex]) next.add(gesture.startIndex);
      updateSelection(next);
      setToast("长按选择：沿着豆子移动即可连续选中");
    }, 420);
  }

  function moveSelectionGesture(event: PointerEvent<HTMLDivElement>) {
    const gesture = selectionGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return false;
    const cell = getCellAt(event.clientX, event.clientY);
    const distance = Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY);
    if (gesture.mode === "pending" && distance > 6) {
      gesture.mode = "rectangle";
      clearSelectionTimer();
    }
    if (!cell) return true;
    if (gesture.mode === "rectangle") {
      selectRectangle(gesture.startIndex, cell.index, gesture.baseSelection, gesture.additive);
    } else if (gesture.mode === "trace" && cell.index !== gesture.lastIndex) {
      selectLine(gesture.lastIndex, cell.index);
    }
    gesture.lastIndex = cell.index;
    return true;
  }

  function finishSelectionGesture(event: PointerEvent<HTMLDivElement>, cancelled: boolean) {
    const gesture = selectionGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return false;
    clearSelectionTimer();
    if (!cancelled && gesture.mode === "pending") {
      const next = new Set(gesture.baseSelection);
      if (grid[gesture.startIndex]) {
        if (next.has(gesture.startIndex)) next.delete(gesture.startIndex);
        else next.add(gesture.startIndex);
      } else if (!gesture.additive) {
        next.clear();
      }
      updateSelection(next);
    }
    selectionGestureRef.current = null;
    return true;
  }

  function handleCanvasPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch" && event.button !== 0) return;
    event.currentTarget.focus({ preventScroll: true });
    if (event.pointerType === "touch") {
      event.currentTarget.setPointerCapture(event.pointerId);
      touchPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (touchPointersRef.current.size > 1) {
      cancelSelectionGesture();
      const points = [...touchPointersRef.current.values()];
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      pinchRef.current = { distance: Math.max(1, distance), zoom: activeZoomRef.current };
      touchGestureRef.current = null;
      setIsFitZoom(false);
      setZoom(activeZoomRef.current);
      return;
    }

    if (tool === "select") {
      const cell = getCellAt(event.clientX, event.clientY);
      if (cell) startSelectionGesture(event, cell.index);
      else if (!event.shiftKey && !event.metaKey && !event.ctrlKey) updateSelection(new Set());
      return;
    }

    if (event.pointerType !== "touch") {
      updateCellAt(event.clientX, event.clientY);
      return;
    }

    if (touchPointersRef.current.size === 1) {
      touchGestureRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        scrollLeft: canvasScrollRef.current?.scrollLeft ?? 0,
        scrollTop: canvasScrollRef.current?.scrollTop ?? 0,
        moved: false,
      };
    }
  }

  function handleCanvasPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" && touchPointersRef.current.has(event.pointerId)) {
      event.preventDefault();
      touchPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (touchPointersRef.current.size >= 2 && pinchRef.current) {
      const points = [...touchPointersRef.current.values()];
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      const nextZoom = Math.max(.2, Math.min(2.2, pinchRef.current.zoom * distance / pinchRef.current.distance));
      activeZoomRef.current = nextZoom;
      setZoom(nextZoom);
      return;
    }

    if (moveSelectionGesture(event)) return;
    if (event.pointerType !== "touch" || !touchPointersRef.current.has(event.pointerId)) return;

    const gesture = touchGestureRef.current;
    if (touchPointersRef.current.size === 1 && gesture?.pointerId === event.pointerId) {
      const deltaX = event.clientX - gesture.startX;
      const deltaY = event.clientY - gesture.startY;
      if (Math.hypot(deltaX, deltaY) > 8) gesture.moved = true;
      if (gesture.moved && canvasScrollRef.current) {
        canvasScrollRef.current.scrollLeft = gesture.scrollLeft - deltaX;
        canvasScrollRef.current.scrollTop = gesture.scrollTop - deltaY;
      }
      return;
    }

  }

  function handleCanvasPointerEnd(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const handledSelection = finishSelectionGesture(event, cancelled);
    if (event.pointerType === "touch") {
      const gesture = touchGestureRef.current;
      if (!handledSelection && !cancelled && gesture?.pointerId === event.pointerId && !gesture.moved && touchPointersRef.current.size === 1) {
        updateCellAt(event.clientX, event.clientY);
      }
      touchPointersRef.current.delete(event.pointerId);
      touchGestureRef.current = null;
      if (touchPointersRef.current.size < 2) pinchRef.current = null;
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setToast("请选择 JPG、PNG 或 WEBP 图片");
      event.target.value = "";
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setToast("图片不能超过 20 MB");
      event.target.value = "";
      return;
    }
    const url = URL.createObjectURL(file);
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setSourceUrl(url);
    setSourceName(file.name.replace(/\.[^.]+$/, ""));
    await generateFromImage(url, clampGridSize(draftWidth), clampGridSize(draftHeight), colorLimit, autoRemoveBackground);
    event.target.value = "";
  }

  async function generateFromImage(url: string, targetWidth: number, targetHeight: number, limit: number, removeBackground: boolean) {
    setIsGenerating(true);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const sampleCanvas = document.createElement("canvas");
      sampleCanvas.width = targetWidth * IMAGE_SAMPLES_PER_CELL;
      sampleCanvas.height = targetHeight * IMAGE_SAMPLES_PER_CELL;
      const context = sampleCanvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas context unavailable");
      const sourceRatio = image.width / image.height;
      const targetRatio = targetWidth / targetHeight;
      let sx = 0;
      let sy = 0;
      let sw = image.width;
      let sh = image.height;
      if (sourceRatio > targetRatio) {
        sw = image.height * targetRatio;
        sx = (image.width - sw) / 2;
      } else {
        sh = image.width / targetRatio;
        sy = (image.height - sh) / 2;
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, sx, sy, sw, sh, 0, 0, sampleCanvas.width, sampleCanvas.height);
      const pixels = context.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data;
      const { cells: next, backgroundCode } = createPatternFromPixels(
        pixels,
        targetWidth,
        targetHeight,
        IMAGE_SAMPLES_PER_CELL,
        RGB_PALETTE,
        limit,
        removeBackground,
      );
      const backgroundMessage = backgroundCode ? `，${backgroundCode} 已识别为背景` : "";
      commitGrid(next, `已生成 ${targetWidth} × ${targetHeight} 图纸${backgroundMessage}`, false, targetWidth, targetHeight);
    } catch (error) {
      console.error("[BEAD_GENERATE]", JSON.stringify({ message: error instanceof Error ? error.message : String(error) }));
      setToast("图片处理失败，请换一张图片重试");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleWidthChange(newWidth: number) {
    setDraftWidth(newWidth);
    if (lockAspectRatio && newWidth > 0) {
      setDraftHeight(clampGridSize(newWidth / lockedAspectRatio));
    }
  }

  function handleHeightChange(newHeight: number) {
    setDraftHeight(newHeight);
    if (lockAspectRatio && newHeight > 0) {
      setDraftWidth(clampGridSize(newHeight * lockedAspectRatio));
    }
  }

  function toggleLockAspectRatio() {
    if (!lockAspectRatio) {
      setLockedAspectRatio(draftWidth / draftHeight);
    }
    setLockAspectRatio(!lockAspectRatio);
  }

  function applyPreset(size: number) {
    setDraftWidth(size);
    setDraftHeight(size);
    setLockedAspectRatio(1);
    setLockAspectRatio(true);
  }

  function applySize() {
    const safeWidth = clampGridSize(draftWidth);
    const safeHeight = clampGridSize(draftHeight);
    setDraftWidth(safeWidth);
    setDraftHeight(safeHeight);
    if (sourceUrl) {
      void generateFromImage(sourceUrl, safeWidth, safeHeight, colorLimit, autoRemoveBackground);
      return;
    }
    const resized = resizeGrid(grid, width, height, safeWidth, safeHeight);
    commitGrid(resized, `已调整为 ${safeWidth} × ${safeHeight}，原图案已保留`, false, safeWidth, safeHeight);
  }

  async function exportPng(pegboardSize: number) {
    try {
      await document.fonts.load('700 16px "LXGW WenKai"', "A1B1C1D1E1F1G1H1M1 0123456789");
    } catch (error) {
      console.error("[BEAD_EXPORT]", JSON.stringify({ action: "load-font", message: error instanceof Error ? error.message : String(error) }));
      setToast("导出字体加载失败，请检查网络后重试");
      return;
    }
    const output = document.createElement("canvas");
    const {
      cell,
      labelGutter,
      gridPixelWidth,
      gridPixelHeight,
      legendTop,
      legendPadding,
      legendHeaderHeight,
      legendItemHeight,
      legendColumns,
      outputWidth,
      outputHeight,
    } = getExportLayout(width, height, counts.length);
    output.width = outputWidth;
    output.height = outputHeight;
    const context = output.getContext("2d");
    if (!context) return;
    context.fillStyle = "#fffdf8";
    context.fillRect(0, 0, output.width, output.height);
    context.save();
    context.translate(labelGutter, labelGutter);
    grid.forEach((code, index) => {
      const x = index % width;
      const y = Math.floor(index / width);
      if (!code) return;
      const color = colorMap.get(code);
      context.fillStyle = color?.hex ?? "#fff";
      context.beginPath();
      context.arc(x * cell + cell / 2, y * cell + cell / 2, cell * 0.4, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = beadLabelColor(color);
      context.font = `700 ${Math.max(9, cell * .29)}px "LXGW WenKai", sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(code, x * cell + cell / 2, y * cell + cell / 2);
    });
    context.lineWidth = Math.max(1, cell * .025);
    context.strokeStyle = "#d8d0c2";
    context.beginPath();
    for (let x = 0; x <= width; x += 1) {
      context.moveTo(x * cell, 0);
      context.lineTo(x * cell, gridPixelHeight);
    }
    for (let y = 0; y <= height; y += 1) {
      context.moveTo(0, y * cell);
      context.lineTo(gridPixelWidth, y * cell);
    }
    context.stroke();

    context.lineWidth = Math.max(2.5, cell * .085);
    context.strokeStyle = "#756c60";
    context.beginPath();
    for (let x = 0; x <= width; x += pegboardSize) {
      context.moveTo(x * cell, 0);
      context.lineTo(x * cell, gridPixelHeight);
    }
    for (let y = 0; y <= height; y += pegboardSize) {
      context.moveTo(0, y * cell);
      context.lineTo(gridPixelWidth, y * cell);
    }
    context.moveTo(gridPixelWidth, 0);
    context.lineTo(gridPixelWidth, gridPixelHeight);
    context.moveTo(0, gridPixelHeight);
    context.lineTo(gridPixelWidth, gridPixelHeight);
    context.stroke();
    context.restore();

    context.fillStyle = "#514b42";
    context.font = `700 ${Math.max(9, cell * .26)}px "LXGW WenKai", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    for (let x = 0; x < width; x += 1) {
      const centerX = labelGutter + x * cell + cell / 2;
      context.fillText(String(x + 1), centerX, labelGutter / 2);
      context.fillText(String(x + 1), centerX, labelGutter + gridPixelHeight + labelGutter / 2);
    }
    for (let y = 0; y < height; y += 1) {
      const centerY = labelGutter + y * cell + cell / 2;
      context.fillText(String(y + 1), labelGutter / 2, centerY);
      context.fillText(String(y + 1), labelGutter + gridPixelWidth + labelGutter / 2, centerY);
    }
    if (counts.length && legendColumns) {
      const legendWidth = outputWidth - legendPadding * 2;
      const columnWidth = legendWidth / legendColumns;
      const headerY = legendTop + legendPadding + legendHeaderHeight / 2;
      context.strokeStyle = "#756c60";
      context.lineWidth = Math.max(2, cell * .05);
      context.beginPath();
      context.moveTo(legendPadding, legendTop);
      context.lineTo(outputWidth - legendPadding, legendTop);
      context.stroke();
      context.fillStyle = "#282722";
      context.font = `700 ${Math.max(20, cell * .42)}px "LXGW WenKai", sans-serif`;
      context.textAlign = "left";
      context.fillText("材料清单", legendPadding, headerY);
      context.fillStyle = "#756c60";
      context.font = `700 ${Math.max(15, cell * .27)}px "LXGW WenKai", sans-serif`;
      context.textAlign = "right";
      context.fillText(`共 ${total.toLocaleString()} 颗 · ${counts.length} 种颜色`, outputWidth - legendPadding, headerY);
      counts.forEach(({ color, count }, index) => {
        const column = index % legendColumns;
        const row = Math.floor(index / legendColumns);
        const x = legendPadding + column * columnWidth;
        const y = legendTop + legendPadding + legendHeaderHeight + row * legendItemHeight + legendItemHeight / 2;
        const swatchRadius = Math.max(12, cell * .24);
        context.fillStyle = color.hex;
        context.beginPath();
        context.arc(x + swatchRadius, y, swatchRadius, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = "#514b42";
        context.lineWidth = Math.max(1.5, cell * .025);
        context.stroke();
        context.fillStyle = "#282722";
        context.font = `700 ${Math.max(16, cell * .31)}px "LXGW WenKai", sans-serif`;
        context.textAlign = "left";
        context.fillText(`${color.code} · ${color.name}`, x + swatchRadius * 2 + cell * .18, y);
        context.textAlign = "right";
        context.fillText(`${count.toLocaleString()} 颗`, x + columnWidth - cell * .22, y);
      });
    }
    output.toBlob((blob) => {
      if (!blob) {
        console.error("[BEAD_EXPORT]", JSON.stringify({ action: "png", width: output.width, height: output.height, message: "Canvas returned an empty blob" }));
        setToast("图纸导出失败，请稍后重试");
        return;
      }
      downloadBlob(blob, `${sourceName || "拼豆图纸"}-${width}x${height}.png`);
      setToast(`已导出 ${output.width} × ${output.height} 高清 PNG`);
    }, "image/png");
  }

  function openExportDialog() {
    setIsExportDialogOpen(true);
  }

  function openSaveProjectDialog() {
    setSaveNameDraft(sourceName || "未命名拼豆项目");
    setIsSaveDialogOpen(true);
  }

  function confirmProjectSave() {
    const projectName = saveNameDraft.trim().slice(0, 80) || "未命名拼豆项目";
    const data = JSON.stringify({ version: 3, name: projectName, width, height, colorLimit, autoRemoveBackground, palette: PALETTE_NAME, cells: grid, savedAt: new Date().toISOString() }, null, 2);
    setSourceName(projectName);
    setIsSaveDialogOpen(false);
    downloadBlob(new Blob([data], { type: "application/json" }), `${projectName}.json`);
    setToast("项目源文件已保存");
  }

  async function importProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("项目文件超过 5 MB");
      const project = parseStoredProject(JSON.parse(await file.text()));
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      setSourceUrl(null);
      setSourceName(project.name);
      setWidth(project.width);
      setHeight(project.height);
      setDraftWidth(project.width);
      setDraftHeight(project.height);
      setLockedAspectRatio(project.width / project.height);
      setColorLimit(project.colorLimit);
      setAutoRemoveBackground(project.autoRemoveBackground);
      setGrid(project.cells);
      setUndoStack([]);
      setRedoStack([]);
      updateSelection(new Set());
      setToast(`已打开 ${project.name}`);
    } catch (error) {
      console.error("[BEAD_PROJECT_IMPORT]", JSON.stringify({ file: file.name, message: error instanceof Error ? error.message : String(error) }));
      setToast("项目文件无效，请选择由豆格导出的 JSON 文件");
    } finally {
      event.target.value = "";
    }
  }

  function exportMaterialsCsv() {
    const rows = [
      ["色号", "颜色", "数量", "建议准备（+10%）"],
      ...counts.map(({ color, count }) => [color.code, color.name, String(count), String(Math.ceil(count * 1.1))]),
      ["合计", "", String(total), String(Math.ceil(total * 1.1))],
    ];
    const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\r\n")}`;
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${sourceName || "拼豆项目"}-材料清单.csv`);
    setToast("材料清单已导出");
  }

  return (
    <main className="studio-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="豆格工作室首页">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span>豆格</span><small>BEAD GRID</small>
        </a>
        <div className="header-actions">
          <span className="privacy-note"><ShieldCheck aria-hidden="true" /> 图片仅在本机处理</span>
          <span className="save-status" title={draftSavedAt ? `最近保存：${new Date(draftSavedAt).toLocaleString("zh-CN")}` : "正在准备自动保存"}><Clock3 aria-hidden="true" />{draftSavedAt ? "已自动保存" : "自动保存"}</span>
          <button className="quiet-button icon-label" onClick={openSaveProjectDialog}><FileJson aria-hidden="true" />保存项目</button>
          <button className="primary-button compact icon-label" onClick={openExportDialog}><Download aria-hidden="true" />导出图纸</button>
        </div>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">PIXELS YOU CAN HOLD</p>
          <h1>把喜欢的图片，<br /><em>变成一颗颗拼豆。</em></h1>
        </div>
        <p className="hero-copy">上传照片，选择尺寸和颜色数量，就能生成可编辑、可统计、可打印的拼豆图纸。</p>
      </section>

      <section className="workspace" aria-label="拼豆图纸编辑器">
        <aside className="control-panel">
          <div className="panel-heading">
            <span className="step-number">01</span>
            <div><h2>生成设置</h2><p>上传图片并控制成品大小</p></div>
          </div>

          <input ref={fileInputRef} className="sr-only" type="file" accept="image/*" onChange={handleUpload} />
          <input ref={projectInputRef} className="sr-only" type="file" accept="application/json,.json" onChange={importProject} />
          <button className="upload-card" onClick={() => fileInputRef.current?.click()} disabled={isGenerating}>
            <span className="upload-icon"><ImagePlus aria-hidden="true" /></span>
            <strong>{isGenerating ? "正在分析颜色…" : "上传一张图片"}</strong>
            <small>JPG、PNG、WEBP · 自动居中裁剪</small>
          </button>
          <div className="project-actions">
            <button className="icon-label" onClick={() => projectInputRef.current?.click()}><FolderOpen aria-hidden="true" />打开项目</button>
            <button className="icon-label" onClick={openSaveProjectDialog}><FileDown aria-hidden="true" />保存源文件</button>
          </div>

          <div className="field-group">
            <label>网格尺寸 <span>{draftWidth} × {draftHeight}</span></label>
            <div className="dimension-row">
              <label><span>宽</span><input aria-label="横向豆子数量" type="number" min={MIN_GRID_SIZE} max={MAX_GRID_SIZE} value={draftWidth} onChange={(e) => handleWidthChange(Number(e.target.value))} /></label>
              <button className={`ratio-lock ${lockAspectRatio ? "active" : ""}`} aria-label={lockAspectRatio ? "关闭比例锁定" : "开启比例锁定"} title={lockAspectRatio ? "比例已锁定，点击解除" : "点击锁定宽高比例"} aria-pressed={lockAspectRatio} onClick={toggleLockAspectRatio}>{lockAspectRatio ? <Link2 aria-hidden="true" /> : <Link2Off aria-hidden="true" />}</button>
              <label><span>高</span><input aria-label="纵向豆子数量" type="number" min={MIN_GRID_SIZE} max={MAX_GRID_SIZE} value={draftHeight} onChange={(e) => handleHeightChange(Number(e.target.value))} /></label>
            </div>
            <div className="size-presets" aria-label="常用网格尺寸">
              {SIZE_PRESETS.map((size) => <button key={size} className={draftWidth === size && draftHeight === size ? "active" : ""} onClick={() => applyPreset(size)}>{size}²</button>)}
            </div>
            <p className="size-summary">约 {physicalWidth} × {physicalHeight} cm · 5 mm 拼豆</p>
            <button className={`apply-size icon-label${pendingSizeChanged ? " pending" : ""}`} onClick={applySize} disabled={!pendingSizeChanged}><Check aria-hidden="true" />{pendingSizeChanged ? "应用新尺寸" : "尺寸已应用"}</button>
            <small>支持 {MIN_GRID_SIZE}–{MAX_GRID_SIZE} 格；锁定比例后，修改一边会同步另一边</small>
          </div>

          <div className="field-group">
            <label htmlFor="color-limit">颜色数量 <span>{colorLimit} 色</span></label>
            <input id="color-limit" type="range" min="3" max={PALETTE.length} value={colorLimit} onChange={(e) => setColorLimit(Number(e.target.value))} />
            <div className="range-labels"><span>简洁</span><span>细腻</span></div>
          </div>

          <div className="field-group">
            <label className="setting-switch" htmlFor="auto-remove-background">
              <span><strong>自动移除背景</strong><small>将出现最多的色号识别为空白</small></span>
              <input id="auto-remove-background" type="checkbox" checked={autoRemoveBackground} onChange={(event) => setAutoRemoveBackground(event.target.checked)} />
              <i aria-hidden="true" />
            </label>
          </div>

          <div className="field-group">
            <label>色板</label>
            <div className="palette-card"><Palette aria-hidden="true" /><span><strong>MARD 标准色板 · {PALETTE.length} 色</strong><small>A–H、M 多系列常用采购色号</small></span></div>
            <small>屏幕颜色仅供模拟，实体颜色可能因品牌与批次略有差异</small>
          </div>

          {sourceUrl && <button className="primary-button full icon-label" onClick={() => void generateFromImage(sourceUrl, clampGridSize(draftWidth), clampGridSize(draftHeight), colorLimit, autoRemoveBackground)} disabled={isGenerating}><RefreshCw aria-hidden="true" />重新生成图纸</button>}
        </aside>

        <section className="canvas-panel">
          <div className="canvas-toolbar">
            <div className="tool-group" role="group" aria-label="编辑工具">
              <button className={tool === "paint" ? "active" : ""} onClick={() => setTool("paint")}><Pencil aria-hidden="true" />画笔</button>
              <button className={tool === "erase" ? "active" : ""} onClick={() => setTool("erase")}><Eraser aria-hidden="true" />橡皮</button>
              <button className={tool === "pick" ? "active" : ""} onClick={() => setTool("pick")}><Pipette aria-hidden="true" />吸管</button>
              <button className={tool === "select" ? "active" : ""} onClick={() => setTool("select")}><MousePointer2 aria-hidden="true" />选择</button>
            </div>
            <div className="toolbar-right">
              <button title="撤销" aria-label="撤销" onClick={undo} disabled={!undoStack.length}><Undo2 aria-hidden="true" /></button>
              <button title="重做" aria-label="重做" onClick={redo} disabled={!redoStack.length}><Redo2 aria-hidden="true" /></button>
              <label className="toggle"><input type="checkbox" checked={showCodes} onChange={(e) => setShowCodes(e.target.checked)} /><span />色号</label>
              <label className="toggle"><input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /><span />网格</label>
            </div>
          </div>

          <div className="canvas-stage">
            {selectedCells.size > 0 && (
              <div className="selection-actions" role="toolbar" aria-label="所选豆子操作">
                <strong><MousePointer2 aria-hidden="true" />{selectedCells.size} 颗已选</strong>
                <button onClick={fillSelection}><PaintBucket aria-hidden="true" />填为 {selectedColor}</button>
                <button className="danger" onClick={eraseSelection}><Trash2 aria-hidden="true" />移除</button>
                <button onClick={selectAllBeads}><Scan aria-hidden="true" />全选</button>
                <button className="icon-only" aria-label="取消选择" title="取消选择" onClick={() => updateSelection(new Set())}><X aria-hidden="true" /></button>
              </div>
            )}
            {tool === "select" && selectedCells.size === 0 && (
              <div className="selection-hint"><MousePointer2 aria-hidden="true" />拖拽框选；长按后沿轨迹连续选择</div>
            )}
            <div className="ruler-label top">{width} BEADS</div>
            <div
              ref={canvasScrollRef}
              className={`canvas-scroll${selectedCells.size ? " has-selection" : ""}`}
              tabIndex={0}
              aria-label="拼豆画布工作区"
              onKeyDown={handleCanvasKeyDown}
              onContextMenu={(event) => event.preventDefault()}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerEnd}
              onPointerCancel={(event) => handleCanvasPointerEnd(event, true)}
            >
              <div className={`canvas-scroll-content ${isFitZoom ? "fit" : "manual"}`}>
                <canvas
                  ref={canvasRef}
                  className={`bead-canvas tool-${tool}`}
                  style={{ width: `${canvasDisplayWidth}px`, height: `${canvasDisplayHeight}px` }}
                  aria-label={`${width} 乘 ${height} 拼豆画布`}
                />
              </div>
            </div>
            <div className="zoom-control" title="双指缩放，或使用 Cmd/Ctrl + 滚轮">
              <button aria-label="缩小画布" onClick={() => { const nextZoom = Math.max(.2, activeZoomRef.current - .15); activeZoomRef.current = nextZoom; setZoom(nextZoom); setIsFitZoom(false); }}><Minus aria-hidden="true" /></button>
              <button className={isFitZoom ? "fit-active" : ""} onClick={() => { activeZoomRef.current = fitZoom; setIsFitZoom(true); }}><Maximize2 aria-hidden="true" />适应</button>
              <span>{Math.round(activeZoom * 100)}%</span>
              <button aria-label="放大画布" onClick={() => { const nextZoom = Math.min(2.2, activeZoomRef.current + .15); activeZoomRef.current = nextZoom; setZoom(nextZoom); setIsFitZoom(false); }}><Plus aria-hidden="true" /></button>
            </div>
          </div>

          <div className="palette-strip" aria-label="拼豆颜色">
            <div className="palette-title"><strong>颜色</strong><span>{selectedColor} · {colorMap.get(selectedColor)?.name}</span></div>
            <div className="swatches">
              {PALETTE.map((color) => (
                <button
                  key={color.code}
                  className={selectedColor === color.code ? "selected" : ""}
                  style={{ "--swatch": color.hex } as React.CSSProperties}
                  onClick={() => { setSelectedColor(color.code); if (!selectedCellsRef.current.size) setTool("paint"); }}
                  title={`${color.code} ${color.name}`}
                  aria-label={`${color.code} ${color.name}`}
                ><span>{color.code}</span></button>
              ))}
            </div>
          </div>
        </section>

        <aside className="material-panel">
          <div className="panel-heading">
            <span className="step-number">02</span>
            <div><h2>材料清单</h2><p>跟着色号准备豆子</p></div>
          </div>
          <div className="total-card">
            <span>预计用豆</span>
            <strong>{total.toLocaleString()}</strong>
            <small>颗 · {counts.length} 种颜色</small>
          </div>
          <div className="material-list">
            {counts.map(({ color, count }) => (
              <button key={color.code} onClick={() => { setSelectedColor(color.code); if (!selectedCellsRef.current.size) setTool("paint"); }}>
                <i style={{ background: color.hex }} />
                <span><strong>{color.code}</strong><small>{color.name}</small></span>
                <b>{count}</b>
              </button>
            ))}
          </div>
          <div className="material-footnote"><Info aria-hidden="true" /><p>建议按清单多准备约 10% 的豆子，避免制作中途缺色。</p></div>
          <button className="quiet-button full icon-label" onClick={exportMaterialsCsv}><FileSpreadsheet aria-hidden="true" />导出材料 CSV</button>
          <button className="primary-button full icon-label" onClick={openExportDialog}><Download aria-hidden="true" />导出带色号 PNG</button>
        </aside>
      </section>

      <footer>
        <p><strong>豆格 BEAD GRID</strong> · 一张图，一盘豆，一点耐心。</p>
        <p>本地处理 · 无需登录 · 支持手机与电脑</p>
      </footer>

      {isSaveDialogOpen && (
        <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsSaveDialogOpen(false); }}>
          <form className="action-dialog" role="dialog" aria-modal="true" aria-labelledby="save-dialog-title" onSubmit={(event) => { event.preventDefault(); confirmProjectSave(); }} onKeyDown={(event) => { if (event.key === "Escape") setIsSaveDialogOpen(false); }}>
            <div className="action-dialog-heading">
              <div><span><FileJson aria-hidden="true" /></span><h2 id="save-dialog-title">保存项目</h2></div>
              <button type="button" aria-label="关闭保存窗口" title="关闭" onClick={() => setIsSaveDialogOpen(false)}><X aria-hidden="true" /></button>
            </div>
            <label htmlFor="save-project-name">项目名称</label>
            <input id="save-project-name" autoFocus value={saveNameDraft} maxLength={80} onChange={(event) => setSaveNameDraft(event.target.value)} />
            <p>项目将保存为可继续编辑的 JSON 源文件。</p>
            <div className="action-dialog-actions">
              <button type="button" className="quiet-button" onClick={() => setIsSaveDialogOpen(false)}>取消</button>
              <button type="submit" className="primary-button icon-label"><FileDown aria-hidden="true" />保存源文件</button>
            </div>
          </form>
        </div>
      )}

      {isExportDialogOpen && (
        <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsExportDialogOpen(false); }}>
          <form className="action-dialog" role="dialog" aria-modal="true" aria-labelledby="export-dialog-title" onSubmit={(event) => { event.preventDefault(); setIsExportDialogOpen(false); void exportPng(exportBoardSize); }} onKeyDown={(event) => { if (event.key === "Escape") setIsExportDialogOpen(false); }}>
            <div className="action-dialog-heading">
              <div><span><Scan aria-hidden="true" /></span><h2 id="export-dialog-title">拼豆板尺寸</h2></div>
              <button type="button" aria-label="关闭导出窗口" title="关闭" onClick={() => setIsExportDialogOpen(false)}><X aria-hidden="true" /></button>
            </div>
            <p>粗网格线将按所选拼豆板尺寸划分；图纸底部会附上所有色号、颜色名称和所需颗数。</p>
            <div className="board-size-options" role="group" aria-label="选择拼豆板尺寸">
              {PEGBOARD_SIZE_OPTIONS.map((size) => (
                <button type="button" key={size} className={exportBoardSize === size ? "active" : ""} aria-pressed={exportBoardSize === size} onClick={() => setExportBoardSize(size)}>{size} × {size}</button>
              ))}
            </div>
            <div className="action-dialog-actions">
              <button type="button" className="quiet-button" onClick={() => setIsExportDialogOpen(false)}>取消</button>
              <button type="submit" className="primary-button icon-label"><Download aria-hidden="true" />导出图纸＋材料清单</button>
            </div>
          </form>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
