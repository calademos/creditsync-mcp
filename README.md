# CreditSync MCP Server

MCP server for connecting Claude Desktop to your [CreditSync](https://www.creditsync.pro) account. Track credit card benefits, monitor ROI, and optimize your card portfolio through natural conversation.

Requires a CreditSync Pro subscription.

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

## Configuration

| Environment Variable | Required | Description |
|---------------------|----------|-------------|
| `CREDITSYNC_API_KEY` | Yes | Your CreditSync API key (starts with `cs_`) |
| `CREDITSYNC_API_URL` | No | API base URL (defaults to `https://www.creditsync.pro`) |

## Tools (27)

### Benefits
| Tool | Description |
|------|-------------|
| `list_benefits` | List all tracked benefits with status, amounts, expiry dates |
| `get_benefit` | Get detailed info for a specific benefit with all periods |
| `mark_benefit_used` | Mark a benefit as used, partial, or unused |
| `create_benefit` | Add a new benefit to a card with auto-generated periods |
| `update_benefit` | Update benefit details (name, amount, category, status) |
| `archive_benefit` | Archive a benefit (soft delete, preserves history) |

### Cards
| Tool | Description |
|------|-------------|
| `list_cards` | List all cards with fees, renewal months, benefit counts |
| `get_card` | Full card picture: benefits, ROI, renewal, value at risk |
| `create_card` | Add a card by name (fuzzy match) or exact template ID |
| `archive_card` | Deactivate a card (soft delete, preserves history) |
| `update_card` | Update metadata: notes, open date, product change, 5/24 status |
| `search_catalog` | Search card catalog by issuer or name |

### Dashboard & Actions
| Tool | Description |
|------|-------------|
| `get_dashboard` | Dashboard metrics: expiring, captured, available, ROI |
| `get_action_items` | Prioritized action items: expiring, missed, renewals, negative ROI |
| `get_calendar_events` | Structured calendar events for deadlines, resets, fees |
| `get_best_card` | Wallet optimizer: best card for a spend category |

### Loyalty Programs
| Tool | Description |
|------|-------------|
| `list_programs` | List loyalty programs with balances, CPP, staleness |
| `update_balance` | Set or adjust a loyalty program balance |
| `get_transfer_partners` | Transfer partners for a currency with ratios |
| `get_earn_rates` | Earning rates for a card: bonus categories, multipliers, caps |

### Welcome Offers
| Tool | Description |
|------|-------------|
| `create_welcome_offer` | Record a welcome offer with bonus, spend, and deadline |
| `update_welcome_offer` | Update spend progress or status |
| `list_welcome_offers` | List offers with spend progress and deadline urgency |

### Retention & 5/24
| Tool | Description |
|------|-------------|
| `log_retention_offer` | Log retention offer interactions for strategy history |
| `get_524_status` | Compute Chase 5/24 eligibility |
| `add_external_card` | Add a non-catalog card for 5/24 tracking |
| `remove_external_card` | Remove an external card from 5/24 tracking |

## Examples

Ask Claude:
- "What benefits are expiring this week?"
- "Show me my dashboard"
- "Mark my Uber Cash as used"
- "Should I keep my Amex Gold? Show me the ROI."
- "What card should I use for dining?"
- "How many MR points do I have?"
- "Can I transfer MR to Virgin Atlantic?"
- "I just got approved for the CSR with 60K UR after $4K spend in 3 months"
- "Am I eligible for a new Chase card?"
- "Add the Oura Ring credit to my Platinum"

## Build with CreditSync

CreditSync MCP provides the data. You decide what to do with it.

The API is read/write, so your AI assistant can both query your benefit data and act on it. Example workflows:

- **Morning brief bot** — Pull expiring benefits and dashboard metrics, deliver a daily summary via Slack or email
- **Automated mark-as-used** — After your AI confirms a qualifying purchase, mark the credit as used
- **Pre-trip checklist** — Flag unused travel credits and expiring certificates across all cards
- **Card renewal advisor** — When a fee posts, pull ROI data and recommend keep, cancel, or retention call
- **Multi-card spend router** — Combine benefit data with spending context to pick the optimal card

The MCP server runs locally on your machine. Any tool your AI has access to can be combined with CreditSync data to create custom workflows.

## Development

```bash
npm install
npm run build
npm start
```

## License

MIT
