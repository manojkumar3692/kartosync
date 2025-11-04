import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { C } from '../theme/colors';
import { submitCorrection, CorrectionItem } from '../api';

const F = (w?: number) =>
  Platform.OS === 'android' ? { fontFamily: 'Roboto', fontWeight: (w ? String(w) : undefined) as any } : {};

type Props = {
  visible: boolean;
  onClose: () => void;
  orderId: string;
  initialItems: Array<{ qty?: number | null; unit?: string | null; name?: string; canonical?: string | null }>;
  onPatched: (items: CorrectionItem[]) => void; // tell parent to refresh the card
};

export default function CorrectionSheet({ visible, onClose, orderId, initialItems, onPatched }: Props) {
  const [items, setItems] = useState<CorrectionItem[]>([]);
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    if (visible) {
      setItems(
        (initialItems || []).map(it => ({
          qty: typeof it?.qty === 'number' ? it.qty : null,
          unit: it?.unit ?? null,
          name: it?.canonical || it?.name || '',
          canonical: it?.canonical ?? null,
        }))
      );
      setNote("");
    }
  }, [visible, initialItems]);

  function updateItem(idx: number, patch: Partial<CorrectionItem>) {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function addRow() {
    setItems(prev => [...prev, { qty: null, unit: null, name: '', canonical: null }]);
  }

  function removeRow(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    const cleaned = items
      .map(it => ({
        qty: it.qty === null || Number.isNaN(it.qty as any) ? null : Number(it.qty),
        unit: (it.unit || '')?.trim() || null,
        name: (it.name || '')?.trim(),
        canonical: (it.canonical || '')?.trim() || null,
      }))
      .filter(it => it.name && it.name.length > 0);

    if (!cleaned.length) {
      // keep UI quiet; owner will add at least one line
      return;
    }

    try {
      await submitCorrection(orderId, { items: cleaned, note: note?.trim() || undefined });
      onPatched(cleaned);
      onClose();
    } catch (e) {
      console.error('❌ submitCorrection failed:', e);
      // keep UX simple (you can Alert here if you want)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.38)', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            paddingTop: 10,
            paddingHorizontal: 14,
            paddingBottom: 14,
            maxHeight: '88%',
          }}
        >
          <View style={{ alignItems: 'center', paddingBottom: 6 }}>
            <View
              style={{
                width: 42, height: 4, borderRadius: 999, backgroundColor: '#E5E7EB',
              }}
            />
          </View>

          <Text style={[{ fontSize: 18, color: C.text, marginBottom: 6 }, F(800)]}>Fix items</Text>
          <Text style={[{ fontSize: 12, color: C.sub, marginBottom: 8 }, F(400)]}>
            Adjust quantity, unit, or name, then Save. This teaches the AI for similar messages.
          </Text>

          <ScrollView style={{ maxHeight: '70%' }}>
            {items.map((it, idx) => (
              <View key={idx} style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 10, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[{ fontSize: 12, color: C.faint, marginBottom: 4 }, F(600)]}>Name</Text>
                    <TextInput
                      placeholder="e.g. Chicken"
                      value={it.name || ''}
                      onChangeText={(v) => updateItem(idx, { name: v })}
                      style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }}
                    />
                  </View>
                  <View style={{ width: 80 }}>
                    <Text style={[{ fontSize: 12, color: C.faint, marginBottom: 4 }, F(600)]}>Qty</Text>
                    <TextInput
                      placeholder="e.g. 2"
                      keyboardType="numeric"
                      value={it.qty == null ? '' : String(it.qty)}
                      onChangeText={(v) => updateItem(idx, { qty: v ? Number(v) : null })}
                      style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }}
                    />
                  </View>
                  <View style={{ width: 100 }}>
                    <Text style={[{ fontSize: 12, color: C.faint, marginBottom: 4 }, F(600)]}>Unit</Text>
                    <TextInput
                      placeholder="kg / pack"
                      value={it.unit || ''}
                      onChangeText={(v) => updateItem(idx, { unit: v })}
                      style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }}
                    />
                  </View>
                </View>

                <TouchableOpacity onPress={() => removeRow(idx)} style={{ alignSelf: 'flex-end', marginTop: 8 }}>
                  <Text style={[{ color: '#EF4444' }, F(800)]}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              onPress={addRow}
              style={{
                borderWidth: 1,
                borderColor: '#D1D5DB',
                borderStyle: 'dashed',
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <Text style={[{ color: '#111827' }, F(800)]}>＋ Add item</Text>
            </TouchableOpacity>

            <TextInput
              placeholder="Optional note for AI (e.g., 'milk usually means 1L tetra pack')"
              value={note}
              onChangeText={setNote}
              style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 10, minHeight: 44 }}
            />
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <TouchableOpacity
              onPress={onClose}
              style={{ flex: 1, backgroundColor: '#E5E7EB', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
            >
              <Text style={[{ color: '#111827' }, F(800)]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={save}
              style={{ flex: 1, backgroundColor: '#0B1220', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
            >
              <Text style={[{ color: '#fff' }, F(800)]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}