'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Wallet, 
  DollarSign, 
  TrendingUp, 
  Send, 
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
  Coins
} from 'lucide-react'

// Mock data
const mockWalletData = {
  balance: {
    available: 2847.32,
    pending: 156.78,
    staked: 1000.00,
    total: 4004.10
  },
  tokens: {
    NGT: {
      name: 'NeuroGrid Token',
      symbol: 'NGT',
      balance: 15423.45,
      value: 2847.32,
      price: 0.1845
    },
    ETH: {
      name: 'Ethereum',
      symbol: 'ETH',
      balance: 0.75,
      value: 1890.25,
      price: 2520.33
    },
    USDC: {
      name: 'USD Coin',
      symbol: 'USDC',
      balance: 266.53,
      value: 266.53,
      price: 1.00
    }
  },
  transactions: [
    {
      id: 'tx_001',
      type: 'earning',
      amount: 45.67,
      token: 'NGT',
      description: 'Task completion reward',
      status: 'completed',
      timestamp: '2024-01-15T10:30:00Z',
      hash: '0x1234...abcd'
    },
    {
      id: 'tx_002',
      type: 'withdrawal',
      amount: -100.00,
      token: 'USDC',
      description: 'Withdrawal to bank account',
      status: 'pending',
      timestamp: '2024-01-15T09:45:00Z',
      hash: '0x5678...efgh'
    },
    {
      id: 'tx_003',
      type: 'staking',
      amount: -500.00,
      token: 'NGT',
      description: 'Staked for network governance',
      status: 'completed',
      timestamp: '2024-01-14T16:20:00Z',
      hash: '0x9abc...ijkl'
    },
    {
      id: 'tx_004',
      type: 'earning',
      amount: 23.45,
      token: 'NGT',
      description: 'Node operation reward',
      status: 'completed',
      timestamp: '2024-01-14T14:15:00Z',
      hash: '0xdef0...mnop'
    },
    {
      id: 'tx_005',
      type: 'purchase',
      amount: 200.00,
      token: 'NGT',
      description: 'Token purchase',
      status: 'completed',
      timestamp: '2024-01-14T11:30:00Z',
      hash: '0x2468...qrst'
    }
  ]
}

export default function WalletPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'stake'>('overview')
  const [filter, setFilter] = useState<'all' | 'earning' | 'withdrawal' | 'staking' | 'purchase'>('all')

  const filteredTransactions = mockWalletData.transactions.filter(tx => 
    filter === 'all' || tx.type === filter
  )

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'earning':
        return <ArrowDownLeft className="h-4 w-4 text-green-500" />
      case 'withdrawal':
        return <ArrowUpRight className="h-4 w-4 text-red-500" />
      case 'staking':
        return <Coins className="h-4 w-4 text-blue-500" />
      case 'purchase':
        return <Plus className="h-4 w-4 text-purple-500" />
      default:
        return <DollarSign className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'success',
      pending: 'warning',
      failed: 'destructive'
    } as const

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status}
      </Badge>
    )
  }

  const formatAmount = (amount: number, token: string) => {
    const prefix = amount > 0 ? '+' : ''
    return `${prefix}${amount.toFixed(2)} ${token}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wallet</h1>
          <p className="text-muted-foreground">
            Manage your NeuroGrid tokens and earnings
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline">
            <Send className="mr-2 h-4 w-4" />
            Send
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Buy Tokens
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-2">
        <Button 
          variant={activeTab === 'overview' ? 'default' : 'outline'}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </Button>
        <Button 
          variant={activeTab === 'transactions' ? 'default' : 'outline'}
          onClick={() => setActiveTab('transactions')}
        >
          Transactions
        </Button>
        <Button 
          variant={activeTab === 'stake' ? 'default' : 'outline'}
          onClick={() => setActiveTab('stake')}
        >
          Staking
        </Button>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Balance Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${mockWalletData.balance.available.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">
                  Ready to use
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${mockWalletData.balance.pending.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">
                  Processing payments
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Staked</CardTitle>
                <Coins className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${mockWalletData.balance.staked.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">
                  Earning 8.5% APY
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Portfolio</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${mockWalletData.balance.total.toFixed(2)}</div>
                <p className="text-xs text-green-600">
                  +12.5% this month
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Token Holdings */}
          <Card>
            <CardHeader>
              <CardTitle>Token Holdings</CardTitle>
              <CardDescription>
                Your cryptocurrency and token balances
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(mockWalletData.tokens).map(([symbol, token]) => (
                  <div key={symbol} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                        {symbol.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{token.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {token.balance.toFixed(2)} {symbol}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${token.value.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">
                        ${token.price.toFixed(4)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-2">
                  <Send className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg">Send Tokens</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Transfer tokens to another wallet or exchange
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  Send
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-2">
                  <CreditCard className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-lg">Buy Tokens</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Purchase NGT tokens with fiat currency or crypto
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  Buy Now
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-2">
                  <Coins className="h-5 w-5 text-purple-600" />
                  <CardTitle className="text-lg">Stake Tokens</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Stake NGT tokens to earn rewards and governance rights
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  Stake
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {/* Transaction Filters */}
          <div className="flex items-center space-x-2">
            <Button 
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button 
              variant={filter === 'earning' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('earning')}
            >
              Earnings
            </Button>
            <Button 
              variant={filter === 'withdrawal' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('withdrawal')}
            >
              Withdrawals
            </Button>
            <Button 
              variant={filter === 'staking' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('staking')}
            >
              Staking
            </Button>
            <Button 
              variant={filter === 'purchase' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('purchase')}
            >
              Purchases
            </Button>
          </div>

          {/* Transactions List */}
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>
                Your recent transactions and transfers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredTransactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getTransactionIcon(tx.type)}
                      <div>
                        <p className="font-medium">{tx.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(tx.timestamp).toLocaleString()} • 
                          <span className="ml-1 font-mono text-xs">
                            {tx.hash.slice(0, 10)}...
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatAmount(tx.amount, tx.token)}
                      </p>
                      {getStatusBadge(tx.status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'stake' && (
        <div className="space-y-6">
          {/* Staking Overview */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Staked</CardTitle>
                <Coins className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">5,420.45 NGT</div>
                <p className="text-xs text-muted-foreground">
                  $1,000.00 USD
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">APY</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">8.5%</div>
                <p className="text-xs text-green-600">
                  +0.2% this week
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Rewards Earned</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">127.89 NGT</div>
                <p className="text-xs text-muted-foreground">
                  Last 30 days
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Staking Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Stake NGT Tokens</CardTitle>
              <CardDescription>
                Stake your NGT tokens to earn rewards and participate in governance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount to Stake</label>
                <Input placeholder="Enter amount in NGT" />
                <p className="text-xs text-muted-foreground">
                  Available: {mockWalletData.tokens.NGT.balance.toFixed(2)} NGT
                </p>
              </div>
              
              <div className="flex items-center space-x-4">
                <Button className="flex-1">
                  Stake Tokens
                </Button>
                <Button variant="outline" className="flex-1">
                  Unstake
                </Button>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Staking Benefits</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Earn 8.5% APY on staked tokens</li>
                  <li>• Participate in network governance</li>
                  <li>• Priority access to new features</li>
                  <li>• Reduced transaction fees</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}