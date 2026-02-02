import { z } from "zod";

export const tokenSchema = z.object({
  id: z.string(),
  name: z.string(),
  symbol: z.string(),
  contractAddress: z.string(),
  createdAt: z.string(),
  iconColor: z.string(),
  imageUrl: z.string().optional(),
  marketCap: z.number().optional(),
  price: z.number().optional(),
  isTrusted: z.boolean().optional(),
});

export const rewardAssetSchema = z.object({
  address: z.string(),
  symbol: z.string(),
  decimals: z.number(),
  amount: z.string(),
  formattedAmount: z.string(),
});

export type RewardAsset = z.infer<typeof rewardAssetSchema>;

export const tokensResponseSchema = z.object({
  tokens: z.array(tokenSchema),
  totalClaimable: z.object({
    rewards: z.array(rewardAssetSchema),
    tokenAddresses: z.array(z.string()),
  }),
});

export type TokensResponse = z.infer<typeof tokensResponseSchema>;

export const clankerTokenResponseSchema = z.object({
  contract_address: z.string(),
  name: z.string(),
  symbol: z.string(),
  img_url: z.string().optional().nullable(),
  chain_id: z.number(),
  deployed_at: z.string().optional(),
  created_at: z.string().optional(),
  msg_sender: z.string(),
  related: z.object({
    market: z.object({
      marketCap: z.number().optional(),
      price: z.number().optional(),
    }).optional(),
  }).optional(),
  trustStatus: z.object({
    isTrustedDeployer: z.boolean(),
    isTrustedClanker: z.boolean(),
    fidMatchesDeployer: z.boolean(),
  }).optional(),
});

export const clankerApiResponseSchema = z.object({
  tokens: z.array(clankerTokenResponseSchema),
  total: z.number(),
  hasMore: z.boolean(),
});

export type ClankerToken = z.infer<typeof clankerTokenResponseSchema>;
export type ClankerApiResponse = z.infer<typeof clankerApiResponseSchema>;

export const transactionSchema = z.object({
  id: z.string(),
  type: z.enum(["batch", "single"]),
  rewards: z.array(rewardAssetSchema).optional(),
  amountEth: z.number().optional(),
  amountUsd: z.number().optional(),
  tokensClaimed: z.array(z.string()),
  poolAddresses: z.array(z.string()).optional(),
  timestamp: z.string(),
  txHash: z.string(),
});

export const walletSchema = z.object({
  address: z.string(),
  isConnected: z.boolean(),
  balance: z.number(),
});

export type Token = z.infer<typeof tokenSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Wallet = z.infer<typeof walletSchema>;

export const users = null;
export const insertUserSchema = z.object({
  username: z.string(),
  password: z.string(),
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = { id: string; username: string; password: string };
