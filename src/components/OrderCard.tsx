// src/components/OrderCard.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  Platform,
  Alert,
  Share,
  TextInput,
} from 'react-native';
import { C } from '../theme/colors';
import { timeAgo } from '../api/timeAgo';
import CorrectionSheet from './CorrectionSheet';
import { getClarifyLink, aiFixOrder, updateStatus } from '../api';
import { API_BASE } from '../api';

const fs = (n: number) => (Platform.OS === 'ios' || Platform.OS === 'android' ? Math.max(10, n - 1) : n);

type Item = {
  qty: number | null;
  unit?: string | null;
  canonical?: string | null;
  name?: string;             // keep undefined when absent
  brand?: string | null;
  variant?: string | null;
  notes?: string | null;
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

  // NEW: to show inquiry badge/buttons in mobile
  parse_reason?: string | null; // "inq:price" | "inq:availability" | ...
  parse_confidence?: number | null;
};

type PatchItem = {
  qty: number | null;
  unit?: string | null;
  canonical?: string | null;
  name?: string;
  brand?: string | null;
  variant?: string | null;
  notes?: string | null;
};

const F = (w?: number) =>
  Platform.select({
    android: { fontFamily: 'Roboto', fontWeight: (w ? String(w) : undefined) as any },
    default: {},
  }) as any;

function normalizePhone(p?: string | null) {
  if (!p) return null;
  let digits = p.replace(/[^\d+]/g, '');
  if (!digits.startsWith('+')) {
    if (/^05\d{7,}$/.test(digits)) digits = '+971' + digits.slice(1); // UAE
    else if (/^0\d{9,}$/.test(digits)) digits = '+91' + digits.slice(1); // India
    else if (/^\d{10,15}$/.test(digits)) digits = '+' + digits;
  }
  return digits;
}

function isBlank(v?: string | null) {
  return !v || !String(v).trim();
}
function isAmbiguous(i: Item) {
  return isBlank(i.brand) || isBlank(i.variant);
}
function inquiryKind(parseReason?: string | null): 'price' | 'availability' | null {
  const r = (parseReason || '').toLowerCase();
  if (r.startsWith('inq:price')) return 'price';
  if (r.startsWith('inq:availability')) return 'availability';
  return null;
}

