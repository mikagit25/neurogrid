import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';

export default function Home() {
  const [stats] = useState({
    totalNodes: 1247,
    activeJobs: 89,
    totalEarnings: 2834.56,
    onlineUsers: 342
  });

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <Head>
        <title>NeuroGrid - Distributed AI Platform</title>
        <meta name="description" content="Decentralized AI inference network" />
      </Head>
      
      {/* Header */}
      <header style={{ padding: '1rem 2rem', backgroundColor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ color: 'white', margin: 0, fontSize: '1.8rem' }}>🚀 NeuroGrid</h1>
          <nav style={{ display: 'flex', gap: '1rem' }}>
            <Link href="/wallet" style={{ color: 'white', textDecoration: 'none', padding: '0.5rem 1rem', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '5px' }}>
              💰 Кошелек
            </Link>
            <a href="https://neurogrid.network" style={{ color: 'white', textDecoration: 'none', padding: '0.5rem 1rem', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '5px' }}>
              🏠 Главная
            </a>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Hero Section */}
        <section style={{ textAlign: 'center', marginBottom: '3rem', color: 'white' }}>
          <h2 style={{ fontSize: '3rem', marginBottom: '1rem', textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
            Распределенная AI платформа
          </h2>
          <p style={{ fontSize: '1.2rem', marginBottom: '2rem', opacity: 0.9 }}>
            Подключайтесь к сети NeuroGrid и зарабатывайте на AI вычислениях
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/wallet" style={{ 
              padding: '15px 30px', 
              backgroundColor: '#ff6b6b', 
              color: 'white', 
              textDecoration: 'none', 
              borderRadius: '10px', 
              fontWeight: 'bold',
              boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
              transition: 'transform 0.2s'
            }}>
              💰 Открыть кошелек
            </Link>
            <a href="https://neurogrid.network" style={{ 
              padding: '15px 30px', 
              backgroundColor: 'rgba(255,255,255,0.2)', 
              color: 'white', 
              textDecoration: 'none', 
              borderRadius: '10px', 
              fontWeight: 'bold',
              border: '2px solid rgba(255,255,255,0.3)'
            }}>
              📋 Узнать больше
            </a>
          </div>
        </section>

        {/* Stats Grid */}
        <section style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
            <div style={{ 
              backgroundColor: 'rgba(255,255,255,0.15)', 
              padding: '1.5rem', 
              borderRadius: '15px', 
              textAlign: 'center',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🖥️</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                {stats.totalNodes.toLocaleString()}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.8)' }}>Активных узлов</div>
            </div>

            <div style={{ 
              backgroundColor: 'rgba(255,255,255,0.15)', 
              padding: '1.5rem', 
              borderRadius: '15px', 
              textAlign: 'center',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⚡</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                {stats.activeJobs}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.8)' }}>AI задач в работе</div>
            </div>

            <div style={{ 
              backgroundColor: 'rgba(255,255,255,0.15)', 
              padding: '1.5rem', 
              borderRadius: '15px', 
              textAlign: 'center',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>💎</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                ${stats.totalEarnings.toFixed(2)}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.8)' }}>Общий доход</div>
            </div>

            <div style={{ 
              backgroundColor: 'rgba(255,255,255,0.15)', 
              padding: '1.5rem', 
              borderRadius: '15px', 
              textAlign: 'center',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👥</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
                {stats.onlineUsers}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.8)' }}>Пользователей онлайн</div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section style={{ marginBottom: '3rem' }}>
          <h3 style={{ textAlign: 'center', color: 'white', fontSize: '2rem', marginBottom: '2rem' }}>
            Возможности платформы
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            <div style={{ 
              backgroundColor: 'rgba(255,255,255,0.1)', 
              padding: '2rem', 
              borderRadius: '15px',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              <h4 style={{ color: '#fff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                💰 <span>Управление кошельком</span>
              </h4>
              <p style={{ color: 'rgba(255,255,255,0.8)', lineHeight: '1.6' }}>
                Отслеживайте баланс, историю транзакций и управляйте своими токенами в удобном интерфейсе.
              </p>
              <Link href="/wallet" style={{ 
                color: '#ff6b6b', 
                textDecoration: 'none', 
                fontWeight: 'bold',
                display: 'inline-block',
                marginTop: '1rem'
              }}>
                Открыть кошелек →
              </Link>
            </div>

            <div style={{ 
              backgroundColor: 'rgba(255,255,255,0.1)', 
              padding: '2rem', 
              borderRadius: '15px',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              <h4 style={{ color: '#fff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🚀 <span>AI вычисления</span>
              </h4>
              <p style={{ color: 'rgba(255,255,255,0.8)', lineHeight: '1.6' }}>
                Предоставляйте вычислительные мощности для AI задач и получайте вознаграждение за каждую выполненную операцию.
              </p>
              <a href="https://neurogrid.network#demo" style={{ 
                color: '#ff6b6b', 
                textDecoration: 'none', 
                fontWeight: 'bold',
                display: 'inline-block',
                marginTop: '1rem'
              }}>
                Попробовать демо →
              </a>
            </div>

            <div style={{ 
              backgroundColor: 'rgba(255,255,255,0.1)', 
              padding: '2rem', 
              borderRadius: '15px',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              <h4 style={{ color: '#fff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📊 <span>Аналитика</span>
              </h4>
              <p style={{ color: 'rgba(255,255,255,0.8)', lineHeight: '1.6' }}>
                Детальная статистика доходов, производительности и эффективности вашего участия в сети.
              </p>
              <a href="https://api.neurogrid.network/health" style={{ 
                color: '#ff6b6b', 
                textDecoration: 'none', 
                fontWeight: 'bold',
                display: 'inline-block',
                marginTop: '1rem'
              }}>
                API статус →
              </a>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer style={{ 
        textAlign: 'center', 
        padding: '2rem', 
        backgroundColor: 'rgba(0,0,0,0.2)', 
        color: 'rgba(255,255,255,0.7)',
        marginTop: '3rem'
      }}>
        <p>© 2025 NeuroGrid - Распределенная AI платформа. Все права защищены.</p>
        <p>
          <a href="https://neurogrid.network" style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>
            Главная страница
          </a>
          {' | '}
          <a href="https://api.neurogrid.network/health" style={{ color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>
            API статус
          </a>
        </p>
      </footer>
    </div>
  );
}