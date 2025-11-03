// src/components/OrderCard.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { C } from '../theme/colors';
import StatusPill from './StatusPill';
import { timeAgo } from '../api/timeAgo';

type Item = { qty: number; unit?: string; canonical?: string; name?: string; meta?: { cut?: string[] } };
type Order = {
  id: string;
  created_at: string;
  customer_name?: string | null;
  source_phone?: string | null;
  raw_text?: string | null;
  items?: Item[];
  status: 'pending' | 'delivered' | 'paid';
};

export default function OrderCard({
  o,
  onSetStatus,
}: {
  o: Order;
  onSetStatus: (id: string, s: Order['status']) => void;
}) {
  const when = timeAgo(o.created_at);
  const who = o.customer_name || o.source_phone || 'Customer';

  const prettyItems = (o.items || []).map((i, idx) => {
    const cut = i.meta?.cut?.length ? ` (${i.meta.cut.join(', ')})` : '';
    const unit = i.unit ? ` ${i.unit}` : '';
    const label = i.canonical || i.name || '';
    const text = `${i.qty}${unit} ${label}${cut}`.trim();
    return (
      <View
        key={idx}
        style={{
          backgroundColor: '#F1F5F9',
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 8,
        }}
      >
        <Text style={{ color: C.text, fontSize: 13 }}>{text}</Text>
      </View>
    );
  });

  const fallback = !prettyItems.length && o.raw_text ? (
    <Text style={{ color: C.text, fontSize: 14 }}>{o.raw_text}</Text>
  ) : null;

  return (
    <View
      style={{
        backgroundColor: C.card,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: C.border,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
      }}
    >
      {/* Top Row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ color: C.sub, fontSize: 12 }}>{when}</Text>
        <Text
          style={{
            fontSize: 12,
            fontWeight: '800',
            color: o.status === 'pending' ? C.pending : o.status === 'delivered' ? C.delivered : C.paid,
          }}
        >
          {o.status.toUpperCase()}
        </Text>
      </View>

      {/* Title */}
      <Text style={{ marginTop: 4, fontWeight: '800', color: C.text, fontSize: 16 }}>{who}</Text>

      {/* Items */}
      <View style={{ gap: 8, marginTop: 10 }}>{prettyItems}</View>
      {fallback && <View style={{ marginTop: 8 }}>{fallback}</View>}

      {/* Actions */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <StatusPill
          active={o.status === 'pending'}
          label="Pending"
          icon="⏳"
          tone="pending"
          onPress={() => onSetStatus(o.id, 'pending')}
        />
        <StatusPill
          active={o.status === 'delivered'}
          label="Delivered"
          icon="📦"
          tone="delivered"
          onPress={() => onSetStatus(o.id, 'delivered')}
        />
        <StatusPill
          active={o.status === 'paid'}
          label="Paid"
          icon="💸"
          tone="paid"
          onPress={() => onSetStatus(o.id, 'paid')}
        />
      </View>
    </View>
  );
}