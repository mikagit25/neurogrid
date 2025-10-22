# NeuroGrid Payment Gateway Documentation

## Overview

NeuroGrid теперь поддерживает полноценную систему платежей с интеграцией фиатных валют, криптовалют и банковских карт. Система включает в себя:

- 💳 **Stripe** для банковских карт (Visa, Mastercard)
- 💰 **PayPal** для онлайн-платежей
- ₿ **Криптовалюты** (Bitcoin, Ethereum, USDT, USDC)
- 🏦 **Банковские переводы** для крупных сумм

## Архитектура системы

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Client    │    │  Payment Gateway │    │  External APIs  │
│                 │    │                  │    │                 │
│ • Deposit UI    │◄──►│ • Route Handler  │◄──►│ • Stripe API    │
│ • Withdrawal UI │    │ • Validation     │    │ • PayPal API    │
│ • Wallet Mgmt   │    │ • Rate Limiting  │    │ • Crypto APIs   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌──────────────────┐             │
         │              │ PaymentGateway   │             │
         │              │ Service          │             │
         │              │                  │             │
         │              │ • Process Intents│             │
         │              │ • Handle Webhooks│             │
         │              │ • Exchange Rates │             │
         │              └──────────────────┘             │
         │                       │                       │
         │                       ▼                       │
         │              ┌──────────────────┐             │
         └─────────────►│ TokenEngine      │◄────────────┘
                        │                  │
                        │ • Credit Tokens  │
                        │ • Debit Tokens   │
                        │ • Transaction Log│
                        └──────────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │ Database         │
                        │                  │
                        │ • payment_intents│
                        │ • external_wallets│
                        │ • transactions   │
                        │ • exchange_rates │
                        └──────────────────┘
