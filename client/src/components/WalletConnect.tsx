import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, LogOut } from "lucide-react";
import { SiFarcaster } from "react-icons/si";
import type { Wallet as WalletType } from "@shared/schema";

interface WalletConnectProps {
  wallet: WalletType | null;
  onConnect: () => void;
  onDisconnect: () => void;
  isConnecting: boolean;
  isInFrame: boolean;
  username?: string;
}

export function WalletConnect({ wallet, onConnect, onDisconnect, isConnecting, isInFrame, username }: WalletConnectProps) {
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (wallet?.isConnected) {
    return (
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-md bg-card border border-card-border">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {isInFrame && username && (
            <span className="text-sm font-medium">@{username}</span>
          )}
          <span className="text-sm font-medium font-mono">{formatAddress(wallet.address)}</span>
          {isInFrame && (
            <Badge variant="secondary" className="text-xs gap-1 bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <SiFarcaster className="w-3 h-3" />
              Frame
            </Badge>
          )}
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onDisconnect}
          data-testid="button-disconnect-wallet"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button 
      onClick={onConnect} 
      disabled={isConnecting}
      className="gap-2"
      data-testid="button-connect-wallet"
    >
      {isInFrame ? (
        <SiFarcaster className="w-4 h-4" />
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <path d="M22 10H18a2 2 0 00-2 2v0a2 2 0 002 2h4" />
        </svg>
      )}
      {isConnecting ? "Connecting..." : isInFrame ? "Connect with Farcaster" : "Connect Wallet"}
    </Button>
  );
}

interface HeaderProps extends WalletConnectProps {}

export function Header({ wallet, onConnect, onDisconnect, isConnecting, isInFrame, username }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 gap-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary text-primary-foreground">
            <Zap className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-lg leading-tight">Claim</span>
            <span className="text-xs text-muted-foreground leading-tight hidden sm:block">Clanker Token Fees</span>
          </div>
        </div>
        <WalletConnect 
          wallet={wallet} 
          onConnect={onConnect} 
          onDisconnect={onDisconnect} 
          isConnecting={isConnecting}
          isInFrame={isInFrame}
          username={username}
        />
      </div>
    </header>
  );
}
