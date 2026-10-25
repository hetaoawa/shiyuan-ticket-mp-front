# AGENTS.md — OpenCode 项目指南

## 项目与命令

- 前端项目：供应链工单流转管理平台，Vue 3 + Vite + Element Plus + Pinia + Vue Router 4 + Axios。
- 包管理器用 npm；`package.json` 只有 `npm run dev`、`npm run build`、`npm run preview`，没有 lint/typecheck/test 脚本。
- 本地开发端口为 `localhost:3000`；`vite.config.js` 把 `/api` 代理到后端 `http://localhost:9860`。
- Vite 代理在 Node 端读取后端本地内部签名配置，逐请求注入 `X-Internal-Signature` 和 `X-Internal-Timestamp`；生产由 Nginx 注入，不把签名值写进浏览器代码。
- E2E 脚本不是 npm scripts：`node e2e-test.cjs` 测 UI，`node e2e-api-test.cjs` 测 API+UI；需先启动前端和后端。

## API 约定

- 所有后端请求必须走 `src/utils/request.js` 的 Axios 实例；`baseURL` 已是 `/api`，API 文件里只写 `/workorders` 这类相对路径，不要再加 `/api`。
- 后端 Controller 实际映射包含 `/api` 前缀（如 `/api/workorders`），前端通过 Vite `/api` 代理转发到后端 `http://localhost:9860`。
- `request.js` 用 `json-bigint` 解析响应以保留雪花 ID 精度；分页响应约定是顶层带 `total`，拦截器会直接返回整个响应对象。
- Sa-Token 自动注入 `Authorization: Bearer <token>`；登录接口是 `application/x-www-form-urlencoded`，普通业务接口默认 JSON。
- API 按模块放在 `src/api/`，后台子模块放在 `src/api/admin/`；接口文档维护在 Apifox 项目 `8260787`，不维护本地 API.md。
- 列表/导出类时间范围参数统一使用 `createdStartTime` / `createdEndTime`，Element Plus 日期时间范围按 `YYYY-MM-DD HH:mm:ss` 传参。
- 管理员重置密码发送 `{ newPassword }`，调用 `PUT /api/users/{id}/reset-password`。
- 个人改密走 `src/api/auth.js` 的 `changePassword`（`PUT /auth/password`，请求 `{ oldPassword, newPassword }`），不要直接绕过 API 模块用 request。
- 个人资料更新走 `src/api/auth.js` 的 `updateProfile`（`PUT /auth/profile`，请求 `{ nickname, phone, email }`）；保存成功后需同步更新 `userStore` 中的 `nickname`、`phone`、`email`，避免页面信息卡显示旧值。

## 架构要点

- `src/main.js` 挂载 Pinia、Router、Element Plus（中文 locale）并全局注册 Element Plus 图标。
- 路由入口在 `src/router/index.js`；当前业务页面在静态 children 中声明，守卫登录后调用 `getUserInfo()` 和 `getMenuTree()`，用 `routerLoaded` 避免重复加载。
- `src/stores/user.js` 持久化 token 到 localStorage，并维护用户信息、角色、权限、菜单树。
- 按钮权限用 `v-hasPermi` / `v-hasRole`，无权限会移除 DOM；新增按钮操作时必须补对应权限码。
- 路径别名 `@` 指向 `./src`（`vite.config.js` + `jsconfig.json`）。
- 可选字段清除：用户管理中 phone、email、externalUserId 发送空值时传 `null`（`|| null`），后端会清除该字段；不传则保持原值。
- 角色派发：工单派发支持按用户和按角色两种方式；按角色时后端仅允许 `WAREHOUSE_ADMIN` 角色编码。编辑用户时 `assignRoles` 始终调用（包括空列表），以支持清除所有角色。
- 用户管理页面支持 `tenantId` 字段的查看和编辑；创建/更新用户时可选传入租户 ID；租户选项通过 `GET /admin/users/tenants` 获取。
- 工单列表/详情处理人列优先显示后端提供的 `assigneeName`（用户昵称）或 `assigneeRoleName`（角色名称），仅在名称缺失时回退显示 ID/编码。
- 工单驳回后后端会清除处理人信息，云仓侧无法再查看该工单详情。
- 角色权限编辑器：`node-key="id"`（非 menuId），树节点 label 对 BUTTON 类型显示 `menuName (permissionCode)`，提交 payload 用 `permission_ids`（snake_case），dialog 打开后用 `nextTick` + `setCheckedKeys()` 回显。
- 侧边栏菜单：过滤 `menuType === 'BUTTON'` 的节点，不渲染空 DIR 节点。
- 权限列表 API：`GET /admin/roles/permissions/all` 返回全部权限记录，需要 `role:view` 权限。

