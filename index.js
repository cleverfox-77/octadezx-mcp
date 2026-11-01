/**
 * OctaDezx Model Context Protocol (MCP) Client SDK
 * Official client connector for https://octadezx.com/mcp
 */
export class OctadezxClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.OCTADEZX_API_KEY || "";
    this.endpoint = (options.endpoint || process.env.OCTADEZX_ENDPOINT || "https://octadezx.com/mcp").replace(/\/+$/, "");
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
    const url = `${this.endpoint}/v1/tools/${toolName}`;
    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "OctaDezx-MCP-Client/1.1.0"
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(args)
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OctaDezx API returned ${res.status}: ${text}`);
    }

    return res.json();
  }
}
