import type { Token, TokensResponse, ClankerApiResponse, ClankerToken } from "@shared/schema";
import { getTotalClaimable } from "./contracts";

const CLANKER_API_BASE = "https://clanker.world/api";
const PAGE_SIZE = 50;
const SAFETY_MAX_PAGES = 100;

const ICON_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e",
];

function getIconColor(address: string): string {
  const hash = address.split("").reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  return ICON_COLORS[Math.abs(hash) % ICON_COLORS.length];
}

function transformClankerToken(clankerToken: ClankerToken): Token {
  const marketCap = clankerToken.related?.market?.marketCap;
  const isTrusted = clankerToken.trustStatus?.isTrustedDeployer || 
                    clankerToken.trustStatus?.isTrustedClanker ||
                    clankerToken.trustStatus?.fidMatchesDeployer || false;

  return {
    id: clankerToken.contract_address,
    name: clankerToken.name,
    symbol: clankerToken.symbol,
    contractAddress: clankerToken.contract_address,
    createdAt: clankerToken.deployed_at || clankerToken.created_at || new Date().toISOString(),
    iconColor: getIconColor(clankerToken.contract_address),
    imageUrl: clankerToken.img_url || undefined,
    marketCap: marketCap,
    price: clankerToken.related?.market?.price,
    isTrusted,
  };
}

async function fetchTokenPage(walletAddress: string, page: number): Promise<{ tokens: ClankerToken[]; hasMore: boolean }> {
  const offset = page * PAGE_SIZE;
  const url = `${CLANKER_API_BASE}/search-creator?q=${encodeURIComponent(walletAddress)}&limit=${PAGE_SIZE}&offset=${offset}&sort=desc`;
  
  console.log(`[DEBUG] Fetching token page ${page + 1}, offset=${offset}`);
  
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "ClaimApp/1.0",
    },
  });

  if (!response.ok) {
    console.error(`Clanker API error: ${response.status} ${response.statusText}`);
    return { tokens: [], hasMore: false };
  }

  const data = await response.json() as ClankerApiResponse;
  
  if (!data.tokens || !Array.isArray(data.tokens)) {
    return { tokens: [], hasMore: false };
  }

  const hasMore = data.tokens.length === PAGE_SIZE;
  console.log(`[DEBUG] Page ${page + 1}: fetched ${data.tokens.length} tokens, hasMore=${hasMore}`);
  
  return { tokens: data.tokens, hasMore };
}

const PARALLEL_PAGES = 5;

async function fetchAllTokens(walletAddress: string): Promise<ClankerToken[]> {
  const allTokens: ClankerToken[] = [];
  const startTime = Date.now();
  
  const firstPage = await fetchTokenPage(walletAddress, 0);
  allTokens.push(...firstPage.tokens);
  
  if (!firstPage.hasMore || firstPage.tokens.length === 0) {
    console.log(`[DEBUG] Total tokens fetched: ${allTokens.length} in ${Date.now() - startTime}ms`);
    return allTokens;
  }
  
  let currentPage = 1;
  let shouldContinue = true;
  
  while (shouldContinue && currentPage < SAFETY_MAX_PAGES) {
    const pagesToFetch = Math.min(PARALLEL_PAGES, SAFETY_MAX_PAGES - currentPage);
    const pagePromises = [];
    
    for (let i = 0; i < pagesToFetch; i++) {
      pagePromises.push(fetchTokenPage(walletAddress, currentPage + i));
    }
    
    console.log(`[DEBUG] Fetching pages ${currentPage + 1} to ${currentPage + pagesToFetch} in parallel`);
    const results = await Promise.all(pagePromises);
    
    for (const result of results) {
      allTokens.push(...result.tokens);
    }
    
    const lastResult = results[results.length - 1];
    const anyEmpty = results.some(r => r.tokens.length === 0);
    const anyHasNoMore = results.some(r => !r.hasMore);
    
    if (anyEmpty || anyHasNoMore) {
      shouldContinue = false;
    } else {
      currentPage += pagesToFetch;
    }
  }

  console.log(`[DEBUG] Total tokens fetched: ${allTokens.length} in ${Date.now() - startTime}ms`);
  return allTokens;
}

export async function fetchTokensByCreator(walletAddress: string): Promise<TokensResponse> {
  try {
    console.log(`[DEBUG] Starting token fetch for wallet: ${walletAddress}`);
    
    const clankerTokens = await fetchAllTokens(walletAddress);
    
    if (clankerTokens.length === 0) {
      console.log(`[DEBUG] No tokens found for wallet`);
      return { tokens: [], totalClaimable: { rewards: [], tokenAddresses: [] } };
    }

    const tokens = clankerTokens.map(transformClankerToken);
    const tokenAddresses = tokens.map(t => t.contractAddress);
    
    console.log(`[DEBUG] Fetching claimable fees for ${tokenAddresses.length} tokens + WETH`);
    
    const totalClaimable = await getTotalClaimable(walletAddress, tokenAddresses);

    console.log(`[DEBUG] Total claimable: ${totalClaimable.rewards.length} assets`);

    return {
      tokens,
      totalClaimable: {
        rewards: totalClaimable.rewards,
        tokenAddresses: totalClaimable.tokenAddresses,
      },
    };
  } catch (error) {
    console.error("Failed to fetch tokens from Clanker:", error);
    return { tokens: [], totalClaimable: { rewards: [], tokenAddresses: [] } };
  }
}
