import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, ExternalLink } from "lucide-react";
import { SiFarcaster } from "react-icons/si";
import { useState } from "react";

interface WalletAddressDisplayProps {
  address: string;
  isInFrame: boolean;
  username?: string;
}

export function WalletAddressDisplay({ address, isInFrame, username }: WalletAddressDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const basescanUrl = `https://basescan.org/address/${address}`;

  return (
    <Card className="p-4" data-testid="card-wallet-display">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
            {isInFrame ? (
              <SiFarcaster className="w-5 h-5 text-primary" />
            ) : (
              <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M22 10H18a2 2 0 00-2 2v0a2 2 0 002 2h4" />
              </svg>
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Connected Wallet</span>
              {isInFrame && (
                <Badge variant="secondary" className="text-xs gap-1 bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <SiFarcaster className="w-3 h-3" />
                  Farcaster
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {username && (
                <span className="font-medium text-sm">@{username}</span>
              )}
              <span 
                className="font-mono text-sm sm:text-base font-medium"
                data-testid="text-wallet-address"
              >
                <span className="hidden sm:inline">{address}</span>
                <span className="sm:hidden">{address.slice(0, 10)}...{address.slice(-8)}</span>
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-2"
            data-testid="button-copy-address"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span className="hidden sm:inline">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span className="hidden sm:inline">Copy</span>
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="gap-2"
            data-testid="link-basescan"
          >
            <a href={basescanUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">View on BaseScan</span>
            </a>
          </Button>
        </div>
      </div>
    </Card>
  );
}
