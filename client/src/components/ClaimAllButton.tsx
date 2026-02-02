import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, Coins, RefreshCw } from "lucide-react";
import type { RewardAsset } from "@shared/schema";

interface TotalClaimable {
  rewards: RewardAsset[];
  tokenAddresses: string[];
}

interface ClaimAllButtonProps {
  totalClaimable: TotalClaimable;
  onClaimAll: () => void;
  isClaiming: boolean;
  isRefreshing?: boolean;
  claimStatus?: string | null;
}

export function ClaimAllButton({ 
  totalClaimable, 
  onClaimAll, 
  isClaiming, 
  isRefreshing = false,
  claimStatus 
}: ClaimAllButtonProps) {
  const hasClaimableRewards = totalClaimable.rewards.length > 0;
  const isDisabled = isClaiming || isRefreshing || !hasClaimableRewards;

  const getButtonContent = () => {
    if (isRefreshing) {
      return (
        <>
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Refreshing balances...</span>
        </>
      );
    }
    
    if (isClaiming) {
      return (
        <>
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span className="truncate max-w-[180px]">{claimStatus || "Claiming..."}</span>
        </>
      );
    }
    
    return (
      <>
        <Zap className="w-5 h-5" />
        Claim All Fees
      </>
    );
  };

  return (
    <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-accent border-primary/20">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-primary" />
              <span className="font-semibold text-lg">Total Claimable</span>
              {isRefreshing && (
                <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />
              )}
            </div>
            
            {hasClaimableRewards ? (
              <div className="flex flex-col gap-1" data-testid="rewards-list">
                {totalClaimable.rewards.map((reward) => (
                  <div 
                    key={reward.address} 
                    className="flex items-baseline gap-2"
                    data-testid={`reward-${reward.symbol}`}
                  >
                    <span className="text-xl sm:text-2xl font-bold font-mono">
                      {reward.formattedAmount}
                    </span>
                    <span className="text-lg font-semibold text-muted-foreground">
                      {reward.symbol}
                    </span>
                  </div>
                ))}
              </div>
            ) : !isRefreshing ? (
              <p className="text-sm text-muted-foreground">No fees available to claim</p>
            ) : null}
          </div>
          
          <Button 
            size="lg" 
            onClick={onClaimAll}
            disabled={isDisabled}
            className="gap-2 text-base px-6 py-6 sm:py-5"
            data-testid="button-claim-all"
          >
            {getButtonContent()}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
