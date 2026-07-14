"use client";

import { ChangeEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";

type BeadColor = {
  code: string;
  name: string;
  hex: string;
};

type Tool = "paint" | "erase" | "pick";

const PALETTE: BeadColor[] = [
  { code: "A01", name: "奶油白", hex: "#F7F1E3" },
  { code: "A02", name: "柠檬黄", hex: "#F6D94A" },
  { code: "A03", name: "蜜橙", hex: "#F59C3D" },
  { code: "A04", name: "珊瑚红", hex: "#EE6A5B" },
  { code: "A05", name: "莓果粉", hex: "#D94E76" },
  { code: "A06", name: "樱花粉", hex: "#F2A7BB" },
  { code: "A07", name: "葡萄紫", hex: "#8D67AB" },
  { code: "A08", name: "雾蓝", hex: "#72A7C4" },
  { code: "A09", name: "湖水蓝", hex: "#45AEB1" },
  { code: "A10", name: "薄荷绿", hex: "#72BE91" },
  { code: "A11", name: "草木绿", hex: "#4D8C57" },
  { code: "A12", name: "抹茶", hex: "#A5B85A" },
  { code: "A13", name: "焦糖", hex: "#B87545" },
  { code: "A14", name: "可可棕", hex: "#754C3B" },
  { code: "A15", name: "暖灰", hex: "#9A9188" },
  { code: "A16", name: "炭黑", hex: "#292827" },
];

const RGB_PALETTE = PALETTE.map((color) => ({ ...color, rgb: hexToRgb(color.hex) }));

function hexToRgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function nearestColor(r: number, g: number, b: number, palette = RGB_PALETTE) {
  let best = palette[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of palette) {
    const [cr, cg, cb] = candidate.rgb;
    const distance = 0.3 * (r - cr) ** 2 + 0.59 * (g - cg) ** 2 + 0.11 * (b - cb) ** 2;
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best.code;
}

function createDemo(width: number, height: number): Array<string | null> {
  return Array.from({ length: width * height }, (_, index) => {
    const x = (index % width) / width;
    const y = Math.floor(index / width) / height;
    const px = x * 2 - 1;
    const py = y * 2 - 0.25;
    const heart = (px * px + py * py - 0.58) ** 3 - px * px * py ** 3 < 0;
    if (!heart) return null;
    if (py < -0.35 && px < 0.1) return "A06";
    if (py > 0.35) return "A05";
    return "A04";
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

export function BeadStudio() {
  const [width, setWidth] = useState(32);
  const [height, setHeight] = useState(32);
  const [colorLimit, setColorLimit] = useState(10);
  const [grid, setGrid] = useState<Array<string | null>>(() => createDemo(32, 32));
  const [sourceName, setSourceName] = useState("示例爱心");
  const [selectedColor, setSelectedColor] = useState("A04");
  const [tool, setTool] = useState<Tool>("paint");
  const [zoom, setZoom] = useState(1);
  const [fitZoom, setFitZoom] = useState(1);
  const [isFitZoom, setIsFitZoom] = useState(true);
  const [showCodes, setShowCodes] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toast, setToast] = useState("示例图案已就绪，可以上传照片开始创作");
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<Array<Array<string | null>>>([]);
  const [redoStack, setRedoStack] = useState<Array<Array<string | null>>>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cell = canvasCellSize;
    canvas.width = width * cell;
    canvas.height = height * cell;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#f7f2e8";
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const code = grid[y * width + x];
        if (code) {
          const color = colorMap.get(code);
          context.fillStyle = color?.hex ?? "#ffffff";
          context.beginPath();
          context.arc(x * cell + cell / 2, y * cell + cell / 2, cell * 0.41, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = "rgba(255,255,255,.25)";
          context.beginPath();
          context.arc(x * cell + cell * 0.38, y * cell + cell * 0.35, cell * 0.1, 0, Math.PI * 2);
          context.fill();
          if (showCodes && cell >= 18) {
            context.fillStyle = code === "A16" ? "#fff" : "#302d29";
            context.font = `600 ${Math.max(7, cell * 0.28)}px sans-serif`;
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText(code.slice(1), x * cell + cell / 2, y * cell + cell / 2 + 0.5);
          }
        }
        if (showGrid) {
          context.strokeStyle = "rgba(72,61,48,.13)";
          context.lineWidth = 1;
          context.strokeRect(x * cell, y * cell, cell, cell);
        }
      }
    }
  }, [grid, width, height, colorMap, showCodes, showGrid, canvasCellSize]);

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
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function commitGrid(next: Array<string | null>, message?: string) {
    setUndoStack((stack) => [...stack.slice(-29), grid]);
    setRedoStack([]);
    setGrid(next);
    if (message) setToast(message);
  }

  function undo() {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setRedoStack((stack) => [...stack, grid]);
    setGrid(previous);
    setUndoStack((stack) => stack.slice(0, -1));
  }

  function redo() {
    const next = redoStack.at(-1);
    if (!next) return;
    setUndoStack((stack) => [...stack, grid]);
    setGrid(next);
    setRedoStack((stack) => stack.slice(0, -1));
  }

  function updateCell(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * width);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * height);
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = y * width + x;
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

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setToast("请选择图片文件");
      return;
    }
    const url = URL.createObjectURL(file);
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setSourceUrl(url);
    setSourceName(file.name.replace(/\.[^.]+$/, ""));
    await generateFromImage(url, width, height, colorLimit);
    event.target.value = "";
  }

  async function generateFromImage(url: string, targetWidth: number, targetHeight: number, limit: number) {
    setIsGenerating(true);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const sampleCanvas = document.createElement("canvas");
      sampleCanvas.width = targetWidth;
      sampleCanvas.height = targetHeight;
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
      context.drawImage(image, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
      const pixels = context.getImageData(0, 0, targetWidth, targetHeight).data;
      const firstPass: Array<string | null> = [];
      const frequency = new Map<string, number>();
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] < 70) {
          firstPass.push(null);
          continue;
        }
        const code = nearestColor(pixels[index], pixels[index + 1], pixels[index + 2]);
        firstPass.push(code);
        frequency.set(code, (frequency.get(code) ?? 0) + 1);
      }
      const allowedCodes = [...frequency.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([code]) => code);
      const allowed = RGB_PALETTE.filter((color) => allowedCodes.includes(color.code));
      const next = firstPass.map((code, index) => {
        if (!code || allowedCodes.includes(code)) return code;
        const pixelIndex = index * 4;
        return nearestColor(pixels[pixelIndex], pixels[pixelIndex + 1], pixels[pixelIndex + 2], allowed);
      });
      commitGrid(next, `已生成 ${targetWidth} × ${targetHeight} 图纸`);
    } catch (error) {
      console.error("[BEAD_GENERATE]", JSON.stringify({ message: error instanceof Error ? error.message : String(error) }));
      setToast("图片处理失败，请换一张图片重试");
    } finally {
      setIsGenerating(false);
    }
  }

  function applySize() {
    const safeWidth = Math.max(8, Math.min(80, Math.round(width)));
    const safeHeight = Math.max(8, Math.min(80, Math.round(height)));
    setWidth(safeWidth);
    setHeight(safeHeight);
    if (sourceUrl) void generateFromImage(sourceUrl, safeWidth, safeHeight, colorLimit);
    else commitGrid(createDemo(safeWidth, safeHeight), `已调整为 ${safeWidth} × ${safeHeight}`);
  }

  function exportPng() {
    const source = canvasRef.current;
    if (!source) return;
    const output = document.createElement("canvas");
    const cell = 32;
    output.width = width * cell;
    output.height = height * cell;
    const context = output.getContext("2d");
    if (!context) return;
    context.fillStyle = "#fffdf8";
    context.fillRect(0, 0, output.width, output.height);
    grid.forEach((code, index) => {
      const x = index % width;
      const y = Math.floor(index / width);
      context.strokeStyle = "#ddd4c6";
      context.strokeRect(x * cell, y * cell, cell, cell);
      if (!code) return;
      context.fillStyle = colorMap.get(code)?.hex ?? "#fff";
      context.beginPath();
      context.arc(x * cell + cell / 2, y * cell + cell / 2, cell * 0.4, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = code === "A16" ? "#fff" : "#332f2a";
      context.font = "600 9px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(code, x * cell + cell / 2, y * cell + cell / 2);
    });
    output.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${sourceName || "拼豆图纸"}-${width}x${height}.png`);
    }, "image/png");
  }

  function exportProject() {
    const data = JSON.stringify({ version: 1, name: sourceName, width, height, palette: "通用暖色 16 色", cells: grid }, null, 2);
    downloadBlob(new Blob([data], { type: "application/json" }), `${sourceName || "拼豆项目"}.json`);
  }

  return (
    <main className="studio-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="豆格工作室首页">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span>豆格</span><small>BEAD GRID</small>
        </a>
        <div className="header-actions">
          <span className="privacy-note"><span className="status-dot" /> 图片仅在本机处理</span>
          <button className="quiet-button" onClick={exportProject}>保存项目</button>
          <button className="primary-button compact" onClick={exportPng}>导出图纸</button>
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
          <button className="upload-card" onClick={() => fileInputRef.current?.click()} disabled={isGenerating}>
            <span className="upload-icon">＋</span>
            <strong>{isGenerating ? "正在分析颜色…" : "上传一张图片"}</strong>
            <small>JPG、PNG、WEBP · 自动居中裁剪</small>
          </button>
          <p className="current-file"><span className="status-dot" /> 当前：{sourceName}</p>

          <div className="field-group">
            <label>网格尺寸 <span>{width} × {height}</span></label>
            <div className="dimension-row">
              <input aria-label="横向豆子数量" type="number" min="8" max="80" value={width} onChange={(e) => setWidth(Number(e.target.value))} />
              <b>×</b>
              <input aria-label="纵向豆子数量" type="number" min="8" max="80" value={height} onChange={(e) => setHeight(Number(e.target.value))} />
              <button onClick={applySize}>应用</button>
            </div>
            <small>支持 8–80 格，数字越大细节越丰富</small>
          </div>

          <div className="field-group">
            <label htmlFor="color-limit">颜色数量 <span>{colorLimit} 色</span></label>
            <input id="color-limit" type="range" min="3" max="16" value={colorLimit} onChange={(e) => setColorLimit(Number(e.target.value))} />
            <div className="range-labels"><span>简洁</span><span>细腻</span></div>
          </div>

          <div className="field-group">
            <label>色板</label>
            <div className="select-like">通用暖色 · 16 色 <span>⌄</span></div>
            <small>首版为屏幕模拟色，实体颜色可能略有差异</small>
          </div>

          {sourceUrl && <button className="primary-button full" onClick={() => void generateFromImage(sourceUrl, width, height, colorLimit)} disabled={isGenerating}>重新生成图纸</button>}
        </aside>

        <section className="canvas-panel">
          <div className="canvas-toolbar">
            <div className="tool-group" role="group" aria-label="编辑工具">
              <button className={tool === "paint" ? "active" : ""} onClick={() => setTool("paint")}><span>✎</span>画笔</button>
              <button className={tool === "erase" ? "active" : ""} onClick={() => setTool("erase")}><span>◇</span>橡皮</button>
              <button className={tool === "pick" ? "active" : ""} onClick={() => setTool("pick")}><span>◉</span>吸管</button>
            </div>
            <div className="toolbar-right">
              <button title="撤销" aria-label="撤销" onClick={undo} disabled={!undoStack.length}>↶</button>
              <button title="重做" aria-label="重做" onClick={redo} disabled={!redoStack.length}>↷</button>
              <label className="toggle"><input type="checkbox" checked={showCodes} onChange={(e) => setShowCodes(e.target.checked)} /><span />色号</label>
              <label className="toggle"><input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /><span />网格</label>
            </div>
          </div>

          <div className="canvas-stage">
            <div className="ruler-label top">{width} BEADS</div>
            <div ref={canvasScrollRef} className="canvas-scroll">
              <div className="canvas-scroll-content">
                <canvas
                  ref={canvasRef}
                  className={`bead-canvas tool-${tool}`}
                  style={{ width: `${canvasDisplayWidth}px`, height: `${canvasDisplayHeight}px` }}
                  onPointerDown={updateCell}
                  aria-label={`${width} 乘 ${height} 拼豆画布`}
                />
              </div>
            </div>
            <div className="zoom-control">
              <button aria-label="缩小画布" onClick={() => { setZoom(Math.max(.2, activeZoom - .15)); setIsFitZoom(false); }}>−</button>
              <button className={isFitZoom ? "fit-active" : ""} onClick={() => setIsFitZoom(true)}>适应</button>
              <span>{Math.round(activeZoom * 100)}%</span>
              <button aria-label="放大画布" onClick={() => { setZoom(Math.min(2.2, activeZoom + .15)); setIsFitZoom(false); }}>＋</button>
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
                  onClick={() => { setSelectedColor(color.code); setTool("paint"); }}
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
              <button key={color.code} onClick={() => { setSelectedColor(color.code); setTool("paint"); }}>
                <i style={{ background: color.hex }} />
                <span><strong>{color.code}</strong><small>{color.name}</small></span>
                <b>{count}</b>
              </button>
            ))}
          </div>
          <div className="material-footnote"><span>＋</span><p>建议按清单多准备约 10% 的豆子，避免制作中途缺色。</p></div>
          <button className="primary-button full" onClick={exportPng}>导出带色号 PNG</button>
        </aside>
      </section>

      <footer>
        <p><strong>豆格 BEAD GRID</strong> · 一张图，一盘豆，一点耐心。</p>
        <p>本地处理 · 无需登录 · 支持手机与电脑</p>
      </footer>

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
