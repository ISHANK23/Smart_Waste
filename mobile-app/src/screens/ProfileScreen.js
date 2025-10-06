import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuthActions, useAuthState } from '../contexts/AuthContext';
import { useOfflineQueue } from '../contexts/OfflineQueueContext';
import { useNotifications } from '../hooks/useNotifications';
const ProfileScreen = () => {
  const { user } = useAuthState();
  const { logout } = useAuthActions();
  const { pendingCollections, syncPendingCollections, isConnected } = useOfflineQueue();
  const { status: notificationStatus } = useNotifications();
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.heading}>Profile</Text>
        <Text style={styles.label}>Username</Text>
        <Text style={styles.value}>{user?.username}</Text>
        <Text style={styles.label}>Role</Text>
        <Text style={styles.value}>{user?.role}</Text>
        {user?.address && (
          <>
            <Text style={styles.label}>Address</Text>
            <Text style={styles.value}>{user.address}</Text>
          </>
        )}
        {user?.phone && (
          <>
            <Text style={styles.label}>Phone</Text>
            <Text style={styles.value}>{user.phone}</Text>
          </>
        )}
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>Connectivity</Text>
        <Text style={styles.value}>Status: {isConnected ? 'Online' : 'Offline'}</Text>
        <Text style={styles.value}>Pending collections: {pendingCollections.length}</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={syncPendingCollections}>
          <Text style={styles.secondaryText}>Sync pending collections</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>Notifications</Text>
        <Text style={styles.value}>Permission: {notificationStatus || 'checking...'}</Text>
        <Text style={styles.helper}>Push alerts keep you updated with collection reminders.</Text>
      </View>
      <TouchableOpacity style={styles.button} onPress={logout}>
        <Text style={styles.buttonText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
    padding: 20
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
  heading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0b3d91',
    marginBottom: 12
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569'
  },
  value: {
    fontSize: 16,
    color: '#0f172a',
    marginBottom: 12
  },
  helper: {
    color: '#64748b',
    marginTop: 6
  },
  button: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center'
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700'
  },
  secondaryButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderColor: '#0b8a6b',
    borderWidth: 1,
    alignItems: 'center'
  },
  secondaryText: {
    color: '#0b8a6b',
    fontWeight: '600'
  }
});
export default ProfileScreen;