async function openWhatsAppTo(phoneE164: string, message: string) {
  const deep = `whatsapp://send?phone=${encodeURIComponent(phoneE164)}&text=${encodeURIComponent(
    message
  )}`;
  const web = `https://wa.me/${encodeURIComponent(phoneE164)}?text=${encodeURIComponent(message)}`;
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
  onPatchItems,
  onDelete, // optional: parent can delete whole order
}: {
  o: Order;
  onSetStatus: (id: string, s: OrderStatus) => void | Promise<void>;
  onPatchItems?: (items: PatchItem[]) => void;
  onDelete?: (id: string) => void | Promise<void>;
}) {
  const when = timeAgo(o.created_at);
  const who = o.customer_name || o.source_phone || 'Customer';
  const phoneE164 = normalizePhone(o.source_phone || undefined);

  // Fix-sheet state (kept)
  const [fixOpen, setFixOpen] = React.useState(false);

  // Inline edit state
  const [editIdx, setEditIdx] = React.useState<number | null>(null);
  const [brandInput, setBrandInput] = React.useState<string>('');
  const [variantInput, setVariantInput] = React.useState<string>('');
  const [notesInput, setNotesInput] = React.useState<string>('');
  const [busyIdx, setBusyIdx] = React.useState<number | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // Inquiry
  const inq = inquiryKind(o.parse_reason);
  const firstItem = (o.items && o.items[0]) || null;
  const itemLabel = (firstItem?.canonical || firstItem?.name || '').trim();
  const firstName = o.customer_name ? ` ${o.customer_name}` : '';

  async function startEdit(idx: number) {
    const it = (o.items || [])[idx];
    setEditIdx(idx);
    setBrandInput(it?.brand || '');
    setVariantInput(it?.variant || '');
    setNotesInput(it?.notes || '');
  }
  function cancelEdit() {
    setEditIdx(null);
    setBrandInput('');
    setVariantInput('');
    setNotesInput('');
  }

  async function saveLine(idx: number) {
    try {
      setBusyIdx(idx);
      const items = (o.items || []).map((it, i) =>
        i === idx
          ? {
              qty: typeof it.qty === 'number' ? it.qty : null,
              unit: it.unit ?? null,
              canonical: it.canonical ?? it.name ?? '',
              name: it.name ?? undefined,
              brand: brandInput.trim() || null,
              variant: variantInput.trim() || null,
              notes: notesInput.trim() || null,
            }
          : {
              qty: typeof it.qty === 'number' ? it.qty : null,
              unit: it.unit ?? null,
              canonical: it.canonical ?? it.name ?? '',
              name: it.name ?? undefined,
              brand: it.brand ?? null,
              variant: it.variant ?? null,
              notes: it.notes ?? null,
            }
      );

      await aiFixOrder(o.id, { items, reason: 'inline_edit_mobile' });

      if (onPatchItems) {
        const patched: PatchItem[] = items.map((it) => ({
          qty: it.qty,
          unit: it.unit,
          canonical: it.canonical,
          name: it.name,
          brand: it.brand,
          variant: it.variant,
          notes: it.notes,
        }));
        onPatchItems(patched);
      } else {
        (o as any).items = items; // optimistic
      }
      cancelEdit();
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Could not save line');
    } finally {
      setBusyIdx(null);
    }
  }

  async function deleteLine(idx: number) {
    try {
      setBusyIdx(idx);
      const items = (o.items || []).filter((_, i) => i !== idx).map((it) => ({
        qty: typeof it.qty === 'number' ? it.qty : null,
        unit: it.unit ?? null,
        canonical: it.canonical ?? it.name ?? '',
        name: it.name ?? undefined,
        brand: it.brand ?? null,
        variant: it.variant ?? null,
        notes: it.notes ?? null,
      }));

      await aiFixOrder(o.id, { items, reason: 'delete_line_mobile' });

      if (onPatchItems) {
        const patched: PatchItem[] = items.map((it) => ({
          qty: it.qty,
          unit: it.unit,
          canonical: it.canonical,
          name: it.name,
          brand: it.brand,
          variant: it.variant,
          notes: it.notes,
        }));
        onPatchItems(patched);
      } else {
        (o as any).items = items; // optimistic
      }
      if (editIdx === idx) cancelEdit();
    } catch (e: any) {
      Alert.alert('Delete failed', e?.message || 'Could not delete item');
    } finally {
      setBusyIdx(null);
    }
  }

  function pickFirstAmbiguousIndex() {
    const items = Array.isArray(o.items) ? o.items : [];
    if (!items.length) return 0;
    const idx = items.findIndex(isAmbiguous);
    return idx >= 0 ? idx : 0;
  }

  async function sendClarify(idx?: number) {
    try {
      const line_index = typeof idx === 'number' ? idx : pickFirstAmbiguousIndex();
      const url = await getClarifyLink(o.id, line_index);
      const message = `Quick confirm: which one did you mean?\n${url}`;
      if (phoneE164) {
        return openWhatsAppTo(phoneE164, message);
      }
      await Share.share({ message });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not create clarify link.');
    }
  }

  const itemsList = (o.items || []).map((it, idx) => {
    const qty = typeof it.qty === 'number' ? it.qty : '';
    const unit = it.unit ? ` ${it.unit}` : '';
    const base = it.canonical || it.name || '';
    const brand = it.brand || '';
    const variant = it.variant || '';
    const notes = it.notes || '';
    const cut = it.meta?.cut?.length ? ` (${it.meta.cut.join(', ')})` : '';
    const ambiguous = isAmbiguous(it);

    const isEditing = editIdx === idx;

    return (
      <View
        key={idx}
        style={{
          backgroundColor: '#F8FAFC',
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: '#E5E7EB',
          marginBottom: 8,
        }}
      >
        {/* Display row */}
        {!isEditing && (
          <TouchableOpacity onPress={() => startEdit(idx)} activeOpacity={0.9}>
            <Text style={[{ color: C.text, fontSize: fs(12) }, F(600)]}>
              {`${qty}${unit} ${base}${brand ? ` · ${brand}` : ' · '}
              ${variant ? variant : ''}${cut}`.replace(/\s+/g, ' ').trim()}
            </Text>
            {!!notes && (
              <Text style={[{ color: '#6B7280', fontSize: fs(12), marginTop: 2 }, F(400)]}>
                📝 {notes}
              </Text>
            )}
            {ambiguous && (
              <View
                style={{
                  marginTop: 6,
                  alignSelf: 'flex-start',
                  backgroundColor: '#FEF3C7',
                  borderColor: '#FDE68A',
                  borderWidth: 1,
                  paddingVertical: 3,
                  paddingHorizontal: 8,
                  borderRadius: 999,
                }}
              >
                <Text style={[{ color: '#92400E', fontSize: fs(11) }, F(700)]}>Needs details</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Inline edit row */}
        {isEditing && (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                placeholder="Brand"
                value={brandInput}
                onChangeText={setBrandInput}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                }}
              />
              <TextInput
                placeholder="Variant"
                value={variantInput}
                onChangeText={setVariantInput}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                }}
              />
            </View>
            <TextInput
              placeholder="Notes (optional)"
              value={notesInput}
              onChangeText={setNotesInput}
              style={{
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 10,
                paddingHorizontal: 10,
                paddingVertical: 8,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                disabled={busyIdx === idx}
                onPress={() => saveLine(idx)}
                style={{
                  flex: 1,
                  backgroundColor: '#0B1220',
                  paddingVertical: 10,
                  borderRadius: 12,
                  alignItems: 'center',
                  opacity: busyIdx === idx ? 0.6 : 1,
                }}
              >
                <Text style={[{ color: '#fff', fontSize: fs(14) }, F(800)]}>
                  {busyIdx === idx ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => sendClarify(idx)}
                style={{
                  flex: 1,
                  backgroundColor: '#111827',
                  paddingVertical: 10,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={[{ color: '#fff', fontSize: fs(14) }, F(800)]}>🔗 Clarify</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={busyIdx === idx}
                onPress={() => deleteLine(idx)}
                style={{
                  width: 56,
                  backgroundColor: '#EF4444',
                  paddingVertical: 10,
                  borderRadius: 12,
                  alignItems: 'center',
                  opacity: busyIdx === idx ? 0.6 : 1,
                }}
              >
                <Text style={[{ color: '#fff', fontSize: fs(14) }, F(800)]}>🗑️</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={cancelEdit}
              style={{
                alignSelf: 'center',
                marginTop: 4,
                paddingVertical: 6,
                paddingHorizontal: 10,
              }}
            >
              <Text style={[{ color: '#6B7280', fontSize: fs(12) }, F(700)]}>Close</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  });

  const fallback =
    !itemsList.length && o.raw_text ? (
      <Text style={[{ color: C.text, fontSize: fs(14) }, F(400)]}>{o.raw_text}</Text>
    ) : null;

  // Current items snapshot for the correction sheet
  const currentItems = (o.items || []).map((i) => ({
    qty: typeof i.qty === 'number' ? i.qty : null,
    unit: (i.unit as any) ?? null,
    name: i.canonical || i.name || '',
    canonical: i.canonical ?? null,
    brand: i.brand ?? null,
    variant: i.variant ?? null,
    notes: i.notes ?? null,
  }));

  async function handleDeleteOrder() {
    try {
      setDeleting(true);
      if (onDelete) {
        await onDelete(o.id);
      } else {
        // Fallback direct call (expects backend DELETE /api/orders/:id)
        const r = await fetch(`${API_BASE}/api/orders/${o.id}`, { method: 'DELETE' });
        if (!r.ok) throw new Error('Delete failed');
      }
    } catch (e: any) {
      Alert.alert('Delete failed', e?.message || 'Could not delete order');
    } finally {
      setDeleting(false);
    }
  }

  function sendInquiry(kind: 'price' | 'availability') {
    const msg =
      kind === 'price'
        ? [
            `Hi${firstName},`,
            itemLabel
              ? `${itemLabel} – current price is AED ____ (per unit).`
              : `Here’s the price you asked for: AED ____ .`,
            `Let me know if you’d like to place an order.`,
          ].join(' ')
        : [
            `Hi${firstName},`,
            itemLabel ? `${itemLabel} is available ✅.` : `Yes, it's available ✅.`,
            `Send item name & quantity and I’ll book it for you.`,
          ].join(' ');
    if (phoneE164) openWhatsAppTo(phoneE164, msg);
    else Share.share({ message: msg });
  }

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
        marginBottom: 14,
      }}
    >
      {/* Top row: created + relative + status + delete */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[{ color: '#6B7280', fontSize: fs(12) }, F(400)]}>
            {new Date(o.created_at).toLocaleString()}
          </Text>
          <View
            style={{ backgroundColor: '#F3F4F6', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999 }}
          >
            <Text style={[{ color: '#374151', fontSize: fs(11) }, F(600)]}>{when}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* Delete whole order */}
          <TouchableOpacity
            onPress={handleDeleteOrder}
            disabled={deleting}
            style={{
              backgroundColor: '#FEE2E2',
              borderColor: '#FCA5A5',
              borderWidth: 1,
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 999,
              opacity: deleting ? 0.6 : 1,
            }}
          >
            <Text style={[{ color: '#B91C1C', fontSize: fs(12) }, F(800)]}>
              {deleting ? 'Deleting…' : '🗑️ Delete'}
            </Text>
          </TouchableOpacity>

          {/* Status segmented */}
          
        </View>
      </View>

      {/* Who + phone */}
      <View style={{ marginTop: 8 }}>
        <Text style={[{ color: '#0F172A', fontSize: fs(18) }, F(900)]} numberOfLines={1}>
          {who}
        </Text>
        {phoneE164 ? (
          <Text style={[{ color: '#6B7280', fontSize: fs(12), marginTop: 2 }, F(400)]} numberOfLines={1}>
            {phoneE164}
          </Text>
        ) : null}
      </View>

      {/* Inquiry badge + quick replies */}
      {inq && (
        <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <View
            style={{
              backgroundColor: '#F3E8FF',
              borderColor: '#E9D5FF',
              borderWidth: 1,
              paddingVertical: 4,
              paddingHorizontal: 10,
              borderRadius: 999,
            }}
          >
            <Text style={[{ color: '#6D28D9', fontSize: fs(12) }, F(800)]}>
              Inquiry: {inq === 'price' ? 'Price' : 'Availability'}
            </Text>
          </View>

          {/* Show BOTH; highlight detected type with solid button */}
          <TouchableOpacity
            onPress={() => sendInquiry('price')}
            style={{
              backgroundColor: inq === 'price' ? '#6D28D9' : '#F5F3FF',
              borderColor: '#DDD6FE',
              borderWidth: 1,
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 10,
            }}
          >
            <Text style={[{ color: inq === 'price' ? '#FFFFFF' : '#6D28D9', fontSize: fs(12) }, F(800)]}>
              💸 Reply (Price)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => sendInquiry('availability')}
            style={{
              backgroundColor: inq === 'availability' ? '#6D28D9' : '#F5F3FF',
              borderColor: '#DDD6FE',
              borderWidth: 1,
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 10,
            }}
          >
            <Text style={[{ color: inq === 'availability' ? '#FFFFFF' : '#6D28D9', fontSize: fs(12) }, F(800)]}>
              ✅ Reply (Availability)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Items with inline edit/clarify/delete */}
      <View style={{ marginTop: 12 }}>{itemsList}</View>

      {fallback && <View style={{ marginTop: 8 }}>{fallback}</View>}

      {/* Call / WhatsApp quick action row */}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
        <TouchableOpacity
          disabled={!phoneE164}
          onPress={() => phoneE164 && Linking.openURL(`tel:${phoneE164}`)}
          style={{
            flex: 1,
            backgroundColor: phoneE164 ? '#0B1220' : '#9CA3AF',
            paddingVertical: 14,
            borderRadius: 18,
            alignItems: 'center',
          }}
          accessibilityLabel="Call customer"
        >
          <Text style={[{ color: '#fff', fontSize: fs(16) }, F(800)]}>📞  Call</Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={!phoneE164}
          onPress={() => phoneE164 && openWhatsAppTo(phoneE164, 'Hi! About your order…')}
          style={{
            flex: 1,
            backgroundColor: phoneE164 ? '#10B981' : '#9CA3AF',
            paddingVertical: 14,
            borderRadius: 18,
            alignItems: 'center',
          }}
          accessibilityLabel="Open WhatsApp"
        >
          <Text style={[{ color: '#fff', fontSize: fs(16) }, F(800)]}>🟢  WhatsApp</Text>
        </TouchableOpacity>
      </View>

      {/* Clarify big button (for first ambiguous line) */}
      {/* <View style={{ marginTop: 10 }}>
        <TouchableOpacity
          onPress={() => sendClarify()}
          style={{
            backgroundColor: '#111827',
            paddingVertical: 12,
            borderRadius: 14,
            alignItems: 'center',
          }}
          accessibilityLabel="Send clarification link to customer"
        >
          <Text style={[{ color: '#fff', fontSize: fs(15) }, F(800)]}>🔗  Clarify with customer</Text>
        </TouchableOpacity>
      </View> */}

      {/* Wrong Parse → Fix (full sheet) */}
      <View style={{ marginTop: 10 }}>
        <TouchableOpacity
          onPress={() => setFixOpen(true)}
          style={{
            backgroundColor: '#F59E0B',
            paddingVertical: 12,
            borderRadius: 14,
            alignItems: 'center',
          }}
          accessibilityLabel="Fix wrong parse"
        >
          <Text style={[{ color: '#fff', fontSize: fs(15) }, F(800)]}>✏️  Wrong Parse → Fix</Text>
        </TouchableOpacity>
      </View>


      <View
  style={{
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 4,
    gap: 4,
    marginTop: 4
  }}
>
  {(['pending', 'shipped', 'paid'] as OrderStatus[]).map((s) => {
    const active = o.status === s;
    const label = s === 'pending' ? 'Pending' : s === 'shipped' ? 'Shipped' : 'Paid';
    const activeColor = s === 'pending' ? '#F59E0B' : s === 'shipped' ? '#3B82F6' : '#22C55E';

    return (
      <TouchableOpacity
        key={s}
        onPress={() => updateStatus(o.id, s).then(() => onSetStatus(o.id, s))}
        style={{
          flex: 1,                        // ✅ takes equal width
          alignItems: 'center',           // ✅ center text
          justifyContent: 'center',
          backgroundColor: active ? '#FFFFFF' : 'transparent',
          borderRadius: 10,
          paddingVertical: 10,
          borderWidth: active ? 1 : 0,
          borderColor: active ? '#E5E7EB' : 'transparent',
        }}
      >
        <Text
          style={[
            { fontSize: 13, color: active ? activeColor : '#6B7280' },
            F(active ? 800 : 600),
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  })}
</View>


      {/* Correction sheet keeps whole-order editing as a fallback */}
      <CorrectionSheet
        visible={fixOpen}
        onClose={() => setFixOpen(false)}
        orderId={o.id}
        initialItems={currentItems}
        onPatched={(items) => {
          const patched: PatchItem[] = items.map((it) => ({
            qty: it.qty,
            unit: it.unit || null,
            canonical: it.canonical || null,
            name: it.name || undefined,
            brand: (it as any).brand ?? null,
            variant: (it as any).variant ?? null,
            notes: (it as any).notes ?? null,
          }));
          if (onPatchItems) onPatchItems(patched);
          else (o as any).items = patched; // optimistic
        }}
      />
    </View>
  );
}