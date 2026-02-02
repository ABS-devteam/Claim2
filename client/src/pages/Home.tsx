import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/WalletConnect";
import { TokenGrid } from "@/components/TokenCard";
import { ClaimAllButton } from "@/components/ClaimAllButton";
import { TransactionHistory } from "@/components/TransactionHistory";
import { WalletAddressDisplay } from "@/components/WalletAddressDisplay";
import { useFarcaster } from "@/hooks/use-farcaster";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SiFarcaster } from "react-icons/si";
import { buildBatchClaimTransaction, WETH_ADDRESS } from "@/lib/contracts";
import type { Transaction, TokensResponse } from "@shared/schema";

const STORAGE_KEY = "claim-transaction-history";

function loadTransactionsFromStorage(): Transaction[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Failed to load transactions from storage:", e);
  }
  return [];
}

function saveTransactionsToStorage(transactions: Transaction[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (e) {
    console.error("Failed to save transactions to storage:", e);
  }
}

export default function Home() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { 
    wallet, 
    isConnecting, 
    isInFrame, 
    isSDKLoaded, 
    context, 
    connectWallet, 
    disconnectWallet,
    sendTransaction,
    waitForTransaction,
  } = useFarcaster();
  
  const [transactions, setTransactions] = useState<Transaction[]>(() => loadTransactionsFromStorage());
  const [isClaiming, setIsClaiming] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const refreshLockRef = useRef(false);

  useEffect(() => {
    saveTransactionsToStorage(transactions);
  }, [transactions]);

  const { 
    data: tokensData, 
    isLoading: isLoadingTokens, 
    isError: isTokensError,
  } = useQuery<TokensResponse>({
    queryKey: ['/api/tokens', wallet?.address],
    queryFn: async () => {
      const url = wallet?.address 
        ? `/api/tokens?wallet=${encodeURIComponent(wallet.address)}`
        : '/api/tokens';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch tokens');
      return response.json();
    },
    enabled: wallet?.isConnected ?? false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const tokens = tokensData?.tokens ?? [];
  const totalClaimable = tokensData?.totalClaimable ?? { rewards: [], tokenAddresses: [] };

  /**
   * SINGLE AUTHORITATIVE REFRESH FUNCTION
   * Used for: app load, wallet connect, and post-claim refresh
   * 
   * @param forceRefresh - bypass server cache (use after claims)
   * @param pollForZero - poll until fees show zero (use after claims)
   */
  const refreshClaimableRewards = useCallback(async (options: {
    forceRefresh?: boolean;
    pollForZero?: boolean;
    maxRetries?: number;
    intervalMs?: number;
  } = {}): Promise<TokensResponse | null> => {
    const { forceRefresh = false, pollForZero = false, maxRetries = 6, intervalMs = 2500 } = options;
    
    if (!wallet?.address) return null;
    
    // Guard against concurrent refresh calls
    if (refreshLockRef.current) {
      console.log("[DEBUG] Refresh already in progress, skipping");
      return null;
    }
    
    refreshLockRef.current = true;
    setIsRefreshing(true);
    
    // Clear previous state before refresh
    queryClient.setQueryData(['/api/tokens', wallet.address], undefined);
    
    console.log("[DEBUG] Starting refreshClaimableRewards", { forceRefresh, pollForZero });
    
    try {
      let lastResult: TokensResponse | null = null;
      const attempts = pollForZero ? maxRetries : 1;
      
      for (let attempt = 1; attempt <= attempts; attempt++) {
        if (pollForZero) {
          console.log(`[DEBUG] Poll attempt ${attempt}/${attempts}`);
        }
        
        // Fetch fresh data from server (bypass cache if forceRefresh)
        const refreshParam = forceRefresh ? '&refresh=true' : '';
        const url = `/api/tokens?wallet=${encodeURIComponent(wallet.address)}${refreshParam}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch tokens');
        const data = await response.json() as TokensResponse;
        
        // Update React Query cache
        queryClient.setQueryData(['/api/tokens', wallet.address], data);
        lastResult = data;
        
        console.log("[DEBUG] Refresh result:", {
          tokens: data.tokens?.length ?? 0,
          rewards: data.totalClaimable.rewards.length,
        });
        
        // If polling, check if fees are zero
        if (pollForZero) {
          const remainingRewards = data.totalClaimable.rewards.length;
          
          if (remainingRewards === 0) {
            console.log("[DEBUG] Fees are zero, stopping poll");
            return data;
          }
          
          if (attempt < attempts) {
            console.log(`[DEBUG] Fees still showing, waiting ${intervalMs}ms`);
            await new Promise(resolve => setTimeout(resolve, intervalMs));
          }
        } else {
          return data;
        }
      }
      
      console.log("[DEBUG] Refresh complete (max retries reached or not polling)");
      return lastResult;
    } catch (error) {
      console.error("[DEBUG] Refresh failed:", error);
      return null;
    } finally {
      refreshLockRef.current = false;
      setIsRefreshing(false);
    }
  }, [wallet?.address, queryClient]);

  // On app load / wallet already connected - refresh rewards
  useEffect(() => {
    if (wallet?.isConnected && !isLoadingTokens && !tokensData) {
      refreshClaimableRewards();
    }
  }, [wallet?.isConnected, isLoadingTokens, tokensData, refreshClaimableRewards]);

  useEffect(() => {
    if (tokensData) {
      console.log("[DEBUG] Loaded tokens:", tokens.length);
      console.log("[DEBUG] Total claimable rewards:", totalClaimable.rewards.length, "assets");
    }
  }, [tokensData, tokens.length, totalClaimable]);

  const handleConnect = async () => {
    const result = await connectWallet();
    if (result && 'error' in result) {
      toast({
        title: "Connection Failed",
        description: result.error,
        variant: "destructive",
      });
    } else if (result && 'address' in result) {
      toast({
        title: "Wallet Connected",
        description: isInFrame 
          ? `Connected via Farcaster Frame` 
          : `Connected to ${result.address.slice(0, 6)}...${result.address.slice(-4)}`,
      });
      // Refresh rewards immediately after wallet connect
      setTimeout(() => refreshClaimableRewards({ forceRefresh: true }), 100);
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected.",
    });
  };

  const handleClaimAll = async () => {
    if (!wallet?.address) return;

    if (totalClaimable.rewards.length === 0) {
      toast({
        title: "Nothing to Claim",
        description: "You don't have any fees to claim.",
        variant: "destructive",
      });
      return;
    }

    if (!isInFrame) {
      toast({
        title: "Claiming Unavailable",
        description: "Real claims require a Farcaster wallet. Please open this app in a Farcaster frame.",
        variant: "destructive",
      });
      return;
    }

    if (isClaiming || isRefreshing) {
      console.log("[DEBUG] Already claiming or refreshing, ignoring click");
      return;
    }

    const claimableAddresses = totalClaimable.tokenAddresses;
    
    if (claimableAddresses.length === 0) {
      toast({
        title: "Nothing to Claim",
        description: "No tokens with claimable fees found.",
        variant: "destructive",
      });
      return;
    }

    setIsClaiming(true);
    const preclaimRewards = [...totalClaimable.rewards];
    
    console.log(`[DEBUG] Starting batch claim for ${claimableAddresses.length} addresses with fees`);

    try {
      setClaimStatus(`Claiming ${claimableAddresses.length} tokens in one transaction...`);
      
      const tx = buildBatchClaimTransaction(wallet.address, claimableAddresses);
      
      toast({
        title: "Confirm Transaction",
        description: `Claiming fees from ${claimableAddresses.length} tokens`,
      });

      const result = await sendTransaction({
        to: tx.to,
        data: tx.data,
        value: tx.value,
      });
      
      console.log("[DEBUG] Batch sendTransaction result:", result);

      if (!result.success) {
        console.error("Batch claim failed:", result.error);
        
        if (result.error?.includes("rejected") || result.error?.includes("cancelled")) {
          toast({
            title: "Claim Cancelled",
            description: "You cancelled the claim operation.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Claim Failed",
            description: result.error || "Transaction failed",
            variant: "destructive",
          });
        }
        
        setIsClaiming(false);
        setClaimStatus(null);
        return;
      }

      setClaimStatus("Waiting for confirmation...");
      console.log("[DEBUG] Waiting for confirmation, hash:", result.txHash);
      
      const confirmed = await waitForTransaction(result.txHash!);
      console.log("[DEBUG] Confirmation result:", confirmed);

      if (confirmed) {
        setClaimStatus("Refreshing balances...");
        
        // Use single authoritative refresh with polling
        await refreshClaimableRewards({ forceRefresh: true, pollForZero: true });
        
        // Only clear loading states AFTER refresh completes
        setIsClaiming(false);
        setClaimStatus(null);
        
        const claimedSymbols = preclaimRewards.map(r => r.symbol);
        
        console.log("[DEBUG] Claimed rewards:", preclaimRewards);

        const newTransaction: Transaction = {
          id: crypto.randomUUID(),
          type: 'batch',
          rewards: preclaimRewards,
          tokensClaimed: claimedSymbols,
          poolAddresses: claimableAddresses,
          timestamp: new Date().toISOString(),
          txHash: result.txHash!,
        };
        
        setTransactions(prev => [newTransaction, ...prev]);
        
        const rewardsSummary = preclaimRewards.map(r => `${r.formattedAmount} ${r.symbol}`).join(', ');
        toast({
          title: "Claim Complete",
          description: `Successfully claimed ${rewardsSummary}`,
        });
      } else {
        setIsClaiming(false);
        setClaimStatus(null);
        toast({
          title: "Claim Failed",
          description: "Transaction was not confirmed. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Claim error:", error);
      toast({
        title: "Claim Failed",
        description: error instanceof Error ? error.message : "Failed to complete claim",
        variant: "destructive",
      });
      setIsClaiming(false);
      setClaimStatus(null);
    }
  };

  const username = context?.user?.username;
  const isDisabled = isClaiming || isRefreshing;

  if (!isSDKLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <span className="text-muted-foreground">Initializing...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header 
        wallet={wallet} 
        onConnect={handleConnect} 
        onDisconnect={handleDisconnect}
        isConnecting={isConnecting}
        isInFrame={isInFrame}
        username={username}
      />
      
      <main className="container mx-auto px-4 py-6 space-y-6">
        {!wallet?.isConnected ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              {isInFrame ? (
                <SiFarcaster className="w-10 h-10 text-primary" />
              ) : (
                <svg className="w-10 h-10 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <path d="M22 10H18a2 2 0 00-2 2v0a2 2 0 002 2h4" />
                </svg>
              )}
            </div>
            <h1 className="text-2xl font-bold mb-3">
              {isInFrame ? "Connect Your Farcaster Wallet" : "Connect Your Wallet"}
            </h1>
            <p className="text-muted-foreground max-w-md mb-6">
              {isInFrame 
                ? "Connect your Farcaster wallet to view and claim accumulated fees from your Clanker tokens."
                : "Connect your wallet to view and claim accumulated fees from your Clanker tokens."
              }
            </p>
            {isInFrame && (
              <Badge variant="secondary" className="gap-2 text-sm py-2 px-4 mb-4 bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <SiFarcaster className="w-4 h-4" />
                Running in Farcaster Frame
              </Badge>
            )}
            {!isInFrame && (
              <p className="text-xs text-muted-foreground">
                Demo mode - Real claims require Farcaster Frame
              </p>
            )}
          </div>
        ) : (
          <>
            <WalletAddressDisplay 
              address={wallet.address}
              isInFrame={isInFrame}
              username={username}
            />
            
            {isLoadingTokens && !tokensData ? (
              <div className="space-y-6">
                <Skeleton className="h-32 w-full rounded-lg" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 rounded-lg" />
                  ))}
                </div>
              </div>
            ) : isTokensError ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Failed to load tokens. Please try again.</p>
              </div>
            ) : tokens.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No Clanker tokens found for this wallet.</p>
                <p className="text-sm text-muted-foreground mt-2">Create tokens with Clanker to see them here.</p>
              </div>
            ) : (
              <>
                <ClaimAllButton 
                  totalClaimable={totalClaimable}
                  onClaimAll={handleClaimAll}
                  isClaiming={isClaiming}
                  isRefreshing={isRefreshing}
                  claimStatus={claimStatus}
                />
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Your Tokens</h2>
                    <span className="text-sm text-muted-foreground">{tokens.length} tokens found</span>
                  </div>
                  <TokenGrid 
                    tokens={tokens}
                    isClaiming={isDisabled}
                  />
                </div>
                
                <TransactionHistory transactions={transactions} />
              </>
            )}
          </>
        )}
      </main>
      
      <footer className="border-t border-border mt-12">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Powered by</span>
              <span className="font-semibold text-foreground">Clanker</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <SiFarcaster className="w-4 h-4" />
                Farcaster Mini App
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
