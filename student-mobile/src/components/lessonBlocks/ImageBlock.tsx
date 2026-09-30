import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { API_BASE_URL } from '../../lib/api';
import type { LessonBlock } from '../../lib/studentApi';
import { colors, fonts } from '../../theme/colors';

// Full width at the image's own aspect ratio (known once it loads; 16:9 until then).
export default function ImageBlock({ block }: { block: Extract<LessonBlock, { type: 'image' }> }) {
  const [ratio, setRatio] = useState(16 / 9);
  const [failed, setFailed] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {failed ? (
        <View style={[styles.frame, styles.failed]}>
          <Text style={styles.caption}>Couldn't load this image.</Text>
        </View>
      ) : (
        <Image
          source={{ uri: `${API_BASE_URL}${block.url}` }}
          accessibilityLabel={block.caption || 'Lesson image'}
          resizeMode="contain"
          style={[styles.frame, { aspectRatio: ratio }]}
          onLoad={(e) => {
            const { width, height } = e.nativeEvent.source ?? {};
            if (width && height) setRatio(width / height);
          }}
          onError={() => setFailed(true)}
        />
      )}
      {block.caption ? <Text style={styles.caption}>{block.caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', borderRadius: 12, backgroundColor: colors.primaryLight },
  failed: { aspectRatio: 16 / 9, alignItems: 'center', justifyContent: 'center' },
  caption: { fontFamily: fonts.bodyRegular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
});
