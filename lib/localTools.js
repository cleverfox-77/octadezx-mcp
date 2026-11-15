/**
 * Deterministic Offline MCP Tools for Customer Support Engineering
 * Zero external network calls or API keys required.
 */

import * as fs from "node:fs/promises";

const INJECTION_PATTERNS = [
  { pattern: /ignore\s+(?:all\s+)?previous\s+instructions/i, label: "Prompt-injection override phrase ('ignore previous instructions')" },
  { pattern: /reveal\s+(?:your\s+)?system\s+prompt/i, label: "System prompt extraction phrase" },
  { pattern: /\bdeveloper\s+mode\b|\bjailbreak\b/i, label: "Jailbreak/developer mode instruction inside KB text" },
  { pattern: /<!--[\s\S]*?(?:system|ignore|override|instruction)[\s\S]*?-->/i, label: "Suspicious directive hidden inside HTML comment" },
  { pattern: /<script\b/i, label: "Embedded <script> tag inside knowledge base document" },
  { pattern: /[\u200B-\u200D\uFEFF]/, label: "Zero-width invisible Unicode characters detected" }
];

const OVERPROMISE_PATTERNS = [
  { pattern: /\b100%\s+guaranteed\b/i, phrase: "100% guaranteed" },
  { pattern: /\binstant\s+refund\b/i, phrase: "instant refund" },
  { pattern: /\bunlimited\s+everything\b/i, phrase: "unlimited everything" },
  { pattern: /\balways\s+free\b/i, phrase: "always free" },
  { pattern: /\bno\s+exceptions?\b/i, phrase: "no exceptions" }
];

const CURRENCY_CODES = /\b(?:USD|EUR|GBP|CAD|AUD|BDT|INR|JPY|SGD|AED)\b/;

function classifyWindowDomain(context) {
  const lower = context.toLowerCase();
  if (/refund|return|money[- ]back|exchange/.test(lower)) return "refund_or_return";
  if (/trial|free\s+test/.test(lower)) return "trial";
  if (/ship|deliver|dispatch|transit/.test(lower)) return "shipping";
  if (/warrant|guarantee|coverage/.test(lower)) return "warranty";
  if (/response|reply|sla|support/.test(lower)) return "sla";
  return "general";
}

function normalizeHours(value, unitRaw) {
  const u = unitRaw.toLowerCase();
  if (u.startsWith("minute")) return value / 60;
  if (u.startsWith("hour") || u.startsWith("hr")) return value;
  if (u.startsWith("day")) return value * 24;
  if (u.startsWith("week")) return value * 24 * 7;
  if (u.startsWith("month")) return value * 24 * 30;
  return value;
}

/**
 * Audit one or more knowledge-base documents (Markdown, plain text, JSON, or a local file)
 * for policy contradictions, currency ambiguity, prompt injection patterns, and AI readiness.
 */
