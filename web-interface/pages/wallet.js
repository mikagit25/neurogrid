import React, { useState, useEffect } from 'react';
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

const WalletPage = () => {
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
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            Loading wallet...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Wallet className="h-6 w-6" />
            <h1 className="text-2xl font-bold">NeuroGrid Wallet</h1>
          </div>
          <button 
            onClick={loadWalletData}
            className="flex items-center space-x-1 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Balance Card */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Current Balance</h2>
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
              NEURO
            </span>
          </div>
          
          <div className="text-3xl font-bold mb-4">
            {balance ? `${formatAmount(balance.balance)} NEURO` : '0.00 NEURO'}
          </div>
          
          <div className="flex space-x-2">
            <button 
              onClick={() => setShowAddFunds(!showAddFunds)}
              className="flex-1 flex items-center justify-center space-x-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add Funds</span>
            </button>
            <button 
              onClick={() => setShowWithdraw(!showWithdraw)}
              className="flex-1 flex items-center justify-center space-x-1 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Minus className="h-4 w-4" />
              <span>Withdraw</span>
            </button>
          </div>

          {/* Add Funds Form */}
          {showAddFunds && (
            <div className="mt-4 p-4 border rounded-lg bg-gray-50">
              <h3 className="font-medium mb-2">Add Funds</h3>
              <div className="flex space-x-2">
                <input
                  type="number"
                  placeholder="Amount"
                  value={addFundsAmount}
                  onChange={(e) => setAddFundsAmount(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button 
                  onClick={handleAddFunds}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add
                </button>
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
                <input
                  type="number"
                  placeholder="Amount"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button 
                  onClick={handleWithdraw}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Withdraw
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Minimum balance of 1.0 NEURO required
              </p>
            </div>
          )}
        </div>

        {/* Platform Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Transactions</p>
                  <p className="text-xl font-bold">{stats.totalTransactions || 0}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Platform Volume</p>
                  <p className="text-xl font-bold">{formatAmount(stats.totalVolume || 0)} NEURO</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Avg Transaction</p>
                  <p className="text-xl font-bold">{formatAmount(stats.averageTransactionSize || 0)} NEURO</p>
                </div>
                <Clock className="h-8 w-8 text-purple-500" />
              </div>
            </div>
          </div>
        )}

        {/* Transaction History */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">Recent Transactions</h2>
          </div>
          <div className="p-6">
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
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        tx.status === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {tx.status || 'completed'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletPage;