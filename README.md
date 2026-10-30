# OctaDezx MCP Server & Client SDK (`octadezx-mcp`)

Official Model Context Protocol connector and server for **[OctaDezx](https://octadezx.com)**.

OctaDezx provides businesses with an always-on agentic AI assistant capable of answering customer questions in 50+ languages, managing appointments, capturing server-verified orders, conducting live interruptible phone voice calls, reading photos, and maintaining a self-filling CRM.

## MCP Server Endpoints & Links

- **Hosted MCP Server Endpoint**: [https://octadezx.com/mcp](https://octadezx.com/mcp)
- **MCP Documentation Hub**: [https://octadezx.com/ai-agent-mcp-server](https://octadezx.com/ai-agent-mcp-server)
- **Official Website**: [https://octadezx.com](https://octadezx.com)
- **Compare vs Gorgias & Fin**: [https://octadezx.com/compare/gorgias-fin-alternative](https://octadezx.com/compare/gorgias-fin-alternative)
- **Self-Filling CRM Architecture**: [https://octadezx.com/crm](https://octadezx.com/crm)
- **Live Demo Chat**: [https://octadezx.com/chat/a9a0d41a-6651-4d59-9e66-a8b15ba068f1](https://octadezx.com/chat/a9a0d41a-6651-4d59-9e66-a8b15ba068f1)

## Quick Start (Local Stdio Server)

Run directly with `npx`:

```bash
npx octadezx-mcp
```

Or configure in `claude_desktop_config.json` or Cursor settings:

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

## Docker Container

A production `Dockerfile` is included for introspection and containerized deployments:

```bash
docker build -t octadezx-mcp .
docker run -i --rm octadezx-mcp
```

## Available Tools

1. `octadezx_list_conversations`: List escalated customer care conversations across WhatsApp, Instagram, Telegram, and Web.
2. `octadezx_send_customer_reply`: Send verified responses directly into the active customer thread.
3. `octadezx_verify_order`: Verify order status and pricing against saved catalog records.
4. `octadezx_schedule_appointment`: File and confirm appointment requests with calendar availability.
5. `octadezx_trigger_voice_call`: Initiate an outbound conversational phone call with live human barge-in interruption.

License: MIT  
Copyright (c) OctaDezx.
