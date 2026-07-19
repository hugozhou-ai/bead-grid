export type BeadColor = {
  code: string;
  name: string;
  hex: string;
};

export const PALETTE: BeadColor[] = [
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
  { code: "A17", name: "纯白", hex: "#FFFFFF" },
  { code: "A18", name: "浅米黄", hex: "#F3DFB3" },
  { code: "A19", name: "金黄", hex: "#E9B934" },
  { code: "A20", name: "亮橙", hex: "#E97532" },
  { code: "A21", name: "正红", hex: "#D8433E" },
  { code: "A22", name: "酒红", hex: "#8E3341" },
  { code: "A23", name: "玫红", hex: "#C9366D" },
  { code: "A24", name: "浅紫", hex: "#C3A6D6" },
  { code: "A25", name: "深紫", hex: "#5E417E" },
  { code: "A26", name: "天蓝", hex: "#A8D5E5" },
  { code: "A27", name: "宝蓝", hex: "#3676B8" },
  { code: "A28", name: "藏青", hex: "#304765" },
  { code: "A29", name: "青绿", hex: "#248B83" },
  { code: "A30", name: "嫩绿", hex: "#A7D56E" },
  { code: "A31", name: "墨绿", hex: "#315B43" },
  { code: "A32", name: "冷灰", hex: "#667078" },
];

export const PALETTE_NAME = "通用综合色板 32 色";

export function hexToRgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

export const RGB_PALETTE = PALETTE.map((color) => ({ ...color, rgb: hexToRgb(color.hex) }));

export function beadLabelColor(color?: BeadColor) {
  if (!color) return "#302d29";
  const [r, g, b] = hexToRgb(color.hex);
  return 0.299 * r + 0.587 * g + 0.114 * b < 128 ? "#fff" : "#302d29";
}
