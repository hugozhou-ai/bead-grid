export const PROJECT_FILE_VERSION = 3 as const;
export const MIN_PROJECT_GRID_SIZE = 8;
export const MAX_PROJECT_GRID_SIZE = 160;

export type StoredProject = {
  version: typeof PROJECT_FILE_VERSION;
  name: string;
  width: number;
  height: number;
  colorLimit: number;
  autoRemoveBackground: boolean;
  palette: string;
  cells: Array<string | null>;
  savedAt: string;
};

type CreateProjectOptions = Omit<StoredProject, "version">;

type ParseProjectOptions = {
  paletteName: string;
  validCodes: readonly string[];
  legacyPaletteName: string;
  legacyCodeMap: Readonly<Record<string, string>>;
};

export function createProjectFile(options: CreateProjectOptions): StoredProject {
  return {
    version: PROJECT_FILE_VERSION,
    name: options.name,
    width: options.width,
    height: options.height,
    colorLimit: options.colorLimit,
    autoRemoveBackground: options.autoRemoveBackground,
    palette: options.palette,
    cells: options.cells,
    savedAt: options.savedAt,
  };
}

function clampProjectGridSize(value: number) {
  return Math.max(MIN_PROJECT_GRID_SIZE, Math.min(MAX_PROJECT_GRID_SIZE, Math.round(value || MIN_PROJECT_GRID_SIZE)));
}

export function parseProjectFile(value: unknown, options: ParseProjectOptions): StoredProject {
  if (!value || typeof value !== "object") throw new Error("项目内容不是对象");
  const candidate = value as Record<string, unknown>;
  const width = clampProjectGridSize(Number(candidate.width));
  const height = clampProjectGridSize(Number(candidate.height));
  if (candidate.width !== width || candidate.height !== height) {
    throw new Error(`图纸尺寸超出 ${MIN_PROJECT_GRID_SIZE}–${MAX_PROJECT_GRID_SIZE} 范围`);
  }
  if (!Array.isArray(candidate.cells) || candidate.cells.length !== width * height) {
    throw new Error("图纸格子数量与尺寸不一致");
  }
  const usesLegacyPalette = Number(candidate.version) === 2 || candidate.palette === options.legacyPaletteName;
  const migratedCells = candidate.cells.map((cell) => {
    if (cell === null) return null;
    if (typeof cell !== "string") throw new Error("图纸包含无效色号");
    return usesLegacyPalette ? options.legacyCodeMap[cell] ?? cell : cell;
  });
  const validCodes = new Set(options.validCodes);
  if (migratedCells.some((cell) => cell !== null && !validCodes.has(cell))) {
    throw new Error("图纸包含未知色号");
  }
  return createProjectFile({
    name: typeof candidate.name === "string" && candidate.name.trim()
      ? candidate.name.trim().slice(0, 80)
      : "未命名拼豆项目",
    width,
    height,
    colorLimit: Math.max(3, Math.min(validCodes.size, Math.round(Number(candidate.colorLimit) || 10))),
    autoRemoveBackground: candidate.autoRemoveBackground === true,
    palette: options.paletteName,
    cells: migratedCells,
    savedAt: typeof candidate.savedAt === "string" ? candidate.savedAt : new Date().toISOString(),
  });
}

export function serializeProjectFile(project: StoredProject) {
  return `${JSON.stringify(project, null, 2)}\n`;
}
