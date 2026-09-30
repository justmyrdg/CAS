import { createElement } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { LessonBlock } from '../../lib/studentApi';
import { colors, fonts } from '../../theme/colors';

// YouTube refuses to play embeds that arrive without a referrer ("Error 153"), which is what a WebView
// showing inline HTML sends by default. Giving the page an https base URL makes the iframe request carry one.
const EMBED_BASE_URL = 'https://cogniview.app';
const ALLOW = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';

const embedSrc = (id: string) => `https://www.youtube.com/embed/${id}?playsinline=1&rel=0`;

// The embed can offer navigation away from the player (a related-video thumbnail, an ad
// click-through, YouTube's own "Watch on YouTube" overlay). Anything that isn't our own inline
// HTML or a host YouTube's player needs gets opened in the system browser instead of letting the
// WebView navigate away from the lesson.
const ALLOWED_NAV_HOSTS = /(^|\.)(youtube\.com|youtube-nocookie\.com|ytimg\.com|ggpht\.com|googlevideo\.com|google\.com|gstatic\.com|doubleclick\.net)$/i;

function allowNavigation(request: { url: string }) {
  const { url } = request;
  if (url.startsWith(EMBED_BASE_URL) || url === 'about:blank') return true;
  try {
    if (ALLOWED_NAV_HOSTS.test(new URL(url).hostname)) return true;
  } catch {
    // Not a parseable absolute URL — don't let the WebView navigate to it.
  }
  void Linking.openURL(url).catch(() => {});
  return false;
}

function embedHtml(id: string) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}</style></head>
<body><iframe src="${embedSrc(id)}" referrerpolicy="strict-origin-when-cross-origin" allow="${ALLOW}" allowfullscreen></iframe></body></html>`;
}

export default function VideoBlock({ block }: { block: Extract<LessonBlock, { type: 'video' }> }) {
  const id = block.youtubeId;
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.player}>
        {Platform.OS === 'web' ? (
          // react-native-webview has no web support; in the browser build a plain iframe does the job.
          createElement('iframe', {
            src: embedSrc(id),
            title: block.caption || 'Video',
            allow: ALLOW,
            allowFullScreen: true,
            referrerPolicy: 'strict-origin-when-cross-origin',
            style: { border: 0, width: '100%', height: '100%' },
          })
        ) : (
          <WebView
            source={{ html: embedHtml(id), baseUrl: EMBED_BASE_URL }}
            originWhitelist={['*']}
            javaScriptEnabled
            allowsInlineMediaPlayback
            allowsFullscreenVideo
            onShouldStartLoadWithRequest={allowNavigation}
            style={{ flex: 1, backgroundColor: '#000' }}
          />
        )}
      </View>
      {block.caption ? <Text style={styles.caption}>{block.caption}</Text> : null}
      <Pressable onPress={() => void Linking.openURL(`https://www.youtube.com/watch?v=${id}`)} accessibilityRole="link" hitSlop={6}>
        <Text style={styles.link}>Open in YouTube ↗</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  player: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  caption: { fontFamily: fonts.bodyRegular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  link: { fontFamily: fonts.bodySemibold, fontSize: 13, color: colors.primary },
});
