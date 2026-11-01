/**
 * Automated Verification Test for OctaDezx MCP Server
 * Validates protocol compliance, tools/list, and real tools/call executions.
 */
import { spawn } from "node:child_process";

async function runProtocolTest() {
  console.log("=== Starting OctaDezx MCP Server Protocol Test ===");
  const proc = spawn("node", ["server.js"], { stdio: ["pipe", "pipe", "inherit"] });

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

  function sendReq(req) {
    proc.stdin.write(JSON.stringify(req) + "\n");
  }

  // 1. Initialize
  sendReq({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  await new Promise(r => setTimeout(r, 200));

  // 2. Tools List
  sendReq({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  await new Promise(r => setTimeout(r, 200));

  // 3. Call octadezx_list_conversations
  sendReq({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "octadezx_list_conversations", arguments: { status: "open", limit: 5 } }
  });
  await new Promise(r => setTimeout(r, 200));

  // 4. Call octadezx_verify_order
  sendReq({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "octadezx_verify_order", arguments: { orderId: "OD-8842" } }
  });
  await new Promise(r => setTimeout(r, 200));

  // 5. Call octadezx_trigger_voice_call
  sendReq({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: { name: "octadezx_trigger_voice_call", arguments: { phoneNumber: "+15551234567", reason: "Follow-up customer inquiry" } }
  });
  await new Promise(r => setTimeout(r, 300));

  proc.kill();

  console.log(`Received ${responses.length} valid JSON-RPC responses from server.js:`);
  for (const resp of responses) {
    console.log(`[Response #${resp.id}]`, JSON.stringify(resp.result || resp.error, null, 2));
  }

  const hasInit = responses.some(r => r.id === 1 && r.result?.serverInfo?.name === "octadezx-mcp-server");
  const hasTools = responses.some(r => r.id === 2 && Array.isArray(r.result?.tools) && r.result.tools.length === 5);
  const hasConvCall = responses.some(r => r.id === 3 && r.result?.content?.[0]?.text?.includes("conv_wa_9841"));
  const hasOrderCall = responses.some(r => r.id === 4 && r.result?.content?.[0]?.text?.includes("OD-8842"));
  const hasVoiceCall = responses.some(r => r.id === 5 && r.result?.content?.[0]?.text?.includes("webrtc_barge_in"));

  if (hasInit && hasTools && hasConvCall && hasOrderCall && hasVoiceCall) {
    console.log("\n✅ ALL 5 VERIFICATION CHECKS PASSED!");
    process.exit(0);
  } else {
    console.error("\n❌ Test failed: Some expected tool execution outputs were missing.");
    process.exit(1);
  }
}

runProtocolTest().catch(console.error);
