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
      setOrders(Array.isArray(d) ? d : []);
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

  // Keep signature; run async inside
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

  // ----- Header (premium, LandingClassic style) -----
  const Header = (
    <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
      {/* soft background blobs */}
      <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>
        <View
          style={{
            position: 'absolute',
            top: -120,
            left: -120,
            width: 260,
            height: 260,
            borderRadius: 260,
            backgroundColor: '#C7D2FE', // indigo-200
            opacity: 0.35,
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: -100,
            right: -100,
            width: 240,
            height: 240,
            borderRadius: 240,
            backgroundColor: '#BBF7D0', // emerald-200
            opacity: 0.35,
          }}
        />
      </View>

      <View
        style={{
          paddingTop: Platform.select({ android: (StatusBar.currentHeight || 0) + 6, ios: 6 }),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Brand + pill */}
        <View style={{ flexShrink: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                height: 40,
                width: 40,
                borderRadius: 12,
                backgroundColor: '#111827',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOpacity: 0.08,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 3 },
                elevation: 2,
              }}
            >
              <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 11 }}>KS</Text>
            </View>
            <Text style={[{ fontSize: 24, color: C.text }, F(900)]}>KartoSync</Text>
          </View>

          {/* Live pill */}
          {/* <View
            style={{
              marginTop: 8,
              alignSelf: 'flex-start',
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              backgroundColor: '#FFFFFF',
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: '#10B981', // emerald-500
                marginRight: 6,
              }}
            />
            <Text style={{ fontSize: 12, color: '#374151' }}>Live in minutes — no code</Text>
          </View> */}

          {/* Workspace meta */}
          <Text style={[{ color: C.sub, marginTop: 8 }, F(600)]} numberOfLines={1}>
            {org?.name || '—'} · {org?.plan ? `${org.plan} plan` : '—'}
          </Text>
          {org?.wa_phone_number_id ? (
            <Text style={[{ color: C.faint, fontSize: 12, marginTop: 2 }, F(400)]}>
              WA ID: {org.wa_phone_number_id}
            </Text>
          ) : null}
        </View>

        {/* Header actions */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Connect')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Open settings"
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Text style={[{ fontSize: 13, color: '#111827' }, F(800)]}>🌐</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onLogout}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Log out"
            style={{
              backgroundColor: '#111827',
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Text style={[{ fontSize: 13, color: '#FFFFFF' }, F(800)]}>⎋ Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Free plan hint (subtle) */}
      {org?.plan === 'free' ? (
        <View
          style={{
            marginTop: 10,
            backgroundColor: '#FFFBEB', // amber-50
            borderWidth: 1,
            borderColor: '#FDE68A', // amber-200
            borderRadius: 12,
            paddingVertical: 10,
            paddingHorizontal: 12,
          }}
        >
          <Text style={[{ color: '#92400E', fontSize: 12 }, F(600)]}>
            Free plan limit: 25 orders/day. Upgrade to Pro for unlimited + PDF invoices.
          </Text>
        </View>
      ) : null}
    </View>
  );

  const Empty = (
    <View
      style={{
        alignItems: 'center',
        padding: 28,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
      }}
    >
      <Text style={{ fontSize: 38, marginBottom: 10 }}>🧾</Text>
      <Text style={[{ color: C.sub, textAlign: 'center' }, F(600)]}>
        No orders yet. Send a WhatsApp message to your business number to see it here.
      </Text>
      <Text style={[{ color: C.faint, textAlign: 'center', marginTop: 6, fontSize: 12 }, F(400)]}>
        Tip: Map your WhatsApp number on the Connect screen.
      </Text>

      <TouchableOpacity
        onPress={() => navigation.navigate('Connect')}
        style={{
          marginTop: 12,
          backgroundColor: '#111827',
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 12,
        }}
      >
        <Text style={[{ color: '#FFFFFF' }, F(800)]}>🌐 Open Connect</Text>
      </TouchableOpacity>
    </View>
  );

  // Inline renderer so we can close over `item` and patch items locally
  const renderItem = ({ item }: { item: any }) => (
    <OrderCard
      o={item}
      onSetStatus={setStatus}
      onPatchItems={(patched) => {
        setOrders(prev => prev.map(o => (o.id === item.id ? { ...o, items: patched } : o)));
      }}
    />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content"/>
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