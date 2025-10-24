import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { NodeManager } from '../services/NodeManager';
import { WalletService } from '../services/WalletService';

const Dashboard = () => {
  const [nodeStatus, setNodeStatus] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [networkStats, setNetworkStats] = useState({});

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      const [node, balance, stats] = await Promise.all([
        NodeManager.getStatus(),
        WalletService.getBalance(),
        NodeManager.getNetworkStats()
      ]);
      
      setNodeStatus(node);
      setWalletBalance(balance);
      setNetworkStats(stats);
    } catch (error) {
      Alert.alert('Error', 'Failed to load dashboard data');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>NeuroGrid Dashboard</Text>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Node Status</Text>
        <Text style={styles.status}>
          {nodeStatus?.active ? '🟢 Online' : '🔴 Offline'}
        </Text>
        <Text>Tasks Processed: {nodeStatus?.tasksProcessed || 0}</Text>
        <Text>Uptime: {nodeStatus?.uptime || '0h'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Wallet</Text>
        <Text style={styles.balance}>{walletBalance} NGT</Text>
        <Text>Staked: {nodeStatus?.staked || 0} NGT</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Network</Text>
        <Text>Active Nodes: {networkStats.activeNodes || 0}</Text>
        <Text>Total Tasks: {networkStats.totalTasks || 0}</Text>
        <Text>Network Health: {networkStats.health || 0}%</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  status: {
    fontSize: 16,
    marginBottom: 8,
  },
  balance: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
  },
});

export default Dashboard;