```

## API Endpoints

### 🔍 Информация о платежах

#### GET /api/payments/methods
Получить доступные методы оплаты для суммы и валюты.

**Параметры:**
```json
{
  "currency": "USD|EUR|RUB|GBP|BTC|ETH|USDT",
  "amount": 100.0,
  "type": "deposit|withdrawal"
}
```

**Ответ:**
```json
{
  "success": true,
  "methods": [
    {
      "id": "stripe",
      "name": "Stripe",
      "type": "card",
      "fees": {
        "percentage": 2.9,
        "fixed": 0.30,
        "total": 3.20
      },
      "processingTime": "Instant",
      "limits": {
        "min": 1,
        "max": 10000,
        "daily": 50000
      }
    }
  ]
}
```

#### GET /api/payments/rates
Получить актуальные курсы обмена.

**Ответ:**
```json
{
  "success": true,
  "rates": {
    "USD/NGRID": 10.0,
    "EUR/NGRID": 9.2,
    "BTC/NGRID": 300000.0
  },
  "lastUpdated": "2025-10-22T10:00:00Z"
}
```

### 💰 Депозиты

#### POST /api/payments/deposit
Создать депозит.

**Тело запроса:**
```json
{
  "amount": 100.0,
  "currency": "USD",
  "paymentMethod": "stripe",
  "returnUrl": "https://app.neurogrid.ai/payment/success",
  "metadata": {
    "userId": "user-123"
  }
}
```

**Ответ:**
```json
{
  "success": true,
  "paymentIntent": {
    "id": "tx_1699123456_abc123",
    "amount": 100.0,
    "currency": "USD",
    "tokenAmount": 1000.0,
    "paymentMethod": "stripe",
    "fees": {
      "percentage": 2.9,
      "fixed": 0.30,
      "total": 3.20
    },
    "netAmount": 96.80,
    "expiresAt": "2025-10-22T10:30:00Z",
    "providerData": {
      "stripe_payment_intent_id": "pi_abc123",
      "client_secret": "pi_abc123_secret_def456"
    }
  }
}
```

### 💸 Выводы

#### POST /api/payments/withdraw
Создать запрос на вывод средств.

**Тело запроса:**
```json
{
  "tokenAmount": 1000.0,
  "currency": "USD", 
  "withdrawalMethod": "paypal",
  "destination": {
    "email": "user@example.com"
  }
}
```

**Ответ:**
```json
{
  "success": true,
  "withdrawalRequest": {
    "id": "tx_1699123456_def789",
    "tokenAmount": 1000.0,
    "fiatAmount": 100.0,
    "currency": "USD",
    "withdrawalMethod": "paypal",
    "fees": {
      "percentage": 3.4,
      "fixed": 0.35,
      "total": 3.75
    },
    "netAmount": 96.25,
    "status": "pending_approval",
    "createdAt": "2025-10-22T10:00:00Z"
  }
}
```

### 👛 Управление кошельками

#### GET /api/wallets
Получить кошельки пользователя.

**Ответ:**
```json
{
  "success": true,
  "wallets": {
    "internal": {
      "id": "wallet_123",
      "type": "internal",
      "status": "active",
      "balances": {
        "NGRID": 1500.0,
        "USD": 0,
        "EUR": 0
      }
    },
    "external": [
      {
        "id": "wallet_456",
        "type": "crypto",
        "currency": "BTC",
        "label": "My BTC Wallet",
        "isDefault": true,
        "isVerified": true,
        "address": "1A1zP1...DivfNa"
      }
    ],
    "total": 2
  }
}
```

#### POST /api/wallets/external
Добавить внешний кошелек.

**Тело запроса:**
```json
{
  "type": "crypto",
  "currency": "BTC",
  "address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
  "label": "My Bitcoin Wallet",
  "isDefault": false
}
```

## Поддерживаемые валюты

### 💵 Фиатные валюты
- **USD** - Доллар США (минимум: $10)
- **EUR** - Евро (минимум: €10) 
- **RUB** - Российский рубль (минимум: ₽500)
- **GBP** - Британский фунт (минимум: £8)

### ₿ Криптовалюты
- **BTC** - Bitcoin (минимум: 0.001 BTC)
- **ETH** - Ethereum (минимум: 0.01 ETH)
- **USDT** - Tether (минимум: $10)
- **USDC** - USD Coin (минимум: $10)

## Курсы обмена

Система автоматически обновляет курсы обмена каждые 5 минут:

```javascript
// Примерные курсы NGRID токенов
USD/NGRID: 10.0    // 1 USD = 10 NGRID
EUR/NGRID: 9.2     // 1 EUR = 9.2 NGRID
RUB/NGRID: 150.0   // 1 RUB = 150 NGRID
BTC/NGRID: 300000  // 1 BTC = 300,000 NGRID
```

## Комиссии

### 📊 Структура комиссий
- **Stripe (карты)**: 2.9% + $0.30
- **PayPal**: 3.4% + $0.35
- **Криптовалюты**: 1.0%
- **Банковские переводы**: 0.5% + $5.00 (мин. $100)

## Процесс платежа

### 🔄 Жизненный цикл депозита

1. **Создание intent** - пользователь выбирает сумму и метод
2. **Оплата** - перенаправление к провайдеру
3. **Webhook** - получение подтверждения оплаты
4. **Зачисление токенов** - автоматическое пополнение баланса
5. **Уведомление** - пользователь получает подтверждение

### 💸 Жизненный цикл вывода

1. **Запрос** - указание суммы и назначения
2. **Резерв токенов** - списание с баланса
3. **Модерация** - проверка администратором (для крупных сумм)
4. **Обработка** - перевод через провайдера
5. **Завершение** - подтверждение успешного перевода

## Безопасность

### 🔐 Меры безопасности

- **Rate limiting** - ограничение частоты запросов
- **Webhook подписи** - проверка подлинности вебхуков
- **Шифрование данных** - все sensitive данные зашифрованы
- **2FA верификация** - двухфакторная аутентификация кошельков
- **Лимиты** - дневные и месячные лимиты на операции

### 🛡️ Защита от мошенничества

- Верификация внешних кошельков
- Задержки для крупных выводов
- Мониторинг подозрительной активности
- Blacklist известных мошеннических адресов

## Интеграция

### 🔧 Настройка переменных окружения

```bash
# Stripe
STRIPE_ENABLED=true
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret

# PayPal  
PAYPAL_ENABLED=true
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_secret

# Crypto
CRYPTO_ENABLED=true
CRYPTO_API_KEY=your_api_key
BITCOIN_NETWORK=testnet
ETHEREUM_NETWORK=goerli
```

### 📱 Frontend интеграция

```javascript
// Создание депозита
const deposit = await fetch('/api/payments/deposit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    amount: 100,
    currency: 'USD',
    paymentMethod: 'stripe'
  })
});

const { paymentIntent } = await deposit.json();

// Перенаправление в Stripe
if (paymentIntent.providerData.client_secret) {
  // Используйте Stripe Elements для завершения оплаты
}
```

## Мониторинг

### 📊 Метрики

- Общий объем транзакций
- Успешность платежей по провайдерам
- Средние комиссии
- Время обработки
- Количество активных кошельков

### 🚨 Алерты

- Превышение лимитов ошибок
- Подозрительная активность
- Проблемы с провайдерами
- Критически низкие балансы ликвидности

## Поддержка

Для технической поддержки по платежам:
- 📧 Email: payments@neurogrid.ai
- 💬 Telegram: @neurogrid_support
- 📞 Phone: +1-555-NEUROGRID

Время работы: 24/7 для критических вопросов, 9:00-18:00 UTC для общих вопросов.