# Kimi Thinking Proxy for Trae

一个给 Trae 使用的本地 Anthropic 协议中转。

它会把 Trae 的请求转发到 Kimi Code，并强制开启 Kimi 的 `thinking`：

```json
{
  "thinking": {
    "type": "enabled",
    "budget_tokens": 16000
  }
}
```

API Key 不需要配置在中转里。你只需要把 Kimi Code API Key 填到 Trae，中转会原样转发 Trae 发来的 `Authorization` 请求头。

## 要求

- Node.js 18 或更高版本
- Kimi Code API Key
- Trae 自定义模型配置入口

## 快速开始

```bash
git clone https://github.com/wuchao961201/api-add-thinking.git
cd api-add-thinking
node server.js
```

启动后会看到：

```text
Kimi thinking proxy listening on http://127.0.0.1:8787
Trae custom Anthropic request URL:
http://127.0.0.1:8787/v1/messages
```

## Trae 配置

在 Trae 的自定义模型里填写：

```text
Provider: Anthropic
Model ID: kimi-for-coding
Custom Request URL: http://127.0.0.1:8787/v1/messages
API Key: 你的 Kimi Code API Key
```

注意：API Key 填在 Trae，不要填在这个中转服务里。

## 可选配置

默认端口是 `8787`，默认 thinking token 预算是 `16000`。

```bash
THINKING_BUDGET_TOKENS=32000 PORT=8787 node server.js
```

## 健康检查

```bash
curl http://127.0.0.1:8787/health
```

正常会返回：

```json
{"ok":true,"target":"https://api.kimi.com/coding/v1/messages"}
```

## 本地验证

把下面命令里的 `KIMI_CODE_API_KEY` 换成你的 Kimi Code API Key：

```bash
curl http://127.0.0.1:8787/v1/messages \
  -H "Authorization: Bearer KIMI_CODE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "kimi-for-coding",
    "messages": [{"role":"user","content":"用一句话回答：2+2 等于几？"}],
    "max_tokens": 128
  }'
```

如果返回的 `content` 里有 `type: "thinking"`，说明中转已经生效。

## 工作方式

Trae 请求：

```text
Trae -> http://127.0.0.1:8787/v1/messages
```

中转转发：

```text
http://127.0.0.1:8787/v1/messages -> https://api.kimi.com/coding/v1/messages
```

中转会强制覆盖请求体里的 `thinking` 字段：

```json
{
  "thinking": {
    "type": "enabled",
    "budget_tokens": 16000
  }
}
```

## 安全说明

- 不要把 Kimi API Key 写进代码或提交到仓库。
- 这个服务默认只监听 `127.0.0.1`，适合本机 Trae 使用。
- 如果你把它部署到公网，请自行增加鉴权、HTTPS 和访问控制。
