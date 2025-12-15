const express = require('express');
const router = express.Router();
const CryptoPortfolioAnalyzer = require('../services/CryptoPortfolioAnalyzer');

// Инициализация Multi-Agent анализатора портфеля
const portfolioAnalyzer = new CryptoPortfolioAnalyzer();

// Mock cryptocurrency data - в реальном приложении это будет подключение к криптобиржам
const mockCryptoData = {
  'BTC': { price: 43250, change24h: 2.5, marketCap: 850000000000 },
  'ETH': { price: 2580, change24h: -1.2, marketCap: 310000000000 },
  'USDT': { price: 1.00, change24h: 0.1, marketCap: 95000000000 },
  'ADA': { price: 0.485, change24h: 3.8, marketCap: 17000000000 },
  'SOL': { price: 98.5, change24h: 5.2, marketCap: 42000000000 },
  'DOT': { price: 7.2, change24h: -2.1, marketCap: 9000000000 }
};

// User portfolios (в реальном приложении это будет база данных)
const userPortfolios = new Map();

// Get user's cryptocurrency portfolio
router.get('/portfolio/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const portfolio = userPortfolios.get(userId) || {
      assets: [
        { symbol: 'BTC', balance: 0.15234, purchasePrice: 41000 },
        { symbol: 'ETH', balance: 2.45612, purchasePrice: 2400 },
        { symbol: 'USDT', balance: 1250.00, purchasePrice: 1.00 },
        { symbol: 'ADA', balance: 1500.00, purchasePrice: 0.45 }
      ],
      totalValue: 0,
      pnl: 0
    };

    // Обогащаем данные текущими ценами
    const enrichedAssets = portfolio.assets.map(asset => {
      const marketData = mockCryptoData[asset.symbol];
      const currentValue = asset.balance * marketData.price;
      const pnl = currentValue - (asset.balance * asset.purchasePrice);
      const pnlPercent = (pnl / (asset.balance * asset.purchasePrice)) * 100;

      return {
        ...asset,
        currentPrice: marketData.price,
        change24h: marketData.change24h,
        currentValue: currentValue,
        pnl: pnl,
        pnlPercent: pnlPercent
      };
    });

    const totalValue = enrichedAssets.reduce((sum, asset) => sum + asset.currentValue, 0);
    const totalPnl = enrichedAssets.reduce((sum, asset) => sum + asset.pnl, 0);

    res.json({
      success: true,
      portfolio: {
        assets: enrichedAssets,
        totalValue: totalValue,
        totalPnl: totalPnl,
        totalPnlPercent: (totalPnl / (totalValue - totalPnl)) * 100
      }
    });
  } catch (error) {
    console.error('Error getting portfolio:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get current cryptocurrency prices
router.get('/prices', (req, res) => {
  try {
    // Симулируем небольшие изменения цен
    const updatedPrices = Object.keys(mockCryptoData).reduce((acc, symbol) => {
      const data = mockCryptoData[symbol];
      const priceChange = (Math.random() - 0.5) * 0.02; // ±1% изменение

      acc[symbol] = {
        price: data.price * (1 + priceChange),
        change24h: data.change24h + (priceChange * 100),
        marketCap: data.marketCap,
        lastUpdate: new Date().toISOString()
      };

      return acc;
    }, {});

    res.json({
      success: true,
      prices: updatedPrices,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting prices:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Execute cryptocurrency swap
router.post('/swap', async (req, res) => {
  try {
    const { userId, fromAsset, toAsset, amount } = req.body;

    if (!userId || !fromAsset || !toAsset || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      });
    }

    // Получаем текущие цены
    const fromPrice = mockCryptoData[fromAsset]?.price;
    const toPrice = mockCryptoData[toAsset]?.price;

    if (!fromPrice || !toPrice) {
      return res.status(400).json({
        success: false,
        message: 'Invalid asset pair'
      });
    }

    // Рассчитываем количество получаемых токенов
    const exchangeRate = fromPrice / toPrice;
    const fee = 0.003; // 0.3% комиссия
    const toAmount = (amount * exchangeRate) * (1 - fee);

    // Симулируем выполнение swap
    const swapResult = {
      transactionId: `swap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fromAsset,
      toAsset,
      fromAmount: amount,
      toAmount: toAmount,
      exchangeRate: exchangeRate,
      fee: amount * exchangeRate * fee,
      feePercent: fee * 100,
      status: 'completed',
      timestamp: new Date().toISOString()
    };

    // В реальном приложении здесь бы обновлялся портфель пользователя
    console.log('Swap executed:', swapResult);

    res.json({
      success: true,
      swap: swapResult
    });
  } catch (error) {
    console.error('Error executing swap:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get AI recommendations for portfolio optimization
router.get('/ai-recommendations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Получаем портфель пользователя
    const portfolio = userPortfolios.get(userId) || {
      assets: [
        { symbol: 'BTC', balance: 0.15234, purchasePrice: 41000 },
        { symbol: 'ETH', balance: 2.45612, purchasePrice: 2400 },
        { symbol: 'USDT', balance: 1250.00, purchasePrice: 1.00 },
        { symbol: 'ADA', balance: 1500.00, purchasePrice: 0.45 }
      ]
    };

    // Обогащаем данные текущими ценами
    const enrichedAssets = portfolio.assets.map(asset => {
      const marketData = mockCryptoData[asset.symbol];
      const currentValue = asset.balance * marketData.price;
      const pnl = currentValue - (asset.balance * asset.purchasePrice);
      const pnlPercent = (pnl / (asset.balance * asset.purchasePrice)) * 100;

      return {
        ...asset,
        currentPrice: marketData.price,
        change24h: marketData.change24h,
        currentValue: currentValue,
        pnl: pnl,
        pnlPercent: pnlPercent
      };
    });

    // Запускаем Multi-Agent анализ портфеля
    console.log(`🤖 Запуск Multi-Agent анализа для пользователя: ${userId}`);
    const aiAnalysis = await portfolioAnalyzer.analyzePortfolio(userId, enrichedAssets, {
      marketConditions: 'neutral',
      volatilityLevel: 'medium'
    });

    // Преобразуем результаты анализа в формат для API
    const recommendations = [
      ...aiAnalysis.recommendations.map(rec => ({
        id: rec.id,
        type: rec.type.toLowerCase(),
        title: rec.title,
        description: rec.description,
        confidence: Math.round(rec.confidence * 100),
        impact: rec.impact,
        reasoning: rec.reasoning,
        suggestedAction: rec.action,
        priority: rec.priority,
        created: new Date().toISOString()
      })),
      ...aiAnalysis.rebalancingSuggestions.map((sug, index) => ({
        id: `rebalance_${index}`,
        type: sug.type.toLowerCase(),
        title: 'Ребалансировка портфеля',
        description: sug.description,
        confidence: 80,
        impact: sug.priority === 'high' ? 'high' : 'medium',
        reasoning: 'AI анализ диверсификации портфеля',
        suggestedAction: sug.action,
        priority: sug.priority,
        created: new Date().toISOString()
      }))
    ];

    // Добавляем алерты как высокоприоритетные рекомендации
    aiAnalysis.alerts.forEach((alert, index) => {
      recommendations.unshift({
        id: `alert_${index}`,
        type: alert.type.toLowerCase(),
        title: 'Важное уведомление',
        description: alert.message,
        confidence: 95,
        impact: 'high',
        reasoning: 'AI мониторинг рыночных условий',
        suggestedAction: 'Требует немедленного внимания',
        priority: 'urgent',
        created: new Date().toISOString()
      });
    });

    console.log(`✅ Multi-Agent анализ завершен. Сгенерировано рекомендаций: ${recommendations.length}`);

    res.json({
      success: true,
      recommendations: recommendations,
      generated: new Date().toISOString(),
      aiModel: 'NeuroGrid Multi-Agent AI v2.1',
      analysisMetrics: {
        portfolioValue: aiAnalysis.portfolioValue,
        riskScore: aiAnalysis.riskAnalysis.portfolioRiskScore,
        diversificationIndex: aiAnalysis.riskAnalysis.diversificationIndex,
        sentimentScore: aiAnalysis.marketSentiment.sentimentScore
      }
    });
  } catch (error) {
    console.error('❌ Ошибка Multi-Agent анализа:', error);
    res.status(500).json({
      success: false,
      message: 'AI analysis temporarily unavailable',
      fallback: true
    });
  }
});

// Get market sentiment analysis
router.get('/market-sentiment', (req, res) => {
  try {
    const sentiment = {
      overall: {
        score: 67,
        label: 'Neutral-Bullish',
        description: 'Рынок показывает умеренный оптимизм'
      },
      assets: {
        'BTC': { score: 75, label: 'Bullish', trend: 'up' },
        'ETH': { score: 80, label: 'Very Bullish', trend: 'up' },
        'USDT': { score: 50, label: 'Neutral', trend: 'stable' },
        'ADA': { score: 65, label: 'Neutral-Bullish', trend: 'up' }
      },
      factors: [
        {
          name: 'Technical Analysis',
          impact: 'positive',
          weight: 0.3,
          description: 'Большинство индикаторов показывают восходящий тренд'
        },
        {
          name: 'News Sentiment',
          impact: 'neutral',
          weight: 0.25,
          description: 'Смешанные новости, но преобладает позитив'
        },
        {
          name: 'Social Media',
          impact: 'positive',
          weight: 0.2,
          description: 'Высокая активность в социальных сетях'
        },
        {
          name: 'Volume Analysis',
          impact: 'neutral',
          weight: 0.25,
          description: 'Объемы торгов на среднем уровне'
        }
      ],
      lastUpdate: new Date().toISOString()
    };

    res.json({
      success: true,
      sentiment: sentiment
    });
  } catch (error) {
    console.error('Error getting market sentiment:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get staking opportunities
router.get('/staking-opportunities', (req, res) => {
  try {
    const opportunities = [
      {
        asset: 'ETH',
        protocol: 'Ethereum 2.0',
        apy: 4.5,
        minAmount: 0.01,
        lockPeriod: '0 days',
        risk: 'low',
        description: 'Нативный стейкинг Ethereum'
      },
      {
        asset: 'ADA',
        protocol: 'Cardano Staking',
        apy: 5.2,
        minAmount: 10,
        lockPeriod: '0 days',
        risk: 'low',
        description: 'Делегирование в стейкинг пулы Cardano'
      },
      {
        asset: 'SOL',
        protocol: 'Solana Staking',
        apy: 7.1,
        minAmount: 1,
        lockPeriod: '2-3 days',
        risk: 'medium',
        description: 'Стейкинг в сети Solana'
      }
    ];

    res.json({
      success: true,
      opportunities: opportunities
    });
  } catch (error) {
    console.error('Error getting staking opportunities:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get transaction history
router.get('/transactions/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0, type } = req.query;

    // Mock transaction data
    const mockTransactions = [
      {
        id: 'tx_001',
        type: 'swap',
        fromAsset: 'BTC',
        toAsset: 'ETH',
        fromAmount: 0.01,
        toAmount: 0.168,
        fee: 0.0003,
        status: 'completed',
        timestamp: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 'tx_002',
        type: 'deposit',
        asset: 'USDT',
        amount: 500,
        fee: 0,
        status: 'completed',
        timestamp: new Date(Date.now() - 7200000).toISOString()
      },
      {
        id: 'tx_003',
        type: 'staking_reward',
        asset: 'ADA',
        amount: 12.5,
        fee: 0,
        status: 'completed',
        timestamp: new Date(Date.now() - 86400000).toISOString()
      }
    ];

    let filteredTransactions = mockTransactions;
    if (type && type !== 'all') {
      filteredTransactions = mockTransactions.filter(tx => tx.type === type);
    }

    const paginatedTransactions = filteredTransactions
      .slice(Number(offset), Number(offset) + Number(limit));

    res.json({
      success: true,
      transactions: paginatedTransactions,
      total: filteredTransactions.length,
      hasMore: Number(offset) + Number(limit) < filteredTransactions.length
    });
  } catch (error) {
    console.error('Error getting transactions:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Quick AI analysis endpoint for real-time recommendations
router.post('/quick-analysis', async (req, res) => {
  try {
    const { portfolioData } = req.body;

    if (!portfolioData || !Array.isArray(portfolioData)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid portfolio data'
      });
    }

    console.log('🚀 Запуск быстрого анализа портфеля');

    // Быстрый анализ через Multi-Agent систему
    const quickRecommendations = await portfolioAnalyzer.quickAnalysis(portfolioData);

    res.json({
      success: true,
      recommendations: quickRecommendations,
      analysisType: 'quick',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in quick analysis:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Portfolio monitoring endpoint
router.post('/monitor-changes/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { previousPortfolio, currentPortfolio } = req.body;

    if (!previousPortfolio || !currentPortfolio) {
      return res.status(400).json({
        success: false,
        message: 'Missing portfolio data'
      });
    }

    console.log(`👁️ Мониторинг изменений портфеля для пользователя: ${userId}`);

    const changeAnalysis = await portfolioAnalyzer.monitorPortfolioChanges(
      userId,
      previousPortfolio,
      currentPortfolio
    );

    res.json({
      success: true,
      changes: changeAnalysis,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error monitoring portfolio changes:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// AI performance metrics
router.get('/ai-performance', (req, res) => {
  try {
    const stats = portfolioAnalyzer.getPerformanceStats();

    res.json({
      success: true,
      performance: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting AI performance:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
