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
          Distributed AI Inference Platform
        </p>
        <div style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '2rem',
          borderRadius: '10px',
          margin: '2rem 0'
        }}>
          <h2>Welcome to NeuroGrid!</h2>
          <p>Ready-to-use AI platform with full functionality</p>
          <p>🚀 API Server: http://localhost:3001</p>
          <p>🌐 Web Interface: http://localhost:3000</p>
        </div>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '1rem', 
          margin: '2rem 0' 
        }}>
          <a 
            href="/dashboard.html"
            style={{
              padding: '20px',
              background: '#28a745',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              display: 'block'
            }}
          >
            📊 Dashboard
            <br />
            <small style={{ opacity: 0.8 }}>Main control panel</small>
          </a>
          
          <a 
            href="/wallet.html"
            style={{
              padding: '20px',
              background: '#007bff',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              display: 'block'
            }}
          >
            💰 Wallet
            <br />
            <small style={{ opacity: 0.8 }}>NEURO tokens management</small>
          </a>
          
          <a 
            href="/node-setup.html"
            style={{
              padding: '20px',
              background: '#ff6b6b',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              display: 'block'
            }}
          >
            🖥️ Node Setup
            <br />
            <small style={{ opacity: 0.8 }}>Configure your node</small>
          </a>
          
          <a 
            href="/api-docs.html"
            style={{
              padding: '20px',
              background: '#6f42c1',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              display: 'block'
            }}
          >
            📚 API Docs
            <br />
            <small style={{ opacity: 0.8 }}>Developer resources</small>
          </a>
          
          <a 
            href="/analytics.html"
            style={{
              padding: '20px',
              background: '#fd7e14',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              display: 'block'
            }}
          >
            📈 Analytics
            <br />
            <small style={{ opacity: 0.8 }}>Performance metrics</small>
          </a>
          
          <a 
            href="/profile.html"
            style={{
              padding: '20px',
              background: '#20c997',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              display: 'block'
            }}
          >
            👤 Profile
            <br />
            <small style={{ opacity: 0.8 }}>Account settings</small>
          </a>
        </div>

        <div style={{ margin: '2rem 0' }}>
          <a 
            href="/api-test"
            style={{
              padding: '15px 30px',
              background: '#6c757d',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '5px',
              fontWeight: 'bold',
              marginRight: '1rem'
            }}
          >
            🧪 API Testing (Dev)
          </a>
          <a 
            href="http://neurogrid.network" 
            style={{
              padding: '15px 30px',
              background: '#dc3545',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '5px',
              fontWeight: 'bold'
            }}
          >
            ← Production Site
          </a>
        </div>
      </main>
    </div>
  );
}
