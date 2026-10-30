/**
 * OctaDezx Model Context Protocol (MCP) Client
 * https://octadezx.com/ai-agent-mcp-server
 */
export class OctadezxClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.OCTADEZX_API_KEY;
    this.endpoint = options.endpoint || "https://octadezx.com/mcp";
  }

  async listConversations(params = {}) {
    return this.#request("list_conversations", params);
  }

  async sendCustomerReply(params) {
    return this.#request("send_customer_reply", params);
  }

  async #request(tool, args) {
    const res = await fetch(`${this.endpoint}/v1/tools/${tool}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(args)
    });
    return res.json();
  }
}
