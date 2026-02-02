# Claim - Clanker Token Fees

## Overview

A Farcaster mini app for claiming accumulated creator fees from Clanker tokens on the Base blockchain. Users can connect their Farcaster wallet, view tokens with claimable fees, and execute real onchain claim transactions. The app displays fee amounts in both ETH and USD and maintains a local transaction history.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state, React useState for local state
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Build Tool**: Vite with React plugin
- **Contract Interaction**: viem for encoding transaction data

### Backend Architecture
- **Runtime**: Node.js with Express 5
- **Language**: TypeScript (ESM modules)
- **API Pattern**: REST endpoints under `/api/*` prefix
- **Development**: Vite dev server with HMR proxied through Express

### Data Layer
- **ORM**: Drizzle ORM configured for PostgreSQL
- **Schema**: Defined in `shared/schema.ts` using Zod for validation
- **Current State**: Real data from Clanker API and smart contracts (no mock data)
- **Session Storage**: connect-pg-simple available for PostgreSQL session storage

### Key Design Decisions
1. **Shared Schema**: Types defined once in `shared/` directory and imported by both client and server
2. **Clanker API Integration**: Fetches real tokens from Clanker public API (clanker.world/api/search-creator)
3. **Local Transaction History**: Transactions stored in browser localStorage, only appended on confirmed onchain transactions
4. **Real Onchain Claims**: Uses ClankerFeeLocker contract for actual claim execution
5. **Farcaster Frame Integration**: Uses @farcaster/frame-sdk for wallet connection and transaction signing

### Clanker Integration
- **Token Fetch**: GET https://clanker.world/api/search-creator?q={walletAddress}&limit=50&offset={offset}
- **Parallel Pagination**: Fetches 5 pages in parallel after first page
- **Multicall**: Uses Multicall3 to batch 500+ fee reads into single RPC call
- **Performance**: 400+ tokens load in ~2-5 seconds instead of 30+
- **ClankerFeeLocker Contract**: 0xF3622742b1E446D92e45E22923Ef11C2fcD55D68 (Base mainnet)
- **Read Method**: `availableFees(feeOwner, token)` returns claimable fees in wei
- **Claim Method**: `claim(feeOwner, token)` executes onchain claim
- **WETH Address**: 0x4200000000000000000000000000000000000006 (Base WETH)
- **USD Conversion**: Real ETH price from CoinGecko API, cached for 60 seconds, fallback to $3200

### Claiming Logic
- **Total Claimable**: Single source of truth - wallet-level aggregation of availableFees across all pools
- **Batch Claim**: Uses Multicall3 aggregate3 to claim all tokens in ONE transaction
- **Transaction Flow**: Single tx → wait for confirmation → poll until zero fees → update history

### Balance Refresh System
- **Single Authoritative Function**: `refreshClaimableRewards()` handles all refresh scenarios
- **Used Everywhere**: App load, wallet connect, post-claim - same function, same logic
- **Options**:
  - `forceRefresh`: bypasses server cache (60s TTL) for fresh blockchain data
  - `pollForZero`: polls until fees show zero (for post-claim RPC propagation delay)
  - `maxRetries`: polling attempts (default 6)
  - `intervalMs`: delay between polls (default 2500ms)
- **Server Cache Bypass**: `?refresh=true` param clears server cache for wallet
- **Concurrent Call Guard**: refreshLockRef prevents multiple simultaneous refreshes
- **State Clearing**: Clears previous fee state before any refresh to avoid stale UI
- **Refreshing State**: Shows "Refreshing balances..." and disables claim button during refresh
- **Error Handling**: User rejection, transaction revert, and timeout all handled with clear error messages

### Reward Structure
- **Multi-Asset Rewards**: Each reward asset tracked separately with address, symbol, decimals, amount
- **TokensResponse**: API returns `{ tokens: Token[], totalClaimable: { rewards: RewardAsset[], tokenAddresses } }`
- **RewardAsset**: `{ address, symbol, decimals, amount (wei string), formattedAmount }`
- **tokenAddresses**: Only addresses with fees > 0 (used for claiming, prevents NoFeesToClaim revert)
- **Display**: Rewards shown as list by asset (e.g., "0.0121 WETH", "1,081,810.31 RELAY")
- **No USD Conversion**: Amounts displayed in native token units only
- **Claim All Only**: No single-token claim buttons - only "Claim All Fees" button

### Transaction History
- **Storage**: Browser localStorage with key "claim-transaction-history"
- **Entry Requirements**: Only appended after transaction is confirmed onchain
- **Entry Contents**: type (single/batch), amountEth, amountUsd, tokensClaimed array, timestamp, txHash
- **BaseScan Links**: Each entry links to transaction on basescan.org

### Project Structure
```
├── client/           # React frontend
│   └── src/
│       ├── components/  # UI components including shadcn/ui
│       ├── pages/       # Route pages
│       ├── hooks/       # Custom React hooks (useFarcaster)
│       └── lib/         # Utilities, query client, contracts.ts
├── server/           # Express backend
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API route definitions
│   ├── clanker.ts    # Clanker API integration
│   └── contracts.ts  # Contract interaction utilities
├── shared/           # Shared types and schemas
└── migrations/       # Drizzle database migrations
```

## External Dependencies

### Database
- **PostgreSQL**: Configured via `DATABASE_URL` environment variable
- **Drizzle Kit**: For database migrations (`npm run db:push`)

### Blockchain
- **viem**: Ethereum library for contract encoding and RPC calls
- **@farcaster/frame-sdk**: Farcaster Frame SDK for wallet connection and signing

### UI Libraries
- **Radix UI**: Full suite of accessible component primitives
- **Lucide React**: Icon library
- **react-icons**: Social icons (Farcaster logo)

### Development Tools
- **Vite**: Build and dev server
- **esbuild**: Production server bundling
- **Replit plugins**: Dev banner, cartographer, runtime error overlay

### Validation
- **Zod**: Schema validation
- **drizzle-zod**: Zod schema generation from Drizzle schemas
- **React Hook Form**: Form handling with Zod resolver
