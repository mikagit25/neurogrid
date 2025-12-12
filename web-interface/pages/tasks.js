import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/tasks');
      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const viewTaskDetails = async (taskId) => {
    try {
      const response = await fetch(`http://localhost:3001/api/tasks/${taskId}`);
      const data = await response.json();
      setSelectedTask(data.task);
    } catch (error) {
      console.error('Error fetching task details:', error);
      alert('Error fetching task details: ' + error.message);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#28a745';
      case 'processing': return '#ffc107';
      case 'queued': return '#6c757d';
      case 'failed': return '#dc3545';
      default: return '#6c757d';
    }
  };

  return (
    <div>
      <Head>
        <title>NeuroGrid - Tasks</title>
      </Head>
      
      <main style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
        <h1 style={{ color: '#667eea' }}>📋 Task Management</h1>
        
        <div style={{ marginBottom: '2rem' }}>
          <button 
            onClick={fetchTasks}
            style={{
              padding: '10px 20px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              marginRight: '1rem'
            }}
          >
            🔄 Refresh Tasks
          </button>
          
          <a 
            href="/api-test"
            style={{
              padding: '10px 20px',
              background: '#007bff',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '5px'
            }}
          >
            ➕ Submit New Task
          </a>
        </div>

        {loading ? (
          <p>Loading tasks...</p>
        ) : (
          <div style={{
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: selectedTask ? '1fr 1fr' : '1fr'
          }}>
            <div>
              <h3>All Tasks ({tasks.length})</h3>
              {tasks.length === 0 ? (
                <div style={{
                  background: '#f8f9fa',
                  padding: '2rem',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <p>No tasks found. Submit a test task to see it here!</p>
                </div>
              ) : (
                tasks.map(task => (
                  <div 
                    key={task.id} 
                    style={{
                      background: 'white',
                      border: '1px solid #dee2e6',
                      padding: '1rem',
                      borderRadius: '8px',
                      marginBottom: '1rem',
                      cursor: 'pointer'
                    }}
                    onClick={() => viewTaskDetails(task.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>{task.id}</strong>
                      <span 
                        style={{
                          background: getStatusColor(task.status),
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '0.8rem'
                        }}
                      >
                        {task.status}
                      </span>
                    </div>
                    <p style={{ margin: '0.5rem 0', color: '#6c757d' }}>
                      Model: {task.model} | Created: {new Date(task.created_at).toLocaleString()}
                    </p>
                    {task.cost && <p style={{ margin: 0, fontSize: '0.9rem' }}>Cost: ${task.cost}</p>}
                  </div>
                ))
              )}
            </div>

            {selectedTask && (
              <div style={{
                background: '#f8f9fa',
                padding: '1rem',
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3>Task Details</h3>
                  <button
                    onClick={() => setSelectedTask(null)}
                    style={{
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '5px 10px',
                      cursor: 'pointer'
                    }}
                  >
                    ✕
                  </button>
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <strong>ID:</strong> {selectedTask.id}
                </div>
                
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Status:</strong> 
                  <span 
                    style={{
                      background: getStatusColor(selectedTask.status),
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      marginLeft: '0.5rem'
                    }}
                  >
                    {selectedTask.status}
                  </span>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <strong>Prompt:</strong>
                  <p style={{ 
                    background: 'white', 
                    padding: '0.5rem', 
                    borderRadius: '4px',
                    marginTop: '0.5rem'
                  }}>
                    {selectedTask.prompt}
                  </p>
                </div>

                {selectedTask.result && (
                  <div style={{ marginBottom: '1rem' }}>
                    <strong>Result:</strong>
                    <p style={{ 
                      background: 'white', 
                      padding: '0.5rem', 
                      borderRadius: '4px',
                      marginTop: '0.5rem',
                      maxHeight: '200px',
                      overflow: 'auto'
                    }}>
                      {selectedTask.result}
                    </p>
                  </div>
                )}

                <div style={{ fontSize: '0.9rem', color: '#6c757d' }}>
                  <p><strong>Model:</strong> {selectedTask.model}</p>
                  <p><strong>Created:</strong> {new Date(selectedTask.created_at).toLocaleString()}</p>
                  {selectedTask.completed_at && (
                    <p><strong>Completed:</strong> {new Date(selectedTask.completed_at).toLocaleString()}</p>
                  )}
                  {selectedTask.processing_time && (
                    <p><strong>Processing Time:</strong> {selectedTask.processing_time}s</p>
                  )}
                  {selectedTask.cost && (
                    <p><strong>Cost:</strong> ${selectedTask.cost}</p>
                  )}
                  {selectedTask.node && (
                    <p><strong>Node:</strong> {selectedTask.node.id} ({selectedTask.node.location})</p>
                  )}
                </div>
              </div>
            )}
          </div>
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