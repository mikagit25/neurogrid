/**
 * Performance Monitor для NeuroGrid Enhanced Server
 * Мониторинг производительности, памяти и ресурсов
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        averageResponseTime: 0,
        responseTime: []
      },
      system: {
        memoryUsage: [],
        cpuUsage: [],
        uptime: process.uptime(),
        startTime: Date.now()
      },
      webSocket: {
        connections: 0,
        messagesSent: 0,
        messagesReceived: 0,
        errors: 0
      }
    };
    
    // Периодический сбор системных метрик
    this.startSystemMonitoring();
    
    console.log('📈 Performance Monitor initialized');
  }
  
  /**
   * Запуск мониторинга системных ресурсов
   */
  startSystemMonitoring() {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const currentTime = Date.now();
      
      this.metrics.system.memoryUsage.push({
        timestamp: currentTime,
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024) // MB
      });
      
      // Ограничиваем количество записей
      if (this.metrics.system.memoryUsage.length > 100) {
        this.metrics.system.memoryUsage.shift();
      }
      
    }, 10000); // Каждые 10 секунд
  }
  
  /**
   * Записать начало обработки запроса
   */
  recordRequestStart() {
    return Date.now();
  }
  
  /**
   * Записать завершение обработки запроса
   */
  recordRequestEnd(startTime, success = true) {
    const responseTime = Date.now() - startTime;
    
    this.metrics.requests.total++;
    if (success) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
    }
    
    this.metrics.requests.responseTime.push(responseTime);
    
    // Ограничиваем массив времён ответов
    if (this.metrics.requests.responseTime.length > 1000) {
      this.metrics.requests.responseTime.shift();
    }
    
    // Пересчитываем среднее время ответа
    this.calculateAverageResponseTime();
    
    return responseTime;
  }
  
  /**
   * Вычисление среднего времени ответа
   */
  calculateAverageResponseTime() {
    if (this.metrics.requests.responseTime.length === 0) return;
    
    const sum = this.metrics.requests.responseTime.reduce((acc, time) => acc + time, 0);
    this.metrics.requests.averageResponseTime = Math.round(sum / this.metrics.requests.responseTime.length);
  }
  
  /**
   * WebSocket метрики
   */
  recordWebSocketConnection() {
    this.metrics.webSocket.connections++;
  }
  
  recordWebSocketDisconnection() {
    this.metrics.webSocket.connections--;
  }
  
  recordWebSocketMessageSent() {
    this.metrics.webSocket.messagesSent++;
  }
  
  recordWebSocketMessageReceived() {
    this.metrics.webSocket.messagesReceived++;
  }
  
  recordWebSocketError() {
    this.metrics.webSocket.errors++;
  }
  
  /**
   * Получить текущие метрики производительности
   */
  getMetrics() {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    return {
      timestamp: new Date().toISOString(),
      requests: {
        ...this.metrics.requests,
        successRate: this.metrics.requests.total > 0 ? 
          Math.round((this.metrics.requests.successful / this.metrics.requests.total) * 100) : 0
      },
      system: {
        uptime: Math.round(uptime),
        memory: {
          current: {
            rss: Math.round(memUsage.rss / 1024 / 1024),
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
            external: Math.round(memUsage.external / 1024 / 1024)
          },
          history: this.metrics.system.memoryUsage.slice(-10) // Последние 10 записей
        },
        process: {
          pid: process.pid,
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version
        }
      },
      webSocket: { ...this.metrics.webSocket }
    };
  }
  
  /**
   * Получить краткую сводку производительности
   */
  getSummary() {
    const metrics = this.getMetrics();
    
    return {
      status: 'OK',
      uptime: metrics.system.uptime,
      requests: metrics.requests.total,
      successRate: metrics.requests.successRate,
      avgResponseTime: metrics.requests.averageResponseTime,
      memoryUsed: metrics.system.memory.current.heapUsed,
      webSocketConnections: metrics.webSocket.connections,
      timestamp: metrics.timestamp
    };
  }
  
  /**
   * Логирование производительности
   */
  logPerformanceStats() {
    const summary = this.getSummary();
    
    console.log(`📊 Performance Summary:`);
    console.log(`   🕐 Uptime: ${summary.uptime}s`);
    console.log(`   📊 Requests: ${summary.requests} (${summary.successRate}% success)`);
    console.log(`   ⏱️  Avg Response Time: ${summary.avgResponseTime}ms`);
    console.log(`   💾 Memory: ${summary.memoryUsed}MB`);
    console.log(`   🔌 WebSocket Connections: ${summary.webSocketConnections}`);
  }
}

module.exports = PerformanceMonitor;