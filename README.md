# 豆格 Bead Grid

一个隐私友好的拼豆图纸生成器。上传图片后，可以在浏览器本地生成、编辑并导出带色号的拼豆图纸，手机和电脑均可使用。

界面采用暖色纸张与钢笔手绘风格，标题与正文使用[霞鹜文楷](https://github.com/lxgw/LxgwWenKai)，拼豆、网格和操作控件均以轻微不规则的墨线呈现，同时保留清晰的颜色与色号辨识度。极小的辅助信息保留系统无衬线字体，确保移动端可读性。

## 功能

- 图片在浏览器本地处理，不上传服务器
- 支持 8×8 至 160×160 的图纸尺寸
- 比例锁定、常用尺寸和 5 mm 拼豆成品尺寸换算
- 每格多点采样并按色号众数匹配 MARD 标准 221 色拼豆色板
- 可选自动移除背景；开启后将出现最多的色号识别为空白，默认关闭
- 画笔、橡皮、吸管、撤销和重做
- 单击选择、拖拽框选、长按轨迹选择和批量填色/移除
- 网格、色号和缩放控制
- 实时材料用量统计
- 本地自动保存，支持 JSON 项目导入与继续编辑
- 根据图纸规模动态生成高清 PNG，导出时可选择 52×52、78×78、104×104 或 120×120 拼豆板分界线，并在四周标注行号与列号
- 导出 JSON 源项目和带 10% 备料建议的材料 CSV
- 响应式移动端和桌面端界面

## 本地开发

需要 Node.js 22.13 或更新版本。

```bash
npm install
npm run dev
```

质量检查：

```bash
npm run lint
npm test
npm run test:pages
```

## 批量导出图纸

批处理脚本递归读取输入目录中的 JPG、PNG 和 WEBP，并复用网页端的色板、4×4 多点采样、颜色收敛和导出尺寸计算逻辑。默认参数为 64×64 网格、10 色、关闭自动移除背景、52×52 拼豆板：

```bash
npm run batch:export -- \
  --input /path/to/images \
  --output /path/to/patterns
```

可通过 `--grid 64x64`、`--colors 10`、`--remove-background false`、`--pegboard 52` 和 `--concurrency 2` 显式覆盖参数。输出目录会保留输入目录结构，并生成 `README.txt` 与包含逐文件颜色用量、尺寸和 SHA-256 的 `manifest.json`。

## 在线访问与自动部署

线上地址：[https://hugozhou-ai.github.io/bead-grid/](https://hugozhou-ai.github.io/bead-grid/)

`.github/workflows/deploy-pages.yml` 会在每次代码合入或推送到 `main` 后自动构建并部署 GitHub Pages，也支持在 Actions 页面手动触发。

## 技术栈

- React 19 + TypeScript
- Next.js 兼容 App Router
- vinext + Vite
- Canvas 2D 图片处理和图纸绘制
- Lucide React 统一界面图标
- Cloudflare Worker 兼容构建

## 隐私说明

图片解码、缩放、颜色匹配和导出均在浏览器中完成。项目不提供服务端上传接口。屏幕色板仅用于模拟，实体拼豆可能因品牌、批次和显示器差异产生色差。

## License

[MIT](./LICENSE)
