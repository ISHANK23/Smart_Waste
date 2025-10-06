import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { SyncContext } from '../contexts/SyncContext';
const QUEUE_KEY = 'smartwaste_mobile_pickup_queue';
const ScheduleScreen = () => {
  const { data, refresh, loading: syncing, online, lastSync } = React.useContext(SyncContext);
  const [form, setForm] = useState({ wasteType: '', description: '', scheduledDate: '' });
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [queuedRequests, setQueuedRequests] = useState([]);
  const requests = useMemo(() => {
    const serverRequests = data?.pickups || [];
    const localRequests = queuedRequests.map((item) => ({ ...item, status: 'queued', isLocal: true }));
    return [...localRequests, ...serverRequests].sort((a, b) => {
      const aTime = new Date(a.timestamp || a.createdAt || 0).getTime();
      const bTime = new Date(b.timestamp || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [data?.pickups, queuedRequests]);
  const loadQueue = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_KEY);
      if (stored) {
        setQueuedRequests(JSON.parse(stored));
      }
    } catch (error) {
      console.warn('Failed to load pickup queue', error.message);
    }
  }, []);
  useEffect(() => {
    loadQueue();
  }, [loadQueue]);
  const persistQueue = useCallback(async (queue) => {
    setQueuedRequests(queue);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }, []);
  useEffect(() => {
    const syncQueue = async () => {
      if (!online || queuedRequests.length === 0) return;
      const remaining = [];
      for (const item of queuedRequests) {
        try {
          await api.post('/api/pickups', item);
        } catch (error) {
          console.warn('Failed to sync pickup', error.message);
          remaining.push(item);
        }
      }
      await persistQueue(remaining);
      if (remaining.length !== queuedRequests.length) {
        await refresh();
      }
    };
    syncQueue();
  }, [online, queuedRequests, persistQueue, refresh]);
  const handleChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };
  const handleSubmit = async () => {
    if (!form.wasteType || !form.description) {
      setStatus({ type: 'error', message: 'Waste type and description are required.' });
      return;
    }
    setSubmitting(true);
    setStatus(null);
    const payload = {
      ...form,
      timestamp: new Date().toISOString(),
      clientReference: `pickup-${Date.now()}`
    };
    try {
      if (!online) {
        await persistQueue([...queuedRequests, payload]);
        setStatus({ type: 'warning', message: 'Offline detected. Pickup saved locally and will sync later.' });
      } else {
        await api.post('/api/pickups', payload);
        setStatus({ type: 'success', message: 'Pickup request created.' });
        await refresh();
      }
      setForm({ wasteType: '', description: '', scheduledDate: '' });
    } catch (error) {
      setStatus({ type: 'error', message: error?.response?.data?.message || 'Could not schedule pickup.' });
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
      <Text style={styles.heading}>Schedule a pickup</Text>
      {!online && <Text style={styles.meta}>Offline mode – new requests will be queued locally.</Text>}
      <View style={styles.card}>
        <Text style={styles.label}>Waste type</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. bulky, recyclable"
          value={form.wasteType}
          onChangeText={(text) => handleChange('wasteType', text)}
        />
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Describe your pickup"
          value={form.description}
          onChangeText={(text) => handleChange('description', text)}
          multiline
        />
        <Text style={styles.label}>Preferred date (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          value={form.scheduledDate}
          onChangeText={(text) => handleChange('scheduledDate', text)}
        />
        <TouchableOpacity style={[styles.button, submitting && styles.buttonDisabled]} onPress={handleSubmit} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? 'Submitting...' : 'Submit request'}</Text>
        </TouchableOpacity>
        {status && (
          <View style={[styles.status, status.type === 'error' ? styles.error : status.type === 'warning' ? styles.warning : styles.success]}>
            <Text style={styles.statusText}>{status.message}</Text>
          </View>
        )}
      </View>
      <View style={styles.card}>
        <Text style={styles.subheading}>My requests</Text>
        <Text style={styles.meta}>Last synced: {lastSync ? new Date(lastSync).toLocaleString() : 'not synced yet'}</Text>
        {syncing ? (
          <Text style={styles.placeholder}>Syncing requests…</Text>
        ) : requests.length ? (
          requests.map((request) => (
            <View key={request._id || request.clientReference} style={styles.listItem}>
              <Text style={styles.listTitle}>{request.wasteType}</Text>
              <Text style={styles.listSubtitle}>{request.description}</Text>
              <Text style={[styles.badge, request.isLocal && styles.badgeQueued]}>{request.isLocal ? 'Pending Sync' : request.status}</Text>
              {request.scheduledDate && (
                <Text style={styles.listSubtitle}>Scheduled: {new Date(request.scheduledDate).toLocaleString()}</Text>
              )}
            </View>
          ))
        ) : (
          <Text style={styles.placeholder}>No requests yet.</Text>
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
    marginBottom: 8
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
  textarea: {
    height: 100,
    textAlignVertical: 'top'
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
    marginBottom: 16
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0a507a'
  },
  listSubtitle: {
    fontSize: 14,
    color: '#334155'
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
  badgeQueued: {
    backgroundColor: '#fde68a',
    color: '#b45309'
  }
});
export default ScheduleScreen;