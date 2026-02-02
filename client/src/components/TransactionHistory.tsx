import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Zap, ArrowUpRight, ExternalLink, History } from "lucide-react";
import type { Transaction } from "@shared/schema";

interface TransactionHistoryProps {
  transactions: Transaction[];
}

export function TransactionHistory({ transactions }: TransactionHistoryProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const truncateTxHash = (hash: string) => {
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="w-5 h-5" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <History className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">
              No claims yet. Claim your token fees to see transaction history.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="w-5 h-5" />
          Transaction History
          <Badge variant="secondary" className="ml-auto">
            {transactions.length} {transactions.length === 1 ? 'claim' : 'claims'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="space-y-0">
            {transactions.map((tx, index) => (
              <div 
                key={tx.id} 
                className={`p-4 hover-elevate ${index !== transactions.length - 1 ? 'border-b border-border' : ''}`}
                data-testid={`row-transaction-${tx.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-md flex items-center justify-center ${
                      tx.type === 'batch' 
                        ? 'bg-primary/10 text-primary' 
                        : 'bg-blue-500/10 text-blue-500'
                    }`}>
                      {tx.type === 'batch' ? (
                        <Zap className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Badge 
                        variant={tx.type === 'batch' ? 'default' : 'secondary'}
                        className={tx.type === 'batch' ? 'bg-primary' : 'bg-blue-500 text-white'}
                      >
                        {tx.type === 'batch' ? 'Batch Claim' : 'Single Claim'}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>{tx.tokensClaimed.length} {tx.tokensClaimed.length === 1 ? 'token' : 'tokens'}</span>
                        <span>•</span>
                        <span>{formatDate(tx.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    {tx.rewards && tx.rewards.length > 0 ? (
                      tx.rewards.map((reward) => (
                        <span key={reward.address} className="font-bold font-mono">
                          {reward.formattedAmount} {reward.symbol}
                        </span>
                      ))
                    ) : tx.amountEth !== undefined ? (
                      <span className="font-bold font-mono">{tx.amountEth.toFixed(6)} ETH</span>
                    ) : null}
                  </div>
                </div>
                
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Tx:</span>
                  <a 
                    href={`https://basescan.org/tx/${tx.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-primary hover:underline flex items-center gap-1"
                    data-testid={`link-tx-${tx.id}`}
                  >
                    {truncateTxHash(tx.txHash)}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                
                {tx.tokensClaimed.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">Tokens:</span>
                    {tx.tokensClaimed.map((symbol, i) => {
                      const poolAddr = tx.poolAddresses?.[i];
                      if (poolAddr) {
                        return (
                          <a
                            key={i}
                            href={`https://basescan.org/token/${poolAddr}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Badge variant="outline" className="text-xs hover-elevate cursor-pointer gap-1">
                              ${symbol}
                              <span className="text-muted-foreground font-mono">({truncateAddress(poolAddr)})</span>
                            </Badge>
                          </a>
                        );
                      }
                      return (
                        <Badge key={i} variant="outline" className="text-xs">
                          ${symbol}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
