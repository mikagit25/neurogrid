import Head from 'next/head';

export default function Home() {
  return (
    <div>
      <Head>
        <title>NeuroGrid - Distributed AI Platform</title>
        <meta name="description" content="Decentralized AI inference network" />
      </Head>
      
      <main style={{ padding: '2rem', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
        <h1 style={{ color: '#667eea', fontSize: '3rem' }}>🚀 NeuroGrid</h1>
        <p style={{ fontSize: '1.2rem', marginBottom: '2rem' }}>
          Распределенная AI платформа
        </p>
        <div style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '2rem',
          borderRadius: '10px',
          margin: '2rem 0'
        }}>
          <h2>Добро пожаловать!</h2>
          <p>Основной интерфейс скоро будет доступен</p>
        </div>
        <a 
          href="http://neurogrid.network" 
          style={{
            padding: '15px 30px',
            background: '#ff6b6b',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '5px',
            fontWeight: 'bold'
          }}
        >
          ← Вернуться на главную
        </a>
      </main>
    </div>
  );
}
