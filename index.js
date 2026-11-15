/**
 * OctaDezx Model Context Protocol (MCP) Client SDK (v1.2.1)
 * Exposes local deterministic offline tools and optional connected OctaDezx Cloud tools.
 */

export {
  auditKnowledgeBase,
  verifyReplySafety,
  planMultistepInquiry,
  calculateSupportTco
} from "./lib/localTools.js";

export class OctadezxClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.OCTADEZX_API_KEY || "";
    this.endpoint = (options.endpoint || process.env.OCTADEZX_ENDPOINT || "https://octadezx.com/mcp").replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs || 15000;
  }

  hasApiKey() {
    return Boolean(this.apiKey && String(this.apiKey).trim());
  }

  async listConversations(params = {}) {
    return this.callTool("octadezx_list_conversations", params);
  }

  async sendCustomerReply(params) {
    return this.callTool("octadezx_send_customer_reply", params);
  }

  async verifyOrder(params) {
    return this.callTool("octadezx_verify_order", params);
  }

  async scheduleAppointment(params) {
    return this.callTool("octadezx_schedule_appointment", params);
  }

  async triggerVoiceCall(params) {
    return this.callTool("octadezx_trigger_voice_call", params);
  }

  async callTool(toolName, args = {}) {
    if (!this.hasApiKey()) {
      throw new Error("OCTADEZX_API_KEY is required for cloud workspace tools.");
    }

    const url = `${this.endpoint}/v1/tools/${toolName}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "OctaDezx-MCP-Client/1.2.1",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(args),
        signal: controller.signal
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OctaDezx API returned ${res.status}: ${text}`);
      }

      return res.json();
    } finally {
      clearTimeout(timer);
    }
  }
}
