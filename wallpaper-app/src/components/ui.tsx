import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

import { colors, gradients, radius } from '../theme';

const GLYPHS = {
  home: '⌂',
  search: '⌕',
  ai: '✦',
  crown: '♛',
  heart: '♥',
  heartOutline: '♡',
  lock: '🔒',
  download: '⤓',
  back: '‹',
  close: '✕',
  share: '⇪',
} as const;

export type IconName = keyof typeof GLYPHS;

export function Icon({ name, size = 22, color = colors.text }: { name: IconName; size?: number; color?: ColorValue }) {
  return <Text style={{ fontSize: size, color, lineHeight: size * 1.2, textAlign: 'center' }}>{GLYPHS[name]}</Text>;
}

export function GradientButton({
  title,
  onPress,
  variant = 'brand',
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'brand' | 'gold';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [{ opacity: pressed || disabled ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}
    >
      <LinearGradient
        colors={variant === 'gold' ? gradients.gold : gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.button}
      >
        {loading ? (
          <ActivityIndicator color={variant === 'gold' ? '#1A1000' : '#fff'} />
        ) : (
          <Text style={[styles.buttonText, variant === 'gold' && { color: '#1A1000' }]}>{title}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export function Badge({ label, tone = 'dark' }: { label: string; tone?: 'dark' | 'gold' }) {
  return (
    <View style={[styles.badge, tone === 'gold' && { backgroundColor: colors.gold }]}>
      <Text style={[styles.badgeText, tone === 'gold' && { color: '#1A1000' }]}>{label}</Text>
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: ReactNode; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { height: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  badge: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 22, marginBottom: 12 },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  sectionAction: { color: colors.accent2, fontSize: 14, fontWeight: '600' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textDim, fontWeight: '600' },
});
