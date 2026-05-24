const TOKEN = process.env.MANYCHAT_API_TOKEN;
const BASE = "https://api.manychat.com";

async function mc(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

const fields = [
  { caption: "lead_email",       type: "text", description: "Email captured by Yara from DM" },
  { caption: "lead_phone",       type: "text", description: "Phone number captured by Yara from DM" },
  { caption: "lead_service",     type: "text", description: "Service of interest detected by Yara (laser, hair, etc.)" },
  { caption: "lead_language",    type: "text", description: "Detected message language: ar or en" },
  { caption: "last_ai_reply_at", type: "datetime", description: "Timestamp of last automated Yara reply" },
];

const tags = ["auto_replied", "lead_captured", "escalated", "lang_ar", "lang_en"];

console.log("=== Creating custom fields ===");
for (const f of fields) {
  const r = await mc("/fb/page/createCustomField", { method: "POST", body: JSON.stringify(f) });
  console.log(`  ${f.caption}: ${r.status} ${typeof r.body === "object" ? r.body.status || JSON.stringify(r.body).slice(0,150) : r.body}`);
}

console.log("\n=== Creating tags ===");
for (const name of tags) {
  const r = await mc("/fb/page/createTag", { method: "POST", body: JSON.stringify({ name }) });
  console.log(`  ${name}: ${r.status} ${typeof r.body === "object" ? r.body.status || JSON.stringify(r.body).slice(0,150) : r.body}`);
}

console.log("\n=== Verify: list fields ===");
const f2 = await mc("/fb/page/getCustomFields");
console.log(JSON.stringify(f2.body.data?.map(x => ({ id: x.id, caption: x.caption, type: x.type })), null, 2));

console.log("\n=== Verify: list tags ===");
const t2 = await mc("/fb/page/getTags");
console.log(JSON.stringify(t2.body.data, null, 2));
