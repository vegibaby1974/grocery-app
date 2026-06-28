// Cloudflare Pages Function — 买菜清单的后端 API
// 路由: /api/lists
//   GET  读取云端清单（需口令）
//   PUT  保存云端清单（需口令）
//
// 依赖两样东西（在 Cloudflare 控制台配置，见部署说明）：
//   1. KV 命名空间，绑定名为  GROCERY   —— 数据存这里
//   2. 环境变量/密钥  APP_PASSCODE       —— 你的口令
//
// 数据在 KV 里只用一个键： "data"，值是整包 JSON {lists, current}

const KV_KEY = "data";

// 统一校验口令。前端把口令放在请求头 X-Passcode 里。
function checkAuth(request, env) {
  const given = request.headers.get("X-Passcode") || "";
  const expected = env.APP_PASSCODE || "";
  // 常数时间比较没必要在这个场景做到极致，但避免空口令通过
  if (!expected) return false;          // 没配置口令 → 一律拒绝，防止裸奔
  return given === expected;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

// GET /api/lists
export async function onRequestGet({ request, env }) {
  if (!checkAuth(request, env)) return json({ error: "unauthorized" }, 401);
  if (!env.GROCERY) return json({ error: "KV 未绑定" }, 500);

  const raw = await env.GROCERY.get(KV_KEY);
  if (!raw) return json({});            // 云端还没数据，返回空对象，前端会用示例初始化
  try {
    return json(JSON.parse(raw));
  } catch (e) {
    return json({});                    // 数据损坏时也返回空，避免前端崩溃
  }
}

// PUT /api/lists
export async function onRequestPut({ request, env }) {
  if (!checkAuth(request, env)) return json({ error: "unauthorized" }, 401);
  if (!env.GROCERY) return json({ error: "KV 未绑定" }, 500);

  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return json({ error: "请求体不是合法 JSON" }, 400);
  }

  // 基本校验：必须有 lists 对象
  if (!payload || typeof payload !== "object" || typeof payload.lists !== "object") {
    return json({ error: "数据格式不对" }, 400);
  }

  await env.GROCERY.put(KV_KEY, JSON.stringify(payload));
  return json({ ok: true });
}

// 其它方法一律拒绝
export async function onRequest({ request }) {
  const m = request.method;
  if (m === "GET" || m === "PUT") return; // 交给上面的处理器
  return new Response("Method Not Allowed", { status: 405 });
}