## 业务踩坑

- 文件上传组件在 `src/components/FileUpload.vue`；创建工单时截图应延迟上传：先创建工单拿 ID，再用 `bizType=WORK_ORDER_IMAGE` + `bizId=工单ID` 请求预签名 URL、PUT 直传、confirm。
- 工单智能解析调用 `POST /ai/parse`，当前前端按 JSON `{ text }` 发送；不要改回 multipart，后端会拒绝该 Content-Type。
- 工单详情物流轨迹默认用 `POST /express/tracked`（DB 缓存优先）自动加载；`POST /express/trace` 只用于“强刷轨迹”。
- 物流公司名称优先用 `/express/companies` 返回的 code/name 映射；映射不到时显示后端返回的 `cpCode`，不要显示“未知”。
- 创建/重新提交工单时，只有用户显式选择才传 `type`；重新提交默认不传类型以保留后端原类型。
- 用户管理页面支持 `externalUserId`（外部系统用户 ID）字段的查看和编辑；创建/更新用户时可选传入。
- 工单创建表单（`create.vue` 和 `list.vue` 弹窗）支持可选的 `senderStaffId` 和 `conversationId` 字段，用于外部货主上下文；仅在非空时传入后端。

## 验证与账号

- 构建验证用 `npm run build`；没有 lint/typecheck/test 可跑时不要编造命令。
- 常用账号：`admin/admin123`（SYSTEM_ADMIN）、`warehouse01/admin123`（WAREHOUSE_ADMIN）、`cargo01/admin123`（CARGO_OWNER）。
- 涉及数据库查询、接口验证或报错排查时优先使用 MCP 服务；涉及 API 变动需同步 Apifox 文档。

## 用户管理分页与角色绑定
- 用户管理页面分页：后端返回 `IPage` 在 `data` 内（`records`/`total`/`size`/`current`/`pages`），前端读取 `res.data.records` 和 `res.data.total`。因后端 Jackson 将 Long 序列化为字符串，需用 `Number(res.data?.total)` 转换后再传给 `el-pagination`。
- 创建用户时前端 payload 包含 `roleIds` 字段，后端 `CreateUserRequest` 通过 `@JsonAlias` 同时接受 `roleIds` 和 `role_ids`，创建时自动绑定角色，无需额外调用 `assignRoles`。
- 编辑用户时仍单独调用 `assignRoles`（始终调用，包括空列表以清除角色）。

## AI 解析缓存与限流
- 后端对相同文本（SHA-256 哈希）缓存 10 分钟，缓存命中直接返回结果。
- 模型返回 418（不合法输入）时缓存拒绝标记，缓存命中 418 也计入拒绝次数。
- 单用户 60 秒内累计 5 次 418 拒绝后封禁 10 分钟，返回 HTTP 429 附带剩余秒数。
- 保留原有每分钟 10 次全局限速。

## 错误提示约定
- `src/utils/request.js` 是 HTTP/业务错误 toast 的唯一来源（`showError` 辅助函数），最大同时显示 3 条错误提示，超出时关闭最早的。
- 401（业务码或 HTTP 状态码）由 `request.js` 统一处理：调用 `resetState()` 清除状态并跳转 `/login`，不调用 `logout()` 避免递归。
- 视图层 catch 块不要重复调用 `ElMessage.error`，只用 `console.error` 记录调试信息；保留非请求类的本地校验消息和用户操作反馈（success/warning）。
