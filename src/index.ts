#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CreditSyncClient } from "./api-client.js";

const apiKey = process.env.CREDITSYNC_API_KEY;
if (!apiKey) {
  console.error("CREDITSYNC_API_KEY environment variable is required");
  process.exit(1);
}

const baseUrl = process.env.CREDITSYNC_API_URL ?? "https://www.creditsync.pro";
const client = new CreditSyncClient(apiKey, baseUrl);

const server = new McpServer({
  name: "creditsync",
  version: "1.0.0",
});

// ─── list_benefits ─────────────────────────────────

server.tool(
  "list_benefits",
  "List all tracked credit card benefits with current period status, amounts, and expiry dates. This includes statement credits, free night certificates, companion certs, lounge passes, and all other card-linked benefits. For standalone items NOT tied to a card (gift cards, vouchers, travel credits), use list_rewards instead. Filter by status (unused/partial/used), card nickname, or expiring within N days.",
  {
    status: z.enum(["unused", "partial", "used"]).optional().describe("Filter by usage status"),
    card: z.string().optional().describe("Filter by card nickname (partial match)"),
    expiring_within_days: z.number().int().positive().optional().describe("Only return benefits expiring within this many days"),
  },
  async ({ status, card, expiring_within_days }) => {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (card) params.card = card;
    if (expiring_within_days) params.expiring_within_days = String(expiring_within_days);

    const data = await client.get("/api/v1/benefits", params);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── get_benefit ───────────────────────────────────

server.tool(
  "get_benefit",
  "Get detailed information about a specific benefit including all historical periods.",
  {
    id: z.string().describe("The benefit ID from list_benefits"),
  },
  async ({ id }) => {
    const data = await client.get(`/api/v1/benefits/${id}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── get_card ──────────────────────────────────────

server.tool(
  "get_card",
  "Get a single card's complete picture: all benefits with current period status, captured vs annual fee ROI, renewal timeline, and total value at risk. Use card_id from list_cards.",
  {
    card_id: z.string().describe("The card ID from list_cards"),
  },
  async ({ card_id }) => {
    const data = await client.get(`/api/v1/cards/${card_id}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── mark_benefit_used ─────────────────────────────

server.tool(
  "mark_benefit_used",
  "Mark a benefit period as used, partially used, or unused. Use the period_id from list_benefits or get_benefit.",
  {
    period_id: z.string().describe("The period ID to update"),
    status: z.enum(["unused", "partial", "used"]).describe("New usage status"),
    amount_used: z.number().positive().optional().describe("Dollar amount used (required for partial status)"),
    notes: z.string().optional().describe("Optional note about usage"),
  },
  async ({ period_id, status, amount_used, notes }) => {
    const body: Record<string, unknown> = { usageStatus: status };
    if (amount_used !== undefined) body.usedAmount = amount_used;
    if (notes !== undefined) body.notes = notes;

    const data = await client.patch(`/api/v1/benefits/${period_id}/use`, body);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── get_dashboard ─────────────────────────────────

server.tool(
  "get_dashboard",
  "Get dashboard metrics: benefits expiring in 30 days, captured this month, total available, and net ROI value (captured vs annual fees).",
  {},
  async () => {
    const data = await client.get("/api/v1/dashboard");
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── list_cards ────────────────────────────────────

server.tool(
  "list_cards",
  "List all credit cards with issuer, annual fee, renewal month, owner, last 4 digits, and benefit count. Use last_four to match cards against external sources (statements, Gmail, Plaid).",
  {},
  async () => {
    const data = await client.get("/api/v1/cards");
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── get_action_items ──────────────────────────────

server.tool(
  "get_action_items",
  "Get prioritized action items ranked by value at risk. Includes expiring benefits, missed prior period credits, upcoming fee renewals, and negative ROI cards. Use action_types to control what's included.",
  {
    days_ahead: z.number().int().positive().optional().describe("Look-ahead window for expiring benefits (default 14)"),
    action_types: z.array(z.enum(["expiring", "unused_prior_period", "renewal_approaching", "negative_roi", "welcome_offer_at_risk"])).optional().describe("Types to include (default: ['expiring']). Options: expiring, unused_prior_period, renewal_approaching, negative_roi, welcome_offer_at_risk"),
  },
  async ({ days_ahead, action_types }) => {
    const params: Record<string, string> = {};
    if (days_ahead) params.days_ahead = String(days_ahead);
    if (action_types) params.action_types = action_types.join(",");

    const data = await client.get("/api/v1/action-items", params);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── get_calendar_events ───────────────────────────

server.tool(
  "get_calendar_events",
  "Get benefit deadlines, credit resets, fee renewals, and expiry windows as structured calendar-ready event objects. Use this to intelligently create, skip, or customize calendar reminders based on the user's actual schedule.",
  {
    start_date: z.string().optional().describe("Start of date range in YYYY-MM-DD format (default: today)"),
    end_date: z.string().optional().describe("End of date range in YYYY-MM-DD format (default: start_date + 30 days)"),
    event_types: z.array(z.enum(["expiry", "credit_reset", "annual_fee_due", "benefit_available", "welcome_offer_deadline"])).optional().describe("Filter by event type (default: all types)"),
    card: z.string().optional().describe("Filter by card nickname (partial match)"),
    include_used: z.boolean().optional().describe("Include events for benefits already marked used (default: false)"),
  },
  async ({ start_date, end_date, event_types, card, include_used }) => {
    const params: Record<string, string> = {};
    if (start_date) params.start_date = start_date;
    if (end_date) params.end_date = end_date;
    if (event_types) params.event_types = event_types.join(",");
    if (card) params.card = card;
    if (include_used) params.include_used = "true";

    const data = await client.get("/api/v1/calendar-events", params);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── search_catalog ────────────────────────────────

server.tool(
  "search_catalog",
  "Search the CreditSync card catalog by issuer or card name. Returns matching templates with IDs, fees, and benefit counts. Use this to find card_template_id for create_card.",
  {
    query: z.string().describe("Search term — issuer, card name, or both (e.g., 'hilton aspire', 'amex')"),
  },
  async ({ query }) => {
    const data = await client.get("/api/v1/catalog", { q: query });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── create_card ───────────────────────────────────

server.tool(
  "create_card",
  "Add a new credit card to the household portfolio. Accepts a card name (fuzzy match) or exact card_template_id from search_catalog. If multiple cards match the name, returns candidates to choose from — call again with the confirmed card_template_id.",
  {
    name: z.string().optional().describe("Card name to fuzzy match (e.g., 'Amex Gold'). Required unless card_template_id is provided."),
    card_template_id: z.string().optional().describe("Exact template ID from search_catalog (bypasses fuzzy match)"),
    owner: z.string().describe("Owner profile name (must match an existing profile, e.g., 'Matt')"),
    nickname: z.string().optional().describe("Last 4 digits or identifier to distinguish duplicate cards"),
    fee_month: z.number().int().min(1).max(12).optional().describe("Month annual fee posts (1-12)"),
  },
  async ({ name, card_template_id, owner, nickname, fee_month }) => {
    const body: Record<string, unknown> = { owner };
    if (name) body.name = name;
    if (card_template_id) body.card_template_id = card_template_id;
    if (nickname) body.nickname = nickname;
    if (fee_month) body.fee_month = fee_month;

    const data = await client.post("/api/v1/cards", body);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── archive_card ──────────────────────────────────

server.tool(
  "archive_card",
  "Deactivate a credit card (soft delete). Benefits and usage history are preserved but the card stops appearing in active views. Use card_id from list_cards.",
  {
    card_id: z.string().describe("The card ID to archive"),
  },
  async ({ card_id }) => {
    const data = await client.delete(`/api/v1/cards/${card_id}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── list_programs ─────────────────────────────────

server.tool(
  "list_programs",
  "List all tracked loyalty programs with current balances, CPP valuations, staleness, linked cards, and transfer partner counts. Use stale_days to find programs needing a balance update.",
  {
    stale_days: z.number().int().positive().optional().describe("Only return programs not updated in N days"),
    owner: z.string().optional().describe("Filter by owner name"),
  },
  async ({ stale_days, owner }) => {
    const params: Record<string, string> = {};
    if (stale_days) params.stale_days = String(stale_days);
    if (owner) params.owner = owner;

    const data = await client.get("/api/v1/programs", params);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── update_balance ────────────────────────────────

server.tool(
  "update_balance",
  "Update a loyalty program balance. Supports absolute set or relative delta. Auto-creates the program if it doesn't exist (requires display_name on first call).",
  {
    program_key: z.string().describe("Program key (e.g., 'amex_mr', 'aa_advantage', 'hilton_honors')"),
    balance: z.number().int().optional().describe("Set absolute balance"),
    delta: z.number().int().optional().describe("Relative change (e.g., +12500 or -88000)"),
    display_name: z.string().optional().describe("Program display name (required when creating a new program)"),
    program_type: z.enum(["bank", "airline", "hotel"]).optional().describe("Program type"),
    currency: z.enum(["points", "miles"]).optional().describe("Currency type"),
    cpp_valuation: z.number().positive().optional().describe("Default cents-per-point valuation"),
    owner: z.string().optional().describe("Owner name"),
    notes: z.string().optional().describe("Freeform notes"),
  },
  async ({ program_key, balance, delta, display_name, program_type, currency, cpp_valuation, owner, notes }) => {
    const body: Record<string, unknown> = { program_key };
    if (balance !== undefined) body.balance = balance;
    if (delta !== undefined) body.delta = delta;
    if (display_name) body.display_name = display_name;
    if (program_type) body.program_type = program_type;
    if (currency) body.currency = currency;
    if (cpp_valuation) body.cpp_valuation = cpp_valuation;
    if (owner) body.owner = owner;
    if (notes) body.notes = notes;

    const data = await client.post("/api/v1/programs", body);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── get_transfer_partners ─────────────────────────

server.tool(
  "get_transfer_partners",
  "Get all transfer partners for a loyalty currency with transfer ratios. Returns the static partner map — no active bonus data. Use to check if a specific airline/hotel program is reachable from a bank currency.",
  {
    source: z.string().describe("Source program key (e.g., 'amex_mr', 'chase_ur', 'citi_typ')"),
  },
  async ({ source }) => {
    const data = await client.get("/api/v1/programs/transfer-partners", { source });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── get_earn_rates ────────────────────────────────

server.tool(
  "get_earn_rates",
  "Get earning rates for a specific card. Returns all bonus categories with multipliers, currencies, caps, channel requirements, and CPP-based dollar value per dollar spent.",
  {
    card_id: z.string().optional().describe("User's card ID (looks up template)"),
    card_template_id: z.string().optional().describe("Catalog template ID directly"),
  },
  async ({ card_id, card_template_id }) => {
    const params: Record<string, string> = {};
    if (card_id) params.card_id = card_id;
    if (card_template_id) params.card_template_id = card_template_id;

    const data = await client.get("/api/v1/earn-rates", params);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── get_best_card ─────────────────────────────────

server.tool(
  "get_best_card",
  "Given a spend category, return the best card in the user's portfolio ranked by effective value per dollar spent. Uses stored CPP valuations by default. Accept cpp_override to adjust valuations for specific redemptions.",
  {
    category: z.string().describe("Spend category: dining, groceries, gas, travel, flights, hotels, transit, streaming, online_shopping, base"),
    amount: z.number().positive().optional().describe("Purchase amount in dollars for points-earned calculation"),
    owner: z.string().optional().describe("Filter to specific owner"),
    channel: z.enum(["direct", "portal", "any"]).optional().describe("Filter by booking channel (default: any)"),
    cpp_override: z.string().optional().describe("CPP overrides as 'currency:value' pairs, comma-separated (e.g., 'amex_mr:2.5,chase_ur:2.0')"),
    include_sub_priority: z.boolean().optional().describe("Boost cards with active welcome offers (default: true). Set false for steady-state ranking without SUB influence."),
  },
  async ({ category, amount, owner, channel, cpp_override, include_sub_priority }) => {
    const params: Record<string, string> = { category };
    if (amount) params.amount = String(amount);
    if (owner) params.owner = owner;
    if (channel) params.channel = channel;
    if (cpp_override) params.cpp_override = cpp_override;
    if (include_sub_priority === false) params.include_sub_priority = "false";

    const data = await client.get("/api/v1/best-card", params);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── update_card ───────────────────────────────────

server.tool(
  "update_card",
  "Update card metadata: nickname, notes, original open date, product change history, business flag, 5/24 status, last four digits. All changes are audit-logged. Notes are appended with timestamp, never replaced.",
  {
    card_id: z.string().describe("The card ID to update"),
    nickname: z.string().optional().describe("Update card nickname"),
    notes: z.string().optional().describe("Add a note (appended with timestamp, never replaces existing)"),
    original_open_date: z.string().optional().describe("Original account open date in YYYY-MM-DD format"),
    product_changed_from: z.string().optional().describe("What card this was before a product change (e.g., 'Chase Sapphire Preferred')"),
    is_business: z.boolean().optional().describe("Is this a business card?"),
    counts_toward_524: z.boolean().optional().describe("Does this card count toward Chase 5/24?"),
    last_four: z.string().optional().describe("Last 4 digits of card number (exactly 4 digits)"),
    fee_month: z.number().int().min(1).max(12).optional().describe("Month annual fee posts (1-12)"),
  },
  async ({ card_id, nickname, notes, original_open_date, product_changed_from, is_business, counts_toward_524, last_four, fee_month }) => {
    const body: Record<string, unknown> = {};
    if (nickname !== undefined) body.nickname = nickname;
    if (notes !== undefined) body.notes = notes;
    if (original_open_date !== undefined) body.original_open_date = original_open_date;
    if (product_changed_from !== undefined) body.product_changed_from = product_changed_from;
    if (is_business !== undefined) body.is_business = is_business;
    if (counts_toward_524 !== undefined) body.counts_toward_524 = counts_toward_524;
    if (last_four !== undefined) body.last_four = last_four;
    if (fee_month !== undefined) body.fee_month = fee_month;

    const data = await client.patch(`/api/v1/cards/${card_id}`, body);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── log_retention_offer ───────────────────────────

server.tool(
  "log_retention_offer",
  "Log a retention offer interaction on a card. Builds historical dataset for retention strategy. The offer history is visible in get_card response.",
  {
    card_id: z.string().describe("The card ID"),
    offer: z.string().describe("Description of the offer (e.g., '40K MR after $3K spend')"),
    accepted: z.boolean().describe("Whether the offer was accepted"),
    date: z.string().optional().describe("Date of the interaction in YYYY-MM-DD (default: today)"),
    notes: z.string().optional().describe("Additional context"),
  },
  async ({ card_id, offer, accepted, date, notes }) => {
    const body: Record<string, unknown> = {
      retention_offer: { offer, accepted },
    };
    if (date) (body.retention_offer as Record<string, unknown>).date = date;
    if (notes) (body.retention_offer as Record<string, unknown>).notes = notes;

    const data = await client.patch(`/api/v1/cards/${card_id}`, body);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── create_welcome_offer ──────────────────────────

server.tool(
  "create_welcome_offer",
  "Record a welcome offer on a card. Tracks bonus amount, spend requirement, deadline, and progress. The agent must explicitly set status to 'earned' after confirming the bonus posted — no auto-earn.",
  {
    card_id: z.string().describe("The card this offer belongs to"),
    bonus_amount: z.number().int().positive().describe("Points/miles/dollars earned (e.g., 80000)"),
    bonus_currency: z.string().describe("Program key (e.g., 'amex_mr', 'aa_aadvantage', 'cashback')"),
    spend_requirement: z.number().positive().describe("Dollar amount that must be spent"),
    spend_deadline: z.string().describe("ISO date by which spend must be completed (YYYY-MM-DD)"),
    current_spend: z.number().optional().describe("Spend already applied (default 0)"),
    notes: z.string().optional().describe("Context (e.g., 'referral link', 'elevated offer')"),
  },
  async ({ card_id, bonus_amount, bonus_currency, spend_requirement, spend_deadline, current_spend, notes }) => {
    const body: Record<string, unknown> = {
      card_id, bonus_amount, bonus_currency, spend_requirement, spend_deadline,
    };
    if (current_spend !== undefined) body.current_spend = current_spend;
    if (notes) body.notes = notes;

    const data = await client.post("/api/v1/welcome-offers", body);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── update_welcome_offer ──────────────────────────

server.tool(
  "update_welcome_offer",
  "Update spend progress or status on a welcome offer. Supports absolute spend or delta. Set status to 'earned' only after confirming the bonus actually posted.",
  {
    card_id: z.string().describe("Card ID with the active offer"),
    current_spend: z.number().optional().describe("Set absolute spend amount"),
    spend_delta: z.number().optional().describe("Relative change (e.g., +450)"),
    status: z.enum(["earned", "missed", "cancelled"]).optional().describe("Update status"),
    notes: z.string().optional().describe("Additional context"),
  },
  async ({ card_id, current_spend, spend_delta, status, notes }) => {
    const body: Record<string, unknown> = {};
    if (current_spend !== undefined) body.current_spend = current_spend;
    if (spend_delta !== undefined) body.spend_delta = spend_delta;
    if (status) body.status = status;
    if (notes) body.notes = notes;

    const data = await client.patch(`/api/v1/welcome-offers/${card_id}`, body);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── list_welcome_offers ───────────────────────────

server.tool(
  "list_welcome_offers",
  "List all welcome offers with spend progress, deadline urgency, and bonus valuations. Filter by status or deadline window.",
  {
    status: z.enum(["in_progress", "earned", "missed", "all"]).optional().describe("Filter by status (default: in_progress)"),
    owner: z.string().optional().describe("Filter by owner name"),
    expiring_within_days: z.number().int().positive().optional().describe("Only offers with deadlines within N days"),
  },
  async ({ status, owner, expiring_within_days }) => {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (owner) params.owner = owner;
    if (expiring_within_days) params.expiring_within_days = String(expiring_within_days);

    const data = await client.get("/api/v1/welcome-offers", params);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── create_benefit ────────────────────────────────

server.tool(
  "create_benefit",
  "Add a new benefit to a card. Generates periods automatically based on schedule_type. For mid-year additions or perks not yet in the catalog.",
  {
    card_id: z.string().describe("The card this benefit belongs to"),
    credit_name: z.string().describe("Benefit name (e.g., 'Oura Ring credit')"),
    amount: z.number().describe("Dollar value per period"),
    unit: z.enum(["dollars", "points", "nights"]).optional().describe("Benefit unit (default: dollars)"),
    schedule_type: z.enum(["monthly", "quarterly", "semiannual", "annual_calendar", "annual_cardmember", "one_time"]).describe("Reset schedule"),
    category: z.string().optional().describe("Category: travel, dining, fitness, shopping, etc. (default: other)"),
    notes: z.string().optional().describe("Additional context"),
  },
  async ({ card_id, credit_name, amount, unit, schedule_type, category, notes }) => {
    const body: Record<string, unknown> = { card_id, credit_name, amount, schedule_type };
    if (unit) body.unit = unit;
    if (category) body.category = category;
    if (notes) body.notes = notes;

    const data = await client.post("/api/v1/benefits", body);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── update_benefit ────────────────────────────────

server.tool(
  "update_benefit",
  "Update a benefit's details. Audit-logged. Amount changes affect future periods only. Use status 'discontinued' to archive a removed perk.",
  {
    benefit_id: z.string().describe("The benefit ID to update"),
    credit_name: z.string().optional().describe("Update benefit name"),
    amount: z.number().optional().describe("Update amount (future periods only)"),
    category: z.string().optional().describe("Update category"),
    notes: z.string().optional().describe("Add a note (appended with timestamp)"),
    status: z.enum(["active", "discontinued"]).optional().describe("Set to 'discontinued' to archive"),
  },
  async ({ benefit_id, credit_name, amount, category, notes, status }) => {
    const body: Record<string, unknown> = {};
    if (credit_name !== undefined) body.credit_name = credit_name;
    if (amount !== undefined) body.amount = amount;
    if (category !== undefined) body.category = category;
    if (notes !== undefined) body.notes = notes;
    if (status !== undefined) body.status = status;

    const data = await client.patch(`/api/v1/benefits/${benefit_id}`, body);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── archive_benefit ────────────────────────────────

server.tool(
  "archive_benefit",
  "Archive (soft delete) a benefit. Sets status to 'discontinued'. Historical periods and usage data are preserved. The benefit stops appearing in active views. Use update_benefit with status='active' to restore.",
  {
    benefit_id: z.string().describe("Benefit ID to archive"),
  },
  async ({ benefit_id }) => {
    const data = await client.patch(`/api/v1/benefits/${benefit_id}`, { status: "discontinued" });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── add_external_card ────────────────────────────────

server.tool(
  "add_external_card",
  "Add a card that is NOT in the CreditSync catalog for application eligibility tracking (Chase 5/24, Amex 2/90). Use this for cards the user holds that CreditSync does not track benefits for (e.g., store cards, non-premium cards). Business cards are automatically excluded from Chase 5/24 count but still tracked for reference. Always set is_business correctly — it affects eligibility calculations.",
  {
    card_name: z.string().describe("Card name (e.g., 'Chase Amazon Visa', 'Apple Card')"),
    open_date: z.string().describe("Date the card was opened, YYYY-MM-DD format"),
    is_business: z.boolean().optional().describe("Whether this is a business card (default false). Business cards do NOT count toward Chase 5/24."),
    owner: z.string().optional().describe("Cardholder name"),
    notes: z.string().optional().describe("Optional notes"),
  },
  async ({ card_name, open_date, is_business, owner, notes }) => {
    const data = await client.post("/api/v1/external-cards", {
      card_name,
      open_date,
      is_business: is_business ?? false,
      owner,
      notes,
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── remove_external_card ────────────────────────────────

server.tool(
  "remove_external_card",
  "Remove an external card from 5/24 tracking. Use when a card is closed or was added by mistake. Only affects external cards — CreditSync-tracked cards are managed via archive_card.",
  {
    card_id: z.string().describe("External card ID to remove"),
  },
  async ({ card_id }) => {
    const data = await client.delete(`/api/v1/external-cards/${card_id}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── get_524_status ────────────────────────────────

server.tool(
  "get_524_status",
  "Compute Chase 5/24 eligibility. Returns current count, slots available, which cards count (including external cards not tracked in CreditSync), when the next slot opens, and data quality warnings.",
  {
    owner: z.string().optional().describe("Filter by cardholder name"),
  },
  async ({ owner }) => {
    const params: Record<string, string> = {};
    if (owner) params.owner = owner;

    const data = await client.get("/api/v1/524-status", params);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── list_rewards ─────────────────────────────────

server.tool(
  "list_rewards",
  "List standalone rewards NOT tied to a card — gift cards, travel vouchers, airline credits, coupons, and other items the user added manually. These are separate from card-linked benefits (use list_benefits for free night certificates, companion certs, statement credits, and other benefits that come from a card). Filter by type or status.",
  {
    status: z.enum(["active", "used", "expired", "all"]).optional().describe("Filter by status (default: active)"),
    type: z.string().optional().describe("Filter by type: gift_card, travel_credit, voucher, lounge_pass, free_night, companion_cert, milestone, coupon, other"),
    expiring_within_days: z.number().int().positive().optional().describe("Only return rewards expiring within this many days"),
  },
  async ({ status, type, expiring_within_days }) => {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (type) params.type = type;
    if (expiring_within_days) params.expiring_within_days = String(expiring_within_days);

    const data = await client.get("/api/v1/rewards", params);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── add_reward ───────────────────────────────────

server.tool(
  "add_reward",
  "Track a standalone reward NOT tied to a card — gift cards, travel vouchers, airline credits, coupons, retention offers. Use this for items the user received outside the card benefit system (e.g., AA flight credit from a cancellation, hotel gift card from a retention call). Do NOT use this for benefits that come from a card (free nights, statement credits) — those are already tracked via list_benefits. Do not store card numbers, PINs, or redemption codes. Items with expiration dates automatically appear in the calendar feed.",
  {
    name: z.string().describe("Reward name (e.g., 'Hilton $50 gift card', 'AA travel voucher')"),
    type: z.enum(["gift_card", "travel_credit", "voucher", "lounge_pass", "free_night", "companion_cert", "milestone", "coupon", "other"]).optional().describe("Reward type (default: other)"),
    value: z.number().optional().describe("Dollar value if applicable"),
    currency: z.string().optional().describe("Currency type (default: dollars)"),
    expiration_date: z.string().optional().describe("Expiration date in YYYY-MM-DD format. Generates calendar reminders at 90, 30, 7 days before and on expiration day."),
    source: z.string().optional().describe("Where the reward came from (e.g., 'retention call', 'welcome bonus', 'amex offer')"),
    notes: z.string().optional().describe("Additional notes. Do NOT store card numbers or PINs."),
    owner: z.string().optional().describe("Owner name"),
  },
  async ({ name, type, value, currency, expiration_date, source, notes, owner }) => {
    const body: Record<string, unknown> = { name };
    if (type) body.type = type;
    if (value !== undefined) body.value = value;
    if (currency) body.currency = currency;
    if (expiration_date) body.expiration_date = expiration_date;
    if (source) body.source = source;
    if (notes) body.notes = notes;
    if (owner) body.owner = owner;

    const data = await client.post("/api/v1/rewards", body);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── update_reward ────────────────────────────────

server.tool(
  "update_reward",
  "Update a reward's details or mark it as used. Set status to 'used' when the reward has been redeemed.",
  {
    reward_id: z.string().describe("The reward ID to update"),
    name: z.string().optional().describe("Update reward name"),
    type: z.string().optional().describe("Update type"),
    value: z.number().optional().describe("Update dollar value"),
    expiration_date: z.string().optional().describe("Update expiration date (YYYY-MM-DD)"),
    source: z.string().optional().describe("Update source"),
    notes: z.string().optional().describe("Update notes"),
    status: z.enum(["active", "used", "expired"]).optional().describe("Set status — use 'used' when redeemed"),
  },
  async ({ reward_id, name, type, value, expiration_date, source, notes, status }) => {
    const body: Record<string, unknown> = {};
    if (name !== undefined) body.name = name;
    if (type !== undefined) body.type = type;
    if (value !== undefined) body.value = value;
    if (expiration_date !== undefined) body.expiration_date = expiration_date;
    if (source !== undefined) body.source = source;
    if (notes !== undefined) body.notes = notes;
    if (status !== undefined) body.status = status;

    const data = await client.patch(`/api/v1/rewards/${reward_id}`, body);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── remove_reward ────────────────────────────────

server.tool(
  "remove_reward",
  "Delete a reward permanently. Use when the reward was added by mistake or is no longer relevant.",
  {
    reward_id: z.string().describe("The reward ID to remove"),
  },
  async ({ reward_id }) => {
    const data = await client.delete(`/api/v1/rewards/${reward_id}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ─── Start server ──────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server error:", err);
  process.exit(1);
});
