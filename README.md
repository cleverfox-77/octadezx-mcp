# OctaDezx MCP Server & Offline Guardrail Toolkit (`octadezx-mcp` v1.2.0)

[![cleverfox-77/octadezx-mcp MCP server](https://glama.ai/mcp/servers/cleverfox-77/octadezx-mcp/badges/score.svg)](https://glama.ai/mcp/servers/cleverfox-77/octadezx-mcp)

Official Model Context Protocol (MCP) server, offline deterministic customer-support verification toolkit, and CLI for **[OctaDezx](https://octadezx.com)**.

`octadezx-mcp` operates in **Dual Mode**:
- **4 Standalone Offline Deterministic Tools (Zero API Key / Zero Network Calls):** Run locally via pure deterministic algorithms in [`lib/localTools.js`](lib/localTools.js) to audit knowledge-base docs, catch hallucinated/unsafe AI replies pre-send, plan compound multilingual inquiries, and compute support TCO.
- **5 Connected Cloud Workspace Tools (Optional `OCTADEZX_API_KEY`):** Connect to your live OctaDezx workspace (`https://octadezx.com/mcp`) to list inbox conversations, send verified replies, verify live orders, schedule Google Calendar-aware appointments, and place interruptible voice calls.

---

## Available Tools (9 Tools Total)

### 1. Standalone Offline Tools (No API Key Required)

| Tool | Description | Annotations |
| :--- | :--- | :--- |
| `audit_knowledge_base` | Audits Markdown/text/JSON support docs or a local `filePath` for conflicting return/trial windows, ambiguous currency symbols, over-promising SLA claims, missing escalation rules, and prompt-injection risks; outputs a `0-100` score (`A-F`). | `readOnlyHint: true`, `idempotentHint: true` |
| `verify_reply_safety` | Deterministic pre-send safety verifier that checks a `candidateReply` against `groundTruth` (`customerEmail`, `customerOrderIds`, `order`, `catalogPrices`, `allowedDiscountCodes`, `policyText`) to block cross-customer privacy leaks, invented promo codes, unverified dollar amounts, and unauthorized refunds. | `readOnlyHint: true`, `idempotentHint: true` |
| `plan_multistep_inquiry` | Parses compound multilingual and code-switched messages (`EN`, `ES`, `PT`, `FR`, `DE`, `IT`, `NL`, `PL`, `Banglish`, `Hinglish`, `Spanglish`) into a 7-stage execution DAG (`detect -> plan -> gate -> lookup -> clarify -> verify -> action`) with auth gates and read-before-write policy. | `readOnlyHint: true`, `idempotentHint: true` |
| `calculate_support_tco` | Computes monthly/annual TCO comparing per-resolution AI tools (Intercom Fin `$0.99/outcome`, Gorgias AI, Zendesk AI) against OctaDezx flat-rate tiers (`Starter $29/mo`, `Pro $99/mo`, `Advanced $199/mo`) and metered Enterprise pricing. | `readOnlyHint: true`, `idempotentHint: true` |

### 2. Cloud Workspace Tools (Requires `OCTADEZX_API_KEY`)

5. `octadezx_list_conversations`: List open or escalated conversations across WhatsApp, Instagram, Messenger, Telegram, phone voice, and web chat.
6. `octadezx_send_customer_reply`: Deliver a verified response into a customer conversation thread.
7. `octadezx_verify_order`: Verify live order status and pricing against storefront catalog records.
8. `octadezx_schedule_appointment`: File an appointment booking request in your connected calendar workflow.
9. `octadezx_trigger_voice_call`: Place an outbound conversational phone call with live barge-in interruption.

---

## Quick Start (Claude Desktop, Cursor, Windsurf, Cline)

You can run the 4 offline deterministic tools immediately with zero API keys or environment variables:

```json
{
  "mcpServers": {
    "octadezx": {
      "command": "node",
      "args": ["server.js"]
    }
  }
}
```

To also enable live OctaDezx Cloud workspace actions (`octadezx_list_conversations`, `octadezx_verify_order`, etc.), add your `OCTADEZX_API_KEY` from [OctaDezx Settings](https://octadezx.com/settings):

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

## CLI Usage

```bash
node server.js --help
node server.js --list-tools
node server.js audit ./docs/refund-policy.md
node server.js plan --message "Where is order #OD-4410? Also cancel #OD-4409 if not shipped."
node server.js tco --tickets 2500 --voice 250 --seats 4 --rate 0.70
```

## Automated Tests

```bash
npm test
```

Runs the full `node --test` unit suite (`test/mcp.test.js`) and JSON-RPC stdio protocol smoke test (`test.js`) without requiring any credentials.

## Links

- **Official Website**: [https://octadezx.com](https://octadezx.com)
- **MCP Documentation**: [https://octadezx.com/ai-agent-mcp-server](https://octadezx.com/ai-agent-mcp-server)
- **Multi-Step Safety Benchmark**: [https://octadezx.com/benchmarks/multi-step-inquiries](https://octadezx.com/benchmarks/multi-step-inquiries)
- **Pricing**: [https://octadezx.com/pricing](https://octadezx.com/pricing)

License: MIT
