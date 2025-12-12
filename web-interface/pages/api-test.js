import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function APITest() {
  const [apiStatus, setApiStatus] = useState('Checking...');
  const [walletData, setWalletData] = useState(null);
  const [nodesData, setNodesData] = useState(null);
  const [tasksData, setTasksData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [taskSubmitting, setTaskSubmitting] = useState(false);

  useEffect(() => {
    checkAPI();
  }, []);

  const checkAPI = async () => {
    try {
      // Check health endpoint
      const healthResponse = await fetch('http://localhost:3001/health');
      const healthData = await healthResponse.json();
      
      if (healthData.status === 'OK') {
        setApiStatus('✅ API is working');
        
        // Get wallet data
        const walletResponse = await fetch('http://localhost:3001/api/tokens/balance');
        const walletInfo = await walletResponse.json();
        setWalletData(walletInfo);
        
        // Get nodes list
        const nodesResponse = await fetch('http://localhost:3001/api/nodes');
        const nodesInfo = await nodesResponse.json();
        setNodesData(nodesInfo);

        // Get existing tasks
        const tasksResponse = await fetch('http://localhost:3001/api/tasks');
        const tasksInfo = await tasksResponse.json();
        setTasksData(tasksInfo.tasks || []);
      }
    } catch (error) {
      setApiStatus('❌ API unavailable: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const submitTestTask = async () => {
    if (taskSubmitting) return;
    
    setTaskSubmitting(true);
    try {
      const response = await fetch('http://localhost:3001/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: 'Hello! This is a test task for NeuroGrid API. Please explain how neural networks work.',
          model: 'llama2:7b'
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        alert(`✅ Task submitted successfully!\nTask ID: ${result.task_id}\nStatus: ${result.status}\nEstimated time: ${result.estimated_time}`);
        
        // Refresh tasks list
        checkAPI();
      } else {
        alert('❌ Failed to submit task: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Task submission error:', error);
      alert('❌ Error submitting task: ' + error.message);
    } finally {
      setTaskSubmitting(false);
    }
  };

  return (
    <div>
      <Head>
        <title>NeuroGrid API Test</title>
      </Head>
      
      <main style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
        <h1 style={{ color: '#667eea' }}>🧪 NeuroGrid API Testing</h1>
        
        <div style={{
          background: '#f8f9fa',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '2rem'
        }}>
          <h3>API Status:</h3>
          <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{apiStatus}</p>
        </div>

        {!loading && (
          <>
            {walletData && (
              <div style={{
                background: '#e8f5e8',
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '1rem'
              }}>
                <h3>💰 Wallet</h3>
                <p>Balance: {walletData.balance.total} {walletData.balance.currency}</p>
                <p>Available: {walletData.balance.available} {walletData.balance.currency}</p>
                <p>Locked: {walletData.balance.locked} {walletData.balance.currency}</p>
              </div>
            )}

            {nodesData && (
              <div style={{
                background: '#e8f0ff',
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '1rem'
              }}>
                <h3>🖥️ Network Nodes</h3>
                <p>Total nodes: {nodesData.total}</p>
                {nodesData.nodes.map(node => (
                  <div key={node.id} style={{
                    background: 'white',
                    padding: '0.5rem',
                    margin: '0.5rem 0',
                    borderRadius: '4px'
                  }}>
                    <strong>{node.id}</strong> - {node.location} ({node.gpu}) - {node.status}
                  </div>
                ))}
              </div>
            )}

            {tasksData.length > 0 && (
              <div style={{
                background: '#f0f8ff',
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '1rem'
              }}>
                <h3>📋 Recent Tasks</h3>
                {tasksData.map(task => (
                  <div key={task.id} style={{
                    background: 'white',
                    padding: '0.5rem',
                    margin: '0.5rem 0',
                    borderRadius: '4px'
                  }}>
                    <strong>{task.id}</strong> - {task.status} ({task.model})
                  </div>
                ))}
              </div>
            )}

            <div style={{
              background: '#fff3cd',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1rem'
            }}>
              <h3>🚀 Test Task Submission</h3>
              <button 
                onClick={submitTestTask}
                disabled={taskSubmitting}
                style={{
                  padding: '10px 20px',
                  background: taskSubmitting ? '#6c757d' : '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: taskSubmitting ? 'not-allowed' : 'pointer'
                }}
              >
                {taskSubmitting ? 'Submitting...' : 'Submit Test Task'}
              </button>
            </div>
          </>
        )}

        <div style={{ marginTop: '2rem' }}>
          <a 
            href="/"
            style={{
              padding: '10px 20px',
              background: '#6c757d',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '5px'
            }}
          >
            ← Back to Home
          </a>
        </div>
      </main>
    </div>
  );
}