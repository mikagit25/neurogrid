import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Wallet, 
  Plus, 
  Minus, 
  TrendingUp, 
  Clock, 
  DollarSign,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';

const WalletDashboard = () => {
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addFundsAmount, setAddFundsAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  useEffect(() => {
    loadWalletData();
  }, []);

  const loadWalletData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Authentication required');
      }

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Load balance
      const balanceResponse = await fetch('/api/tokens/balance', { headers });
      if (!balanceResponse.ok) {
        throw new Error('Failed to load balance');
      }
      const balanceData = await balanceResponse.json();
      setBalance(balanceData.data);

      // Load transactions
      const transactionsResponse = await fetch('/api/tokens/transactions?limit=10', { headers });
      if (!transactionsResponse.ok) {
        throw new Error('Failed to load transactions');
      }
      const transactionsData = await transactionsResponse.json();
      setTransactions(transactionsData.data);

      // Load platform stats
      const statsResponse = await fetch('/api/tokens/stats', { headers });
      if (!statsResponse.ok) {
        throw new Error('Failed to load stats');
      }
      const statsData = await statsResponse.json();
      setStats(statsData.data);

      setError(null);
    } catch (err) {
      console.error('Error loading wallet data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFunds = async () => {
    try {
      const amount = parseFloat(addFundsAmount);
      if (!amount || amount <= 0) {
        throw new Error('Please enter a valid amount');
      }

      const token = localStorage.getItem('token');
      const response = await fetch('/api/tokens/add-funds', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: amount,
          paymentMethod: 'manual'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add funds');
      }

      setAddFundsAmount('');
      setShowAddFunds(false);
      await loadWalletData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleWithdraw = async () => {
    try {
      const amount = parseFloat(withdrawAmount);
      if (!amount || amount <= 0) {
        throw new Error('Please enter a valid amount');
      }

      const token = localStorage.getItem('token');
      const response = await fetch('/api/tokens/withdraw', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: amount,
          withdrawalMethod: 'manual'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to withdraw funds');
      }

      setWithdrawAmount('');
      setShowWithdraw(false);
      await loadWalletData();
    } catch (err) {
      setError(err.message);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatAmount = (amount) => {
    return parseFloat(amount).toFixed(2);
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'credit':
        return <ArrowUpRight className="h-4 w-4 text-green-500" />;
      case 'debit':
        return <ArrowDownLeft className="h-4 w-4 text-red-500" />;
      default:
        return <DollarSign className="h-4 w-4 text-blue-500" />;
    }
  };

  const getTransactionColor = (type) => {
    switch (type) {
      case 'credit':
        return 'text-green-600';
      case 'debit':
        return 'text-red-600';
      default:
        return 'text-blue-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        Loading wallet...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Wallet className="h-6 w-6" />
          <h1 className="text-2xl font-bold">NeuroGrid Wallet</h1>
        </div>
        <Button onClick={loadWalletData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Balance Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Current Balance</span>
            <Badge variant="outline">NEURO</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold mb-4">
            {balance ? `${formatAmount(balance.balance)} NEURO` : '0.00 NEURO'}
          </div>
          <div className="flex space-x-2">
            <Button 
              onClick={() => setShowAddFunds(!showAddFunds)}
              className="flex-1"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Funds
            </Button>
            <Button 
              onClick={() => setShowWithdraw(!showWithdraw)}
              variant="outline"
              className="flex-1"
            >
              <Minus className="h-4 w-4 mr-1" />
              Withdraw
            </Button>
          </div>

          {/* Add Funds Form */}
          {showAddFunds && (
            <div className="mt-4 p-4 border rounded-lg bg-gray-50">
              <h3 className="font-medium mb-2">Add Funds</h3>
              <div className="flex space-x-2">
                <Input
                  type="number"
                  placeholder="Amount"
                  value={addFundsAmount}
                  onChange={(e) => setAddFundsAmount(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleAddFunds}>Add</Button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Demo mode: Funds will be added instantly
              </p>
            </div>
          )}

          {/* Withdraw Form */}
          {showWithdraw && (
            <div className="mt-4 p-4 border rounded-lg bg-gray-50">
              <h3 className="font-medium mb-2">Withdraw Funds</h3>
              <div className="flex space-x-2">
                <Input
                  type="number"
                  placeholder="Amount"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleWithdraw} variant="outline">Withdraw</Button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Minimum balance of 1.0 NEURO required
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Platform Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Transactions</p>
                  <p className="text-xl font-bold">{stats.totalTransactions || 0}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Platform Volume</p>
                  <p className="text-xl font-bold">{formatAmount(stats.totalVolume || 0)} NEURO</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Avg Transaction</p>
                  <p className="text-xl font-bold">{formatAmount(stats.averageTransactionSize || 0)} NEURO</p>
                </div>
                <Clock className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No transactions yet</p>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx, index) => (
                <div
                  key={tx.id || index}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    {getTransactionIcon(tx.transaction_type)}
                    <div>
                      <p className="font-medium">{tx.description || 'Transaction'}</p>
                      <p className="text-sm text-gray-500">
                        {formatDate(tx.created_at || tx.timestamp)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${getTransactionColor(tx.transaction_type)}`}>
                      {tx.transaction_type === 'credit' ? '+' : '-'}
                      {formatAmount(tx.amount)} NEURO
                    </p>
                    <Badge 
                      variant={tx.status === 'completed' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {tx.status || 'completed'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WalletDashboard;