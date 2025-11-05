// src/components/OrderCard.tsx
import React from 'react';
import { View, Text, TouchableOpacity, Linking, Platform, Alert } from 'react-native';
import { C } from '../theme/colors';
import { timeAgo } from '../api/timeAgo';
import CorrectionSheet from './CorrectionSheet';

type Item = {
  qty: number | null;
  unit?: string | null;
  canonical?: string | null;
  name?: string;             // keep undefined when absent (not null)
  brand?: string | null;     // NEW
  variant?: string | null;   // NEW
  notes?: string | null;     // NEW
  meta?: { cut?: string[] };
};

type OrderStatus = 'pending' | 'shipped' | 'paid';

type Order = {
  id: string;
  created_at: string;
  customer_name?: string | null;
  source_phone?: string | null;
  raw_text?: string | null;
  items?: Item[];
  status: OrderStatus;
};

// For onPatchItems typing (fixes implicit any)
type PatchItem = {
  qty: number | null;
  unit?: string | null;
  canonical?: string | null;
  name?: string;
  brand?: string | null;
  variant?: string | null;
  notes?: string | null;
};

// Roboto on Android (keeps iOS default nice)
const F = (w?: number) =>
  Platform.select({
    android: { fontFamily: 'Roboto', fontWeight: (w ? String(w) : undefined) as any },
    default: {},
  }) as any;

function normalizePhone(p?: string | null) {
  if (!p) return null;
  let digits = p.replace(/[^\d+]/g, '');
  if (!digits.startsWith('+')) {
    if (/^05\d{7,}$/.test(digits)) digits = '+971' + digits.slice(1); // UAE mobile
    else if (/^0\d{9,}$/.test(digits)) digits = '+91' + digits.slice(1); // India
    else if (/^\d{10,15}$/.test(digits)) digits = '+' + digits;
  }
  return digits;
}

function StatusPill({ status }: { status: OrderStatus }) {
  // pending → orange, shipped → blue, paid → green
  const tone =
    status === 'pending'
      ? { bg: '#FFF7ED', fg: '#FB923C' } // orange-50 / orange-400
      : status === 'shipped'
      ? { bg: '#EFF6FF', fg: '#3B82F6' } // blue-50 / blue-500
      : { bg: '#F0FDF4', fg: '#22C55E' }; // green-50 / green-500

  const label = status === 'pending' ? 'PENDING' : status === 'shipped' ? 'SHIPPED' : 'PAID';

  return (
    <View style={{ backgroundColor: tone.bg, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 }}>
      <Text style={[{ color: tone.fg, fontSize: 12, fontWeight: '800' }, F(800)]}>{label}</Text>
    </View>
  );
}

async function openWhatsApp(phoneE164: string) {
  const msg = 'Hi! About your order…';
  const deep = `whatsapp://send?phone=${encodeURIComponent(phoneE164)}&text=${encodeURIComponent(msg)}`;
  const web = `https://wa.me/${encodeURIComponent(phoneE164)}?text=${encodeURIComponent(msg)}`;
  try {
    const canDeep = await Linking.canOpenURL('whatsapp://send');
    if (canDeep) return Linking.openURL(deep);
    return Linking.openURL(web);
  } catch {
    Alert.alert('WhatsApp not available', 'Please install WhatsApp to continue.');
  }
}

