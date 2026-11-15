#!/usr/bin/env node
/**
 * OctaDezx Model Context Protocol (MCP) Server & CLI Toolkit (v1.2.1)
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
export const SERVER_VERSION = "1.2.1";
export const PROTOCOL_VERSION = "2024-11-05";

export const TOOLS = [
  {
    name: "audit_knowledge_base",
    description:
      "Deterministically audit support documentation before indexing it into a RAG or AI customer agent. Runs completely offline with zero network calls or API key required, checking one or more Markdown, plain-text, or JSON files for conflicting policy time windows, unqualified commitments, currency ambiguity, missing headings, missing human escalation contacts, and embedded prompt-injection patterns. Returns JSON with score (0-100), grade (A-F), findings[], extractedFacts, recommendations[], and mode ('local_deterministic').",
    annotations: {
      title: "Audit Knowledge Base",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    },
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: {
          type: "string",
          minLength: 1,
          default: "Inline Knowledge Base",
          description: "Human-readable document title used in audit findings when supplying inline content."
        },
        content: {
          type: "string",
          minLength: 1,
          description: "Inline Markdown, plain-text, or JSON policy documentation to audit. Provide content, filePath, or documents."
        },
        filePath: {
          type: "string",
          minLength: 1,
          description: "Local filesystem path to a readable UTF-8 Markdown, text, or JSON file to audit."
        },
        documents: {
          type: "array",
          minItems: 1,
          description: "Collection of multiple policy documents to audit together so cross-document contradictions (e.g., 14-day vs 30-day refunds) are detected.",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: {
                type: "string",
                minLength: 1,
                description: "Document title or filename shown in contradiction and risk findings."
              },
              content: {
                type: "string",
                minLength: 1,
                description: "Full Markdown, plain-text, or JSON content of this document."
              }
            },
            required: ["content"]
          }
        }
      }
    }
  },
  {
    name: "verify_reply_safety",
    description:
      "Pre-send deterministic safety and hallucination verifier for a draft AI customer support response. Runs completely offline without an API key, validating every email address, order ID, promo code, monetary figure, refund commitment, template placeholder, and punctuation rule against authoritative groundTruth records. Returns JSON with safe (boolean), riskLevel ('pass' | 'review' | 'block'), violationCount, violations[], and verifiedClaims[].",
    annotations: {
      title: "Verify Reply Safety",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    },
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        candidateReply: {
          type: "string",
          minLength: 1,
          description: "Draft customer-facing AI response text to verify prior to delivery."
        },
        strictStyle: {
          type: "boolean",
          default: false,
          description: "When true, flag em dashes and en dashes in candidateReply as low-severity style violations."
        },
        groundTruth: {
          type: "object",
          additionalProperties: false,
          description: "Authoritative customer, order, catalog, discount, and policy facts used to verify every claim in candidateReply.",
          properties: {
            customerEmail: {
              type: "string",
              format: "email",
              description: "Verified customer email address; mentioning any other email triggers a cross_customer_email_leak block."
            },
            allowedEmails: {
              type: "array",
              description: "Additional permitted emails (such as official company support addresses) allowed inside the reply.",
              items: {
                type: "string",
                format: "email",
                description: "Allowed contact email address."
              }
            },
            customerOrderIds: {
              type: "array",
              description: "List of order identifiers belonging to the verified customer; referencing unlisted order IDs triggers a cross_customer_order_leak block.",
              items: {
                type: "string",
                minLength: 1,
                description: "Authorized customer order ID (for example, 'OD-1001')."
              }
            },
            verified: {
              type: "boolean",
              default: true,
              description: "Whether customer identity is verified; when false, claiming a refund was issued triggers unauthorized_refund_commitment."
            },
            allowMutations: {
              type: "boolean",
              default: true,
              description: "When false, treat any claim of an executed refund or account mutation as a critical violation."
            },
            order: {
              type: "object",
              additionalProperties: false,
              description: "Authoritative order object containing verified totals, currency, refundable status, and line items.",
              properties: {
                id: { type: "string", description: "Primary order ID." },
                orderId: { type: "string", description: "Alternate order identifier field." },
                total: { type: "number", minimum: 0, description: "Verified total order amount." },
                subtotal: { type: "number", minimum: 0, description: "Verified pre-tax/shipping subtotal." },
                shipping: { type: "number", minimum: 0, description: "Verified shipping fee." },
                tax: { type: "number", minimum: 0, description: "Verified tax amount." },
                refundAmount: { type: "number", minimum: 0, description: "Verified eligible or processed refund amount." },
                amount: { type: "number", minimum: 0, description: "Generic verified order amount." },
                currency: { type: "string", description: "ISO 4217 currency code (for example, 'USD')." },
                status: { type: "string", description: "Current authoritative fulfillment or order status." },
                refundable: { type: "boolean", description: "Whether this order is eligible for a refund." },
                items: {
                  type: "array",
                  description: "Verified order line items whose unit prices are permitted in the reply.",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      name: { type: "string", description: "Line item product name." },
                      price: { type: "number", minimum: 0, description: "Authorized line item price." },
                      unitPrice: { type: "number", minimum: 0, description: "Authorized single-unit price." }
                    }
                  }
                }
              }
            },
            catalogPrices: {
              type: "object",
              additionalProperties: {
                type: "number",
                minimum: 0,
                description: "Authoritative catalog price in USD for the keyed SKU or product name."
              },
              description: "Dictionary mapping product SKUs or names to verified numeric catalog prices allowed in candidateReply."
            },
            allowedDiscountCodes: {
              type: "array",
              description: "Explicit allowlist of valid promo or voucher codes; any other promo code mentioned in candidateReply is flagged.",
              items: {
                type: "string",
                minLength: 1,
                description: "Valid promo/discount code (for example, 'WELCOME10')."
              }
            },
            allowedAmounts: {
              type: "array",
              description: "Additional verified numeric monetary amounts permitted in candidateReply.",
              items: {
                type: "number",
                minimum: 0,
                description: "Permitted monetary value."
              }
            },
            policyText: {
              type: "string",
              description: "Canonical policy text whose numeric amounts (such as restocking fees or free-shipping thresholds) are whitelisted."
            }
          }
        }
      },
      required: ["candidateReply"]
    }
  },
  {
    name: "plan_multistep_inquiry",
    description:
      "Deterministically decompose a complex, multi-intent, or code-switched customer inquiry (supporting English, Spanish, Portuguese, French, German, Italian, Dutch, Polish, Banglish, Hinglish, and Spanglish) into a read-before-write 7-stage execution DAG (detect -> plan -> gate -> lookup -> clarify -> verify -> action). Runs completely offline with zero network calls or API key, extracting order IDs, emails, phones, and monetary figures while enforcing identity authentication and clarification gates before state mutations.",
    annotations: {
      title: "Plan Multi-Step Inquiry",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    },
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        message: {
          type: "string",
          minLength: 1,
          description: "Raw incoming customer message text (single-language or code-switched, single or multi-intent)."
        },
        localeHint: {
          type: "string",
          default: "en",
          enum: ["en", "es", "pt", "fr", "de", "it", "nl", "pl", "banglish", "hinglish"],
          description: "Fallback ISO language or script hint when no non-English tokens match automatically."
        },
        hasAuthenticatedSession: {
          type: "boolean",
          default: false,
          description: "Whether the customer has already completed identity verification for private order/account lookups or mutations."
        },
        knownCustomerOrderIds: {
          type: "array",
          description: "Previously retrieved order IDs on file for this customer so redundant order-number questions can be skipped.",
          items: {
            type: "string",
            minLength: 1,
            description: "Order identifier associated with the customer session."
          }
        }
      },
      required: ["message"]
    }
  },
  {
    name: "calculate_support_tco",
    description:
      "Deterministic total-cost-of-ownership (TCO) and unit-economics calculator comparing per-resolution AI support pricing (Intercom Fin at $0.99/resolution + seats, Gorgias AI automated interaction pricing, Zendesk AI) against flat-rate OctaDezx tiers (Starter $29/mo, Pro $99/mo, Advanced $199/mo) and Enterprise metered billing ($499/mo minimum). Runs completely offline with no API key, returning recommendedPlan, monthlyUsd, annualUsd, effectiveCostPerTicketUsd, and competitor savings.",
    annotations: {
      title: "Calculate Support TCO",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    },
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        monthlyTickets: {
          type: "number",
          minimum: 0,
          description: "Total monthly customer support tickets or inquiries across all messaging channels."
        },
        aiResolutionRate: {
          type: "number",
          minimum: 0,
          maximum: 1,
          default: 0.65,
          description: "Expected fraction of monthlyTickets resolved autonomously by AI (from 0.0 to 1.0, default 0.65)."
        },
        avgMessagesPerTicket: {
          type: "number",
          minimum: 1,
          default: 4,
          description: "Average AI messages exchanged per customer ticket (default 4)."
        },
        monthlyVoiceMinutes: {
          type: "number",
          minimum: 0,
          default: 0,
          description: "Expected monthly inbound/outbound AI phone voice minutes (default 0)."
        },
        teamSeats: {
          type: "number",
          minimum: 1,
          default: 3,
          description: "Number of human support team seats required (default 3)."
        },
        intercomPerResolutionUsd: {
          type: "number",
          minimum: 0,
          default: 0.99,
          description: "Intercom Fin fee per resolved conversation in USD (default 0.99)."
        },
        intercomSeatUsd: {
          type: "number",
          minimum: 0,
          default: 29,
          description: "Intercom monthly price per agent seat in USD (default 29)."
        },
        gorgiasPerAutomatedUsd: {
          type: "number",
          minimum: 0,
          default: 0.95,
          description: "Gorgias AI fee per automated ticket resolution in USD (default 0.95)."
        },
        gorgiasBaseMonthlyUsd: {
          type: "number",
          minimum: 0,
          default: 60,
          description: "Gorgias base monthly helpdesk subscription in USD (default 60)."
        },
        zendeskSeatUsd: {
          type: "number",
          minimum: 0,
          default: 55,
          description: "Zendesk Suite monthly price per agent seat in USD (default 55)."
        },
        zendeskAutomatedResolutionUsd: {
          type: "number",
          minimum: 0,
          default: 1.5,
          description: "Zendesk AI add-on fee per automated resolution in USD (default 1.50)."
        }
      },
      required: ["monthlyTickets"]
    }
  },
  {
    name: "octadezx_list_conversations",
    description:
      "Retrieve recent or escalated customer conversations from your connected OctaDezx Cloud workspace across WhatsApp, Instagram, Facebook Messenger, Telegram, Phone Voice, and Web Widget. Use when triaging open support queues or fetching thread IDs before replying. Requires OCTADEZX_API_KEY in the environment; if unset, returns a structured 'requires_api_key' guidance payload instead of failing silently.",
    annotations: {
      title: "List Workspace Conversations",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        status: {
          type: "string",
          enum: ["open", "escalated", "all"],
          default: "all",
          description: "Filter workspace conversations by triage state ('open', 'escalated', or 'all')."
        },
        limit: {
          type: "number",
          minimum: 1,
          maximum: 100,
          default: 10,
          description: "Maximum number of conversation threads to return (1 to 100, default 10)."
        }
      }
    }
  },
  {
    name: "octadezx_send_customer_reply",
    description:
      "Deliver a verified customer care reply into an active OctaDezx Cloud conversation thread across its originating channel (WhatsApp, Instagram, Messenger, Telegram, or Web Widget). Best paired with verify_reply_safety prior to sending. Requires OCTADEZX_API_KEY; returns a structured 'requires_api_key' error payload when unauthenticated.",
    annotations: {
      title: "Send Customer Reply",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    },
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        conversationId: {
          type: "string",
          minLength: 1,
          description: "Unique identifier of the target OctaDezx customer conversation thread."
        },
        message: {
          type: "string",
          minLength: 1,
          maxLength: 4000,
          description: "Final verified reply text to send to the customer (up to 4,000 characters)."
        }
      },
      required: ["conversationId", "message"]
    }
  },
  {
    name: "octadezx_verify_order",
    description:
      "Look up authoritative live order fulfillment status, line items, and verified totals in your connected OctaDezx storefront integration (Shopify or WooCommerce). Use before promising refunds, answering WISMO questions, or citing order amounts. Requires OCTADEZX_API_KEY; returns a structured 'requires_api_key' error payload if unconfigured.",
    annotations: {
      title: "Verify Workspace Order",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        orderId: {
          type: "string",
          minLength: 1,
          description: "Storefront order ID (for example, 'OD-1042' or '#1042') or verified customer phone number."
        }
      },
      required: ["orderId"]
    }
  },
  {
    name: "octadezx_schedule_appointment",
    description:
      "Create an appointment booking request and check Google Calendar staff busy-time availability in your OctaDezx Cloud workspace. Use after confirming service type, customer name, and callback phone number. Requires OCTADEZX_API_KEY; returns a structured 'requires_api_key' error payload when no API key is configured.",
    annotations: {
      title: "Schedule Workspace Appointment",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    },
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        customerName: {
          type: "string",
          minLength: 1,
          description: "Full name of the customer requesting the appointment."
        },
        phone: {
          type: "string",
          minLength: 5,
          description: "Customer contact phone number for SMS/WhatsApp/voice booking confirmation."
        },
        service: {
          type: "string",
          minLength: 1,
          description: "Name of the requested service, consultation, or salon/clinic treatment."
        },
        datetime: {
          type: "string",
          description: "Optional preferred appointment start date and time in ISO 8601 format (for example, '2026-11-18T14:30:00Z')."
        }
      },
      required: ["customerName", "phone", "service"]
    }
  },
  {
    name: "octadezx_trigger_voice_call",
    description:
      "Initiate an outbound conversational AI phone reminder or support follow-up call from your OctaDezx Cloud workspace with real-time human barge-in support. Only invoke after verifying consent and call purpose. Requires OCTADEZX_API_KEY; returns a structured 'requires_api_key' error payload when unauthenticated.",
    annotations: {
      title: "Trigger AI Voice Call",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    },
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        phoneNumber: {
          type: "string",
          pattern: "^\\+[1-9]\\d{6,14}$",
          description: "Destination phone number in strict E.164 international format (for example, '+14155550199')."
        },
        reason: {
          type: "string",
          minLength: 3,
          maxLength: 500,
          description: "Concise, specific purpose or context brief for the AI voice agent call (3 to 500 characters)."
        }
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
