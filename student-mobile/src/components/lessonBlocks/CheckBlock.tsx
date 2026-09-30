import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LessonBlock } from '../../lib/studentApi';
import { colors, fonts } from '../../theme/colors';

const LETTERS = 'ABCDEF';

// Ungraded: instant right/wrong feedback, explanation, unlimited retries. The first tap counts as "answered".
export default function CheckBlock({ block, onAnswered }: { block: Extract<LessonBlock, { type: 'check' }>; onAnswered: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const correct = picked === block.correctChoice;

  function pick(index: number) {
    setPicked(index);
    onAnswered();
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>CHECK YOUR UNDERSTANDING</Text>
      <Text style={styles.prompt}>{block.prompt}</Text>
      <View style={{ gap: 8 }}>
        {block.choices.map((choice, i) => {
          const isPicked = picked === i;
          return (
            <Pressable
              key={i}
              onPress={() => pick(i)}
              disabled={picked !== null}
              accessibilityRole="button"
              accessibilityState={{ selected: isPicked, disabled: picked !== null }}
              style={[styles.choice, isPicked && (correct ? styles.choiceRight : styles.choiceWrong)]}
            >
              <Text style={styles.letter}>{LETTERS[i]}</Text>
              <Text style={styles.choiceText}>{choice}</Text>
              {isPicked && <Text style={[styles.mark, { color: correct ? colors.primary : colors.danger }]}>{correct ? '✓' : '✗'}</Text>}
            </Pressable>
          );
        })}
      </View>
      {picked !== null && (
        <View style={styles.feedback}>
          <Text style={[styles.verdict, { color: correct ? colors.primary : colors.danger }]}>{correct ? 'Correct!' : 'Not quite.'}</Text>
          {block.explanation ? <Text style={styles.explanation}>{block.explanation}</Text> : null}
          {!correct && (
            <Pressable onPress={() => setPicked(null)} accessibilityRole="button" hitSlop={6}>
              <Text style={styles.retry}>Try again</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.primaryLight, padding: 16, gap: 10 },
  label: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.6, color: colors.primary },
  prompt: { fontFamily: fonts.bodySemibold, fontSize: 16, lineHeight: 23, color: colors.text },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  choiceRight: { borderColor: colors.primary, borderWidth: 1.5 },
  choiceWrong: { borderColor: colors.danger, borderWidth: 1.5, backgroundColor: colors.dangerBg },
  letter: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.textMuted, width: 16 },
  choiceText: { flex: 1, fontFamily: fonts.bodyRegular, fontSize: 15, lineHeight: 21, color: colors.text },
  mark: { fontFamily: fonts.bodyBold, fontSize: 16 },
  feedback: { gap: 6 },
  verdict: { fontFamily: fonts.bodyBold, fontSize: 14 },
  explanation: { fontFamily: fonts.bodyRegular, fontSize: 14, lineHeight: 21, color: colors.text },
  retry: { fontFamily: fonts.bodySemibold, fontSize: 14, color: colors.primary },
});
