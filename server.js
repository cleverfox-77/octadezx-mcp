#!/usr/bin/env node
/**
 * OctaDezx Model Context Protocol (MCP) Server & CLI Toolkit (v1.2.0)
 * Dual-mode architecture:
 *   - 4 standalone deterministic local tools (zero API key, zero network required)
 *   - 5 connected OctaDezx Cloud workspace tools (when OCTADEZX_API_KEY is configured)
 * Protocol Version: 2024-11-05
 */

import * as fs from "node:fs";
import * as readline from "node:readline";
import { fileURLToPath } from "node:url";
import {
  OctadezxClient,
  auditKnowledgeBase,
  verifyReplySafety,
  planMultistepInquiry,
  calculateSupportTco
} from "./index.js";

export const SERVER_NAME = "octadezx-mcp-server";
export const SERVER_VERSION = "1.2.0";
export const PROTOCOL_VERSION = "2024-11-05";

export const TOOLS = [
  {
    name: "audit_knowledge_base",
    description: "[Offline / No API Key] Deterministically audit Markdown, text, or JSON support docs for policy contradictions, conflicting time windows, currency ambiguity, missing escalation paths, and prompt-injection risks.",
    annotations: { readOnlyHint: true, idempotentHint: true },
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Optional title when passing inline content" },
        content: { type: "string", description: "Inline Markdown, text, or JSON documentation to audit" },
        filePath: { type: "string", description: "Optional path to a local Markdown, text, or JSON file" },
        documents: {
          type: "array",
          description: "Optional list of multiple documents to audit together for cross-document contradictions",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              content: { type: "string" }
            },
            required: ["content"]
          }
        }
      }
    }
  },
  {
    name: "verify_reply_safety",
    description: "[Offline / No API Key] Pre-send deterministic safety and hallucination verifier for a candidate AI customer reply against ground-truth order, catalog, discount, email, and policy facts.",
    annotations: { readOnlyHint: true, idempotentHint: true },
    inputSchema: {
      type: "object",
      properties: {
        candidateReply: { type: "string", description: "Draft AI reply to verify before sending to a customer" },
        strictStyle: { type: "boolean", description: "Flag em/en dashes when strict punctuation style is enabled" },
        groundTruth: {
          type: "object",
          description: "Authoritative customer, order, catalog, discount, and policy facts",
          properties: {
            customerEmail: { type: "string" },
            customerOrderIds: { type: "array", items: { type: "string" } },
            verified: { type: "boolean" },
            allowMutations: { type: "boolean" },
            order: { type: "object" },
            catalogPrices: { type: "object" },
            allowedDiscountCodes: { type: "array", items: { type: "string" } },
            allowedAmounts: { type: "array", items: { type: "number" } },
            policyText: { type: "string" }
          }
        }
      },
      required: ["candidateReply"]
    }
  },
  {
    name: "plan_multistep_inquiry",
    description: "[Offline / No API Key] Decompose compound multilingual or code-switched (EN/ES/PT/FR/DE/IT/NL/PL/Banglish/Hinglish/Spanglish) customer messages into a 7-stage read-before-write DAG with auth gates.",
    annotations: { readOnlyHint: true, idempotentHint: true },
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Raw customer inquiry text" },
        localeHint: { type: "string", description: "Optional ISO language hint (e.g., en, es, fr)" },
        hasAuthenticatedSession: { type: "boolean", description: "Whether customer identity is already verified" },
        knownCustomerOrderIds: { type: "array", items: { type: "string" } }
      },
      required: ["message"]
    }
  },
  {
    name: "calculate_support_tco",
    description: "[Offline / No API Key] Deterministic TCO and unit-economics calculator comparing per-resolution AI pricing (Intercom Fin $0.99/outcome, Gorgias AI, Zendesk AI) against flat-rate plans and Enterprise metered billing.",
    annotations: { readOnlyHint: true, idempotentHint: true },
    inputSchema: {
      type: "object",
      properties: {
        monthlyTickets: { type: "number", description: "Total monthly customer support inquiries" },
        aiResolutionRate: { type: "number", description: "Fraction resolved by AI (0.0 to 1.0, default 0.65)" },
        avgMessagesPerTicket: { type: "number", description: "Average AI messages per inquiry (default 4)" },
        monthlyVoiceMinutes: { type: "number", description: "Monthly AI phone voice minutes (default 0)" },
        teamSeats: { type: "number", description: "Number of staff seats required (default 3)" },
        intercomPerResolutionUsd: { type: "number" },
        intercomSeatUsd: { type: "number" },
        gorgiasPerAutomatedUsd: { type: "number" },
        gorgiasBaseMonthlyUsd: { type: "number" },
        zendeskSeatUsd: { type: "number" },
        zendeskAutomatedResolutionUsd: { type: "number" }
      },
      required: ["monthlyTickets"]
    }
  },
  {
    name: "octadezx_list_conversations",
    description: "[Cloud / Requires OCTADEZX_API_KEY] List live recent or escalated customer conversations across WhatsApp, Instagram, Messenger, Telegram, phone voice, and web chat.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["open", "escalated", "all"], description: "Filter by conversation status" },
        limit: { type: "number", description: "Maximum conversations to return (default 10)" }
      }
    }
  },
  {
    name: "octadezx_send_customer_reply",
    description: "[Cloud / Requires OCTADEZX_API_KEY] Send a verified customer care response into a live customer conversation thread.",
    inputSchema: {
      type: "object",
      properties: {
        conversationId: { type: "string", description: "The customer conversation ID" },
        message: { type: "string", description: "Verified message text to deliver" }
      },
      required: ["conversationId", "message"]
    }
  },
  {
    name: "octadezx_verify_order",
    description: "[Cloud / Requires OCTADEZX_API_KEY] Look up and verify live order status and pricing against connected storefront catalog records.",
    inputSchema: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "Order ID or verified customer phone number" }
      },
      required: ["orderId"]
    }
  },
  {
    name: "octadezx_schedule_appointment",
    description: "[Cloud / Requires OCTADEZX_API_KEY] File an appointment booking request and check Google Calendar availability in your OctaDezx workspace.",
    inputSchema: {
      type: "object",
      properties: {
        customerName: { type: "string", description: "Customer full name" },
        phone: { type: "string", description: "Contact phone number" },
        service: { type: "string", description: "Requested service or treatment" },
        datetime: { type: "string", description: "Preferred ISO datetime" }
      },
      required: ["customerName", "phone", "service"]
    }
  },
  {
    name: "octadezx_trigger_voice_call",
    description: "[Cloud / Requires OCTADEZX_API_KEY] Initiate an outbound conversational AI phone reminder or support call with live human barge-in.",
    inputSchema: {
      type: "object",
      properties: {
        phoneNumber: { type: "string", description: "Destination phone number in E.164 format" },
        reason: { type: "string", description: "Specific reason or context for the call" }
      },
      required: ["phoneNumber", "reason"]
    }
  }
];

