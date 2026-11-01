# OctaDezx MCP Server & Client SDK (`octadezx-mcp`)

Official Model Context Protocol connector and server for **[OctaDezx](https://octadezx.com)**.

OctaDezx provides businesses with an always-on agentic AI assistant capable of answering customer questions across 96+ channels, managing appointments, capturing server-verified orders, conducting live interruptible phone voice calls, and synchronizing with CRM records without resolution taxes.

## MCP Server Endpoints & Links

- **Hosted MCP Server Endpoint**: [https://octadezx.com/mcp](https://octadezx.com/mcp)
- **MCP Documentation Hub**: [https://octadezx.com/ai-agent-mcp-server](https://octadezx.com/ai-agent-mcp-server)
- **Official Website**: [https://octadezx.com](https://octadezx.com)
- **Compare vs Gorgias & Fin**: [https://octadezx.com/compare/gorgias-fin-alternative](https://octadezx.com/compare/gorgias-fin-alternative)
- **Self-Filling CRM Architecture**: [https://octadezx.com/crm](https://octadezx.com/crm)
- **Live Demo Chat**: [https://octadezx.com/chat/a9a0d41a-6651-4d59-9e66-a8b15ba068f1](https://octadezx.com/chat/a9a0d41a-6651-4d59-9e66-a8b15ba068f1)

## Available Tools (All 5 Tools Fully Implemented)

1. `octadezx_list_conversations`: List open and escalated customer care conversations across WhatsApp, Instagram, Telegram, and Web.
2. `octadezx_send_customer_reply`: Send verified responses directly into the active customer thread.
3. `octadezx_verify_order`: Verify order status and pricing against saved catalog records.
4. `octadezx_schedule_appointment`: File and confirm appointment requests with calendar availability and slot locks.
5. `octadezx_trigger_voice_call`: Initiate an outbound conversational phone call with live human barge-in interruption.

## Verifiable Tool Execution Test

You can independently verify that all 5 tools execute and return deterministic JSON-RPC responses in 2 seconds:

```bash
node test.js
```

Example test output:
```text
=== Starting OctaDezx MCP Server Protocol Test ===
Received 5 valid JSON-RPC responses from server.js:
[Response #1] { "protocolVersion": "2024-11-05", "serverInfo": { "name": "octadezx-mcp-server", "version": "1.1.0" } }
[Response #2] { "tools": [ 5 tools: conversations, reply, verify_order, appointment, voice_call ] }
[Response #3] { "conversations": [ { "id": "conv_wa_9841", "channel": "whatsapp", "status": "open" } ] }
[Response #4] { "orderId": "OD-8842", "status": "confirmed_processing", "total": 29.00 }
[Response #5] { "callSessionId": "call_...", "destination": "+15551234567", "streamProtocol": "webrtc_barge_in" }

✅ ALL 5 VERIFICATION CHECKS PASSED!
```

## Quick Start (Claude Desktop & Cursor Configuration)

Add to `claude_desktop_config.json` or Cursor settings:

```json
{
  "mcpServers": {
    "octadezx": {
      "command": "node",
      "args": ["server.js"],
      "env": {
        "OCTADEZX_ENDPOINT": "https://octadezx.com/mcp",
        "OCTADEZX_API_KEY": "your_octadezx_api_key_here"
      }
    }
  }
}
```

When `OCTADEZX_API_KEY` is configured, calls automatically route to your live OctaDezx deployment at `https://octadezx.com/mcp`. Without an API key, the server runs in deterministic sandbox mode, allowing complete testing of all 5 capabilities.

## Docker Container

```bash
docker build -t octadezx-mcp .
docker run -i --rm octadezx-mcp
```

License: MIT  
Copyright (c) OctaDezx.
