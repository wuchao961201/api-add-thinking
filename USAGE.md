# 使用说明

这个项目用于在 Trae 和 Kimi Code API 之间加一个本地中转，强制开启 Kimi Anthropic 协议里的 `thinking` 参数。

## 1. 启动中转

```bash
node server.js
```

默认监听：

```text
http://127.0.0.1:8787/v1/messages
```

## 2. 配置 Trae

在 Trae 自定义模型里填写：

```text
Provider: Anthropic
Model ID: kimi-for-coding
Custom Request URL: http://127.0.0.1:8787/v1/messages
API Key: 你的 Kimi Code API Key
```

API Key 只填在 Trae，不需要也不应该填到中转里。

## 3. 调整 thinking token 预算

默认：

```text
THINKING_BUDGET_TOKENS=16000
```

启动时可以改：

```bash
THINKING_BUDGET_TOKENS=32000 node server.js
```

## 4. 修改端口

```bash
PORT=8899 node server.js
```

Trae 里对应改成：

```text
http://127.0.0.1:8899/v1/messages
```

## 5. 验证是否生效

```bash
curl http://127.0.0.1:8787/health
```

或者直接请求代理：

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

如果响应的 `content` 数组里出现：

```json
{"type":"thinking"}
```

说明强制 thinking 已经生效。

## 6. 常见问题

### Trae 里 API Key 填什么？

填你的 Kimi Code API Key。中转会把 Trae 发来的 `Authorization` 原样转发给 Kimi。

### 可以公网部署吗？

不建议直接公网裸奔。这个项目默认只监听 `127.0.0.1`，就是为了本机使用。如果要部署到公网，需要自己加鉴权、HTTPS 和访问控制。

### 为什么不用 OpenAI 协议？

目前测试到 Kimi Code 的 `thinking` 参数在 Anthropic `/v1/messages` 协议下有效，所以 Trae 的 Provider 应该选 `Anthropic`。
