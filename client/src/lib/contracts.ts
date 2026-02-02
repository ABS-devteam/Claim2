import { encodeFunctionData, type Hex } from "viem";

export const CLANKER_FEE_LOCKER_ADDRESS = "0xF3622742b1E446D92e45E22923Ef11C2fcD55D68" as const;
export const WETH_ADDRESS = "0x4200000000000000000000000000000000000006" as const;
export const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;
export const BASE_CHAIN_ID = 8453;

const FEE_LOCKER_ABI = [
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

const MULTICALL3_ABI = [
  {
    name: "aggregate3",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "allowFailure", type: "bool" },
          { name: "callData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      {
        name: "returnData",
        type: "tuple[]",
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" },
        ],
      },
    ],
  },
] as const;

export function encodeClaimCall(feeOwner: string, tokenAddress: string): Hex {
  return encodeFunctionData({
    abi: FEE_LOCKER_ABI,
    functionName: "claim",
    args: [feeOwner as `0x${string}`, tokenAddress as `0x${string}`],
  });
}

export function encodeClaimWethCall(feeOwner: string): Hex {
  return encodeFunctionData({
    abi: FEE_LOCKER_ABI,
    functionName: "claim",
    args: [feeOwner as `0x${string}`, WETH_ADDRESS],
  });
}

export interface ClaimTransaction {
  to: `0x${string}`;
  data: `0x${string}`;
  value: `0x${string}`;
  chainId: `0x${string}`;
}

export function buildClaimTransaction(feeOwner: string, tokenAddress: string): ClaimTransaction {
  return {
    to: CLANKER_FEE_LOCKER_ADDRESS,
    data: encodeClaimCall(feeOwner, tokenAddress),
    value: "0x0",
    chainId: `0x${BASE_CHAIN_ID.toString(16)}` as `0x${string}`,
  };
}

export function buildClaimWethTransaction(feeOwner: string): ClaimTransaction {
  return {
    to: CLANKER_FEE_LOCKER_ADDRESS,
    data: encodeClaimWethCall(feeOwner),
    value: "0x0",
    chainId: `0x${BASE_CHAIN_ID.toString(16)}` as `0x${string}`,
  };
}

export function buildBatchClaimTransaction(feeOwner: string, tokenAddresses: string[]): ClaimTransaction {
  const calls = tokenAddresses.map((tokenAddress) => ({
    target: CLANKER_FEE_LOCKER_ADDRESS as `0x${string}`,
    allowFailure: true,
    callData: encodeClaimCall(feeOwner, tokenAddress),
  }));

  const data = encodeFunctionData({
    abi: MULTICALL3_ABI,
    functionName: "aggregate3",
    args: [calls],
  });

  return {
    to: MULTICALL3_ADDRESS,
    data,
    value: "0x0",
    chainId: `0x${BASE_CHAIN_ID.toString(16)}` as `0x${string}`,
  };
}
