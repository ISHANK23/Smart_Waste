import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthActions } from '../contexts/AuthContext';
const RegisterScreen = ({ navigation }) => {
  const { register } = useAuthActions();
  const [form, setForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    role: 'resident',
    address: '',
    phone: ''
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const handleChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };
  const handleSubmit = async () => {
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await register({
        username: form.username,
        password: form.password,
        role: form.role,
        address: form.address,
        phone: form.phone
      });
      setSuccess('Registration successful! You can now sign in.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <LinearGradient colors={['#0b3d91', '#0b8a6b']} style={styles.gradient}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.title}>Create account</Text>
            {error && <Text style={styles.error}>{error}</Text>}
            {success && <Text style={styles.success}>{success}</Text>}
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
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              secureTextEntry
              value={form.confirmPassword}
              onChangeText={(text) => handleChange('confirmPassword', text)}
            />
            <TextInput
              style={styles.input}
              placeholder="Role (resident/staff)"
              autoCapitalize="none"
              value={form.role}
              onChangeText={(text) => handleChange('role', text.toLowerCase())}
            />
            <TextInput
              style={styles.input}
              placeholder="Address"
              value={form.address}
              onChangeText={(text) => handleChange('address', text)}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone"
              keyboardType="phone-pad"
              value={form.phone}
              onChangeText={(text) => handleChange('phone', text)}
            />
            <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={submitting}>
              <Text style={styles.buttonText}>{submitting ? 'Creating...' : 'Register'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.link}>Back to login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
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
    flex: 1,
    width: '100%',
    paddingHorizontal: 24
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center'
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 20,
    padding: 24,
    marginVertical: 40,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    elevation: 6
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0b3d91',
    textAlign: 'center',
    marginBottom: 16
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
  },
  success: {
    color: '#0b8a6b',
    marginBottom: 12,
    textAlign: 'center'
  }
});
export default RegisterScreen;