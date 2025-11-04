// src/components/StatusPill.tsx
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { C } from '../theme/colors';

type Tone = 'pending' | 'shipped' | 'paid';

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
  tone: Tone;
  onPress: () => void;
}) {
  // Graceful fallback: if your theme doesn't yet have shipped colors,
  // reuse delivered colors so nothing breaks visually.
  const toneColorMap = {
    pending: {
      hard: C?.pending,
      soft: C?.pendingSoft,
    },
    shipped: {
      hard: (C as any)?.shipped ?? (C as any)?.delivered ?? '#10B981',
      soft: (C as any)?.shippedSoft ?? (C as any)?.deliveredSoft ?? '#ECFDF5',
    },
    paid: {
      hard: C?.paid,
      soft: C?.paidSoft,
    },
  } as const;

  const colors = toneColorMap[tone];
  const bg = active ? colors.hard : colors.soft;
  const color = active ? '#FFFFFF' : colors.hard;
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