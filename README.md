# OctaDezx MCP SDK (`octadezx-mcp`)

Official Model Context Protocol connector for **[OctaDezx](https://octadezx.com)**.

OctaDezx provides businesses with an always-on agentic AI assistant capable of answering customer questions in 50+ languages, managing appointments, capturing server-verified orders, conducting live interruptible phone voice calls, reading photos, and maintaining a self-filling CRM.

## Documentation & Links

- **Official Website**: [https://octadezx.com](https://octadezx.com)
- **MCP Server Hub**: [https://octadezx.com/ai-agent-mcp-server](https://octadezx.com/ai-agent-mcp-server)
- **Compare vs Gorgias & Fin**: [https://octadezx.com/compare/gorgias-fin-alternative](https://octadezx.com/compare/gorgias-fin-alternative)
- **CRM Architecture**: [https://octadezx.com/crm](https://octadezx.com/crm)
- **Live Demo**: [https://octadezx.com/chat/a9a0d41a-6651-4d59-9e66-a8b15ba068f1](https://octadezx.com/chat/a9a0d41a-6651-4d59-9e66-a8b15ba068f1)

## Installation

```bash
npm install octadezx-mcp
```

## Quick Start with Claude / Cursor

Add to your MCP settings file (`claude_desktop_config.json` or Cursor MCP settings):

```json
{
  "mcpServers": {
    "octadezx": {
      "command": "npx",
      "args": ["octadezx-mcp"],
      "env": {
        "OCTADEZX_API_KEY": "your_octadezx_api_key_here"
      }
    }
  }
}
```

License: MIT  
Copyright (c) OctaDezx.
