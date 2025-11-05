// src/components/CorrectionSheet.tsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { C } from '../theme/colors';
import { submitCorrection } from '../api';

// Loosely match your API type but allow the new fields safely
export type SheetItem = {
  qty: number | null;
  unit: string | null;
  name: string;               // display name (never null here)
  canonical: string | null;
  brand?: string | null;
  variant?: string | null;
  notes?: string | null;
};

const F = (w?: number) =>
  Platform.OS === 'android'
    ? { fontFamily: 'Roboto', fontWeight: (w ? String(w) : undefined) as any }
    : {};

type Props = {
  visible: boolean;
  onClose: () => void;
  orderId: string;
  initialItems: Array<{
    qty?: number | null;
    unit?: string | null;
    name?: string;
    canonical?: string | null;
    brand?: string | null;
    variant?: string | null;
    notes?: string | null;
  }>;
  onPatched: (items: SheetItem[]) => void;
};

export default function CorrectionSheet({
  visible,
  onClose,
  orderId,
  initialItems,
  onPatched,
}: Props) {
  const [items, setItems] = useState<SheetItem[]>([]);
  const [note, setNote] = useState<string>('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const prevVisibleRef = useRef<boolean>(false);
  const prevOrderIdRef = useRef<string | null>(null);

  // Initialize ONLY when opening or order changes
  useEffect(() => {
    const wasVisible = prevVisibleRef.current;
    const openingNow = visible && !wasVisible;
    const orderChanged = prevOrderIdRef.current !== null && prevOrderIdRef.current !== orderId;

    if ((openingNow || orderChanged) && !dirty) {
      const prepared: SheetItem[] = (initialItems || []).map((it, idx) => ({
        qty: typeof it?.qty === 'number' ? it.qty : null,
        unit: it?.unit ?? null,
        // prefer canonical for display; fall back to name
        name: (it?.canonical || it?.name || '').trim(),
        canonical: it?.canonical ?? null,
        brand: it?.brand ?? null,
        variant: it?.variant ?? null,
        notes: it?.notes ?? null,
      }));
      setItems(prepared.length ? prepared : [{ qty: null, unit: null, name: '', canonical: null, brand: null, variant: null, notes: null }]);
      setNote('');
      setSaving(false);
      setDirty(false);
    }

    prevVisibleRef.current = visible;
    prevOrderIdRef.current = orderId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, orderId]);

  function updateItem(idx: number, patch: Partial<SheetItem>) {
    setDirty(true);
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function addRow() {
    setDirty(true);
    setItems((prev) => [
      ...prev,
      { qty: null, unit: null, name: '', canonical: null, brand: null, variant: null, notes: null },
    ]);
  }

  function removeRow(idx: number) {
    setDirty(true);
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  // Strict but user-friendly numeric parsing (no scientific notation)
  const parseQty = (v: string): number | null => {
    const s = v.trim();
    if (!s) return null;
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    const n = Number(s);
    if (Number.isNaN(n)) return null;
    return n;
  };

  const cleaned = useMemo(() => {
    return items
      .map((it) => ({
        qty: it.qty == null ? null : Number(it.qty),
        unit: (it.unit || '').trim() || null,
        name: (it.name || '').trim(),
        canonical: (it.canonical || '').trim() || null,
        brand: (it.brand || '')?.trim() || null,
        variant: (it.variant || '')?.trim() || null,
        notes: (it.notes || '')?.trim() || null,
      }))
      .filter((it) => it.name && it.name.length > 0);
  }, [items]);

  const canSave = cleaned.length > 0 && !saving;

  async function save() {
    if (!canSave) return;
    try {
      setSaving(true);
      await submitCorrection(orderId, { items: cleaned, note: note?.trim() || undefined });
      onPatched(cleaned);
      setDirty(false);
      onClose();
    } catch (e) {
      console.error('❌ submitCorrection failed:', e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.38)', justifyContent: 'flex-end' }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
          style={{ width: '100%' }}
        >
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
            {/* drag handle */}
            <View style={{ alignItems: 'center', paddingBottom: 6 }}>
              <View style={{ width: 42, height: 4, borderRadius: 999, backgroundColor: '#E5E7EB' }} />
            </View>

            <Text style={[{ fontSize: 18, color: C.text, marginBottom: 6 }, F(800)]}>Fix items</Text>
            <Text style={[{ fontSize: 12, color: C.sub, marginBottom: 8 }, F(400)]}>
              Adjust quantity, unit, <Text style={{ fontWeight: 'bold' }}>brand</Text>,{' '}
              <Text style={{ fontWeight: 'bold' }}>variant</Text>, or name, then Save. This teaches
              the AI for similar messages.
            </Text>

            <ScrollView
              style={{ maxHeight: '70%' }}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              {items.map((it, idx) => (
                <View
                  key={idx}
                  style={{
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    borderRadius: 12,
                    padding: 10,
                    marginBottom: 10,
                    backgroundColor: '#fff',
                  }}
                >
                  {/* Row 1: Name / Canonical + Qty + Unit */}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[{ fontSize: 12, color: C.faint, marginBottom: 4 }, F(600)]}>Name / Canonical</Text>
                      <TextInput
                        placeholder="e.g. Milk"
                        autoFocus={idx === 0}
                        value={it.name || ''}
                        onChangeText={(v) => updateItem(idx, { name: v })}
                        returnKeyType="next"
                        style={{
                          borderWidth: 1,
                          borderColor: '#E5E7EB',
                          borderRadius: 10,
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                        }}
                      />
                    </View>

                    <View style={{ width: 88 }}>
                      <Text style={[{ fontSize: 12, color: C.faint, marginBottom: 4 }, F(600)]}>Qty</Text>
                      <TextInput
                        placeholder="e.g. 2"
                        keyboardType="decimal-pad"
                        value={it.qty == null ? '' : String(it.qty)}
                        onChangeText={(v) => updateItem(idx, { qty: parseQty(v) })}
                        style={{
                          borderWidth: 1,
                          borderColor: '#E5E7EB',
                          borderRadius: 10,
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                        }}
                      />
                    </View>

                    <View style={{ width: 110 }}>
                      <Text style={[{ fontSize: 12, color: C.faint, marginBottom: 4 }, F(600)]}>Unit</Text>
                      <TextInput
                        placeholder="kg / pack / L"
                        value={it.unit || ''}
                        onChangeText={(v) => updateItem(idx, { unit: v })}
                        style={{
                          borderWidth: 1,
                          borderColor: '#E5E7EB',
                          borderRadius: 10,
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                        }}
                      />
                    </View>
                  </View>

                  {/* Row 2: Brand + Variant */}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[{ fontSize: 12, color: C.faint, marginBottom: 4 }, F(600)]}>Brand</Text>
                      <TextInput
                        placeholder="e.g. Almarai"
                        value={it.brand || ''}
                        onChangeText={(v) => updateItem(idx, { brand: v })}
                        style={{
                          borderWidth: 1,
                          borderColor: '#E5E7EB',
                          borderRadius: 10,
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                        }}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[{ fontSize: 12, color: C.faint, marginBottom: 4 }, F(600)]}>Variant</Text>
                      <TextInput
                        placeholder="e.g. Full Fat / Low Sugar"
                        value={it.variant || ''}
                        onChangeText={(v) => updateItem(idx, { variant: v })}
                        style={{
                          borderWidth: 1,
                          borderColor: '#E5E7EB',
                          borderRadius: 10,
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                        }}
                      />
                    </View>
                  </View>

                  {/* Row 3: Notes + Remove */}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[{ fontSize: 12, color: C.faint, marginBottom: 4 }, F(600)]}>Notes (optional)</Text>
                      <TextInput
                        placeholder="e.g. Prefer 1L tetra pack"
                        value={it.notes || ''}
                        onChangeText={(v) => updateItem(idx, { notes: v })}
                        style={{
                          borderWidth: 1,
                          borderColor: '#E5E7EB',
                          borderRadius: 10,
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                        }}
                      />
                    </View>
                    <View style={{ justifyContent: 'flex-end' }}>
                      <TouchableOpacity
                        onPress={() => removeRow(idx)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{ alignSelf: 'flex-end' }}
                      >
                        <Text style={[{ color: '#EF4444' }, F(800)]}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
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
                placeholder="Optional note for AI (e.g., 'milk usually means Almarai 1L Full Fat')"
                value={note}
                onChangeText={(v) => {
                  setDirty(true);
                  setNote(v);
                }}
                multiline
                style={{
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  borderRadius: 12,
                  padding: 10,
                  minHeight: 44,
                }}
              />
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  setDirty(false);
                  onClose();
                }}
                style={{
                  flex: 1,
                  backgroundColor: '#E5E7EB',
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={[{ color: '#111827' }, F(800)]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={save}
                disabled={!canSave}
                style={{
                  flex: 1,
                  backgroundColor: canSave ? '#0B1220' : '#9CA3AF',
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={[{ color: '#fff' }, F(800)]}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}