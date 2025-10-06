import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { SyncContext } from '../contexts/SyncContext';
const PAYMENT_QUEUE_KEY = 'smartwaste_mobile_payment_queue';
const BillingScreen = () => {
  const { data, refresh, loading: syncing, online, lastSync } = React.useContext(SyncContext);
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [queuedPayments, setQueuedPayments] = useState([]);
  const transactions = useMemo(() => {
    const records = data?.transactions || [];
    return records.sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0));
  }, [data?.transactions]);
  const loadQueue = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(PAYMENT_QUEUE_KEY);
      if (stored) {
        setQueuedPayments(JSON.parse(stored));
      }
    } catch (error) {
      console.warn('Failed to load payment queue', error.message);
    }
  }, []);
  useEffect(() => {
    loadQueue();
  }, [loadQueue]);
  const persistQueue = useCallback(async (queue) => {
    setQueuedPayments(queue);
    await AsyncStorage.setItem(PAYMENT_QUEUE_KEY, JSON.stringify(queue));
  }, []);
  useEffect(() => {
    const syncQueue = async () => {
      if (!online || queuedPayments.length === 0) return;
      const remaining = [];
      for (const payment of queuedPayments) {
        try {
          await api.post('/api/transactions/pay', payment);
        } catch (error) {
          console.warn('Failed to sync payment', error.message);
          remaining.push(payment);
        }
      }
      await persistQueue(remaining);
      if (remaining.length !== queuedPayments.length) {
        await refresh();
      }
    };
    syncQueue();
  }, [online, queuedPayments, persistQueue, refresh]);
  const handlePayment = async () => {
    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      setStatus({ type: 'error', message: 'Enter a valid amount.' });
      return;
    }
    setSubmitting(true);
    setStatus(null);
    const payload = { amount: numericAmount, clientReference: `payment-${Date.now()}` };
    try {
      if (!online) {
        await persistQueue([...queuedPayments, payload]);
        setStatus({ type: 'warning', message: 'Offline detected. Payment queued and will process later.' });
      } else {
        await api.post('/api/transactions/pay', payload);
        setStatus({ type: 'success', message: 'Payment processed successfully.' });
        await refresh();
      }
      setAmount('');
    } catch (error) {
      setStatus({ type: 'error', message: error?.response?.data?.message || 'Payment failed.' });
    } finally {
      setSubmitting(false);
    }
  };
  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0b8a6b" />}
    >
      <Text style={styles.heading}>Billing & Payments</Text>
      <Text style={styles.meta}>Last synced: {lastSync ? new Date(lastSync).toLocaleString() : 'not synced yet'}</Text>
      {!online && <Text style={styles.meta}>Offline mode – payments will be queued.</Text>}
      <View style={styles.card}>
        <Text style={styles.label}>Amount</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter amount"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
        <TouchableOpacity style={[styles.button, submitting && styles.buttonDisabled]} onPress={handlePayment} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? 'Processing...' : 'Pay now'}</Text>
        </TouchableOpacity>
        {status && (
          <View
            style={[
              styles.status,
              status.type === 'error' ? styles.error : status.type === 'warning' ? styles.warning : styles.success
            ]}
          >
            <Text style={styles.statusText}>{status.message}</Text>
          </View>
        )}
        {queuedPayments.length > 0 && (
          <Text style={styles.meta}>{queuedPayments.length} payment(s) pending sync.</Text>
        )}
      </View>
      <View style={styles.card}>
        <Text style={styles.subheading}>Transaction history</Text>
        {syncing ? (
          <Text style={styles.placeholder}>Syncing transactions…</Text>
        ) : transactions.length ? (
          transactions.map((transaction) => (
            <View key={transaction._id || transaction.clientReference} style={styles.listItem}>
              <Text style={styles.listTitle}>
                {transaction.type} - ${transaction.amount}
              </Text>
              <Text style={styles.badge}>{transaction.status}</Text>
              <Text style={styles.listSubtitle}>
                {transaction.createdAt ? new Date(transaction.createdAt).toLocaleString() : 'Pending'}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.placeholder}>No transactions yet.</Text>
        )}
      </View>
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
    paddingBottom: 60
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0b3d91',
    marginBottom: 8
  },
  meta: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 6
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 4
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0b3d91',
    marginBottom: 6
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 14
  },
  button: {
    backgroundColor: '#0b8a6b',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center'
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700'
  },
  status: {
    marginTop: 12,
    borderRadius: 12,
    padding: 12
  },
  statusText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600'
  },
  error: {
    backgroundColor: '#ef4444'
  },
  success: {
    backgroundColor: '#0b8a6b'
  },
  warning: {
    backgroundColor: '#f97316'
  },
  subheading: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0b3d91',
    marginBottom: 12
  },
  placeholder: {
    color: '#64748b'
  },
  listItem: {
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    paddingVertical: 12
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a'
  },
  listSubtitle: {
    color: '#475569',
    marginTop: 4
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#d1fae5',
    color: '#047857',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    textTransform: 'capitalize'
  }
});
export default BillingScreen;