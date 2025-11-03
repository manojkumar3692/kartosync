// src/components/StatusPill.tsx
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { C } from '../theme/colors';

export default function StatusPill({
  active,
  label,
  icon,
  tone,
  onPress,
}: {
  active: boolean;
  label: string;
  icon: string;
  tone: 'pending' | 'delivered' | 'paid';
  onPress: () => void;
}) {
  const bg = active
    ? (tone === 'pending' ? C.pending : tone === 'delivered' ? C.delivered : C.paid)
    : (tone === 'pending' ? C.pendingSoft : tone === 'delivered' ? C.deliveredSoft : C.paidSoft);
  const color = active ? '#FFFFFF' : (tone === 'pending' ? C.pending : tone === 'delivered' ? C.delivered : C.paid);
  const border = active ? 'transparent' : 'rgba(0,0,0,0)';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <View
        style={{
          backgroundColor: bg,
          borderColor: border as any,
          borderWidth: 1,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 999,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Text style={{ color, fontSize: 14 }}>{icon}</Text>
        <Text style={{ color, fontWeight: '700', fontSize: 13 }}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
}