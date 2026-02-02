import { useEffect, useState, useCallback } from "react";
import sdk from "@farcaster/frame-sdk";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import type { Wallet } from "@shared/schema";

const basePublicClient = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

function getEthereumProvider() {
  try {
    if (sdk.wallet && sdk.wallet.ethProvider) {
      return sdk.wallet.ethProvider;
    }
  } catch {
    // SDK wallet not available
  }
  return null;
}

type FarcasterContext = Awaited<typeof sdk.context>;

interface FarcasterState {
  isSDKLoaded: boolean;
  isInFrame: boolean;
  context: FarcasterContext | null;
  wallet: Wallet | null;
  isConnecting: boolean;
  error: string | null;
}

export interface TransactionResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export function useFarcaster() {
  const [state, setState] = useState<FarcasterState>({
    isSDKLoaded: false,
    isInFrame: false,
    context: null,
    wallet: null,
    isConnecting: false,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    const initializeSDK = async () => {
      try {
        const context = await sdk.context;
        
        if (!mounted) return;

        if (context) {
          await sdk.actions.ready();
          
          setState({
            isSDKLoaded: true,
            isInFrame: true,
            context,
            wallet: null,
            isConnecting: false,
            error: null,
          });
        } else {
          setState({
            isSDKLoaded: true,
            isInFrame: false,
            context: null,
            wallet: null,
            isConnecting: false,
            error: null,
          });
        }
      } catch (error) {
        if (!mounted) return;
        
        setState({
          isSDKLoaded: true,
          isInFrame: false,
          context: null,
          wallet: null,
          isConnecting: false,
          error: error instanceof Error ? error.message : "Failed to initialize Farcaster SDK",
        });
      }
    };

    initializeSDK();

    return () => {
      mounted = false;
    };
  }, []);

  const connectWallet = useCallback(async () => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    if (state.isInFrame) {
      try {
        const provider = getEthereumProvider();
        if (provider && typeof provider.request === 'function') {
          const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
          if (accounts && accounts.length > 0) {
            const wallet: Wallet = {
              address: accounts[0],
              isConnected: true,
              balance: 0,
            };
            setState(prev => ({ ...prev, wallet, isConnecting: false }));
            return wallet;
          }
        }
        const errorMsg = "Farcaster wallet not available";
        setState(prev => ({ 
          ...prev, 
          isConnecting: false,
          error: errorMsg
        }));
        return { error: errorMsg };
      } catch (error) {
        console.error("Failed to connect Farcaster wallet:", error);
        const errorMsg = error instanceof Error ? error.message : "Failed to connect wallet";
        setState(prev => ({ 
          ...prev, 
          isConnecting: false,
          error: errorMsg
        }));
        return { error: errorMsg };
      }
    }

    try {
      const response = await fetch('/api/wallet/connect', { method: 'POST' });
      const data = await response.json();
      setState(prev => ({
        ...prev,
        wallet: data,
        isConnecting: false,
      }));
      return data;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: "Failed to connect wallet",
      }));
      return null;
    }
  }, [state.isInFrame]);

  const disconnectWallet = useCallback(() => {
    setState(prev => ({ ...prev, wallet: null }));
  }, []);

  const sendTransaction = useCallback(async (params: {
    to: `0x${string}`;
    data: `0x${string}`;
    value?: `0x${string}`;
    chainId?: `0x${string}`;
  }): Promise<TransactionResult> => {
    if (!state.isInFrame || !state.wallet) {
      return { 
        success: false, 
        error: "Wallet not connected or not in Farcaster frame" 
      };
    }

    try {
      const provider = getEthereumProvider();
      if (!provider || typeof provider.request !== 'function') {
        return { success: false, error: "Ethereum provider not available" };
      }

      const currentChainId = await provider.request({ method: 'eth_chainId' }) as string;
      const baseChainId = '0x2105';
      
      if (currentChainId !== baseChainId) {
        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: baseChainId }],
          });
        } catch (switchError) {
          return { 
            success: false, 
            error: "Please switch to Base network to claim rewards" 
          };
        }
      }

      console.log("[DEBUG] Sending transaction via eth_sendTransaction...");
      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: state.wallet.address as `0x${string}`,
          to: params.to,
          data: params.data,
          value: params.value || '0x0',
          chainId: baseChainId,
        }],
      }) as string;

      console.log("[DEBUG] Transaction hash returned:", txHash);
      return { success: true, txHash };
    } catch (error) {
      console.error("Transaction failed:", error);
      
      let errorMessage = "Transaction failed";
      if (error instanceof Error) {
        if (error.message.includes("rejected") || error.message.includes("denied") || error.message.includes("cancelled")) {
          errorMessage = "Transaction rejected by user";
        } else if (error.message.includes("revert")) {
          errorMessage = error.message;
        } else {
          errorMessage = error.message;
        }
      }
      
      return { success: false, error: errorMessage };
    }
  }, [state.isInFrame, state.wallet]);

  const waitForTransaction = useCallback(async (txHash: string): Promise<boolean> => {
    console.log("[DEBUG] waitForTransaction called with hash:", txHash);
    
    if (!state.isInFrame) {
      console.log("[DEBUG] Not in frame, skipping waitForTransaction");
      return false;
    }

    try {
      console.log("[DEBUG] Awaiting transaction receipt from Base public client...");
      const receipt = await basePublicClient.waitForTransactionReceipt({
        hash: txHash as `0x${string}`,
        confirmations: 1,
        timeout: 120_000,
      });
      
      console.log("[DEBUG] Transaction receipt received:", {
        status: receipt.status,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        transactionHash: receipt.transactionHash,
      });
      
      const success = receipt.status === 'success';
      console.log("[DEBUG] Transaction confirmed, success:", success);
      return success;
    } catch (error) {
      console.error("[DEBUG] waitForTransactionReceipt error:", error);
      return false;
    }
  }, [state.isInFrame]);

  return {
    ...state,
    connectWallet,
    disconnectWallet,
    sendTransaction,
    waitForTransaction,
  };
}
