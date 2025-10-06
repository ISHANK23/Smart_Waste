import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuthState } from '../contexts/AuthContext';
import { useOfflineQueue } from '../contexts/OfflineQueueContext';
import { SyncContext } from '../contexts/SyncContext';
const DashboardScreen = ({ navigation }) => {
  const { user } = useAuthState();
  const { pendingCollections, isConnected } = useOfflineQueue();
  const { data, refresh, loading: syncing, online, lastSync } = React.useContext(SyncContext);
  const [refreshing, setRefreshing] = useState(false);
  const bins = data?.bins || [];
  const pickups = data?.pickups || [];
  const transactions = data?.transactions || [];
  const collections = data?.collections || [];
  useEffect(() => {
    if (!syncing) {
      setRefreshing(false);
    }
  }, [syncing]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);
  const todayStats = useMemo(() => {
    const today = new Date();
    return collections.filter((record) => {
      const ts = new Date(record.timestamp || record.createdAt);
      return ts.getDate() === today.getDate() && ts.getMonth() === today.getMonth() && ts.getFullYear() === today.getFullYear();
    });
  }, [collections]);
  const renderResident = () => (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>My Bins</Text>
        {bins.length ? (
          bins.map((bin) => (
            <View key={bin._id || bin.binId} style={styles.listItem}>
              <Text style={styles.listTitle}>{bin.type?.toUpperCase()} Bin</Text>
              <Text style={styles.listSubtitle}>Current level: {bin.currentLevel ?? 'Unknown'}%</Text>
              <Text style={styles.listSubtitle}>Location: {bin.location}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.placeholder}>No bin data available.</Text>
        )}
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Upcoming Pickups</Text>
        {pickups.length ? (
          pickups.map((pickup) => (
            <View key={pickup._id || pickup.clientReference} style={styles.listItem}>
              <Text style={styles.listTitle}>{pickup.wasteType}</Text>
              <Text style={styles.listSubtitle}>
                Scheduled: {pickup.scheduledDate ? new Date(pickup.scheduledDate).toLocaleString() : 'Pending'}
              </Text>
              <Text style={styles.badge}>{pickup.status || 'Queued'}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.placeholder}>No scheduled pickups.</Text>
        )}
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Schedule')}>
          <Text style={styles.primaryButtonText}>Schedule Pickup</Text>
        </TouchableOpacity>
      </View>
    </>
  );
  const renderStaff = () => (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today's Collections</Text>
        <Text style={styles.listSubtitle}>Collections logged: {todayStats.length}</Text>
        <Text style={styles.listSubtitle}>
          Total weight: {todayStats.reduce((sum, record) => sum + (record.weight || 0), 0).toFixed(1)} kg
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Scan')}>
          <Text style={styles.primaryButtonText}>Open Scanner</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pending Pickups</Text>
        <Text style={styles.listSubtitle}>{pickups.filter((p) => p.status !== 'completed').length} requests</Text>
        {!isConnected && (
          <Text style={styles.warning}>Offline mode — queued scans will sync when connected.</Text>
        )}
        {pendingCollections.length > 0 && (
          <Text style={styles.warning}>{pendingCollections.length} collection(s) awaiting sync.</Text>
        )}
      </View>
    </>
  );
  const renderAdmin = () => (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>System Analytics</Text>
        <Text style={styles.listSubtitle}>Collections logged: {collections.length}</Text>
        <Text style={styles.listSubtitle}>
          Total weight collected: {collections.reduce((sum, record) => sum + (record.weight || 0), 0).toFixed(1)} kg
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Transactions</Text>
        {transactions.length ? (
          transactions.slice(0, 5).map((tx) => (
            <View key={tx._id || tx.clientReference} style={styles.listItem}>
              <Text style={styles.listTitle}>{tx.type} - ${tx.amount}</Text>
              <Text style={styles.badge}>{tx.status}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.placeholder}>No transactions recorded.</Text>
        )}
      </View>
    </>
  );
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0b8a6b" />}
    >
      <Text style={styles.heading}>Welcome back, {user?.username}</Text>
      {!online && <Text style={styles.warning}>You are offline. Showing cached data.</Text>}
      <Text style={styles.meta}>Last synced: {lastSync ? new Date(lastSync).toLocaleString() : 'not synced yet'}</Text>
      {user?.role === 'resident' && renderResident()}
      {user?.role === 'staff' && renderStaff()}
      {user?.role === 'admin' && renderAdmin()}
      {syncing && <Text style={styles.placeholder}>Syncing latest updates…</Text>}
    </ScrollView>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8'
  },
  content: {
    padding: 20,
    paddingBottom: 80
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0b3d91',
    marginBottom: 8
  },
  meta: {
    fontSize: 12,
    color: '#2f4858',
    marginBottom: 16
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#0c7c59',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0a507a',
    marginBottom: 12
  },
  listItem: {
    marginBottom: 12
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0a507a'
  },
  listSubtitle: {
    fontSize: 14,
    color: '#2f4858'
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e0f2f1',
    color: '#0c7c59',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
    fontWeight: '600'
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: '#0c7c59',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center'
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: '700'
  },
  placeholder: {
    fontSize: 14,
    color: '#7a7f85'
  },
  warning: {
    fontSize: 13,
    color: '#ad6a00',
    marginTop: 4
  }
});
export default DashboardScreen;