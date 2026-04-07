# CreditSync MCP Server

MCP server for connecting Claude Desktop to your CreditSync account. Requires a CreditSync Pro subscription.

## Setup

1. In CreditSync, go to **Settings > API** and create an API key
2. Copy the key (it's only shown once)
3. Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "creditsync": {
      "command": "npx",
      "args": ["@creditsync-pro/mcp"],
      "env": {
        "CREDITSYNC_API_KEY": "cs_your_key_here"
      }
    }
  }
}
```

4. Restart Claude Desktop

## Tools

| Tool | Description |
|------|-------------|
| `list_benefits` | List card-linked benefits (statement credits, free nights, companion certs, lounge passes). For standalone items, use `list_rewards` |
| `get_benefit` | Get detailed info for a specific benefit with all periods |
| `mark_benefit_used` | Mark a benefit as used, partial, or unused |
| `get_dashboard` | Dashboard metrics: expiring, captured, available, ROI |
| `list_cards` | List all cards with issuer, issuing_bank, fees, renewal months, last 4 digits, benefit counts |
| `get_card` | Get a single card's full picture: benefits, ROI, renewal, value at risk |
| `get_action_items` | Prioritized action items: expiring, missed, renewals, negative ROI |
| `get_calendar_events` | Structured calendar events for deadlines, resets, fees, availability |
| `search_catalog` | Search card catalog by issuer or name to find template IDs |
| `create_card` | Add a card to portfolio by name (fuzzy) or exact template ID |
| `archive_card` | Deactivate a card (soft delete, preserves history) |
| `list_programs` | List loyalty programs with balances, CPP valuations, staleness |
| `update_balance` | Set or adjust a loyalty program balance (absolute or delta) |
| `get_transfer_partners` | Get transfer partners for a currency with ratios |
| `get_earn_rates` | Earning rates for a card: bonus categories, multipliers, caps |
| `get_best_card` | Wallet optimizer: best card for a spend category ranked by value |
| `update_card` | Update card metadata: notes, open date, product change, 5/24 status |
| `log_retention_offer` | Log retention offer interactions for strategy history |
| `create_welcome_offer` | Record a welcome offer with bonus, spend requirement, and deadline |
| `update_welcome_offer` | Update spend progress or status on a welcome offer |
| `list_welcome_offers` | List welcome offers with spend progress and deadline urgency |
| `create_benefit` | Add a new benefit to a card with auto-generated periods |
| `update_benefit` | Update benefit details (name, amount, category, status) |
| `get_524_status` | Compute Chase 5/24 eligibility from card metadata + external cards |
| `archive_benefit` | Archive a benefit (soft delete, preserves history) |
| `add_external_card` | Add a non-catalog card for 5/24 tracking |
| `remove_external_card` | Remove an external card from 5/24 tracking |
| `list_rewards` | List standalone rewards NOT tied to a card (gift cards, vouchers, airline credits). Separate from card-linked `list_benefits` |
| `add_reward` | Track a standalone reward (not from a card). No card numbers or PINs — existence only |
| `update_reward` | Update reward details or mark as used |
| `remove_reward` | Delete a reward permanently |

## Examples

Ask Claude:
- "What benefits are expiring this week?"
- "Show me my dashboard"
- "Mark my Uber Cash as used"
- "What cards do I have and when do their fees post?"
- "Should I keep my Amex Gold? Show me the ROI."
- "What do I need to act on this week?"
- "Did I miss any credits last month?"
- "What benefit deadlines do I have in April?"
- "How many MR points do I have?"
- "Can I transfer MR to Virgin Atlantic?"
- "Update my AAdvantage balance to 385,000 miles"
- "What card should I use for dining?"
- "Show me the earn rates on my Amex Gold"
- "I just product-changed my Sapphire Preferred to a Freedom Unlimited"
- "Log that I declined the Amex Gold retention offer of $150 credit"
- "I just got approved for the CSR with 60K UR after $4K spend in 3 months"
- "How much more do I need to spend on my new card?"
- "Add the Oura Ring credit to my Platinum"
- "Am I eligible for a new Chase card?"
- "Add the Hilton Aspire card to my portfolio"
- "Search the catalog for Chase cards"
- "I also have a Chase Amazon Visa I opened in March 2024 — add it for 5/24"
- "Remove the Oura Ring credit from my Platinum, I made a mistake"
- "I got a $50 Hilton gift card from my retention call — track it, expires December 2027"
- "Show me all my gift cards and vouchers"
- "Mark the AA travel voucher as used"

## Build with CreditSync

CreditSync MCP provides the data. You decide what to do with it.

The API is read/write, so your AI assistant can both query your benefit data and act on it. This makes it a building block for workflows that go far beyond simple lookups:

- **Morning brief bot** — Pull expiring benefits and dashboard metrics, format a daily summary, deliver via Telegram, Slack, or email
- **Automated mark-as-used** — After your AI confirms a qualifying purchase, mark the credit as used without opening CreditSync
- **Pre-trip checklist** — Before a trip, flag unused travel credits, expiring certificates, and airline fee credits across all your cards
- **Card renewal advisor** — When a fee month approaches, pull the card's ROI data and recommend keep, cancel, or call for retention
- **Multi-card spend router** — Combine CreditSync benefit data with your own spending context to decide which card to use for a purchase

The MCP server runs locally on your machine. Any tool your AI has access to (HTTP APIs, local scripts, messaging platforms) can be combined with CreditSync data to create custom workflows.
