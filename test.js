/**
 * Quick CLI & Stdio Smoke Test for OctaDezx MCP Server (v1.2.0)
 * Validates protocol compliance, all 9 registered tools, and standalone offline tools.
 */
import { spawn } from "node:child_process";

async function runProtocolTest() {
  console.log("=== Starting OctaDezx MCP Server Protocol Smoke Test ===");
  const proc = spawn("node", ["server.js"], {
    stdio: ["pipe", "pipe", "inherit"],
    env: { ...process.env, OCTADEZX_API_KEY: "" }
  });

  let buffer = "";
  const responses = [];

  proc.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (line.trim()) {
        try {
          responses.push(JSON.parse(line));
        } catch {}
      }
    }
  });

  const sendReq = (req) => proc.stdin.write(JSON.stringify(req) + "\n");

  sendReq({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  sendReq({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  sendReq({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "audit_knowledge_base",
      arguments: {
        content: "# Refund Policy\nItems qualify for a 14-day return. Contact support@example.com for help."
      }
    }
  });
  sendReq({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "verify_reply_safety",
      arguments: {
        candidateReply: "Your order #OD-8842 total is $29.00 USD.",
        groundTruth: { customerOrderIds: ["OD-8842"], order: { id: "OD-8842", total: 29.0 } }
      }
    }
  });
  sendReq({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: {
      name: "plan_multistep_inquiry",
      arguments: { message: "Check order #OD-8842 and book a haircut tomorrow afternoon." }
    }
  });

  const deadline = Date.now() + 3000;
  while (responses.length < 5 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50));
  }
  proc.kill();

  console.log(`Received ${responses.length} valid JSON-RPC responses from server.js`);

  const hasInit = responses.some((r) => r.id === 1 && r.result?.serverInfo?.name === "octadezx-mcp-server");
  const hasTools = responses.some((r) => r.id === 2 && Array.isArray(r.result?.tools) && r.result.tools.length === 9);
  const hasAudit = responses.some((r) => r.id === 3 && r.result?.content?.[0]?.text?.includes("local_deterministic"));
  const hasSafety = responses.some((r) => r.id === 4 && r.result?.content?.[0]?.text?.includes('"safe": true'));
  const hasPlan = responses.some((r) => r.id === 5 && r.result?.content?.[0]?.text?.includes("appointment_booking"));

  if (hasInit && hasTools && hasAudit && hasSafety && hasPlan) {
    console.log("ALL 5 SMOKE CHECKS PASSED!");
    process.exit(0);
  } else {
    console.error("Smoke test failed: unexpected output", responses);
    process.exit(1);
  }
}

runProtocolTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