export async function auditKnowledgeBase(args = {}) {
  const docs = [];

  if (args.filePath) {
    const fileText = await fs.readFile(String(args.filePath), "utf8");
    docs.push({ title: String(args.filePath), content: fileText });
  }
  if (Array.isArray(args.documents)) {
    for (let i = 0; i < args.documents.length; i++) {
      const item = args.documents[i];
      if (item && typeof item.content === "string" && item.content.trim()) {
        docs.push({ title: item.title || `Document ${i + 1}`, content: item.content });
      }
    }
  }
  if (typeof args.content === "string" && args.content.trim()) {
    docs.push({ title: args.title || "Inline Knowledge Base", content: args.content });
  }

  if (docs.length === 0) {
    throw new Error("Provide 'content', non-empty 'documents', or a readable 'filePath' to audit.");
  }

  const findings = [];
  const extractedWindows = [];
  const extractedPrices = [];
  const currenciesSeen = new Set();

  let hasHeadings = false;
  let hasEscalationContact = false;

  for (const doc of docs) {
    const text = doc.content;

    if (/^#{1,3}\s+\S/m.test(text) || /"[a-zA-Z0-9_]+"/.test(text)) {
      hasHeadings = true;
    }
    if (/@|support|contact|human|escalat|help\s+desk/i.test(text)) {
      hasEscalationContact = true;
    }

    for (const rule of INJECTION_PATTERNS) {
      if (rule.pattern.test(text)) {
        findings.push({
          severity: "critical",
          category: "prompt_injection_risk",
          document: doc.title,
          message: rule.label
        });
      }
    }

    for (const rule of OVERPROMISE_PATTERNS) {
      if (rule.pattern.test(text)) {
        findings.push({
          severity: "medium",
          category: "unqualified_commitment",
          document: doc.title,
          message: `Contains absolute claim "${rule.phrase}" without explicit eligibility conditions.`
        });
      }
    }

    const windowRegex = /\b(\d+(?:\.\d+)?)\s*[-\s]?(?:calendar\s+|business\s+|working\s+)?(minutes?|hours?|hrs?|days?|weeks?|months?)\b/gi;
    let wm;
    while ((wm = windowRegex.exec(text)) !== null) {
      const val = Number(wm[1]);
      const unit = wm[2];
      const start = Math.max(0, wm.index - 45);
      const end = Math.min(text.length, wm.index + wm[0].length + 45);
      const snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
      const domain = classifyWindowDomain(snippet);
      extractedWindows.push({
        document: doc.title,
        domain,
        raw: wm[0],
        hoursEquivalent: Number(normalizeHours(val, unit).toFixed(2)),
        snippet
      });
    }

    const priceRegex = /(?:([$€£¥])\s?(\d+(?:[.,]\d{1,2})?))|(?:\b(\d+(?:[.,]\d{1,2})?)\s?(USD|EUR|GBP|CAD|AUD|BDT|INR)\b)/g;
    let pm;
    while ((pm = priceRegex.exec(text)) !== null) {
      const symbol = pm[1] || pm[4];
      const amount = Number((pm[2] || pm[3]).replace(/,/g, ""));
      const start = Math.max(0, pm.index - 35);
      const end = Math.min(text.length, pm.index + pm[0].length + 35);
      const snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
      currenciesSeen.add(symbol);
      if (pm[1] === "$" && !CURRENCY_CODES.test(text)) {
        // Record bare symbol; flagged once below if document mentions international/multi-region
      }
      extractedPrices.push({ document: doc.title, raw: pm[0], symbol, amount, snippet });
    }
  }

  // Detect conflicting time windows within the same policy domain
  const windowsByDomain = new Map();
  for (const w of extractedWindows) {
    if (w.domain === "general") continue;
    if (!windowsByDomain.has(w.domain)) windowsByDomain.set(w.domain, []);
    windowsByDomain.get(w.domain).push(w);
  }
  for (const [domain, list] of windowsByDomain.entries()) {
    const distinctHours = new Set(list.map((w) => w.hoursEquivalent));
    if (distinctHours.size > 1) {
      const examples = [...new Set(list.map((w) => `${w.raw} (${w.document})`))].slice(0, 4).join(" vs ");
      findings.push({
        severity: "high",
        category: "policy_contradiction",
        document: docs.map((d) => d.title).join(", "),
        message: `Conflicting time windows in "${domain}" policy: ${examples}. AI agents may quote inconsistent terms.`
      });
    }
  }

  const combinedText = docs.map((d) => d.content).join("\n");
  if (currenciesSeen.has("$") && !CURRENCY_CODES.test(combinedText) && /international|global|canada|australia|uk|europe/i.test(combinedText)) {
    findings.push({
      severity: "low",
      category: "ambiguous_currency",
      document: "All",
      message: "Uses bare '$' symbol in international context without specifying ISO currency code (e.g., USD vs CAD/AUD)."
    });
  }

  if (!hasHeadings) {
    findings.push({
      severity: "low",
      category: "structure_missing_headings",
      document: "All",
      message: "No Markdown headings or structured keys found; add headings per policy topic to improve RAG chunk accuracy."
    });
  }
  if (!hasEscalationContact) {
    findings.push({
      severity: "medium",
      category: "missing_escalation_path",
      document: "All",
      message: "No human handoff email, support link, or escalation rule detected in the documentation."
    });
  }

  const penalties = { critical: 35, high: 20, medium: 10, low: 5 };
  const totalPenalty = findings.reduce((acc, f) => acc + (penalties[f.severity] || 5), 0);
  const score = Math.max(0, 100 - totalPenalty);
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 45 ? "D" : "F";

  const recommendations = [];
  if (findings.some((f) => f.category === "policy_contradiction")) {
    recommendations.push("Reconcile conflicting day/hour windows into one canonical rule per topic.");
  }
  if (findings.some((f) => f.category === "prompt_injection_risk")) {
    recommendations.push("Strip hidden comments, scripts, zero-width chars, and instruction-like text before indexing.");
  }
  if (findings.some((f) => f.category === "missing_escalation_path")) {
    recommendations.push("Add an explicit human escalation rule and support contact channel.");
  }
  if (recommendations.length === 0) {
    recommendations.push("Knowledge base passed deterministic consistency and prompt-safety checks.");
  }

  return {
    score,
    grade,
    documentCount: docs.length,
    findingCount: findings.length,
    findings,
    extractedFacts: {
      timeWindows: extractedWindows,
      prices: extractedPrices,
      currencies: [...currenciesSeen]
    },
    recommendations,
    mode: "local_deterministic"
  };
}

