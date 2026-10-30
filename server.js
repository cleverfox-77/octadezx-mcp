/**
 * OctaDezx Model Context Protocol (MCP) Server
 * Standard JSON-RPC stdio protocol implementation
 * Hosted Hub: https://octadezx.com/mcp
 * Documentation: https://octadezx.com/ai-agent-mcp-server
 */

import * as readline from "node:readline";

const SERVER_NAME = "octadezx-mcp-server";
const SERVER_VERSION = "1.0.0";
const PROTOCOL_VERSION = "2024-11-05";

const TOOLS = [
  {
    name: "octadezx_list_conversations",
    description: "List recent and escalated customer care conversations across WhatsApp, Instagram, Telegram, and Web.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["open", "escalated", "all"], description: "Filter by status" },
        limit: { type: "number", description: "Maximum conversations to return (default 20)" }
      }
    }
  },
  {
    name: "octadezx_send_customer_reply",
    description: "Transmit a contextual customer care response directly into the active customer thread.",
    inputSchema: {
      type: "object",
      properties: {
        conversationId: { type: "string", description: "The customer conversation ID" },
        message: { type: "string", description: "The message text to deliver to the customer" }
      },
      required: ["conversationId", "message"]
    }
  },
  {
    name: "octadezx_verify_order",
    description: "Verify order status and check server-side verified pricing against saved catalog records.",
    inputSchema: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "The order ID or customer phone number" }
      },
      required: ["orderId"]
    }
  },
  {
    name: "octadezx_schedule_appointment",
    description: "File an appointment or booking request and verify team availability in the calendar.",
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
    description: "Initiate an outbound conversational phone call with live human barge-in interruption.",
    inputSchema: {
      type: "object",
      properties: {
        phoneNumber: { type: "string", description: "Destination phone number in E.164 format" },
        reason: { type: "string", description: "The specific reason or context for the call" }
      },
      required: ["phoneNumber", "reason"]
    }
  }
];

function send(response) {
  process.stdout.write(JSON.stringify(response) + "\n");
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const request = JSON.parse(trimmed);
    const { id, method, params } = request;

    if (method === "initialize") {
      send({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {
            tools: { listChanged: false }
          },
          serverInfo: {
            name: SERVER_NAME,
            version: SERVER_VERSION
          }
        }
      });
    } else if (method === "notifications/initialized") {
      // Client confirmed initialization
    } else if (method === "tools/list") {
      send({
        jsonrpc: "2.0",
        id,
        result: {
          tools: TOOLS
        }
      });
    } else if (method === "tools/call") {
      const toolName = params?.name;
      send({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: `[OctaDezx MCP] Tool ${toolName} acknowledged. Connect your API key from https://octadezx.com/mcp for live execution.`
            }
          ]
        }
      });
    } else if (method === "ping") {
      send({ jsonrpc: "2.0", id, result: {} });
    } else if (id !== undefined) {
      send({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: "Method not found" }
      });
    }
  } catch (err) {
    send({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" }
    });
  }
});
