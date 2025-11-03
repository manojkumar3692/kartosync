import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login, signup, setToken } from '../api';

export default function LoginScreen({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  async function submit() {
    try {
      let data: any;
    if (mode === 'signup') {
    if (!name?.trim()) return Alert.alert('Enter shop name');
    if (!phone?.trim()) return Alert.alert('Enter phone');
    if (!password?.trim()) return Alert.alert('Enter password');
  
    data = await signup(name, phone, password);   // ✅ include password
  } else {
    data = await login(phone, password);
  }
      await AsyncStorage.setItem('token', data.token);
    //   const token = await AsyncStorage.getItem('token');
      console.log('🪙 Token:', data.token);
      setToken(data.token);
      onAuthed();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Failed');
    }
  }

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 22, fontWeight: '700', marginBottom: 8 }}>KartoSync</Text>
      <Text style={{ color: '#666', marginBottom: 18 }}>
        {mode === 'signup' ? 'Create your shop account' : 'Sign in to your shop'}
      </Text>

      {mode === 'signup' && (
        <TextInput
          placeholder="Shop name"
          value={name}
          onChangeText={setName}
          style={styles.input}
        />
      )}

      <TextInput
        placeholder="Phone (e.g. +919999999999)"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        style={styles.input}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      <TouchableOpacity onPress={submit} style={styles.btn}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>
          {mode === 'signup' ? 'Create account' : 'Log in'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        <Text style={{ color: '#3b82f6', marginTop: 12 }}>
          {mode === 'login' ? "New here? Create an account" : 'Have an account? Log in'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = {
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: '#fafafa',
  },
  btn: {
    backgroundColor: '#111827',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
} as const;