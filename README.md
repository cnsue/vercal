# 养老金工具页

这个仓库是一个纯静态站点，适合直接部署到 Vercel。

当前包含三个可公开访问的页面：

- `index.html`
  站点首页，提供工具导航入口。
- `retirement-gap-calculator.html`
  退休待遇与养老缺口测算页。
- `pension-calc-v5.html`
  银行股养老全收益计算器。
- `flex-pension-city-compare.html`
  多城灵活就业养老金测算页。

## 本地文件结构

```text
.
├── flex-pension-city-compare.html
├── index.html
├── pension-calc-v5.html
├── retirement-gap-calculator.html
└── vercel.json
```

## 部署后的访问路径

`vercel.json` 已开启 `cleanUrls: true`，所以部署后通常可以直接用不带 `.html` 的路径访问：

- `/`
- `/retirement-gap-calculator`
- `/pension-calc-v5`
- `/flex-pension-city-compare`

## 推送到 GitHub

如果本机还没有登录 GitHub CLI，先登录：

```bash
gh auth login -h github.com
```

然后推送：

```bash
git add .
git commit -m "update site"
git push -u origin main
```

## 部署到 Vercel

### 方式 1：从 GitHub 导入

1. 把仓库推到 GitHub。
2. 登录 Vercel。
3. 选择 `Add New Project`。
4. 导入这个仓库。
5. 使用默认静态站点配置即可：
   - Root Directory: 仓库根目录
   - Framework Preset: `Other` 或自动识别
   - Build Command: 留空
   - Output Directory: 留空
   - Environment Variables: 不需要

### 方式 2：直接从本地部署

安装 Vercel CLI 后，在仓库目录执行：

```bash
vercel
vercel --prod
```

## 说明

- 这是静态 HTML 页面，不依赖后端。
- 页面中的计算结果为前端估算值，最终仍应以当地政策和官方系统口径为准。
