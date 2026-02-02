import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, ShieldCheck, ExternalLink } from "lucide-react";
import type { Token } from "@shared/schema";

interface TokenCardProps {
  token: Token;
}

export function TokenCard({ token }: TokenCardProps) {
  const formatMarketCap = (value: number | undefined) => {
    if (!value) return null;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  const basescanUrl = `https://basescan.org/token/${token.contractAddress}`;

  return (
    <Card 
      className="hover-elevate transition-all duration-200" 
      data-testid={`card-token-${token.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {token.imageUrl ? (
              <img 
                src={token.imageUrl} 
                alt={token.name}
                className="w-10 h-10 rounded-md object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <div 
              className={`w-10 h-10 rounded-md flex items-center justify-center text-white font-bold text-sm ${token.imageUrl ? 'hidden' : ''}`}
              style={{ backgroundColor: token.iconColor }}
            >
              {token.symbol.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm">{token.name}</span>
                {token.isTrusted && (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                )}
              </div>
              <span className="text-xs text-muted-foreground font-mono">${token.symbol}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <a 
              href={basescanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1"
              data-testid={`link-token-${token.id}`}
            >
              <Badge variant="secondary" className="text-xs font-mono gap-1 hover-elevate">
                {token.contractAddress.slice(0, 6)}...{token.contractAddress.slice(-4)}
                <ExternalLink className="w-3 h-3" />
              </Badge>
            </a>
            {token.marketCap && (
              <span className="text-xs text-muted-foreground">
                MCap: {formatMarketCap(token.marketCap)}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface TokenGridProps {
  tokens: Token[];
  isClaiming: boolean;
}

export function TokenGrid({ tokens, isClaiming }: TokenGridProps) {
  if (tokens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Coins className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-lg mb-2">No Tokens Found</h3>
        <p className="text-muted-foreground text-sm max-w-md">
          You haven't created any tokens via Clanker yet. Create a token to start accumulating fees.
        </p>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${isClaiming ? 'opacity-60 pointer-events-none' : ''}`}>
      {tokens.map((token) => (
        <TokenCard 
          key={token.id} 
          token={token} 
        />
      ))}
    </div>
  );
}
