const MultiAgentCoordinator = require('./MultiAgentCoordinator');
const NodeReputationSystem = require('./NodeReputationSystem');

class CryptoPortfolioAnalyzer {
  constructor() {
    this.multiAgentCoordinator = new MultiAgentCoordinator();
    this.reputationSystem = new NodeReputationSystem();
    this.activeAnalyses = new Map();
    this.analysisHistory = [];
    this.marketData = new Map();
  }

  // Главный метод анализа портфеля через Multi-Agent систему
  async analyzePortfolio(userId, portfolioData, marketContext = {}) {
    console.log(`🔍 Запуск Multi-Agent анализа портфеля для пользователя: ${userId}`);

    try {
      const analysisId = `portfolio_analysis_${userId}_${Date.now()}`;

      // Создаем комплексную задачу для Multi-Agent системы
      const complexTask = {
        id: analysisId,
        type: 'CRYPTO_PORTFOLIO_ANALYSIS',
        priority: 'HIGH',
        input: {
          portfolio: portfolioData,
          marketContext: marketContext,
          userId: userId,
          timestamp: new Date().toISOString()
        },
        requirements: [
          'Анализ текущего состава портфеля',
          'Оценка рисков и диверсификации',
          'Поиск арбитражных возможностей',
          'Прогноз доходности на основе технического анализа',
          'Рекомендации по ребалансировке',
          'Анализ рыночных настроений'
        ]
      };

      // Запускаем Multi-Agent анализ
      const result = await this.multiAgentCoordinator.processComplexTask(complexTask);

      // Обрабатываем результаты и создаем структурированный ответ
      const structuredAnalysis = await this.processAgentResults(result, portfolioData);

      // Сохраняем анализ в историю
      this.saveAnalysisToHistory(userId, structuredAnalysis);

      console.log(`✅ Анализ портфеля завершен для пользователя: ${userId}`);
      return structuredAnalysis;

    } catch (error) {
      console.error('❌ Ошибка при анализе портфеля:', error);
      throw new Error(`Portfolio analysis failed: ${error.message}`);
    }
  }

  // Обработка результатов от различных агентов
  async processAgentResults(agentResults, portfolioData) {
    const analysis = {
      timestamp: new Date().toISOString(),
      portfolioValue: this.calculatePortfolioValue(portfolioData),
      riskAnalysis: {},
      recommendations: [],
      arbitrageOpportunities: [],
      marketSentiment: {},
      performancePrediction: {},
      rebalancingSuggestions: [],
      alerts: []
    };

    // Обрабатываем результаты от каждого агента
    for (const [agentType, agentResult] of Object.entries(agentResults.results)) {
      switch (agentType) {
      case 'TEXT_AGENT':
        analysis.marketSentiment = this.processTextAgentResults(agentResult);
        break;

      case 'CODE_AGENT':
        analysis.riskAnalysis = this.processCodeAgentResults(agentResult);
        break;

      case 'DATA_AGENT':
        analysis.arbitrageOpportunities = this.processDataAgentResults(agentResult);
        break;

      case 'IMAGE_AGENT':
        analysis.performancePrediction = this.processImageAgentResults(agentResult);
        break;

      case 'AGGREGATOR_AGENT':
        analysis.recommendations = this.processAggregatorResults(agentResult);
        break;
      }
    }

    // Генерируем общие рекомендации
    analysis.rebalancingSuggestions = this.generateRebalancingSuggestions(analysis, portfolioData);
    analysis.alerts = this.generateAlerts(analysis, portfolioData);

    return analysis;
  }

  // Обработка результатов Text Agent (анализ новостей и настроений)
  processTextAgentResults(textResults) {
    return {
      overallSentiment: textResults.analysis?.sentiment || 'neutral',
      sentimentScore: textResults.analysis?.score || 50,
      newsImpact: textResults.analysis?.newsImpact || [],
      socialSentiment: textResults.analysis?.socialMedia || {},
      keyEvents: textResults.analysis?.events || [],
      confidenceLevel: textResults.confidence || 0.7
    };
  }

  // Обработка результатов Code Agent (технический анализ)
  processCodeAgentResults(codeResults) {
    return {
      portfolioRiskScore: codeResults.analysis?.riskScore || 0,
      diversificationIndex: codeResults.analysis?.diversification || 0,
      volatilityMetrics: codeResults.analysis?.volatility || {},
      correlationMatrix: codeResults.analysis?.correlation || {},
      valueAtRisk: codeResults.analysis?.VaR || {},
      sharpeRatio: codeResults.analysis?.sharpe || 0,
      confidenceLevel: codeResults.confidence || 0.8
    };
  }

