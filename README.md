# 善愿日用品店（零售/批发）

手机端商品展示站。顾客可以逛店、看详情；登录用户能把货放进购物车当询价清单；管理员负责上架、改价、改介绍。成交走电话 / 微信，网站里不收款。

---

## 三种入口

| 入口 | 怎么进 | 能做什么 |
|------|--------|----------|
| 游客 | 点「游客进入」 | 看商品、看客服，不能加购物车 |
| 用户 | 用户名 + 密码（可注册，不绑邮箱） | 看商品、收藏到购物车、改用户名 / 密码 / 头像 |
| 管理员 | 账号 + 密码 + **独立密钥**（三件都对） | 改店铺里几乎所有内容；可切到「用户视角」直接摆货 |

管理员只有 1 个账号，不走用户注册表。密码存在数据库里（哈希），**不会出现在本仓库**。

---

## 页面说明

底栏四个 Tab：**商城 / 分类 / 购物车 / 我的**。

- **商城**：店名、搜索、轮播、通知、店铺视频、分类宫格、双列商品。价格显示成 `100元5个`。
- **分类**：四列宫格，点进去看该分类商品。
- **详情**：多图 / 视频、名称、多条「金额 + 数量」报价、介绍、加入购物车。
- **购物车**：登录用户的意向清单。游客会提示先登录。底部「联系商家」可带上清单。
- **我的**：头像、用户名；订单五格是占位（点了会提示联系商家）；个人资料只有用户名、密码、头像。
- **客服**：任意页右上角「客」。电话、微信、二维码、地址、营业时间都由管理员在后台改。

管理员登录后，后台有「进入用户视角摆货」。打开「开始摆货」后，商城页上可以直接改封面、名称、价格和介绍。

---

## 本仓库包含什么

**会上传**

- 前端、后端源码
- 数据库结构 `schema.sql`
- `package.json` / `package-lock.json`（别人可以按同样依赖装起来）
- `wrangler.toml`（当前站点用的 Worker / D1 / R2 绑定）
- `wrangler.example.toml`、`.dev.vars.example`（自己另内部署时用）

**不会上传**

- `node_modules/`、`dist/`（构建产物，需自己生成）
- `.dev.vars`、环境变量、管理员密码 / 密钥
- `.wrangler/`（本地数据库、Cloudflare 登录缓存）
- 图片视频等用户上传内容（在 Cloudflare R2 里，不在 Git）

---

## 环境要求

- Node.js 18 或更高
- npm
- 要上线的话：一个 Cloudflare 账号（Workers + D1 + R2）

---

## 本地运行

```bash
git clone https://github.com/ZNaiGaomu/shanyuan-online-shop.git
cd shanyuan-online-shop
npm install
```

复制一份本地密钥文件（这个文件不会进 Git）：

```bash
cp .dev.vars.example .dev.vars
```

用编辑器打开 `.dev.vars`，把 `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_SECRET` 改成你自己的。密码和密钥都至少 6 位。

初始化本地数据库并启动：

```bash
npm run db:local
npm run dev
```

浏览器打开 http://localhost:5174

- 页面：5174
- 接口：8788（Vite 已代理 `/api` 和 `/media`）

第一次打开网站时，会用 `.dev.vars` 里的三项写入管理员账号。之后改密码请在后台「账号」里改，不必再改文件。

---

## 自己部署到 Cloudflare

1. 安装并登录 Wrangler：`npx wrangler login`
2. 若你是另开一个站，复制 `wrangler.example.toml` 为 `wrangler.toml`，按下面创建资源并填 ID。
3. 创建 D1 和 R2：

```bash
npx wrangler d1 create shanyuan-shop-db
npx wrangler r2 bucket create shanyuan-shop-media
```

把打印出来的 `database_id` 填进 `wrangler.toml`。有自己的域名时，改 `[[routes]]` 里的子域名。

4. 写入管理员三项（不要把真实密码写进代码或 README）：

```bash
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put ADMIN_SECRET
```

5. 建表并发布：

```bash
npm run db:remote
npm run deploy
```

图片和视频走 R2，由 Worker 的 `/media/...` 对外提供，不必把桶设成公开。

---

## 常用脚本

| 命令 | 作用 |
|------|------|
| `npm run dev` | 本地同时开页面和 Worker |
| `npm run build` | 只构建前端到 `dist/` |
| `npm run deploy` | 构建并发布到 Cloudflare |
| `npm run db:local` | 初始化本地 D1 |
| `npm run db:remote` | 初始化线上 D1 |

---

## 技术结构

```
src/web/        React 页面（入口、商城、购物车、我的、后台）
src/worker/     Cloudflare Worker 接口（登录、商品、上传、购物车）
schema.sql      D1 表结构
```

| 层 | 选择 |
|----|------|
| 计算 | Cloudflare Worker（Hono） |
| 页面 | React + Vite |
| 数据 | D1（SQLite） |
| 图片 / 视频 | R2 |
| 登录 | HttpOnly Cookie + 服务端 Session |

一期明确不做：在线支付、短信验证码、邮箱验证、真实订单流、微信小程序。

更细的产品约定见 [`方案.md`](./方案.md)。
