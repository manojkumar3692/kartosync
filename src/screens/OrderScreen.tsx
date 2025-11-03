// src/screens/OrdersScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { listOrders, me, updateStatus, bootstrapAuth } from '../api';
import OrderCard from '../components/OrderCard';
import { C } from '../theme/colors';

export default function OrdersScreen({ navigation, onLogout }: any) {
  const [orders, setOrders] = useState<any[]>([]);
  const [org, setOrg] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [ready, setReady] = useState(false);
  const timerRef = useRef<any>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      console.log('📦 Fetching orders…');
      const [d, m] = await Promise.all([listOrders(), me()]);
      setOrders(d);
      setOrg(m);
      console.log('✅ Orders:', d.length);
    } catch (err) {
      console.error('❌ Orders refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const tok = await bootstrapAuth();
        console.log('🔐 bootstrapAuth token?', !!tok);
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    refresh();
    timerRef.current = setInterval(refresh, 12000);
    return () => clearInterval(timerRef.current);
  }, [ready, refresh]);

  async function setStatus(id: string, s: 'pending' | 'delivered' | 'paid') {
    try {
      await updateStatus(id, s);
      setOrders(prev => prev.map(o => (o.id === id ? { ...o, status: s } : o)));
    } catch (e) {
      console.error('❌ Update status failed:', e);
    }
  }

  const Header = (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 6,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <View>
        <Text style={{ fontSize: 20, fontWeight: '900', color: C.text }}>KartoSync</Text>
        <Text style={{ color: C.sub, marginTop: 2 }}>
          {org?.name || '—'} • Plan: {org?.plan || '—'}
        </Text>
        {org?.wa_phone_number_id ? (
          <Text style={{ color: C.faint, fontSize: 12, marginTop: 2 }}>
            WA ID: {org.wa_phone_number_id}
          </Text>
        ) : null}
      </View>

      {/* ⚙️ Settings Button */}
      <TouchableOpacity onPress={() => navigation.navigate('Connect')}>
        <Text style={{ fontSize: 20, color: '#007AFF' }}>⚙️</Text>
      </TouchableOpacity>
    </View>
  );

  const Empty = (
    <View style={{ alignItems: 'center', padding: 28 }}>
      <Text style={{ fontSize: 38, marginBottom: 10 }}>🧾</Text>
      <Text style={{ color: C.sub, textAlign: 'center' }}>
        No orders yet. Send a WhatsApp message to your business number to see it here.
      </Text>
      <Text
        style={{
          color: C.faint,
          textAlign: 'center',
          marginTop: 6,
          fontSize: 12,
        }}
      >
        Free plan limit: 25 orders/day. Upgrade to Pro for unlimited + PDF invoices
        (sales@tropicalglow.in)
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <FlatList
        ListHeaderComponent={Header}
        contentContainerStyle={{ padding: 12, gap: 10 }}
        data={orders}
        keyExtractor={x => x.id}
        renderItem={({ item }) => <OrderCard o={item} onSetStatus={setStatus} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListEmptyComponent={Empty}
      />
      <View style={{ alignItems: 'center', paddingVertical: 10 }}>
        <Text onPress={onLogout} style={{ color: '#EF4444', fontWeight: '800' }}>
          Log out
        </Text>
      </View>
    </View>
  );
}