# 從最新 `main` 開分支並逐步 port（PDF 審查其餘項目）

`main` 已含：**`GET /health` / `GET /metrics` 在全域 auth 前短路**（commit `fix(api): allow unauthenticated GET /health and /metrics for probes`）。本文件說明如何把其餘審查項目（proxy body、CI、指標、Web env、文件）**逐步**合併進倉庫，且以 **GitHub 上最新 `main` 為準**，避免用舊本機目錄整份覆蓋。

## 1. 建立分支

在倉庫根目錄執行（或使用 `scripts/git-branch-from-main.ps1`）：

```powershell
git fetch origin
git checkout main
git pull origin main --ff-only
git checkout -b feat/pdf-review-port
```

建議分支名：`feat/pdf-review-port`（可自訂）。

## 2. 建議 port 順序（每一步可單獨 `git commit`）

| 順序 | 項目 | 說明 |
|------|------|------|
| 1 | CI 基線 | 若 `main` 尚無：加入 [`.github/dependabot.yml`](../.github/dependabot.yml)、[`codeql.yml`](../.github/workflows/codeql.yml)。若已有則只做 diff 合併。 |
| 2 | Web `NEXT_PUBLIC_*` | 將 `costs` / `audit` 等頁與 [`.env.example`](../.env.example) 對齊為 `NEXT_PUBLIC_API_BASE_URL`（勿再混用 `NEXT_PUBLIC_API_URL`）。 |
| 3 | Proxy 請求體 | 在 **`main` 現有** [`apps/api/src/proxy.ts`](https://github.com/mason113074-cyber/ai-gateway/blob/main/apps/api/src/proxy.ts) 上**手動合併**：導入 `parseProxyRequestBody`、改用 `request.body`、保留遠端的 async、`retry`、Anthropic header 等行為。 |
| 4 | Fastify JSON scope | 在 [`server.ts`](https://github.com/mason113074-cyber/ai-gateway/blob/main/apps/api/src/server.ts) 中，用 `app.register` 子作用域為 `/v1/*` 註冊 `application/json` + `parseAs: "string"`，**不要**破壞遠端已有的 `FastifyRequest` / async audit 寫法。 |
| 5 | `/metrics` 與 `metrics.ts` | 若 `main` 尚無：新增 [`apps/api/src/metrics.ts`](../apps/api/src/metrics.ts) 與 `GET /metrics`（Prometheus 文字）；在 `recordProxyRequest` 處接上 proxy 成功/失敗路徑。 |
| 6 | 測試 | 補 [`auth-middleware.test.ts`](../apps/api/src/auth-middleware.test.ts)、[`proxy.test.ts`](../apps/api/src/proxy.test.ts) 中與 body、metrics 相關案例。 |
| 7 | 文件 | 更新 [`docs/context/current-status.md`](context/current-status.md)、[`docs/architecture.md`](../architecture.md) 中觀測性與已知限制。 |

## 3. 與舊本機副本的差異（重要）

- **遠端 `main`** 使用與本機舊目錄不同的 API（例如 async `auditLogger.log`、`createLogStore`、權限名稱等）。Port 時請**以 `origin/main` 檔案為底**，只貼「審查建議的邏輯補丁」，不要整檔替換成舊 workspace 版本。
- **`auth-middleware.ts`** 已在 `main` 含 bootstrap / legacy 與 `/health`、`/metrics` 短路；後續 PR **勿還原**為僅 legacy 的舊版。

## 4. 推上 GitHub並開 PR

```powershell
git push -u origin feat/pdf-review-port
```

在 GitHub 上對 `main` 開 Pull Request；若變更大，可拆成多個 PR（例如「CI only」「proxy body only」）降低 review 負擔。
