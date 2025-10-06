import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthActions, useAuthState } from '../contexts/AuthContext';
const LoginScreen = ({ navigation }) => {
  const { login } = useAuthActions();
  const { loading } = useAuthState();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const handleChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };
  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await login(form);
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to login. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <LinearGradient colors={['#0b3d91', '#0b8a6b']} style={styles.gradient}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Smart Waste</Text>
          <Text style={styles.subtitle}>Sign in to manage your waste services</Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <TextInput
            style={styles.input}
            placeholder="Username"
            autoCapitalize="none"
            value={form.username}
            onChangeText={(text) => handleChange('username', text)}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={form.password}
            onChangeText={(text) => handleChange('password', text)}
          />
          <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={submitting || loading}>
            <Text style={styles.buttonText}>{submitting ? 'Signing in...' : 'Sign In'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.link}>Need an account? Register</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};
const styles = StyleSheet.create({
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  container: {
    width: '100%',
    paddingHorizontal: 24
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 8
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0b3d91',
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 24
  },
  input: {
    backgroundColor: '#f4f6fb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12
  },
  button: {
    backgroundColor: '#0b8a6b',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600'
  },
  link: {
    color: '#0b3d91',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500'
  },
  error: {
    color: '#ef4444',
    marginBottom: 12,
    textAlign: 'center'
  }
});
export default LoginScreen;