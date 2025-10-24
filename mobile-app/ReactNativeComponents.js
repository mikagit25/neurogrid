/**
 * NeuroGrid Mobile App - React Native Implementation
 * Main React Native application with navigation, screens, and components
 */

// React Native App Structure
const AppStructure = {
  // Package.json for React Native app
  packageJson: {
    "name": "neurogrid-mobile",
    "version": "1.0.0",
    "private": true,
    "scripts": {
      "android": "react-native run-android",
      "ios": "react-native run-ios", 
      "start": "react-native start",
      "test": "jest",
      "lint": "eslint . --ext .js,.jsx,.ts,.tsx"
    },
    "dependencies": {
      "react": "18.2.0",
      "react-native": "0.73.0",
      "@react-navigation/native": "^6.1.0",
      "@react-navigation/stack": "^6.3.0",
      "@react-navigation/bottom-tabs": "^6.5.0",
      "@react-native-async-storage/async-storage": "^1.19.0",
      "react-native-keychain": "^8.1.0",
      "react-native-biometrics": "^3.0.0",
      "react-native-vector-icons": "^10.0.0",
      "@reduxjs/toolkit": "^1.9.0",
      "react-redux": "^8.1.0",
      "react-native-reanimated": "^3.5.0",
      "react-native-gesture-handler": "^2.13.0",
      "react-native-safe-area-context": "^4.7.0",
      "react-native-screens": "^3.26.0",
      "react-native-svg": "^13.14.0",
      "@react-native-camera/camera": "^7.0.0",
      "react-native-qrcode-scanner": "^1.5.0",
      "react-native-push-notification": "^8.1.0",
      "@react-native-firebase/app": "^18.5.0",
      "@react-native-firebase/messaging": "^18.5.0",
      "react-native-chart-kit": "^6.12.0",
      "react-native-linear-gradient": "^2.8.0"
    },
    "devDependencies": {
      "@babel/core": "^7.20.0",
      "@babel/preset-env": "^7.20.0",
      "@babel/runtime": "^7.20.0",
      "@react-native/eslint-config": "^0.73.0",
      "@react-native/metro-config": "^0.73.0",
      "@react-native/typescript-config": "^0.73.0",
      "@types/react": "^18.0.24",
      "@types/react-test-renderer": "^18.0.0",
      "babel-jest": "^29.2.1",
      "eslint": "^8.19.0",
      "jest": "^29.2.1",
      "metro-react-native-babel-preset": "0.76.8",
      "prettier": "^2.4.1",
      "react-test-renderer": "18.2.0",
      "typescript": "4.8.4"
    },
    "jest": {
      "preset": "react-native"
    }
  },

  // Main App Component
  appComponent: `
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';

// Import screens
import SplashScreen from './src/screens/SplashScreen';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import WalletScreen from './src/screens/WalletScreen';
import NodesScreen from './src/screens/NodesScreen';
import DeFiScreen from './src/screens/DeFiScreen';
import SettingsScreen from './src/screens/SettingsScreen';

// Import components
import { store } from './src/store/store';
import { AuthProvider } from './src/context/AuthContext';
import { NeuroGridProvider } from './src/context/NeuroGridContext';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom Tab Navigator
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = 'dashboard';
          } else if (route.name === 'Wallet') {
            iconName = 'account-balance-wallet';
          } else if (route.name === 'Nodes') {
            iconName = 'computer';
          } else if (route.name === 'DeFi') {
            iconName = 'trending-up';
          } else if (route.name === 'Settings') {
            iconName = 'settings';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Wallet" component={WalletScreen} />
      <Tab.Screen name="Nodes" component={NodesScreen} />
      <Tab.Screen name="DeFi" component={DeFiScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

// Main App
export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check authentication status
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Check for existing session
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate loading
      setIsLoading(false);
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <AuthProvider>
          <NeuroGridProvider>
            <NavigationContainer>
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                {!isAuthenticated ? (
                  <Stack.Screen name="Auth" component={AuthScreen} />
                ) : (
                  <Stack.Screen name="Main" component={MainTabs} />
                )}
              </Stack.Navigator>
            </NavigationContainer>
          </NeuroGridProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </Provider>
  );
}
`,

  // Home Screen Component
  homeScreen: `
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { LineChart } from 'react-native-chart-kit';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const [refreshing, setRefreshing] = useState(false);
  const [portfolioData, setPortfolioData] = useState({
    totalValue: 25420.50,
    dailyChange: 1247.25,
    dailyChangePercent: 5.17,
    activeNodes: 3,
    activePositions: 8,
    pendingTransactions: 2
  });

  const [priceData, setPriceData] = useState({
    labels: ['1h', '2h', '3h', '4h', '5h', '6h'],
    datasets: [{
      data: [1.20, 1.25, 1.18, 1.32, 1.28, 1.35],
      strokeWidth: 3,
      color: (opacity = 1) => \`rgba(99, 102, 241, \${opacity})\`
    }]
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Dashboard data loaded');
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const quickActions = [
    { title: 'Send', icon: 'send', color: '#10b981', action: () => navigation.navigate('Wallet') },
    { title: 'Receive', icon: 'call-received', color: '#3b82f6', action: () => navigation.navigate('Wallet') },
    { title: 'Swap', icon: 'swap-horiz', color: '#8b5cf6', action: () => navigation.navigate('DeFi') },
    { title: 'Bridge', icon: 'compare-arrows', color: '#f59e0b', action: () => navigation.navigate('DeFi') },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning</Text>
            <Text style={styles.username}>John Doe</Text>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Icon name="notifications" size={24} color="#374151" />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        </View>

        {/* Portfolio Card */}
        <LinearGradient
          colors={['#6366f1', '#8b5cf6']}
          style={styles.portfolioCard}
        >
          <Text style={styles.portfolioLabel}>Total Portfolio Value</Text>
          <Text style={styles.portfolioValue}>
            $\{portfolioData.totalValue.toLocaleString()}
          </Text>
          <View style={styles.portfolioChange}>
            <Icon 
              name="trending-up" 
              size={16} 
              color="#ffffff" 
            />
            <Text style={styles.changeText}>
              +$\{portfolioData.dailyChange.toLocaleString()} 
              (+\{portfolioData.dailyChangePercent}%)
            </Text>
          </View>
        </LinearGradient>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.actionButton}
                onPress={action.action}
              >
                <View style={[styles.actionIcon, { backgroundColor: action.color }]}>
                  <Icon name={action.icon} size={24} color="#ffffff" />
                </View>
                <Text style={styles.actionTitle}>{action.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* NGRID Price Chart */}
        <View style={styles.chartSection}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartTitle}>NGRID Price</Text>
              <Text style={styles.chartPrice}>$1.35</Text>
            </View>
            <View style={styles.priceChange}>
              <Icon name="trending-up" size={16} color="#10b981" />
              <Text style={[styles.changeText, { color: '#10b981' }]}>+12.5%</Text>
            </View>
          </View>
          <LineChart
            data={priceData}
            width={width - 32}
            height={200}
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 2,
              color: (opacity = 1) => \`rgba(99, 102, 241, \${opacity})\`,
              style: {
                borderRadius: 16,
              },
            }}
            bezier
            style={styles.chart}
          />
        </View>

        {/* Stats Cards */}
        <View style={styles.statsSection}>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Icon name="computer" size={24} color="#6366f1" />
              <Text style={styles.statValue}>{portfolioData.activeNodes}</Text>
              <Text style={styles.statLabel}>Active Nodes</Text>
            </View>
            <View style={styles.statCard}>
              <Icon name="trending-up" size={24} color="#10b981" />
              <Text style={styles.statValue}>{portfolioData.activePositions}</Text>
              <Text style={styles.statLabel}>DeFi Positions</Text>
            </View>
            <View style={styles.statCard}>
              <Icon name="hourglass-empty" size={24} color="#f59e0b" />
              <Text style={styles.statValue}>{portfolioData.pendingTransactions}</Text>
              <Text style={styles.statLabel}>Pending Txs</Text>
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.activityList}>
            <ActivityItem
              icon="send"
              title="Sent NGRID"
              subtitle="To 0x1234...5678"
              amount="-125.50 NGRID"
              time="2 hours ago"
              color="#ef4444"
            />
            <ActivityItem
              icon="call-received"
              title="Received USDC"
              subtitle="From Uniswap"
              amount="+2,450.00 USDC"
              time="4 hours ago"
              color="#10b981"
            />
            <ActivityItem
              icon="computer"
              title="Node Rewards"
              subtitle="Validator Node #1"
              amount="+45.25 NGRID"
              time="6 hours ago"
              color="#6366f1"
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActivityItem({ icon, title, subtitle, amount, time, color }) {
  return (
    <View style={styles.activityItem}>
      <View style={[styles.activityIcon, { backgroundColor: color }]}>
        <Icon name={icon} size={20} color="#ffffff" />
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityTitle}>{title}</Text>
        <Text style={styles.activitySubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.activityRight}>
        <Text style={[styles.activityAmount, { color }]}>{amount}</Text>
        <Text style={styles.activityTime}>{time}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  greeting: {
    fontSize: 14,
    color: '#6b7280',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    backgroundColor: '#ef4444',
    borderRadius: 4,
  },
  portfolioCard: {
    margin: 16,
    padding: 24,
    borderRadius: 16,
  },
  portfolioLabel: {
    fontSize: 14,
    color: '#e5e7eb',
    marginBottom: 8,
  },
  portfolioValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  portfolioChange: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeText: {
    fontSize: 14,
    color: '#ffffff',
    marginLeft: 4,
  },
  quickActions: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    alignItems: 'center',
    flex: 1,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 12,
    color: '#374151',
    textAlign: 'center',
  },
  chartSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  chartPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6366f1',
  },
  priceChange: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chart: {
    borderRadius: 16,
  },
  statsSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  activitySection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  activityList: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  activitySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  activityRight: {
    alignItems: 'flex-end',
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  activityTime: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
});
`,

  // Wallet Screen Component
  walletScreen: `
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';

export default function WalletScreen() {
  const [wallets, setWallets] = useState([
    {
      id: '1',
      name: 'Main Wallet',
      type: 'neurogrid',
      balance: 1247.50,
      usdValue: 1684.13,
      address: 'ngrid1xyz...abc123'
    },
    {
      id: '2',
      name: 'Trading Wallet',
      type: 'ethereum',
      balance: 0.85,
      usdValue: 2040.00,
      address: '0x1234...5678'
    }
  ]);

  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);

  const [sendForm, setSendForm] = useState({
    to: '',
    amount: '',
    memo: ''
  });

  const totalBalance = wallets.reduce((sum, wallet) => sum + wallet.usdValue, 0);

  const handleSend = () => {
    if (!sendForm.to || !sendForm.amount) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    Alert.alert(
      'Confirm Transaction',
      \`Send \${sendForm.amount} to \${sendForm.to}?\`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Send', 
          onPress: () => {
            // Handle send logic
            setShowSendModal(false);
            setSendForm({ to: '', amount: '', memo: '' });
            Alert.alert('Success', 'Transaction sent successfully');
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Wallet</Text>
          <TouchableOpacity style={styles.addButton}>
            <Icon name="add" size={24} color="#6366f1" />
          </TouchableOpacity>
        </View>

        {/* Total Balance Card */}
        <LinearGradient
          colors={['#6366f1', '#8b5cf6']}
          style={styles.balanceCard}
        >
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceValue}>
            $\{totalBalance.toLocaleString()}
          </Text>
          <View style={styles.balanceActions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => setShowSendModal(true)}
            >
              <Icon name="send" size={20} color="#ffffff" />
              <Text style={styles.actionText}>Send</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => setShowReceiveModal(true)}
            >
              <Icon name="call-received" size={20} color="#ffffff" />
              <Text style={styles.actionText}>Receive</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Wallets List */}
        <View style={styles.walletsSection}>
          <Text style={styles.sectionTitle}>Your Wallets</Text>
          {wallets.map((wallet) => (
            <TouchableOpacity
              key={wallet.id}
              style={styles.walletCard}
              onPress={() => setSelectedWallet(wallet)}
            >
              <View style={styles.walletHeader}>
                <View style={styles.walletInfo}>
                  <Text style={styles.walletName}>{wallet.name}</Text>
                  <Text style={styles.walletType}>{wallet.type}</Text>
                </View>
                <Icon name="chevron-right" size={24} color="#9ca3af" />
              </View>
              <View style={styles.walletBalance}>
                <Text style={styles.walletAmount}>
                  {wallet.balance} {wallet.type === 'neurogrid' ? 'NGRID' : 'ETH'}
                </Text>
                <Text style={styles.walletUsd}>
                  $\{wallet.usdValue.toLocaleString()}
                </Text>
              </View>
              <Text style={styles.walletAddress}>{wallet.address}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Send Modal */}
        <Modal
          visible={showSendModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowSendModal(false)}>
                <Icon name="close" size={24} color="#374151" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Send</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>To Address</Text>
                <TextInput
                  style={styles.input}
                  value={sendForm.to}
                  onChangeText={(text) => setSendForm({ ...sendForm, to: text })}
                  placeholder="Enter recipient address"
                  placeholderTextColor="#9ca3af"
                />
                <TouchableOpacity style={styles.scanButton}>
                  <Icon name="qr-code-scanner" size={20} color="#6366f1" />
                  <Text style={styles.scanText}>Scan QR</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Amount</Text>
                <TextInput
                  style={styles.input}
                  value={sendForm.amount}
                  onChangeText={(text) => setSendForm({ ...sendForm, amount: text })}
                  placeholder="0.00"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Memo (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={sendForm.memo}
                  onChangeText={(text) => setSendForm({ ...sendForm, memo: text })}
                  placeholder="Add a note"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <TouchableOpacity
                style={styles.sendButton}
                onPress={handleSend}
              >
                <Text style={styles.sendButtonText}>Send Transaction</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* Receive Modal */}
        <Modal
          visible={showReceiveModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowReceiveModal(false)}>
                <Icon name="close" size={24} color="#374151" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Receive</Text>
              <View style={{ width: 24 }} />
            </View>

            <View style={styles.receiveContent}>
              <View style={styles.qrContainer}>
                {/* QR Code would go here */}
                <View style={styles.qrPlaceholder}>
                  <Icon name="qr-code" size={120} color="#6366f1" />
                </View>
              </View>

              <Text style={styles.receiveAddress}>
                ngrid1xyz...abc123
              </Text>

              <TouchableOpacity style={styles.copyButton}>
                <Icon name="content-copy" size={20} color="#6366f1" />
                <Text style={styles.copyText}>Copy Address</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.shareButton}>
                <Icon name="share" size={20} color="#ffffff" />
                <Text style={styles.shareText}>Share Address</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceCard: {
    margin: 16,
    padding: 24,
    borderRadius: 16,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#e5e7eb',
    marginBottom: 8,
  },
  balanceValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 24,
  },
  balanceActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    flex: 1,
    marginHorizontal: 8,
    justifyContent: 'center',
  },
  actionText: {
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 8,
  },
  walletsSection: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  walletCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  walletInfo: {
    flex: 1,
  },
  walletName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  walletType: {
    fontSize: 14,
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  walletBalance: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  walletAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  walletUsd: {
    fontSize: 16,
    color: '#6b7280',
  },
  walletAddress: {
    fontSize: 12,
    color: '#9ca3af',
    fontFamily: 'monospace',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#f9fafb',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  scanText: {
    color: '#6366f1',
    marginLeft: 4,
    fontWeight: '600',
  },
  sendButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  receiveContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
  },
  qrContainer: {
    backgroundColor: '#f8fafc',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  receiveAddress: {
    fontSize: 16,
    fontFamily: 'monospace',
    color: '#374151',
    marginBottom: 24,
    textAlign: 'center',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginBottom: 16,
  },
  copyText: {
    color: '#6366f1',
    fontWeight: '600',
    marginLeft: 8,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  shareText: {
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 8,
  },
});
`
};

module.exports = AppStructure;