/**
 * MVP Configuration for Product Hunt Launch
 * Минимальный набор функций для демонстрации
 */

module.exports = {
  // MVP FEATURES - только критически важное
  features: {
    enabled: [
      'auth',           // Базовая аутентификация
      'task_queue',     // Простая очередь задач
      'basic_ui',       // Web интерфейс
      'single_model'    // Только одна модель
    ],
    disabled: [
      'monitoring',     // Отложено
      'websockets',     // Отложено  
      'billing',        // Отложено
      'multiple_models' // Отложено
    ]
  },

  // ОДНА МОДЕЛЬ для демо
  models: {
    enabled: ['text-generation'],
    primary: 'llama2:7b',
    fallback: 'mock-model' // Для демо если нет GPU
  },

  // MVP LIMITS
  limits: {
    max_nodes: 3,           // Максимум 3 тестовые ноды
    max_tasks_per_hour: 100, // 100 задач/час для начала
    max_task_duration: 30,   // 30 секунд макс
    demo_users: 50          // 50 бета-пользователей
  },

  // DEMO MODE настройки
  demo: {
    enabled: true,
    mock_responses: true,    // Если нет реальных нод
    sample_tasks: [
      "Объясни квантовую физику простыми словами",
      "Напиши короткое стихотворение про AI",
      "Создай план изучения Python за месяц"
    ]
  },

  // PRODUCT HUNT специфичные настройки
  product_hunt: {
    special_offers: {
      free_tasks: 1000,      // 1000 бесплатных задач
      early_adopter_bonus: 2000,
      lifetime_discount: 15   // 15% скидка навсегда
    },
    
    landing: {
      title: "NeuroGrid - Airbnb for AI Computing",
      tagline: "Turn idle GPUs into affordable AI power",
      demo_available: true,
      waitlist_enabled: true
    }
  }
};