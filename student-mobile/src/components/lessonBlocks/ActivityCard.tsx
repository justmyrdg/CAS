import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../../theme/colors';

// The lesson's AR model, presented as its hands-on activity.
export default function ActivityCard({ name, onOpen }: { name: string; onOpen: () => void }) {
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Hands-on activity: view ${name} in AR`} style={styles.card}>
      <Text style={styles.label}>HANDS-ON ACTIVITY</Text>
      <Text style={styles.title}>View “{name}” in AR</Text>
      <Text style={styles.hint}>Rotate it, zoom in, and place it in your space →</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, backgroundColor: colors.primaryDark, padding: 16, gap: 4 },
  label: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.6, color: colors.accent },
  title: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.white },
  hint: { fontFamily: fonts.bodyRegular, fontSize: 13, color: 'rgba(255,255,255,0.75)' },
});
