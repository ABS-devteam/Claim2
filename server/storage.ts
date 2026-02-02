import type { Token, Wallet } from "@shared/schema";

function generateTxHash(): string {
  const chars = "0123456789abcdef";
  let hash = "0x";
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

export interface IStorage {
  connectWallet(): Wallet;
  getTokens(): Token[];
  getGasEstimate(): { gasSavingsPercent: number };
  claimSingle(tokenId: string): { success: boolean; txHash: string };
  claimAll(tokenIds: string[]): { success: boolean; txHash: string; gasSavingsPercent: number };
}

export class MemStorage implements IStorage {
  private tokens: Token[];
  private wallet: Wallet | null;

  constructor() {
    this.tokens = [];
    this.wallet = null;
  }

  connectWallet(): Wallet {
    this.wallet = {
      address: "0x" + Math.random().toString(16).slice(2, 10) + "..." + Math.random().toString(16).slice(2, 6),
      isConnected: true,
      balance: parseFloat((Math.random() * 5 + 0.5).toFixed(4)),
    };
    const fullAddress = "0x" + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join("");
    this.wallet.address = fullAddress;
    return this.wallet;
  }

  getTokens(): Token[] {
    return this.tokens;
  }

  getGasEstimate(): { gasSavingsPercent: number } {
    const tokenCount = this.tokens.filter(t => t.feesEth > 0).length;
    const baseSavings = Math.min(15 + tokenCount * 8, 65);
    return { gasSavingsPercent: baseSavings };
  }

  claimSingle(tokenId: string): { success: boolean; txHash: string } {
    const tokenIndex = this.tokens.findIndex(t => t.id === tokenId);
    if (tokenIndex !== -1) {
      this.tokens[tokenIndex] = {
        ...this.tokens[tokenIndex],
        feesEth: 0,
        feesUsd: 0,
      };
    }
    return {
      success: true,
      txHash: generateTxHash(),
    };
  }

  claimAll(tokenIds: string[]): { success: boolean; txHash: string; gasSavingsPercent: number } {
    const claimableCount = tokenIds.length;
    tokenIds.forEach(tokenId => {
      const tokenIndex = this.tokens.findIndex(t => t.id === tokenId);
      if (tokenIndex !== -1) {
        this.tokens[tokenIndex] = {
          ...this.tokens[tokenIndex],
          feesEth: 0,
          feesUsd: 0,
        };
      }
    });
    
    const gasSavingsPercent = Math.min(15 + claimableCount * 8, 65);
    
    return {
      success: true,
      txHash: generateTxHash(),
      gasSavingsPercent,
    };
  }
}

export const storage = new MemStorage();
