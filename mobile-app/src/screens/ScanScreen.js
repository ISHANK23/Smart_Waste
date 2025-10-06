import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import api from '../services/api';
import { useOfflineQueue } from '../contexts/OfflineQueueContext';
import { SyncContext } from '../contexts/SyncContext';
const LOCATION_STALE_MS = 60 * 1000;
const ScanScreen = () => {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [binId, setBinId] = useState('');
  const [weight, setWeight] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);
  const [statusType, setStatusType] = useState('info');
  const [locationPermission, setLocationPermission] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(null);
  const { isConnected, queueCollection, pendingCollections, syncPendingCollections } = useOfflineQueue();
  const { refresh } = React.useContext(SyncContext);
  const cameraRef = useRef(null);
  const successSound = useRef(null);
  const errorSound = useRef(null);
  useEffect(() => {
    let mounted = true;
    const loadSounds = async () => {
      try {
        const success = await Audio.Sound.createAsync(require('../../assets/sounds/success.wav'));
        const error = await Audio.Sound.createAsync(require('../../assets/sounds/error.wav'));
        if (mounted) {
          successSound.current = success.sound;
          errorSound.current = error.sound;
        }
      } catch (err) {
        console.warn('Unable to load feedback sounds', err?.message || err);
      }
    };
    loadSounds();
    return () => {
      mounted = false;
      successSound.current?.unloadAsync();
      errorSound.current?.unloadAsync();
    };
  }, []);
  const playFeedback = async (type) => {
    try {
      if (type === 'success') {
        await successSound.current?.replayAsync();
      } else if (type === 'error') {
        await errorSound.current?.replayAsync();
      }
    } catch (error) {
      console.warn('Unable to play feedback sound', error);
    }
  };
  const resetStatus = () => {
    setStatusMessage(null);
    setStatusType('info');
  };
  const acquireLocation = useCallback(async () => {
    setLocationLoading(true);
    setLocationError(null);
    try {
      let status = locationPermission;
      if (!status) {
        const foreground = await Location.getForegroundPermissionsAsync();
        status = foreground.status;
        setLocationPermission(status);
      }
      if (status !== 'granted') {
        const request = await Location.requestForegroundPermissionsAsync();
        status = request.status;
        setLocationPermission(status);
        if (status !== 'granted') {
          setLocationError('Location permission is required to validate bin proximity.');
          return null;
        }
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      setCurrentPosition(position);
      return position;
    } catch (error) {
      console.warn('Failed to get location', error);
      setLocationError('Unable to acquire GPS location. Try again.');
      return null;
    } finally {
      setLocationLoading(false);
    }
  }, [locationPermission]);
  const handleSubmit = useCallback(
    async (targetBinId) => {
      if (!targetBinId) {
        Alert.alert('Missing bin', 'Please provide a bin ID.');
        return;
      }
      const numericWeight = Number(weight);
      if (Number.isNaN(numericWeight) || numericWeight <= 0) {
        Alert.alert('Weight required', 'Please enter the weight collected before submitting.');
        return;
      }
      setProcessing(true);
      resetStatus();
      const trimBinId = targetBinId.trim();
      let latestPosition = currentPosition;
      if (!latestPosition || Date.now() - (latestPosition.timestamp || 0) > LOCATION_STALE_MS) {
        latestPosition = await acquireLocation();
      }
      const coords = latestPosition?.coords;
      const payload = {
        binId: trimBinId,
        weight: numericWeight,
        timestamp: new Date().toISOString(),
        clientReference: `${trimBinId}-${Date.now()}`,
        location: coords
          ? {
              latitude: coords.latitude,
              longitude: coords.longitude,
              accuracy: coords.accuracy,
              capturedAt: new Date().toISOString()
            }
          : undefined
      };
      try {
        const response = await api.post('/api/collections/scan', payload);
        if (response?.data?.duplicate) {
          setStatusMessage('Collection already synced, skipping duplicate.');
          setStatusType('warning');
        } else {
          const distance = response?.data?.distanceFromBin;
          const distanceNote = typeof distance === 'number' ? ` (within ${distance}m of registered location)` : '';
          setStatusMessage(`Collection recorded for bin ${trimBinId}${distanceNote}.`);
          setStatusType('success');
        }
        setBinId('');
        setWeight('');
        await playFeedback('success');
        syncPendingCollections();
        await refresh();
      } catch (error) {
        const isNetworkIssue = error?.response == null;
        if (error?.response?.status === 422) {
          const distance = error?.response?.data?.distanceFromBin;
          setStatusMessage(
            distance
              ? `Too far from registered bin location (${distance}m). Move closer and try again.`
              : error?.response?.data?.message || 'Location verification failed.'
          );
          setStatusType('error');
          await playFeedback('error');
        } else if (isNetworkIssue || !isConnected) {
          queueCollection(payload);
          setStatusMessage('Offline detected. Collection saved and will sync automatically.');
          setStatusType('warning');
          await playFeedback('success');
        } else {
          const message = error?.response?.data?.message || 'Failed to record collection.';
          setStatusMessage(message);
          setStatusType('error');
          await playFeedback('error');
        }
      } finally {
        setProcessing(false);
      }
    },
    [acquireLocation, currentPosition, isConnected, queueCollection, refresh, syncPendingCollections, weight]
  );
  const handleBarCodeScanned = useCallback(
    ({ data }) => {
      if (processing) {
        return;
      }
      setBinId(data);
      Alert.alert('Bin detected', `Scanned bin ID: ${data}`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Record',
          onPress: () => handleSubmit(data)
        }
      ]);
    },
    [handleSubmit, processing]
  );
  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);
  useEffect(() => {
    acquireLocation();
  }, [acquireLocation]);
  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#0b8a6b" />
        <Text style={styles.statusText}>Requesting camera permission...</Text>
      </View>
    );
  }
  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.statusText}>Camera permission is required to scan QR codes.</Text>
      </View>
    );
  }
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.cameraWrapper}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          onCameraReady={() => setCameraReady(true)}
          onBarcodeScanned={handleBarCodeScanned}
        />
        {!cameraReady && (
          <View style={styles.cameraOverlay}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.overlayText}>Preparing camera...</Text>
          </View>
        )}
        <View style={styles.viewfinder}>
          <Text style={styles.viewfinderText}>Align QR code within the frame</Text>
        </View>
      </View>
      <View style={styles.form}>
        <Text style={styles.label}>Manual bin ID entry</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter bin ID"
          value={binId}
          onChangeText={setBinId}
          autoCapitalize="characters"
        />
        <Text style={styles.label}>Collected weight (kg)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 5.5"
          keyboardType="decimal-pad"
          value={weight}
          onChangeText={setWeight}
        />
        <TouchableOpacity
          style={[styles.button, processing && styles.buttonDisabled]}
          onPress={() => handleSubmit(binId)}
          disabled={processing}
        >
          <Text style={styles.buttonText}>{processing ? 'Submitting...' : 'Record Collection'}</Text>
        </TouchableOpacity>
        <Text style={styles.connectionText}>
          Connection: <Text style={{ color: isConnected ? '#16a34a' : '#ef4444' }}>{isConnected ? 'Online' : 'Offline'}</Text>
        </Text>
        <View style={styles.locationRow}>
          <Text style={styles.connectionText}>
            GPS:{' '}
            {currentPosition?.coords
              ? `Lat ${currentPosition.coords.latitude.toFixed(4)}, Lon ${currentPosition.coords.longitude.toFixed(4)} (~${Math.round(
                  currentPosition.coords.accuracy || 0
                )}m)`
              : locationPermission === 'granted'
              ? 'Locking current position...'
              : 'Permission required'}
          </Text>
          <Text style={styles.syncLink} onPress={acquireLocation}>
            {locationLoading ? 'Refreshing…' : 'Refresh GPS'}
          </Text>
        </View>
        {locationError && <Text style={styles.warning}>{locationError}</Text>}
        {pendingCollections.length > 0 && (
          <Text style={styles.connectionText}>
            Pending collections: {pendingCollections.length}{' '}
            <Text style={styles.syncLink} onPress={syncPendingCollections}>
              Sync now
            </Text>
          </Text>
        )}
        {statusMessage && (
          <Text
            style={[
              styles.statusText,
              statusType === 'success' && styles.success,
              statusType === 'error' && styles.error,
              statusType === 'warning' && styles.warning
            ]}
          >
            {statusMessage}
          </Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8'
  },
  cameraWrapper: {
    flex: 1,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#001f3f'
  },
  camera: {
    flex: 1
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  overlayText: {
    marginTop: 12,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  viewfinder: {
    position: 'absolute',
    top: '30%',
    left: '10%',
    right: '10%',
    borderWidth: 2,
    borderColor: '#0b8a6b',
    borderRadius: 20,
    height: 220,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 16
  },
  viewfinderText: {
    color: '#fff',
    fontWeight: '600'
  },
  form: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 12,
    elevation: 8
  },
  label: {
    color: '#0a507a',
    fontWeight: '600',
    marginTop: 12
  },
  input: {
    backgroundColor: '#f4f6fb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginTop: 8
  },
  button: {
    backgroundColor: '#0b8a6b',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 18
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600'
  },
  connectionText: {
    marginTop: 12,
    color: '#0a507a',
    fontSize: 14
  },
  statusText: {
    textAlign: 'center',
    marginTop: 16,
    fontSize: 16,
    color: '#0a507a'
  },
  success: {
    color: '#0c7c59'
  },
  warning: {
    color: '#ad6a00'
  },
  error: {
    color: '#ef4444'
  },
  syncLink: {
    color: '#0b3d91',
    fontWeight: '600'
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#001f3f'
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  }
});
export default ScanScreen;