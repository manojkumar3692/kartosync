import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE = 'https://characterful-enneadic-cherelle.ngrok-free.dev';


export function setToken(token?: string) {
  if (token) axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete axios.defaults.headers.common.Authorization;
}

export async function bootstrapAuth() {
  const t = await AsyncStorage.getItem('token');
  if (t) setToken(t);
  return t;
}

export async function signup(name: string, phone: string, password: string) {
  const r = await axios.post(`${API_BASE}/api/auth/signup`, { name, phone, password });
  return r.data; // { token, org }
}

export async function login(phone: string, password: string) {
  const r = await axios.post(`${API_BASE}/api/auth/login`, { phone, password });
  return r.data; // { token, org }
}

export async function me() {
  const r = await axios.get(`${API_BASE}/api/org/me`);
  return r.data;
}

export async function listOrders() {
  const r = await axios.get(`${API_BASE}/api/orders`);
  return r.data; // Order[]
}

export async function updateStatus(id: string, status: 'pending'|'shipped'|'paid') {
  await axios.post(`${API_BASE}/api/orders/${id}/status`, { status });
}