export default function OrderCard({
  o,
  onSetStatus,
  onPatchItems, // optional: if provided, parent list will patch items; otherwise we patch locally
}: {
  o: Order;
  onSetStatus: (id: string, s: OrderStatus) => void | Promise<void>;
  onPatchItems?: (items: PatchItem[]) => void;
}) {
  const when = timeAgo(o.created_at);
  const who = o.customer_name || o.source_phone || 'Customer';
  const phoneE164 = normalizePhone(o.source_phone || undefined);

  // Fix flow state
  const [fixOpen, setFixOpen] = React.useState(false);

  const prettyItems = (o.items || []).map((i, idx) => {
    const cut = i.meta?.cut?.length ? ` (${i.meta.cut.join(', ')})` : '';
    const unit = i.unit ? ` ${i.unit}` : '';
    const label = i.canonical || i.name || '';
    const qty = typeof i.qty === 'number' ? i.qty : '';
    const brand = i.brand ? ` · ${i.brand}` : '';
    const variant = i.variant ? ` · ${i.variant}` : '';
    const text = `${qty}${unit} ${label}${brand}${variant}${cut}`.trim();
    return (
      <View
        key={idx}
        style={{
          backgroundColor: '#F8FAFC', // slate-50
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: '#E5E7EB',
        }}
      >
        <Text style={[{ color: C.text, fontSize: 15 }, F(500)]}>{text}</Text>
      </View>
    );
  });

  const fallback =
    !prettyItems.length && o.raw_text ? <Text style={[{ color: C.text, fontSize: 14 }, F(400)]}>{o.raw_text}</Text> : null;

  // Pass current items (including brand/variant/notes) to the correction sheet
  const currentItems = (o.items || []).map(i => ({
    qty: typeof i.qty === 'number' ? i.qty : null,
    unit: (i.unit as any) ?? null,
    name: i.canonical || i.name || '',
    canonical: i.canonical ?? null,
    brand: i.brand ?? null,
    variant: i.variant ?? null,
    notes: i.notes ?? null,
  }));

  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      }}
    >
      {/* Top row: time + status pill */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[{ color: '#6B7280', fontSize: 12 }, F(400)]}>
            {new Date(o.created_at).toLocaleString()}
          </Text>
          <View style={{ backgroundColor: '#F3F4F6', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999 }}>
            <Text style={[{ color: '#374151', fontSize: 11 }, F(600)]}>{when}</Text>
          </View>
        </View>
        <StatusPill status={o.status} />
      </View>

      {/* Who + phone (if any) */}
      <View style={{ marginTop: 8 }}>
        <Text style={[{ color: '#0F172A', fontSize: 18 }, F(900)]} numberOfLines={1}>
          {who}
        </Text>
        {phoneE164 ? (
          <Text style={[{ color: '#6B7280', fontSize: 12, marginTop: 2 }, F(400)]} numberOfLines={1}>
            {phoneE164}
          </Text>
        ) : null}
      </View>

      {/* Items */}
      <View style={{ gap: 10, marginTop: 12 }}>{prettyItems}</View>
      {fallback && <View style={{ marginTop: 10 }}>{fallback}</View>}

      {/* Big rounded actions */}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
        <TouchableOpacity
          disabled={!phoneE164}
          onPress={() => phoneE164 && Linking.openURL(`tel:${phoneE164}`)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            flex: 1,
            backgroundColor: phoneE164 ? '#0B1220' : '#9CA3AF',
            paddingVertical: 14,
            borderRadius: 18,
            alignItems: 'center',
          }}
          accessibilityLabel="Call customer"
        >
          <Text style={[{ color: '#fff', fontSize: 16 }, F(800)]}>📞  Call</Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={!phoneE164}
          onPress={() => phoneE164 && openWhatsApp(phoneE164)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            flex: 1,
            backgroundColor: phoneE164 ? '#10B981' : '#9CA3AF',
            paddingVertical: 14,
            borderRadius: 18,
            alignItems: 'center',
          }}
          accessibilityLabel="Open WhatsApp"
        >
          <Text style={[{ color: '#fff', fontSize: 16 }, F(800)]}>🟢  WhatsApp</Text>
        </TouchableOpacity>
      </View>

      {/* Wrong Parse → Fix */}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
        <TouchableOpacity
          onPress={() => setFixOpen(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            flex: 1,
            backgroundColor: '#F59E0B',
            paddingVertical: 12,
            borderRadius: 14,
            alignItems: 'center',
          }}
          accessibilityLabel="Fix wrong parse"
        >
          <Text style={[{ color: '#fff', fontSize: 15 }, F(800)]}>✏️  Wrong Parse → Fix</Text>
        </TouchableOpacity>
      </View>

      {/* Segmented status switcher (Pending / Shipped / Paid) */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: '#F3F4F6',
          borderRadius: 14,
          padding: 4,
          gap: 4,
          marginTop: 14,
        }}
      >
        {(['pending', 'shipped', 'paid'] as OrderStatus[]).map((s) => {
          const active = o.status === s;
          const label = s === 'pending' ? 'Pending' : s === 'shipped' ? 'Shipped' : 'Paid';
          const activeColor =
            s === 'pending' ? '#F59E0B' : s === 'shipped' ? '#3B82F6' : '#22C55E';
          return (
            <TouchableOpacity
              key={s}
              onPress={() => onSetStatus(o.id, s)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={{
                flex: 1,
                backgroundColor: active ? '#FFFFFF' : 'transparent',
                borderRadius: 10,
                paddingVertical: 10,
                alignItems: 'center',
                borderWidth: active ? 1 : 0,
                borderColor: active ? '#E5E7EB' : 'transparent',
              }}
              accessibilityLabel={`Mark ${label}`}
            >
              <Text
                style={[
                  {
                    fontSize: 13,
                    color: active ? activeColor : '#6B7280',
                  },
                  F(active ? 800 : 600),
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Correction bottom sheet */}
      <CorrectionSheet
        visible={fixOpen}
        onClose={() => setFixOpen(false)}
        orderId={o.id}
        initialItems={currentItems}
        onPatched={(items) => {
          // items may include brand / variant / notes if your sheet adds them
          const patched: PatchItem[] = items.map((it) => ({
            qty: it.qty,
            unit: it.unit || null,
            canonical: it.canonical || null,
            name: it.name || undefined,
            brand: (it as any).brand ?? null,
            variant: (it as any).variant ?? null,
            notes: (it as any).notes ?? null,
          }));

          // Prefer lifting to parent, otherwise patch locally for instant feel.
          if (onPatchItems) {
            onPatchItems(patched);
          } else {
            (o as any).items = patched; // local optimistic patch
          }
        }}
      />
    </View>
  );
}