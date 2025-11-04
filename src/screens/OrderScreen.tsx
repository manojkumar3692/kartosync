// src/screens/OrdersScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StatusBar,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';
import { listOrders, me, updateStatus, bootstrapAuth } from '../api';
import OrderCard from '../components/OrderCard';
import { C } from '../theme/colors';

const F = (w?: number) =>
  Platform.OS === 'android'
    ? { fontFamily: 'Roboto', fontWeight: (w ? String(w) : undefined) as any }
    : {};

type OrderStatus = 'pending' | 'shipped' | 'paid';

export default function OrdersScreen({ navigation, onLogout }: any) {
  const [orders, setOrders] = useState<any[]>([]);
  const [org, setOrg] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [ready, setReady] = useState(false);
  const timerRef = useRef<any>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [d, m] = await Promise.all([listOrders(), me()]);
      setOrders(d);
      setOrg(m);
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

  // Keep signature sync for child; run async inside
  function setStatus(id: string, s: OrderStatus): void {
    (async () => {
      try {
        await updateStatus(id, s);
        setOrders(prev => prev.map(o => (o.id === id ? { ...o, status: s } : o)));
      } catch (e) {
        console.error('❌ Update status failed:', e);
      }
    })();
  }

  const Header = (
    <View style={{ paddingHorizontal: 16, paddingBottom: 12, backgroundColor: C.bg }}>
      <View
        style={{
          paddingTop: Platform.select({ android: (StatusBar.currentHeight || 0) + 6, ios: 6 }),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexShrink: 1 }}>
          <Text style={[{ fontSize: 26, color: C.text }, F(900)]}>KartoSync</Text>
          <Text style={[{ color: C.sub, marginTop: 2 }, F(400)]} numberOfLines={1}>
            {org?.name || '—'} · {org?.plan ? `${org.plan} plan` : '—'}
          </Text>
          {org?.wa_phone_number_id ? (
            <Text style={[{ color: C.faint, fontSize: 12, marginTop: 2 }, F(400)]}>
              WA ID: {org.wa_phone_number_id}
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', gap: 16 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Connect')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Open settings"
          >
            <Text style={{ fontSize: 22 }}>🌐</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onLogout}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Log out"
          >
            <Text style={{ fontSize: 22 }}>⎋</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const Empty = (
    <View style={{ alignItems: 'center', padding: 28 }}>
      <Text style={{ fontSize: 38, marginBottom: 10 }}>🧾</Text>
      <Text style={[{ color: C.sub, textAlign: 'center' }, F(400)]}>
        No orders yet. Send a WhatsApp message to your business number to see it here.
      </Text>
      <Text style={[{ color: C.faint, textAlign: 'center', marginTop: 6, fontSize: 12 }, F(400)]}>
        Free plan limit: 25 orders/day. Upgrade to Pro for unlimited + PDF invoices.
      </Text>
    </View>
  );

  // Inline renderer so we can close over `item` and pass onPatchItems
  const renderItem = ({ item }: { item: any }) => (
    <OrderCard
      o={item}
      onSetStatus={setStatus}
      onPatchItems={(patched) => {
        setOrders(prev =>
          prev.map(o => (o.id === item.id ? { ...o, items: patched } : o))
        );
      }}
    />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <FlatList
        ListHeaderComponent={Header}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 16, gap: 12 }}
        data={orders}
        keyExtractor={x => x.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListEmptyComponent={Empty}
      />
    </SafeAreaView>
  );
}