  // Обработка результатов Data Agent (анализ данных и арбитраж)
  processDataAgentResults(dataResults) {
    const opportunities = dataResults.analysis?.arbitrage || [];

    return opportunities.map(opp => ({
      id: `arbitrage_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: 'PRICE_ARBITRAGE',
      fromExchange: opp.from || 'Unknown',
      toExchange: opp.to || 'Unknown',
      asset: opp.asset || '',
      priceDifference: opp.difference || 0,
      potentialProfit: opp.profit || 0,
      timeWindow: opp.timeWindow || 300, // 5 минут по умолчанию
      confidence: opp.confidence || 0.6,
      riskLevel: opp.risk || 'medium'
    }));
  }

  // Обработка результатов Image Agent (графический анализ)
  processImageAgentResults(imageResults) {
    return {
      technicalPatterns: imageResults.analysis?.patterns || [],
      supportResistanceLevels: imageResults.analysis?.levels || {},
      trendAnalysis: imageResults.analysis?.trends || {},
      chartSignals: imageResults.analysis?.signals || [],
      priceTargets: imageResults.analysis?.targets || {},
      timeHorizon: imageResults.analysis?.timeframe || '1M',
      confidenceLevel: imageResults.confidence || 0.6
    };
  }

  // Обработка результатов Aggregator Agent (общие рекомендации)
  processAggregatorResults(aggregatorResults) {
    const recommendations = aggregatorResults.analysis?.recommendations || [];

    return recommendations.map(rec => ({
      id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: rec.type || 'GENERAL',
      title: rec.title || 'Рекомендация',
      description: rec.description || '',
      action: rec.action || '',
      priority: rec.priority || 'medium',
      confidence: rec.confidence || 0.7,
      impact: rec.impact || 'medium',
      timeframe: rec.timeframe || 'short',
      reasoning: rec.reasoning || '',
      expectedOutcome: rec.outcome || ''
    }));
  }

  // Генерация предложений по ребалансировке
  generateRebalancingSuggestions(analysis, portfolioData) {
    const suggestions = [];
    const totalValue = this.calculatePortfolioValue(portfolioData);

    // Анализ диверсификации
    if (analysis.riskAnalysis.diversificationIndex < 0.6) {
      suggestions.push({
        type: 'DIVERSIFICATION',
        priority: 'high',
        description: 'Портфель недостаточно диверсифицирован',
        action: 'Рассмотрите добавление активов из других секторов',
        targetAllocation: this.calculateOptimalAllocation(portfolioData)
      });
    }

    // Анализ концентрации
    portfolioData.forEach(asset => {
      const weight = (asset.currentValue || 0) / totalValue;
      if (weight > 0.4) {
        suggestions.push({
          type: 'CONCENTRATION_RISK',
          priority: 'medium',
          asset: asset.symbol,
          description: `Слишком высокая концентрация в ${asset.symbol} (${(weight * 100).toFixed(1)}%)`,
          action: `Рассмотрите частичную фиксацию прибыли по ${asset.symbol}`
        });
      }
    });

    return suggestions;
  }

  // Генерация алертов
  generateAlerts(analysis, portfolioData) {
    const alerts = [];

    // Алерты по арбитражным возможностям
    analysis.arbitrageOpportunities.forEach(opp => {
      if (opp.potentialProfit > 100 && opp.confidence > 0.8) {
        alerts.push({
          type: 'ARBITRAGE_OPPORTUNITY',
          urgency: 'high',
          message: `Выгодный арбитраж: ${opp.asset} - потенциальная прибыль $${opp.potentialProfit}`,
          data: opp
        });
      }
    });

    // Алерты по рискам
    if (analysis.riskAnalysis.portfolioRiskScore > 0.8) {
      alerts.push({
        type: 'HIGH_RISK_WARNING',
        urgency: 'medium',
        message: 'Обнаружен высокий уровень риска в портфеле',
        data: { riskScore: analysis.riskAnalysis.portfolioRiskScore }
      });
    }

    // Алерты по рыночным настроениям
    if (analysis.marketSentiment.sentimentScore < 30) {
      alerts.push({
        type: 'NEGATIVE_SENTIMENT',
        urgency: 'medium',
        message: 'Негативные настроения на рынке - рассмотрите защитные стратегии',
        data: analysis.marketSentiment
      });
    }

    return alerts;
  }

  // Расчет оптимального распределения активов
  calculateOptimalAllocation(portfolioData) {
    // Простая стратегия равного веса с корректировками
    const numAssets = portfolioData.length;
    const baseWeight = 1 / numAssets;

    return portfolioData.map(asset => ({
      symbol: asset.symbol,
      currentWeight: asset.currentValue / this.calculatePortfolioValue(portfolioData),
      targetWeight: baseWeight,
      adjustment: 'rebalance' // buy, sell, hold
    }));
  }

  // Расчет общей стоимости портфеля
  calculatePortfolioValue(portfolioData) {
    return portfolioData.reduce((total, asset) => {
      return total + (asset.currentValue || 0);
    }, 0);
  }

  // Сохранение анализа в историю
  saveAnalysisToHistory(userId, analysis) {
    this.analysisHistory.push({
      userId,
      timestamp: analysis.timestamp,
      analysis: analysis
    });

    // Ограничиваем историю последними 100 записями
    if (this.analysisHistory.length > 100) {
      this.analysisHistory = this.analysisHistory.slice(-100);
    }
  }

  // Получение истории анализов для пользователя
  getAnalysisHistory(userId, limit = 10) {
    return this.analysisHistory
      .filter(record => record.userId === userId)
      .slice(-limit)
      .reverse();
  }

  // Быстрый анализ для real-time рекомендаций
  async quickAnalysis(portfolioData) {
    const quickRecommendations = [];
    const totalValue = this.calculatePortfolioValue(portfolioData);

    // Простые правила для быстрых рекомендаций
    portfolioData.forEach(asset => {
      const weight = (asset.currentValue || 0) / totalValue;

      if (asset.pnlPercent > 20) {
        quickRecommendations.push({
          type: 'PROFIT_TAKING',
          asset: asset.symbol,
          message: `Рассмотрите фиксацию прибыли по ${asset.symbol} (+${asset.pnlPercent.toFixed(1)}%)`,
          confidence: 0.7
        });
      }

      if (asset.pnlPercent < -15) {
        quickRecommendations.push({
          type: 'STOP_LOSS',
          asset: asset.symbol,
          message: `Внимание: убытки по ${asset.symbol} (${asset.pnlPercent.toFixed(1)}%)`,
          confidence: 0.8
        });
      }
    });

    return quickRecommendations;
  }

  // Мониторинг изменений портфеля
  async monitorPortfolioChanges(userId, previousPortfolio, currentPortfolio) {
    const changes = [];

    currentPortfolio.forEach((currentAsset, index) => {
      const previousAsset = previousPortfolio[index];
      if (!previousAsset) return;

      const valueChange = currentAsset.currentValue - previousAsset.currentValue;
      const percentChange = (valueChange / previousAsset.currentValue) * 100;

      if (Math.abs(percentChange) > 5) {
        changes.push({
          asset: currentAsset.symbol,
          change: percentChange,
          impact: Math.abs(valueChange),
          direction: percentChange > 0 ? 'positive' : 'negative'
        });
      }
    });

    if (changes.length > 0) {
      // Запускаем быстрый анализ при значительных изменениях
      return await this.quickAnalysis(currentPortfolio);
    }

    return [];
  }

  // Получение статистики производительности
  getPerformanceStats() {
    return {
      totalAnalyses: this.analysisHistory.length,
      averageConfidence: this.calculateAverageConfidence(),
      successfulRecommendations: this.calculateSuccessRate(),
      activeAnalyses: this.activeAnalyses.size,
      lastAnalysis: this.analysisHistory.length > 0 ?
        this.analysisHistory[this.analysisHistory.length - 1].timestamp : null
    };
  }

  calculateAverageConfidence() {
    if (this.analysisHistory.length === 0) return 0;

    const totalConfidence = this.analysisHistory.reduce((sum, record) => {
      return sum + (record.analysis.recommendations.reduce((recSum, rec) => {
        return recSum + rec.confidence;
      }, 0) / record.analysis.recommendations.length || 0);
    }, 0);

    return totalConfidence / this.analysisHistory.length;
  }

  calculateSuccessRate() {
    // В реальном приложении здесь была бы логика отслеживания успешности рекомендаций
    return Math.random() * 0.3 + 0.7; // Симулируем 70-100% успешность
  }
}

module.exports = CryptoPortfolioAnalyzer;
