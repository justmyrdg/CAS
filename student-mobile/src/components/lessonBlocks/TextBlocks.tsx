import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme/colors';

export function HeadingBlock({ text }: { text: string }) {
  return (
    <Text style={styles.heading} accessibilityRole="header">
      {text}
    </Text>
  );
}

// Blank lines separate paragraphs.
export function TextBlock({ text }: { text: string }) {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <View style={{ gap: 12 }}>
      {paragraphs.map((p, i) => (
        <Text key={i} style={styles.text}>
          {p}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: fonts.bodySemibold, fontSize: 19, lineHeight: 26, color: colors.text, marginTop: 4 },
  text: { fontFamily: fonts.bodyRegular, fontSize: 16, lineHeight: 26, color: colors.text },
});