/**
 * Deterministic pre-send safety and hallucination verifier for a candidate AI reply
 * checked against ground-truth customer, order, catalog, and policy facts.
 */
export function verifyReplySafety(args = {}) {
  const reply = typeof args.candidateReply === "string" ? args.candidateReply : "";
  if (!reply.trim()) {
    throw new Error("Missing required field: candidateReply");
  }

  const gt = args.groundTruth || {};
  const strictStyle = Boolean(args.strictStyle);
  const violations = [];
  const verifiedClaims = [];

  // 1. Cross-customer email privacy leak check
  const emailsInReply = [...new Set(reply.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])];
  for (const email of emailsInReply) {
    const allowedEmails = [gt.customerEmail, ...(gt.allowedEmails || [])].filter(Boolean).map((e) => e.toLowerCase());
    if (allowedEmails.length > 0 && !allowedEmails.includes(email.toLowerCase())) {
      violations.push({
        severity: "critical",
        rule: "cross_customer_email_leak",
        detail: `Reply mentions email "${email}", which does not match the verified customer email.`
      });
    } else if (allowedEmails.includes(email.toLowerCase())) {
      verifiedClaims.push(`email:${email}`);
    }
  }

  // 2. Cross-customer order ID leak check
  const allowedOrders = new Set(
    [gt.order?.id, gt.order?.orderId, ...(gt.customerOrderIds || [])]
      .filter(Boolean)
      .map((id) => String(id).replace(/^#/, "").toUpperCase())
  );
  const orderMatches = [];
  const orderRegex = /(?:order\s*(?:id|number|#)?\s*#?|#)([A-Z]{1,6}[-_]?\d{3,}|\d{4,})\b/gi;
  let om;
  while ((om = orderRegex.exec(reply)) !== null) {
    orderMatches.push(om[1].toUpperCase());
  }
  for (const ord of [...new Set(orderMatches)]) {
    if (allowedOrders.size > 0 && !allowedOrders.has(ord)) {
      violations.push({
        severity: "critical",
        rule: "cross_customer_order_leak",
        detail: `Reply references order "${ord}", which is absent from this customer's verified order IDs.`
      });
    } else if (allowedOrders.has(ord)) {
      verifiedClaims.push(`order:${ord}`);
    }
  }

  // 3. Invented promo / discount code check
  const allowedCodes = new Set((gt.allowedDiscountCodes || []).map((c) => String(c).toUpperCase()));
  const codeStopWords = new Set(["CODE", "COUPON", "PROMO", "VOUCHER", "DISCOUNT", "NONE", "HERE", "BELOW", "ONLY", "TODAY"]);
  const promoRegex = /\b(?:promo|coupon|discount|voucher)\s*(?:code)?\s*(?:is|:|\buse\b)?\s*["'`]?([A-Z0-9][A-Z0-9_-]{3,19})["'`]?/gi;
  let prm;
  while ((prm = promoRegex.exec(reply)) !== null) {
    const code = prm[1].toUpperCase();
    if (codeStopWords.has(code)) continue;
    if (!allowedCodes.has(code)) {
      violations.push({
        severity: "high",
        rule: "invented_discount_code",
        detail: `Reply offers promo code "${code}", which is not in groundTruth.allowedDiscountCodes.`
      });
    } else {
      verifiedClaims.push(`discountCode:${code}`);
    }
  }

  // 4. Monetary claim verification
  const knownAmounts = new Set();
  if (gt.order) {
    for (const k of ["total", "subtotal", "shipping", "tax", "refundAmount", "amount"]) {
      if (typeof gt.order[k] === "number") knownAmounts.add(Number(gt.order[k]).toFixed(2));
    }
    if (Array.isArray(gt.order.items)) {
      for (const it of gt.order.items) {
        if (typeof it?.price === "number") knownAmounts.add(Number(it.price).toFixed(2));
        if (typeof it?.unitPrice === "number") knownAmounts.add(Number(it.unitPrice).toFixed(2));
      }
    }
  }
  if (gt.catalogPrices && typeof gt.catalogPrices === "object") {
    for (const val of Object.values(gt.catalogPrices)) {
      if (typeof val === "number") knownAmounts.add(Number(val).toFixed(2));
    }
  }
  if (Array.isArray(gt.allowedAmounts)) {
    for (const val of gt.allowedAmounts) {
      if (typeof val === "number") knownAmounts.add(Number(val).toFixed(2));
    }
  }
  if (typeof gt.policyText === "string") {
    const policyPrices = gt.policyText.match(/\d+(?:\.\d{1,2})?/g) || [];
    for (const p of policyPrices) knownAmounts.add(Number(p).toFixed(2));
  }

  const replyMoneyRegex = /(?:[$€£]\s?(\d[\d,]*(?:\.\d{1,2})?))|(?:\b(\d[\d,]*(?:\.\d{1,2})?)\s?(?:USD|EUR|GBP)\b)/g;
  let mm;
  while ((mm = replyMoneyRegex.exec(reply)) !== null) {
    const rawNum = Number((mm[1] || mm[2]).replace(/,/g, ""));
    const normalized = rawNum.toFixed(2);
    if (knownAmounts.size > 0 && !knownAmounts.has(normalized)) {
      violations.push({
        severity: "high",
        rule: "unverified_monetary_claim",
        detail: `Reply cites monetary amount "${mm[0]}" (${normalized}), which is absent from ground-truth order/catalog/policy records.`
      });
    } else if (knownAmounts.has(normalized)) {
      verifiedClaims.push(`amount:${normalized}`);
    }
  }

  // 5. Unauthorized refund / mutation assertion check
  const refundAssertion = /\b(?:issued|processed|approved|credited)\s+(?:your\s+)?(?:full\s+)?refund\b|\brefunded\s+(?:in\s+full|to\s+your\s+card)\b/i;
  if (refundAssertion.test(reply)) {
    if (gt.verified === false || gt.order?.refundable === false || gt.allowMutations === false) {
      violations.push({
        severity: "critical",
        rule: "unauthorized_refund_commitment",
        detail: "Reply claims a refund was issued/approved despite unverified identity, non-refundable status, or read-only policy."
      });
    }
  }

  // 6. Placeholder & system-prompt leakage
  if (/\{\{[^}]+\}\}|\[INSERT[^\]]*\]|\bAs an AI language model\b/i.test(reply)) {
    violations.push({
      severity: "high",
      rule: "template_or_model_leakage",
      detail: "Reply contains unrendered template placeholders or meta-AI phrasing."
    });
  }

  if (strictStyle && /[—–]/.test(reply)) {
    violations.push({
      severity: "low",
      rule: "strict_style_dash",
      detail: "Reply contains em dash or en dash prohibited under strictStyle mode."
    });
  }

  const blocking = violations.filter((v) => v.severity === "critical" || v.severity === "high");
  const riskLevel = blocking.some((v) => v.severity === "critical")
    ? "block"
    : blocking.length > 0
      ? "review"
      : violations.length > 0
        ? "review"
        : "pass";

  return {
    safe: blocking.length === 0,
    riskLevel,
    violationCount: violations.length,
    violations,
    verifiedClaims,
    mode: "local_deterministic"
  };
}

const LANGUAGE_RULES = [
  { code: "banglish", patterns: [/\bamar\b/i, /\btaka\b/i, /\bkothay\b/i, /\bkobe\b/i, /\bekhon\b/i, /\bchai\b/i, /\bdaam\b/i, /\bkorbo\b/i] },
  { code: "hinglish", patterns: [/\bmera\b/i, /\bkahan\b/i, /\bwapas\b/i, /\bchahiye\b/i, /\bpaisa\b/i, /\bkab\b/i, /\bkaro\b/i] },
  { code: "es", patterns: [/\bquiero\b/i, /\bpedido\b/i, /\breembolso\b/i, /\bhola\b/i, /\bporfa(?:vor)?\b/i, /\bcita\b/i, /\bcancelar\b/i] },
  { code: "pt", patterns: [/\bmeu\s+pedido\b/i, /\breembolso\b/i, /\bquero\b/i, /\bagendamento\b/i, /\bol[áa]\b/i, /\bpre[çc]o\b/i] },
  { code: "fr", patterns: [/\bbonjour\b/i, /\bcommande\b/i, /\bremboursement\b/i, /\brendez[- ]vous\b/i, /\bannuler\b/i, /\badresse\b/i] },
  { code: "de", patterns: [/\bhallo\b/i, /\bbestellung\b/i, /\br[üu]ckerstattung\b/i, /\btermin\b/i, /\bstornieren\b/i, /\blieferung\b/i] },
  { code: "it", patterns: [/\bciao\b/i, /\bordine\b/i, /\brimborso\b/i, /\bappuntamento\b/i, /\bannullare\b/i] },
  { code: "nl", patterns: [/\bbestelling\b/i, /\bterugbetaling\b/i, /\bafspraak\b/i, /\bannuleren\b/i] },
  { code: "pl", patterns: [/\bzam[óo]wienie\b/i, /\bzwrot\b/i, /\bwizyta\b/i, /\banulowa[ćc]\b/i] }
];

const INTENT_RULES = [
  {
    intent: "order_status",
    mutating: false,
    requiresPrivateAuth: true,
    pattern: /\b(?:where\s+is|status|track|shipped|delivery|kothay|kahan|estado|statut|lieferstatus|rastrear)\b|\border\s*#?\w{3,}/i
  },
  {
    intent: "refund_or_return",
    mutating: true,
    requiresPrivateAuth: true,
    pattern: /\b(?:refund|return|money\s*back|reembolso|remboursement|r[üu]ckerstattung|rimborso|zwrot|wapas|ferot)\b/i
  },
  {
    intent: "cancel_order",
    mutating: true,
    requiresPrivateAuth: true,
    pattern: /\b(?:cancel(?:ar|er)?|stornieren|annullare|anulowa[ćc]|batil)\b/i
  },
  {
    intent: "address_change",
    mutating: true,
    requiresPrivateAuth: true,
    pattern: /\b(?:change|update|wrong|new)\s+(?:the\s+)?(?:shipping\s+|delivery\s+)?(?:address|adresse|direcci[óo]n|indirizzo)\b|\b(?:shipping\s+|delivery\s+)?(?:address|adresse|direcci[óo]n|indirizzo)\s+(?:change|update|correction)\b/i
  },
  {
    intent: "appointment_booking",
    mutating: true,
    requiresPrivateAuth: false,
    pattern: /\b(?:book|schedule|appointment|slot|reschedule|cita|rendez[- ]vous|termin|appuntamento|afspraak)\b/i
  },
  {
    intent: "pricing_or_product",
    mutating: false,
    requiresPrivateAuth: false,
    pattern: /\b(?:price|cost|pricing|how\s+much|koto\s+taka|daam|stock|available|pre[çc]o|prix|preis)\b/i
  },
  {
    intent: "complaint_escalation",
    mutating: false,
    requiresPrivateAuth: false,
    pattern: /\b(?:damaged|broken|wrong\s+item|manager|human|agent|supervisor|scam|unacceptable)\b/i
  }
];

/**
 * Deterministically decompose a compound or multilingual/code-switched customer message
 * into a 7-stage execution DAG (detect -> plan -> gate -> lookup -> clarify -> verify -> action).
 */
export function planMultistepInquiry(args = {}) {
  const message = typeof args.message === "string" ? args.message.trim() : "";
  if (!message) {
    throw new Error("Missing required field: message");
  }

  const hasAuthenticatedSession = Boolean(args.hasAuthenticatedSession);
  const detectedLanguages = [];

  for (const rule of LANGUAGE_RULES) {
    if (rule.patterns.some((p) => p.test(message))) {
      detectedLanguages.push(rule.code);
    }
  }
  if (/[a-zA-Z]/.test(message) && detectedLanguages.length === 0) {
    detectedLanguages.push(args.localeHint || "en");
  } else if (detectedLanguages.some((l) => l === "banglish" || l === "hinglish") || (/[a-zA-Z]/.test(message) && detectedLanguages.length > 0 && /\b(?:order|refund|price|change|please|shipped|where|my)\b/i.test(message))) {
    if (!detectedLanguages.includes("en")) detectedLanguages.push("en");
  }

  const intents = [];
  for (const rule of INTENT_RULES) {
    if (rule.pattern.test(message)) {
      intents.push({
        intent: rule.intent,
        mutating: rule.mutating,
        requiresPrivateAuth: rule.requiresPrivateAuth
      });
    }
  }
  if (intents.length === 0) {
    intents.push({ intent: "general_inquiry", mutating: false, requiresPrivateAuth: false });
  }

  const entities = {
    orderIds: [...new Set([...(message.match(/(?:#|\border\s*#?\s*)([A-Z]{1,6}[-_]?\d{3,}|\d{4,})\b/gi) || [])].map((m) => m.replace(/^(?:order\s*)?#?\s*/i, "").toUpperCase()))],
    emails: [...new Set(message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])],
    phones: [...new Set(message.match(/\+?\d[\d\s\-()]{7,}\d/g) || [])],
    monetaryValues: [...new Set(message.match(/[$€£¥]\s?\d+(?:\.\d{1,2})?/g) || [])]
  };

  const needsAuth = intents.some((i) => i.requiresPrivateAuth) && !hasAuthenticatedSession;
  const hasMutating = intents.some((i) => i.mutating);
  const missingOrderForPrivateQuery = intents.some((i) => ["order_status", "refund_or_return", "cancel_order", "address_change"].includes(i.intent)) && entities.orderIds.length === 0 && !(Array.isArray(args.knownCustomerOrderIds) && args.knownCustomerOrderIds.length > 0);

  const requiredClarifications = [];
  if (needsAuth) {
    requiredClarifications.push("Verify customer identity (signed token or email/phone match) before reading or mutating private account records.");
  }
  if (missingOrderForPrivateQuery) {
    requiredClarifications.push("Ask for the specific order number before looking up status or staging a mutation.");
  }
  if (intents.some((i) => i.intent === "cancel_order") && intents.some((i) => i.intent === "address_change")) {
    requiredClarifications.push("Customer asked about both cancelling and changing address; confirm whether to cancel OR update address before mutating.");
  }

  const stages = [
    { step: 1, stage: "detect", operation: "Detect language(s), script/code-switching, and compound sub-intents", output: { detectedLanguages, intentCount: intents.length } },
    { step: 2, stage: "plan", operation: "Order read-only lookups before any candidate mutations", dependsOn: [1] },
    { step: 3, stage: "gate", operation: needsAuth ? "Enforce customer authentication gate prior to PII/order access" : "Auth satisfied or public catalog query only", blockedUntilAuth: needsAuth, dependsOn: [2] },
    { step: 4, stage: "lookup", operation: "Fetch authoritative catalog, order, or calendar state (read-only)", dependsOn: [3] },
    { step: 5, stage: "clarify", operation: requiredClarifications.length > 0 ? "Request missing verification/disambiguation details cleanly" : "No blocking clarification needed", questions: requiredClarifications, dependsOn: [4] },
    { step: 6, stage: "verify", operation: "Run deterministic verify_reply_safety check against ground-truth state", dependsOn: [4, 5] },
    { step: 7, stage: "action", operation: hasMutating && requiredClarifications.length > 0 ? "Hold write action until customer confirms clarification and auth passes" : hasMutating ? "Execute scoped mutation after read-before-write check" : "Send verified final customer response", readBeforeWriteEnforced: true, dependsOn: [5, 6] }
  ];

  return {
    detectedLanguages,
    isCodeSwitched: detectedLanguages.length > 1 || detectedLanguages.includes("banglish") || detectedLanguages.includes("hinglish"),
    isCompoundInquiry: intents.length > 1,
    intents,
    entities,
    requiredClarifications,
    stages,
    executionPolicy: {
      readBeforeWrite: true,
      authGateRequired: needsAuth,
      preventUnrequestedActions: true
    },
    mode: "local_deterministic"
  };
}

/**
 * Exact plan catalogue aligned with OctaDezx plans.ts constants.
 */
const OCTADEZX_TIERS = [
  { name: "Starter", monthlyBase: 29, includedMessages: 2500, includedVoiceMins: 100, includedSeats: 3 },
  { name: "Pro", monthlyBase: 99, includedMessages: 10000, includedVoiceMins: 400, includedSeats: 10 },
  { name: "Advanced", monthlyBase: 199, includedMessages: 22000, includedVoiceMins: 900, includedSeats: 20 }
];

const ENTERPRISE_RATE = { minMonthly: 499, perMessage: 0.006, perVoiceMin: 0.12 };

/**
 * Deterministic TCO calculator comparing per-resolution AI pricing (Intercom Fin, Gorgias AI, Zendesk AI)
 * against OctaDezx flat-rate plans and Enterprise metered pricing.
 */
export function calculateSupportTco(args = {}) {
  const monthlyTickets = Number(args.monthlyTickets);
  if (!Number.isFinite(monthlyTickets) || monthlyTickets < 0) {
    throw new Error("Missing or invalid numeric field: monthlyTickets");
  }

  const aiResolutionRate = args.aiResolutionRate !== undefined ? Number(args.aiResolutionRate) : 0.65;
  const avgMessagesPerTicket = args.avgMessagesPerTicket !== undefined ? Number(args.avgMessagesPerTicket) : 4;
  const monthlyVoiceMinutes = args.monthlyVoiceMinutes !== undefined ? Number(args.monthlyVoiceMinutes) : 0;
  const teamSeats = args.teamSeats !== undefined ? Number(args.teamSeats) : 3;

  const resolvedByAi = Math.round(monthlyTickets * Math.min(1, Math.max(0, aiResolutionRate)));
  const totalMessages = Math.round(monthlyTickets * avgMessagesPerTicket);

  const eligibleTier = OCTADEZX_TIERS.find(
    (t) => totalMessages <= t.includedMessages && monthlyVoiceMinutes <= t.includedVoiceMins && teamSeats <= t.includedSeats
  );
  const enterpriseCost = Number(
    Math.max(ENTERPRISE_RATE.minMonthly, totalMessages * ENTERPRISE_RATE.perMessage + monthlyVoiceMinutes * ENTERPRISE_RATE.perVoiceMin).toFixed(2)
  );
  const octadezxMonthly = eligibleTier ? eligibleTier.monthlyBase : enterpriseCost;
  const octadezxPlanName = eligibleTier ? `OctaDezx ${eligibleTier.name}` : "OctaDezx Enterprise (Metered)";

  const intercomPerResolution = args.intercomPerResolutionUsd !== undefined ? Number(args.intercomPerResolutionUsd) : 0.99;
  const intercomSeatUsd = args.intercomSeatUsd !== undefined ? Number(args.intercomSeatUsd) : 29;
  const intercomMonthly = Number((teamSeats * intercomSeatUsd + resolvedByAi * intercomPerResolution).toFixed(2));

  const gorgiasPerAutomated = args.gorgiasPerAutomatedUsd !== undefined ? Number(args.gorgiasPerAutomatedUsd) : 0.95;
  const gorgiasBase = args.gorgiasBaseMonthlyUsd !== undefined ? Number(args.gorgiasBaseMonthlyUsd) : 60;
  const gorgiasMonthly = Number((gorgiasBase + resolvedByAi * gorgiasPerAutomated).toFixed(2));

  const zendeskSeatUsd = args.zendeskSeatUsd !== undefined ? Number(args.zendeskSeatUsd) : 55;
  const zendeskAutoResUsd = args.zendeskAutomatedResolutionUsd !== undefined ? Number(args.zendeskAutomatedResolutionUsd) : 1.50;
  const zendeskMonthly = Number((teamSeats * zendeskSeatUsd + resolvedByAi * zendeskAutoResUsd).toFixed(2));

  const formatVendor = (monthly) => ({
    monthlyUsd: monthly,
    annualUsd: Number((monthly * 12).toFixed(2)),
    effectiveCostPerTicketUsd: monthlyTickets > 0 ? Number((monthly / monthlyTickets).toFixed(4)) : 0,
    annualSavingsWithOctaDezxUsd: Number(((monthly - octadezxMonthly) * 12).toFixed(2))
  });

  return {
    assumptions: {
      monthlyTickets,
      aiResolutionRate,
      resolvedByAiPerMonth: resolvedByAi,
      avgMessagesPerTicket,
      estimatedMonthlyAiMessages: totalMessages,
      monthlyVoiceMinutes,
      teamSeats
    },
    recommendedPlan: octadezxPlanName,
    octadezx: {
      plan: octadezxPlanName,
      monthlyUsd: octadezxMonthly,
      annualUsd: Number((octadezxMonthly * 12).toFixed(2)),
      resolutionFeeUsd: 0,
      effectiveCostPerTicketUsd: monthlyTickets > 0 ? Number((octadezxMonthly / monthlyTickets).toFixed(4)) : 0
    },
    competitors: {
      intercomFin: formatVendor(intercomMonthly),
      gorgiasAi: formatVendor(gorgiasMonthly),
      zendeskAi: formatVendor(zendeskMonthly)
    },
    mode: "local_deterministic"
  };
}
