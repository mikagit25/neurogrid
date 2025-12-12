import React, { useState, useEffect, useRef } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

const EnhancedCryptoWallet = () => {
    const [portfolioData, setPortfolioData] = useState([]);
    const [totalBalance, setTotalBalance] = useState(0);
    const [aiRecommendations, setAiRecommendations] = useState([]);
    const [marketSentiment, setMarketSentiment] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('portfolio');
    const [swapModal, setSwapModal] = useState(false);
    const [swapData, setSwapData] = useState({
        fromAsset: 'ETH',
        toAsset: 'USDT',
        fromAmount: '',
        toAmount: '',
        exchangeRate: 0
    });

    const wsRef = useRef(null);
    const userId = 'user_123'; // В реальном приложении получаем из контекста авторизации

    // WebSocket connection for real-time updates
    useEffect(() => {
        // Инициализация WebSocket для real-time обновлений
        const connectWebSocket = () => {
            wsRef.current = new WebSocket(`ws://localhost:3001/ws/crypto/${userId}`);
            
            wsRef.current.onmessage = (event) => {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            };
            
            wsRef.current.onclose = () => {
                // Переподключение при разрыве соединения
                setTimeout(connectWebSocket, 5000);
            };
        };

        connectWebSocket();
        loadInitialData();

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);

    const handleWebSocketMessage = (data) => {
        switch (data.type) {
            case 'price_update':
                updatePrices(data.prices);
                break;
            case 'ai_recommendation':
                setAiRecommendations(prev => [data.recommendation, ...prev]);
                break;
            case 'transaction_update':
                setTransactions(prev => [data.transaction, ...prev]);
                break;
            default:
                break;
        }
    };

    const loadInitialData = async () => {
        try {
            setLoading(true);
            await Promise.all([
                loadPortfolio(),
                loadAIRecommendations(),
                loadMarketSentiment(),
                loadTransactions()
            ]);
        } catch (error) {
            console.error('Error loading data:', error);
            showNotification('Ошибка загрузки данных', 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadPortfolio = async () => {
        try {
            const response = await fetch(`/api/crypto/portfolio/${userId}`);
            const data = await response.json();
            
            if (data.success) {
                setPortfolioData(data.portfolio.assets);
                setTotalBalance(data.portfolio.totalValue);
            }
        } catch (error) {
            console.error('Error loading portfolio:', error);
        }
    };

    const loadAIRecommendations = async () => {
        try {
            const response = await fetch(`/api/crypto/ai-recommendations/${userId}`);
            const data = await response.json();
            
            if (data.success) {
                setAiRecommendations(data.recommendations);
            }
        } catch (error) {
            console.error('Error loading AI recommendations:', error);
        }
    };

    const loadMarketSentiment = async () => {
        try {
            const response = await fetch('/api/crypto/market-sentiment');
            const data = await response.json();
            
            if (data.success) {
                setMarketSentiment(data.sentiment);
            }
        } catch (error) {
            console.error('Error loading market sentiment:', error);
        }
    };

    const loadTransactions = async () => {
        try {
            const response = await fetch(`/api/crypto/transactions/${userId}?limit=20`);
            const data = await response.json();
            
            if (data.success) {
                setTransactions(data.transactions);
            }
        } catch (error) {
            console.error('Error loading transactions:', error);
        }
    };

    const updatePrices = (newPrices) => {
        setPortfolioData(prev => 
            prev.map(asset => ({
                ...asset,
                currentPrice: newPrices[asset.symbol]?.price || asset.currentPrice,
                change24h: newPrices[asset.symbol]?.change24h || asset.change24h
            }))
        );
        
        // Пересчитываем общий баланс
        const newTotal = portfolioData.reduce((sum, asset) => {
            const price = newPrices[asset.symbol]?.price || asset.currentPrice;
            return sum + (asset.balance * price);
        }, 0);
        setTotalBalance(newTotal);
    };

    const executeSwap = async () => {
        try {
            const response = await fetch('/api/crypto/swap', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId,
                    fromAsset: swapData.fromAsset,
                    toAsset: swapData.toAsset,
                    amount: parseFloat(swapData.fromAmount)
                })
            });

            const data = await response.json();
            
            if (data.success) {
                showNotification('Обмен выполнен успешно!', 'success');
                setSwapModal(false);
                loadPortfolio(); // Обновляем портфель
            } else {
                showNotification('Ошибка выполнения обмена', 'error');
            }
        } catch (error) {
            console.error('Error executing swap:', error);
            showNotification('Ошибка выполнения обмена', 'error');
        }
    };

    const showNotification = (message, type) => {
        // Реализация уведомлений
        console.log(`${type.toUpperCase()}: ${message}`);
    };

    // Chart data for portfolio composition
    const chartData = {
        labels: portfolioData.map(asset => asset.symbol),
        datasets: [{
            data: portfolioData.map(asset => asset.currentValue || 0),
            backgroundColor: [
                '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', 
                '#ef4444', '#06b6d4', '#f97316', '#84cc16'
            ],
            borderWidth: 2,
            borderColor: '#ffffff'
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    padding: 20,
                    usePointStyle: true,
                    font: { size: 12 }
                }
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        const value = context.parsed;
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = ((value / total) * 100).toFixed(1);
                        return `${context.label}: $${value.toLocaleString()} (${percentage}%)`;
                    }
                }
            }
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Продвинутый кошелек</h1>
                        <p className="text-blue-100">Управление цифровыми активами с AI</p>
                    </div>
                    <div className="text-right">
                        <p className="text-blue-100 text-sm">Общий баланс</p>
                        <p className="text-3xl font-bold">${totalBalance.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                    </div>
                </div>
            </div>

            {/* AI Recommendations */}
            {aiRecommendations.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                                <span className="text-white text-sm">🤖</span>
                            </div>
                            <h3 className="text-lg font-semibold">AI Рекомендации</h3>
                        </div>
                        <button 
                            onClick={loadAIRecommendations}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            🔄
                        </button>
                    </div>
                    <div className="space-y-3">
                        {aiRecommendations.slice(0, 3).map((rec, index) => (
                            <div key={index} className={`border rounded-lg p-4 ${
                                rec.type === 'portfolio_optimization' ? 'border-blue-200 bg-blue-50' :
                                rec.type === 'risk_management' ? 'border-yellow-200 bg-yellow-50' :
                                'border-green-200 bg-green-50'
                            }`}>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="font-medium text-gray-900">{rec.title}</p>
                                        <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className={`text-xs px-2 py-1 rounded ${
                                            rec.priority === 'urgent' ? 'bg-red-200 text-red-800' :
                                            rec.priority === 'high' ? 'bg-orange-200 text-orange-800' :
                                            'bg-gray-200 text-gray-800'
                                        }`}>
                                            {rec.priority}
                                        </span>
                                        <span className="text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded">
                                            {rec.confidence}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Navigation Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex space-x-8">
                    {[
                        { id: 'portfolio', label: 'Портфель', icon: '💼' },
                        { id: 'swap', label: 'Обмен', icon: '🔄' },
                        { id: 'history', label: 'История', icon: '📋' },
                        { id: 'analytics', label: 'Аналитика', icon: '📊' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center space-x-2 py-3 px-1 border-b-2 font-medium text-sm ${
                                activeTab === tab.id
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            <span>{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2">
                    {activeTab === 'portfolio' && (
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 className="text-lg font-semibold mb-4">Криптовалютный портфель</h3>
                            <div className="space-y-4">
                                {portfolioData.map((asset, index) => (
                                    <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                                        <div className="flex items-center space-x-4">
                                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-lg">
                                                {asset.symbol === 'BTC' ? '₿' : 
                                                 asset.symbol === 'ETH' ? 'Ξ' : 
                                                 asset.symbol === 'USDT' ? '₮' : '🪙'}
                                            </div>
                                            <div>
                                                <h4 className="font-semibold">{asset.symbol}</h4>
                                                <p className="text-sm text-gray-600">{asset.balance?.toFixed(4)} {asset.symbol}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold">${(asset.currentValue || 0).toFixed(2)}</p>
                                            <p className={`text-sm ${
                                                (asset.change24h || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                                {(asset.change24h || 0) >= 0 ? '↗' : '↘'} {Math.abs(asset.change24h || 0).toFixed(1)}%
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'swap' && (
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 className="text-lg font-semibold mb-4">Обмен криптовалют</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Отдаю</label>
                                    <div className="flex space-x-2">
                                        <select 
                                            value={swapData.fromAsset}
                                            onChange={(e) => setSwapData(prev => ({...prev, fromAsset: e.target.value}))}
                                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                                        >
                                            {portfolioData.map(asset => (
                                                <option key={asset.symbol} value={asset.symbol}>
                                                    {asset.symbol}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            value={swapData.fromAmount}
                                            onChange={(e) => setSwapData(prev => ({...prev, fromAmount: e.target.value}))}
                                            placeholder="0.0"
                                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                                        />
                                    </div>
                                </div>
                                
                                <div className="flex justify-center">
                                    <button 
                                        onClick={() => setSwapData(prev => ({
                                            ...prev,
                                            fromAsset: prev.toAsset,
                                            toAsset: prev.fromAsset
                                        }))}
                                        className="w-10 h-10 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                    >
                                        🔄
                                    </button>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Получаю</label>
                                    <div className="flex space-x-2">
                                        <select 
                                            value={swapData.toAsset}
                                            onChange={(e) => setSwapData(prev => ({...prev, toAsset: e.target.value}))}
                                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                                        >
                                            {portfolioData.map(asset => (
                                                <option key={asset.symbol} value={asset.symbol}>
                                                    {asset.symbol}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            value={swapData.toAmount}
                                            placeholder="0.0"
                                            readOnly
                                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                                        />
                                    </div>
                                </div>
                                
                                <button 
                                    onClick={executeSwap}
                                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
                                >
                                    Обменять
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 className="text-lg font-semibold mb-4">История транзакций</h3>
                            <div className="space-y-3">
                                {transactions.map((tx, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 border-b border-gray-100">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-sm">
                                                {tx.type === 'swap' ? '🔄' : 
                                                 tx.type === 'deposit' ? '⬇️' : '⬆️'}
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">
                                                    {tx.type === 'swap' ? `${tx.fromAsset} → ${tx.toAsset}` : 
                                                     `${tx.type === 'deposit' ? 'Пополнение' : 'Вывод'} ${tx.asset}`}
                                                </p>
                                                <p className="text-xs text-gray-600">
                                                    {new Date(tx.timestamp).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-medium text-sm">
                                                {tx.type === 'swap' ? `${tx.toAmount} ${tx.toAsset}` : 
                                                 `${tx.amount} ${tx.asset}`}
                                            </p>
                                            <p className={`text-xs ${tx.status === 'completed' ? 'text-green-600' : 'text-yellow-600'}`}>
                                                {tx.status}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Portfolio Chart */}
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                        <h4 className="text-lg font-semibold mb-4">Состав портфеля</h4>
                        <div style={{ height: '300px' }}>
                            <Doughnut data={chartData} options={chartOptions} />
                        </div>
                    </div>

                    {/* Market Sentiment */}
                    {marketSentiment && (
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h4 className="text-lg font-semibold mb-4">Настроения рынка</h4>
                            <div className="space-y-3">
                                <div className="text-center">
                                    <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                                        marketSentiment.overall.score >= 70 ? 'bg-green-100 text-green-800' :
                                        marketSentiment.overall.score >= 40 ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-red-100 text-red-800'
                                    }`}>
                                        {marketSentiment.overall.label}
                                    </div>
                                    <p className="text-2xl font-bold mt-1">{marketSentiment.overall.score}%</p>
                                </div>
                                {Object.entries(marketSentiment.assets).map(([asset, data]) => (
                                    <div key={asset} className="flex items-center justify-between">
                                        <span className="text-sm font-medium">{asset}</span>
                                        <div className="flex items-center space-x-2">
                                            <div className="w-16 h-2 bg-gray-200 rounded-full">
                                                <div 
                                                    className={`h-2 rounded-full ${
                                                        data.score >= 70 ? 'bg-green-500' :
                                                        data.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                                    }`}
                                                    style={{ width: `${data.score}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-xs text-gray-600">{data.score}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EnhancedCryptoWallet;