export async function executeTool(name, args = {}, client = new OctadezxClient()) {
  switch (name) {
    case "audit_knowledge_base":
      return auditKnowledgeBase(args);
    case "verify_reply_safety":
      return verifyReplySafety(args);
    case "plan_multistep_inquiry":
      return planMultistepInquiry(args);
    case "calculate_support_tco":
      return calculateSupportTco(args);

    case "octadezx_list_conversations":
    case "octadezx_send_customer_reply":
    case "octadezx_verify_order":
    case "octadezx_schedule_appointment":
    case "octadezx_trigger_voice_call": {
      if (!client.hasApiKey()) {
        return {
          status: "requires_api_key",
          tool: name,
          message: `Cloud workspace tool "${name}" requires OCTADEZX_API_KEY (get one at https://octadezx.com/settings). The 4 standalone offline tools (audit_knowledge_base, verify_reply_safety, plan_multistep_inquiry, calculate_support_tco) run locally with no API key required.`,
          availableOfflineTools: [
            "audit_knowledge_base",
            "verify_reply_safety",
            "plan_multistep_inquiry",
            "calculate_support_tco"
          ]
        };
      }
      return client.callTool(name, args);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export async function handleRpcRequest(request, client) {
  const { id, method, params } = request || {};

  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION }
      }
    };
  }
  if (method === "notifications/initialized") {
    return null;
  }
  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  }
  if (method === "tools/call") {
    const toolName = params?.name;
    const toolArgs = params?.arguments || {};
    try {
      const executionResult = await executeTool(toolName, toolArgs, client);
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(executionResult, null, 2) }],
          isError: executionResult?.status === "requires_api_key"
        }
      };
    } catch (toolErr) {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify({ error: toolErr.message }) }],
          isError: true
        }
      };
    }
  }
  if (method === "ping") {
    return { jsonrpc: "2.0", id, result: {} };
  }
  if (id !== undefined) {
    return { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } };
  }
  return null;
}

function printCliHelp() {
  process.stdout.write(
    `octadezx-mcp v${SERVER_VERSION} - Dual-mode Enterprise Support MCP Server & Offline CLI\n\n` +
    `Usage:\n` +
    `  octadezx-mcp                       Start MCP stdio JSON-RPC server\n` +
    `  octadezx-mcp --help                Show help\n` +
    `  octadezx-mcp --version             Print version\n` +
    `  octadezx-mcp --list-tools          Print JSON tool schema catalog\n` +
    `  octadezx-mcp audit <file>          Audit a Markdown/text/JSON support doc offline\n` +
    `  octadezx-mcp tco --tickets <n> [--voice <mins>] [--seats <n>] [--rate <0.65>]\n` +
    `  octadezx-mcp plan --message "<customer text>"\n\n` +
    `Environment (optional, only for cloud workspace tools):\n` +
    `  OCTADEZX_API_KEY                   Your OctaDezx workspace key\n` +
    `  OCTADEZX_ENDPOINT                  Defaults to https://octadezx.com/mcp\n`
  );
}

function getFlagValue(argv, flag) {
  const idx = argv.indexOf(flag);
  return idx !== -1 && idx + 1 < argv.length ? argv[idx + 1] : undefined;
}

async function runCli(argv) {
  const cmd = argv[0];
  if (argv.includes("--help") || argv.includes("-h")) {
    printCliHelp();
    return 0;
  }
  if (argv.includes("--version") || argv.includes("-v")) {
    process.stdout.write(`${SERVER_VERSION}\n`);
    return 0;
  }
  if (argv.includes("--list-tools")) {
    process.stdout.write(JSON.stringify(TOOLS, null, 2) + "\n");
    return 0;
  }
  if (cmd === "audit") {
    const filePath = argv[1];
    if (!filePath) {
      process.stderr.write("Usage: octadezx-mcp audit <filePath>\n");
      return 1;
    }
    const res = await auditKnowledgeBase({ filePath });
    process.stdout.write(JSON.stringify(res, null, 2) + "\n");
    return 0;
  }
  if (cmd === "plan") {
    const message = getFlagValue(argv, "--message") || argv.slice(1).join(" ");
    if (!message) {
      process.stderr.write("Usage: octadezx-mcp plan --message \"<text>\"\n");
      return 1;
    }
    const res = planMultistepInquiry({ message });
    process.stdout.write(JSON.stringify(res, null, 2) + "\n");
    return 0;
  }
  if (cmd === "tco") {
    const tickets = Number(getFlagValue(argv, "--tickets") ?? 3000);
    const voice = Number(getFlagValue(argv, "--voice") ?? 0);
    const seats = Number(getFlagValue(argv, "--seats") ?? 3);
    const rate = Number(getFlagValue(argv, "--rate") ?? 0.65);
    const res = calculateSupportTco({
      monthlyTickets: tickets,
      monthlyVoiceMinutes: voice,
      teamSeats: seats,
      aiResolutionRate: rate
    });
    process.stdout.write(JSON.stringify(res, null, 2) + "\n");
    return 0;
  }
  return null;
}

export function startStdioServer() {
  const client = new OctadezxClient({
    endpoint: process.env.OCTADEZX_ENDPOINT || "https://octadezx.com/mcp",
    apiKey: process.env.OCTADEZX_API_KEY || ""
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const request = JSON.parse(trimmed);
      const response = await handleRpcRequest(request, client);
      if (response) {
        process.stdout.write(JSON.stringify(response) + "\n");
      }
    } catch {
      process.stdout.write(
        JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }) + "\n"
      );
    }
  });
}

const resolvedArgv = process.argv[1]
  ? (() => { try { return fs.realpathSync(process.argv[1]); } catch { return process.argv[1]; } })()
  : "";
const isEntrypoint = resolvedArgv && fs.realpathSync(fileURLToPath(import.meta.url)) === resolvedArgv;
if (isEntrypoint) {
  const exitCode = await runCli(process.argv.slice(2));
  if (exitCode !== null) {
    process.exit(exitCode);
  }
  startStdioServer();
}
