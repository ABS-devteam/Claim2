import { createPublicClient, http, formatUnits, encodeFunctionData } from "viem";
import { base } from "viem/chains";
import type { RewardAsset } from "@shared/schema";

const CLANKER_FEE_LOCKER_ADDRESS = "0xf3622742b1e446d92e45e22923ef11c2fcd55d68" as const;
const WETH_ADDRESS = "0x4200000000000000000000000000000000000006" as const;
const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;

const FEE_LOCKER_ABI = [
  {
    name: "availableFees",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "feeOwner", type: "address" },
      { name: "token", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "claim",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "feeOwner", type: "address" },
      { name: "token", type: "address" },
    ],
    outputs: [],
  },
] as const;

const ERC20_ABI = [
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

const publicClient = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

const tokenMetadataCache = new Map<string, { symbol: string; decimals: number }>();

async function getTokenMetadata(address: string): Promise<{ symbol: string; decimals: number }> {
  const cached = tokenMetadataCache.get(address.toLowerCase());
  if (cached) return cached;
  
  if (address.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
    const metadata = { symbol: "WETH", decimals: 18 };
    tokenMetadataCache.set(address.toLowerCase(), metadata);
    return metadata;
  }
  
  try {
    const [symbol, decimals] = await Promise.all([
      publicClient.readContract({
        address: address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "symbol",
      }),
      publicClient.readContract({
        address: address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "decimals",
      }),
    ]);
    
    const metadata = { symbol: symbol as string, decimals: Number(decimals) };
    tokenMetadataCache.set(address.toLowerCase(), metadata);
    return metadata;
  } catch (error) {
    console.error(`[DEBUG] Failed to fetch metadata for ${address}:`, error);
    return { symbol: address.slice(0, 8), decimals: 18 };
  }
}

export interface TotalClaimable {
  rewards: RewardAsset[];
  tokenAddresses: string[];
}

const MULTICALL_BATCH_SIZE = 500;

async function getFeesForAddressesMulticall(
  feeOwner: string,
  tokenAddresses: string[]
): Promise<Map<string, bigint>> {
  const results = new Map<string, bigint>();
  
  if (tokenAddresses.length === 0) {
    return results;
  }

  console.log(`[DEBUG] Using multicall for ${tokenAddresses.length} addresses`);

  const contracts = tokenAddresses.map((tokenAddress) => ({
    address: CLANKER_FEE_LOCKER_ADDRESS,
    abi: FEE_LOCKER_ABI,
    functionName: "availableFees" as const,
    args: [feeOwner as `0x${string}`, tokenAddress as `0x${string}`],
  }));

  try {
    const multicallResults = await publicClient.multicall({
      contracts,
      allowFailure: true,
    });

    for (let i = 0; i < multicallResults.length; i++) {
      const result = multicallResults[i];
      const tokenAddress = tokenAddresses[i];
      
      if (result.status === "success") {
        results.set(tokenAddress, result.result as bigint);
      } else {
        console.error(`[DEBUG] Multicall failed for ${tokenAddress}:`, result.error);
        results.set(tokenAddress, BigInt(0));
      }
    }
  } catch (error) {
    console.error("[DEBUG] Multicall batch failed:", error);
    for (const addr of tokenAddresses) {
      results.set(addr, BigInt(0));
    }
  }

  return results;
}

function formatTokenAmount(amount: bigint, decimals: number): string {
  const formatted = formatUnits(amount, decimals);
  const num = parseFloat(formatted);
  
  if (num === 0) return "0";
  if (num < 0.0001) return num.toExponential(4);
  if (num < 1) return num.toFixed(6);
  if (num < 1000) return num.toFixed(4);
  
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(num);
}

export async function getTotalClaimable(
  feeOwner: string,
  tokenAddresses: string[]
): Promise<TotalClaimable> {
  const allAddresses = [...tokenAddresses, WETH_ADDRESS];
  
  console.log(`[DEBUG] Computing total claimable for ${allAddresses.length} addresses using multicall`);
  const startTime = Date.now();
  
  const feesPerAddress = new Map<string, bigint>();
  const addressesWithFees: string[] = [];
  
  for (let i = 0; i < allAddresses.length; i += MULTICALL_BATCH_SIZE) {
    const batch = allAddresses.slice(i, i + MULTICALL_BATCH_SIZE);
    console.log(`[DEBUG] Multicall batch ${Math.floor(i / MULTICALL_BATCH_SIZE) + 1}: ${batch.length} addresses`);
    
    const batchResults = await getFeesForAddressesMulticall(feeOwner, batch);
    
    batchResults.forEach((fees, address) => {
      if (fees > BigInt(0)) {
        feesPerAddress.set(address, fees);
        addressesWithFees.push(address);
      }
    });
  }

  const rewards: RewardAsset[] = [];
  
  for (const address of addressesWithFees) {
    const amount = feesPerAddress.get(address)!;
    const metadata = await getTokenMetadata(address);
    
    rewards.push({
      address,
      symbol: metadata.symbol,
      decimals: metadata.decimals,
      amount: amount.toString(),
      formattedAmount: formatTokenAmount(amount, metadata.decimals),
    });
  }

  const elapsed = Date.now() - startTime;
  console.log(`[DEBUG] Total claimable: ${rewards.length} assets from ${addressesWithFees.length} sources (${elapsed}ms)`);

  return {
    rewards,
    tokenAddresses: addressesWithFees,
  };
}

export function getClaimCalldata(feeOwner: string, tokenAddress: string): {
  to: string;
  data: string;
  functionName: string;
  args: [string, string];
} {
  return {
    to: CLANKER_FEE_LOCKER_ADDRESS,
    functionName: "claim",
    args: [feeOwner, tokenAddress],
    data: "",
  };
}

export function getClaimWethCalldata(feeOwner: string): {
  to: string;
  data: string;
  functionName: string;
  args: [string, string];
} {
  return {
    to: CLANKER_FEE_LOCKER_ADDRESS,
    functionName: "claim",
    args: [feeOwner, WETH_ADDRESS],
    data: "",
  };
}

export { CLANKER_FEE_LOCKER_ADDRESS, WETH_ADDRESS, FEE_LOCKER_ABI };
