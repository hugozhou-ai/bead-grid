# 豆格 Bead Grid

一个隐私友好的拼豆图纸生成器。上传图片后，可以在浏览器本地生成、编辑并导出带色号的拼豆图纸，手机和电脑均可使用。

## 功能

- 图片在浏览器本地处理，不上传服务器
- 支持 8×8 至 80×80 的图纸尺寸
- 自动匹配通用 16 色拼豆色板并限制颜色数量
- 画笔、橡皮、吸管、撤销和重做
- 网格、色号和缩放控制
- 实时材料用量统计
- 导出带网格和色号的 PNG
- 导出 JSON 源项目
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

## 在线访问与自动部署

线上地址：[https://hugozhou-ai.github.io/bead-grid/](https://hugozhou-ai.github.io/bead-grid/)

`.github/workflows/deploy-pages.yml` 会在每次代码合入或推送到 `main` 后自动构建并部署 GitHub Pages，也支持在 Actions 页面手动触发。

## 技术栈

- React 19 + TypeScript
- Next.js 兼容 App Router
- vinext + Vite
- Canvas 2D 图片处理和图纸绘制
- Cloudflare Worker 兼容构建

## 隐私说明

图片解码、缩放、颜色匹配和导出均在浏览器中完成。项目不提供服务端上传接口。屏幕色板仅用于模拟，实体拼豆可能因品牌、批次和显示器差异产生色差。

## License

[MIT](./LICENSE)
