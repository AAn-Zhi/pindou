# 豆豆工坊（Doudou Gongfang）V4

> 一个基于 Web 的拼豆图纸智能生成与管理系统：将图片转换为可编辑的拼豆网格图纸，并支持色号查看、颜色统计、PNG 导出和个人图纸库。

**在线体验：** https://pindou-mkei.onrender.com  
**GitHub 仓库：** https://github.com/AAn-Zhi/pindou  
**当前版本：** V4（多用户 + MySQL 云端存储）

> 本文档以豆豆工坊 V4 的现有代码结构和部署方式为基础。具体依赖、接口参数及数据库迁移步骤以仓库中的最新代码为准。

## 目录

- [1. 项目简介](#1-项目简介)
- [2. 主要功能](#2-主要功能)
- [3. 技术栈](#3-技术栈)
- [4. 系统架构与数据流程](#4-系统架构与数据流程)
- [5. 项目目录](#5-项目目录)
- [6. 本地运行](#6-本地运行)
- [7. 数据库设计](#7-数据库设计)
- [8. 后端接口](#8-后端接口)
- [9. 云端部署](#9-云端部署)
- [10. 功能验证](#10-功能验证)
- [11. 安全与使用说明](#11-安全与使用说明)
- [12. 常见问题](#12-常见问题)
- [13. 已知限制与后续计划](#13-已知限制与后续计划)
- [14. 项目截图](#14-项目截图)

## 1. 项目简介

拼豆创作需要将图像转化为规则的颜色网格，并根据每格的色号选择对应拼豆。手工制作图纸需要逐格处理颜色、统计材料用量，步骤繁琐。豆豆工坊希望将这些工作整合到一个浏览器网站中。

用户可以上传图片、设置图纸参数并生成网格，之后进行局部颜色修改、查看色号和颜色统计，最终导出图纸。V4 在此基础上加入账号系统和 MySQL 图纸库，使不同用户能够分别保存和管理自己的作品。

### 项目目标

1. 降低从图片制作拼豆图纸的操作成本。
2. 保留图纸的结构化网格数据，而不只是导出一张静态图片。
3. 支持个人账号、云端保存和再次编辑。
4. 将前端图像处理、后端接口、数据库和部署串成可运行的完整 Web 项目。

## 2. 主要功能

| 模块 | 功能说明 |
| --- | --- |
| 图片上传 | 从本地选择图片，进入图纸生成流程 |
| 图片处理 | 支持图片裁剪、缩放等生成前调整（以当前页面实现为准） |
| 图纸生成 | 按指定网格尺寸对图片采样，并匹配拼豆色卡 |
| 色号标注 | 在网格中显示对应色号，便于照图拼豆 |
| 颜色统计 | 统计图纸中不同颜色的使用情况与豆子数量 |
| 图纸编辑 | 修改指定豆格的颜色，并更新图纸显示 |
| 颜色筛选 | 按色号查看对应颜色在图纸中的位置 |
| 图纸导出 | 导出 PNG 图纸，供保存、打印或分享 |
| 账号系统 | 用户注册、登录、退出登录 |
| 个人图纸库 | 保存、查询、打开、更新和删除自己的图纸 |
| 多用户隔离 | 后端根据登录用户 ID 限制图纸数据访问 |
| 云端访问 | 前端与 Node.js 服务部署在 Render，数据库托管于 Aiven |

**使用流程：** 上传图片 → 调整参数 → 生成图纸 → 编辑与查看统计 → 导出 PNG 或登录后保存 → 从个人图纸库重新打开。

> 游客可使用部分本地图纸处理功能；云端图纸保存和管理接口要求登录。不同版本页面细节可能略有区别。

## 3. 技术栈

| 层次 | 技术 | 主要用途 |
| --- | --- | --- |
| 前端 | HTML、CSS、JavaScript | 页面布局、交互与图纸展示 |
| 图像处理 | Canvas API | 图像绘制、像素读取和网格生成 |
| 后端运行环境 | Node.js | 运行服务端 JavaScript |
| Web 框架 | Express | 路由、HTTP 请求与响应处理 |
| 数据库驱动 | mysql2/promise | 执行 MySQL 查询及更新 |
| 数据库 | MySQL | 保存用户、图纸及统计数据 |
| 身份认证 | bcryptjs、jsonwebtoken、cookie-parser | 密码哈希、JWT 和 Cookie 会话 |
| 接口防护 | express-rate-limit | 限制注册、登录请求频率 |
| 配置管理 | dotenv | 读取本地环境变量 |
| 版本管理 | Git、GitHub | 源代码管理与协作 |
| 部署 | Render、Aiven | 托管 Node.js 服务与 MySQL 数据库 |

依赖版本以 `package.json` 为准。现有 V4 代码包采用 Express 4、mysql2 3、jsonwebtoken 9 等依赖。

## 4. 系统架构与数据流程

```text
┌─────────────────────────────────────┐
│ 浏览器前端（HTML / CSS / JavaScript）│
│ 上传图片、Canvas 生成、编辑、导出    │
└────────────────┬────────────────────┘
                 │ HTTP / JSON
                 ▼
┌─────────────────────────────────────┐
│ Render：Node.js + Express           │
│ 身份认证、参数校验、图纸 CRUD 接口    │
└────────────────┬────────────────────┘
                 │ mysql2 / SQL（云端可启用 TLS）
                 ▼
┌─────────────────────────────────────┐
│ Aiven：MySQL                        │
│ users / patterns                    │
└─────────────────────────────────────┘
```

### 图纸保存过程

1. 用户在前端生成图纸并点击“保存”。
2. 前端向 `POST /api/patterns` 提交 JSON 数据。
3. Express 通过 `requireAuth` 验证登录身份，并通过 `validatePattern` 检查数据结构。
4. 后端使用 mysql2 执行参数化 `INSERT`，写入 `patterns` 表，并记录当前 `user_id`。
5. 保存成功时返回 HTTP `201` 和新增图纸 ID；失败时返回相应错误响应。

### 图纸重新读取

用户登录后，通过 `GET /api/patterns` 获取个人图纸列表，再通过 `GET /api/patterns/:id` 读取图纸详情。后端查询时同时检查 `id` 和 `user_id`，前端根据返回的 `grid_data` 恢复可编辑图纸。

## 5. 项目目录

以下为现有 V4 代码的主要结构；GitHub 仓库中的实际层级可能包含 `v4/` 子目录或额外文件。

```text
v4/
├── server.js                 # Express 服务、认证与图纸接口
├── package.json              # npm 脚本与依赖
├── .env.example              # 环境变量示例（不要写入真实密钥）
├── .gitignore                # Git 忽略规则
├── 数据库升级.sql             # 旧版 patterns 表的字段升级脚本
├── 数据库V4升级.sql           # V4 users 表与用户关联升级脚本
├── public/
│   ├── index.html            # 首页及图纸生成
│   ├── editor.html           # 图纸编辑
│   ├── gallery.html          # 个人图纸库
│   ├── login.html            # 注册、登录
│   ├── account.html          # 账号页面
│   └── auth.js               # 前端认证相关逻辑
└── README.md                 # 项目说明
```

线上版本如包含 `ca.pem`、账号注销相关接口或其他新增文件，请根据最终仓库同步更新本节。

## 6. 本地运行

### 6.1 环境要求

- Node.js 与 npm（建议使用当前维护中的 LTS 版本）。
- MySQL 8.x 或与现有表结构兼容的 MySQL 服务。
- MySQL Workbench（可选，用于查看和管理数据库）。
- Chrome、Edge 等现代浏览器。

### 6.2 获取代码

```bash
git clone https://github.com/AAn-Zhi/pindou.git
cd pindou
```

找到包含 `server.js` 和 `package.json` 的 V4 目录；如果仓库结构为 `pindou/v4/`，继续执行：

```bash
cd v4
```

### 6.3 安装依赖

```bash
npm install
```

### 6.4 准备数据库

在 MySQL 中创建数据库（首次安装时）：

```sql
CREATE DATABASE IF NOT EXISTS doudou_gongfang
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE doudou_gongfang;
```

**重要：** 随附的 `数据库升级.sql`、`数据库V4升级.sql` 是针对已有 V3 `patterns` 表的**升级脚本**，不是完整的空库初始化脚本。如果从零安装，需要先创建基础 `patterns` 表，或导入项目已有的结构备份；不要直接在空库中执行 `ALTER TABLE patterns`。

若已有 V3 数据库：

1. **先备份**现有数据库。
2. 检查 `patterns` 是否已具有 `thumb`、`total_beads`、`requested_colors`、`counts` 字段；缺失时按实际结构执行 `数据库升级.sql`。
3. 检查 `users` 表和 `patterns.user_id` 是否已存在；未升级时执行 `数据库V4升级.sql`。
4. **不要重复执行已完成的 ALTER TABLE、CREATE INDEX 或外键语句**，否则可能报重复字段、索引或约束错误。

参考的基础表结构如下（用于说明字段；实际迁移请以现有数据库为准）：

```sql
CREATE TABLE patterns (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  width INT NOT NULL,
  height INT NOT NULL,
  color_count INT DEFAULT 0,
  grid_data JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  thumb LONGTEXT NULL,
  total_beads INT NOT NULL DEFAULT 0,
  requested_colors INT NOT NULL DEFAULT 0,
  counts JSON NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

> 此示例仅用于**全新空库**的基础 `patterns` 表，随后仍需执行 V4 用户关联迁移；已有数据库不要用它覆盖现有表。数据库字段长度和约束请以最终线上实际结构为准。

### 6.5 配置环境变量

复制示例文件：

```bash
cp .env.example .env
```

Windows PowerShell 可使用：

```powershell
Copy-Item .env.example .env
```

编辑 `.env`：

```dotenv
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的本地数据库密码
DB_NAME=doudou_gongfang
PORT=3000
JWT_SECRET=替换成至少32字符的随机私密字符串
NODE_ENV=development
DB_SSL=false
```

- `DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`：数据库连接信息。
- `JWT_SECRET`：JWT 签名密钥，当前服务端代码要求长度至少 32 字符。
- `PORT`：本地服务监听端口，默认 3000。
- `NODE_ENV`：本地为 `development`，线上通常为 `production`。
- `DB_SSL`：当前扩展版 `server.js` 支持设为 `true` 时从项目目录读取 `ca.pem` 并验证数据库 TLS 证书；本地 MySQL 通常可设为 `false`。**请以实际部署的 server.js 是否包含该逻辑为准。**

**不要将 `.env`、真实数据库密码、JWT 密钥、个人数据或私密证书上传到公开仓库。**

### 6.6 启动服务

```bash
npm start
```

或者：

```bash
node server.js
```

浏览器访问：

```text
http://localhost:3000
```

检查后端与数据库连接：

```text
http://localhost:3000/api/health
```

在当前扩展版代码中，数据库连接成功时返回类似：

```json
{"success":true,"message":"数据库连接正常"}
```

如启动失败，请先检查 `.env`、MySQL 是否运行、数据库表是否完整、端口是否被占用，以及终端错误日志。

## 7. 数据库设计

### 7.1 `users` 用户表

| 字段 | 类型（V4 升级脚本） | 说明 |
| --- | --- | --- |
| `id` | BIGINT UNSIGNED | 用户主键，自增 |
| `email` | VARCHAR(254) | 登录邮箱，唯一 |
| `password_hash` | VARCHAR(255) | bcrypt 密码哈希，不保存明文密码 |
| `created_at` | TIMESTAMP | 注册时间 |

### 7.2 `patterns` 图纸表

| 字段 | 作用 |
| --- | --- |
| `id` | 图纸主键 |
| `name` | 图纸名称 |
| `width` / `height` | 图纸网格尺寸 |
| `color_count` | 图纸颜色数量 |
| `grid_data` | JSON 格式的二维色号网格 |
| `thumb` | 缩略图数据 |
| `total_beads` | 豆格/拼豆总数 |
| `requested_colors` | 生成时请求的颜色数量 |
| `counts` | JSON 格式的颜色用量统计 |
| `user_id` | 所属用户 ID，关联 `users.id` |
| `created_at` | 创建时间 |

**关系：** 一个用户可以拥有多张图纸，即 `users (1) → (N) patterns`。V4 升级脚本为 `patterns.user_id` 建立索引和外键，配置了 `ON DELETE CASCADE`。

历史 V3 图纸的 `user_id` 可能为 `NULL`，不会自动显示在新账号的个人图纸库中。迁移旧数据前应确认归属，避免误分配。

### 7.3 数据库检查 SQL

```sql
USE doudou_gongfang;
SHOW TABLES;
DESCRIBE users;
DESCRIBE patterns;

-- 查看最近保存的图纸（避免展示真实用户敏感信息）
SELECT id, name, width, height, color_count, user_id, created_at
FROM patterns
ORDER BY id DESC
LIMIT 10;
```

## 8. 后端接口

接口前缀为 `/api`。下表依据当前检查过的 `server.js` 整理。

### 8.1 用户认证

| 方法 | 路径 | 作用 | 登录要求 |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | 注册账号 | 否 |
| POST | `/api/auth/login` | 登录账号 | 否 |
| POST | `/api/auth/logout` | 退出登录 | 否 |
| GET | `/api/auth/me` | 查询当前登录用户 | 是 |

注册、登录主要使用 `email` 和 `password`。当前代码要求注册密码长度为 10～72 个字符，使用 bcryptjs 生成密码哈希，并通过 JWT + HttpOnly Cookie 维护登录状态。

### 8.2 图纸管理

| 方法 | 路径 | 功能 | 登录要求 |
| --- | --- | --- | --- |
| GET | `/api/patterns` | 获取当前用户图纸列表 | 是 |
| GET | `/api/patterns/:id` | 获取指定图纸详情 | 是 |
| POST | `/api/patterns` | 新增图纸 | 是 |
| PUT | `/api/patterns/:id` | 修改自己的图纸 | 是 |
| DELETE | `/api/patterns/:id` | 删除自己的图纸 | 是 |
| GET | `/api/health` | 检查服务端数据库连接 | 否 |

`GET /api/patterns` 的当前实现最多返回最近 500 条个人图纸记录；详情、修改和删除接口均通过 `id` 与 `user_id` 限定目标记录。

### 8.3 保存图纸示例

请求：

```http
POST /api/patterns
Content-Type: application/json
Cookie: doudou_session=<登录后获得的会话 Cookie>
```

请求体（简化示例）：

```json
{
  "name": "示例图纸",
  "width": 2,
  "height": 2,
  "color_count": 2,
  "grid_data": [["H2", "F4"], ["F4", "H2"]],
  "thumb": "",
  "total_beads": 4,
  "requested_colors": 2,
  "counts": []
}
```

成功响应（示例 ID）：

```json
{
  "success": true,
  "id": 15,
  "message": "保存成功"
}
```

**常见状态码：** `201` 创建成功；`400` 参数格式不正确；`401` 未登录或会话失效；`404` 目标图纸不存在或不属于当前用户；`500` 服务端或数据库操作失败。具体响应以实际接口为准。

## 9. 云端部署

目前项目采用 **GitHub + Render + Aiven** 的部署组合。

1. 将项目代码提交至 GitHub。
2. 在 Aiven 创建并配置 MySQL 服务，导入项目数据库结构及所需数据。
3. 在 Render 创建 Node.js Web Service，关联 GitHub 仓库。
4. 如项目位于 `v4/`，将 Render 的 Root Directory 指向实际 V4 目录。
5. 配置构建命令 `npm install` 和启动命令 `npm start`（以 Render 当前服务配置为准）。
6. 在 Render 的环境变量中配置数据库连接信息、JWT 密钥和生产环境选项。
7. 若使用 Aiven TLS 证书，按实际服务端实现配置证书文件或受支持的证书传递方式，确保数据库连接验证正常。
8. 部署成功后，访问网站并实际测试注册、登录、保存和读取图纸。

**线上地址：** https://pindou-mkei.onrender.com


## 10. 功能验证

完成本地安装或线上部署后，可以按以下步骤确认各主要模块是否正常运行。以下是验证方法，不代表当前线上环境的实时运行状态。

| 功能 | 验证方式 | 预期表现 |
| --- | --- | --- |
| 图片生成 | 上传图片，设置网格尺寸并生成 | 显示带有颜色与色号的网格图纸 |
| 图纸编辑 | 修改指定豆格颜色 | 网格显示和颜色统计同步变化 |
| PNG 导出 | 导出当前图纸 | 下载的图片包含对应图纸内容 |
| 注册与登录 | 使用测试邮箱注册并登录 | 能进入个人图纸库 |
| 图纸保存 | 保存一张新图纸 | 个人图纸库出现对应记录 |
| 持久化读取 | 关闭页面后重新登录 | 仍能打开此前保存的图纸 |
| 图纸更新 | 修改已有图纸并保存 | 重新打开后保留修改，未意外新增副本 |
| 图纸删除 | 删除一张测试图纸 | 个人图纸库不再显示该记录 |
| 多用户隔离 | 分别使用两个账号查看图纸库 | 每个账号只显示自己的图纸 |
| 服务健康 | 访问 `/api/health` | 返回与服务及数据库连接状态相符的响应 |

可以在 MySQL Workbench 中查看最近的图纸记录，以核对保存、修改和删除操作：

```sql
SELECT id, name, width, height, color_count, user_id, created_at
FROM patterns
ORDER BY id DESC
LIMIT 10;
```

> 请使用专门的测试账号和测试图纸，不要在公共演示或截图中暴露真实用户数据。图纸列表隔离并不能替代针对详情、修改、删除接口的权限检查。

## 11. 安全与使用说明

- **密码处理：** 后端使用 bcryptjs 保存密码哈希，不存储明文密码。
- **登录会话：** 使用 JWT，并通过 HttpOnly Cookie 传递；生产环境使用 Secure Cookie（需正确配置 HTTPS）。
- **数据隔离：** 图纸查询、更新和删除接口结合当前登录用户 ID 限制操作范围。
- **SQL 安全：** 使用 mysql2 参数化查询，避免直接拼接用户输入。
- **请求校验：** 保存图纸前验证名称、尺寸、网格结构等字段；当前后端限制宽高不超过 200 格。
- **登录限流：** 注册与登录接口使用 express-rate-limit。
- **密钥管理：** `.env`、JWT 密钥、数据库密码及私密证书不得提交到 GitHub。
- **数据备份：** 在升级数据库或调整表结构前，先备份数据。

现有功能实现不等同于完整的生产安全审计。正式面向公众长期运营前，还应完善监控、备份恢复、隐私说明及安全测试。

## 12. 常见问题

### 启动后无法打开网页

确认已经在包含 `package.json` 和 `server.js` 的目录运行 `npm install`、`npm start`，并检查控制台显示的监听端口。若端口被其他程序占用，调整 `PORT` 或结束冲突进程。

### `/api/health` 提示数据库连接失败

依次检查 `.env` 中的数据库主机、端口、用户名、密码和数据库名；确认 MySQL 服务已启动，网络能够访问对应端口。使用 Aiven 等托管数据库时，还应检查 TLS 证书配置和服务状态。

### 保存成功后找不到图纸

确认使用的是同一个登录账号，并检查登录状态是否有效。若从旧版数据库迁移数据，历史记录可能尚未关联到当前用户。可以检查后端日志及 `patterns.user_id`，不要随意修改其他用户的数据归属。

### 为什么生成图纸的颜色与原图不同？

原图经过网格化和有限色卡匹配后，颜色与细节可能发生变化。可以尝试调整图纸尺寸、颜色数量、裁剪范围，或手动修改部分豆格。

## 13. 已知限制与后续计划

- 复杂图片的细节与色彩可能在网格化、色卡匹配后发生变化。
- 图纸生成效果受到网格尺寸、颜色数量和色卡质量影响。
- 免费或低成本云服务可能出现冷启动、资源限制或临时连接问题。
- 历史版本数据迁移需谨慎处理图纸归属。
- 邮箱验证、密码找回、自动化测试、性能测试和生产环境监控等能力可继续完善。
- 未来可考虑增加色卡选择、颜色匹配优化、移动端体验改进等功能。


---

**反馈与维护：** 如遇到功能异常或希望提出改进建议，可以在 GitHub 仓库提交 Issue。功能实现、安装方式和部署配置以仓库最新代码为准。
