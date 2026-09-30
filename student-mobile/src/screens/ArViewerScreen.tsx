import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { WebView } from 'react-native-webview';
import { useCameraPermissions } from 'expo-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { fonts } from '../theme/colors';
import { API_BASE_URL, ApiError, apiRequest } from '../lib/api';
import { arHtml, viewerHtml } from '../lib/arPages';
import type { ArHotspot, ArModelPayload } from '../lib/arPages';

type Props = NativeStackScreenProps<RootStackParamList, 'ArViewer'>;
type Mode = 'ar' | '3d';

interface StudentArModel {
  id: string;
  name: string;
  fileUrl: string;
  hotspots: ArHotspot[];
}

const AR_ACCENT = '#83D5C6';
// getUserMedia needs a secure context, so the AR page gets an https base URL. It still loads the model and marker
// data from the API (http on a dev LAN), which Android allows via mixedContentMode; iOS needs an https API for AR.
const AR_BASE_URL = 'https://cogniview.app/';
const markerUrl = `${API_BASE_URL}/api/ar-marker/marker.png`;

const toPayload = (m: StudentArModel): ArModelPayload => ({ id: m.id, name: m.name, src: `${API_BASE_URL}${m.fileUrl}`, hotspots: m.hotspots });
const fetchModel = (id: string) => apiRequest<{ model: StudentArModel }>(`/api/student/ar-models/${id}`).then((d) => toPayload(d.model));

// Opened for one model (a lesson's hands-on activity or the AR Library list) it shows that model; opened without one
// ("Scan AR card") it's a scanner: the page reads the QR code on a printed AR card and the model appears on its marker.
export default function ArViewerScreen({ navigation, route }: Props) {
  const initialId = route.params?.modelId;
  const scanning = !initialId;
  const [mode, setMode] = useState<Mode>('ar');
  const [permission, requestPermission] = useCameraPermissions();
  // The model being shown (with the admin's points of interest).
  const [current, setCurrent] = useState<ArModelPayload | null>(null);
  // The model baked into the AR page when it was (re)built; scanned models are sent into the running page instead,
  // so the camera doesn't restart.
  const [arSeed, setArSeed] = useState<ArModelPayload | null>(null);
  const [ready, setReady] = useState(scanning);
  // What the AR page tracks: the printed marker plus every trigger picture (GET /api/ar-targets/index).
  const [targets, setTargets] = useState<{ mindUrl: string; models: (string | null)[] } | null>(null);
  const webView = useRef<WebView>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  // The browser build asks for the camera itself; the native app asks first so the WebView can use it.
  const cameraReady = Platform.OS === 'web' || permission?.granted;

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/api/ar-targets/index`)
      .then((r) => (r.ok ? (r.json() as Promise<{ mindUrl: string; models: (string | null)[] }>) : Promise.reject(new Error(String(r.status)))))
      .then((t) => !cancelled && setTargets({ mindUrl: `${API_BASE_URL}${t.mindUrl}`, models: t.models }))
      // Without the list, fall back to the printed marker alone.
      .catch(() => !cancelled && setTargets({ mindUrl: `${API_BASE_URL}/api/ar-marker/marker.mind`, models: [null] }));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!initialId) return;
    let cancelled = false;
    fetchModel(initialId)
      // If the points can't be loaded the model still shows, just without pins.
      .catch((): ArModelPayload => ({ id: initialId, name: route.params?.modelName ?? 'Model', src: `${API_BASE_URL}/api/ar-models/${initialId}/file`, hotspots: [] }))
      .then((model) => {
        if (cancelled) return;
        setCurrent(model);
        setArSeed(model);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [initialId, route.params?.modelName]);

  // Sends the scan result into the running AR page.
  const deliver = useCallback((result: { model: ArModelPayload } | { error: string }) => {
    if (Platform.OS === 'web') {
      const msg = 'model' in result ? { type: 'load', model: result.model } : { type: 'scan-error', message: result.error };
      frame.current?.contentWindow?.postMessage(JSON.stringify(msg), '*');
    } else {
      webView.current?.injectJavaScript(
        'model' in result ? `window.cvLoadModel(${JSON.stringify(result.model)}); true;` : `window.cvScanError(${JSON.stringify(result.error)}); true;`,
      );
    }
  }, []);

  const onPageMessage = useCallback(
    (text: string) => {
      let msg: { type?: string; id?: unknown };
      try {
        msg = JSON.parse(text) as typeof msg;
      } catch {
        return;
      }
      if (msg.type !== 'scan' || typeof msg.id !== 'string') return;
      fetchModel(msg.id)
        .then((model) => {
          setCurrent(model);
          deliver({ model });
        })
        .catch((err: unknown) =>
          deliver({ error: err instanceof ApiError && err.status === 404 ? "That AR card's model has been removed." : "Couldn't open that AR card. Check your connection." }),
        );
    },
    [deliver],
  );

  // On web the page is an iframe and talks to us with postMessage.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onMessage = (e: MessageEvent) => {
      if (e.source === frame.current?.contentWindow && typeof e.data === 'string') onPageMessage(e.data);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onPageMessage]);

  function switchMode(next: Mode) {
    if (next === mode) return;
    if (next === 'ar') setArSeed(current); // the AR page restarts showing the current model
    setMode(next);
  }

  // Rebuilt only when the page itself must change, so re-renders (and scans, which go into the running page) don't
  // reload it and restart the camera. The 3D page depends on `current` only while in 3D mode, where it can't change.
  const viewerModel = mode === '3d' ? current : null;
  const html = useMemo(
    () =>
      mode === 'ar'
        ? targets
          ? arHtml(targets.mindUrl, { model: arSeed, scan: scanning, targets: targets.models })
          : ''
        : viewerModel
          ? viewerHtml(viewerModel.src, viewerModel.name, viewerModel.hotspots)
          : '',
    [mode, arSeed, scanning, viewerModel, targets],
  );
  const source = useMemo(() => (mode === 'ar' ? { html, baseUrl: AR_BASE_URL } : { html }), [mode, html]);
  const title = current?.name ?? (scanning ? 'Scan an AR card' : (route.params?.modelName ?? 'AR'));
  const pinsHint = current?.hotspots.length ? ' · tap a numbered pin to learn about that part' : '';

  let stage;
  if (!ready || (mode === 'ar' && !targets)) {
    stage = (
      <View style={styles.permission}>
        <ActivityIndicator color={AR_ACCENT} />
      </View>
    );
  } else if (mode === 'ar' && !cameraReady) {
    stage = (
      <View style={styles.permission}>
        <Text style={styles.permissionTitle}>Use your camera for AR</Text>
        <Text style={styles.permissionText}>
          CogniView AR {scanning ? 'scans your AR card and shows its model' : 'shows the model on the printed AR marker'} through your camera. Nothing is
          recorded or uploaded.
        </Text>
        {permission && !permission.canAskAgain ? (
          <Pressable onPress={() => void Linking.openSettings()} style={styles.permissionBtn} accessibilityRole="button">
            <Text style={styles.permissionBtnLabel}>Open settings to allow the camera</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => void requestPermission()} style={styles.permissionBtn} accessibilityRole="button">
            <Text style={styles.permissionBtnLabel}>Allow camera</Text>
          </Pressable>
        )}
        {current && (
          <Pressable onPress={() => switchMode('3d')} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.link}>Use the 3D view instead</Text>
          </Pressable>
        )}
      </View>
    );
  } else if (Platform.OS === 'web') {
    // react-native-webview has no web support; in the browser build an iframe does the same job.
    stage = createElement('iframe', {
      key: mode,
      ref: frame,
      srcDoc: html,
      title,
      allow: 'camera; autoplay; fullscreen',
      style: { border: 0, width: '100%', height: '100%' },
    });
  } else {
    stage = (
      <WebView
        key={mode}
        ref={webView}
        originWhitelist={['*']}
        source={source}
        onMessage={(e) => onPageMessage(e.nativeEvent.data)}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        javaScriptEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        mixedContentMode="always"
      />
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close viewer">
            <Svg width={18} height={18} viewBox="0 0 18 18">
              <Path d="M11 3l-6 6 6 6" stroke="#fff" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <Text style={styles.modelName} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.modeSwitch} accessibilityRole="tablist">
            {(['ar', '3d'] as const).map((m) => {
              const disabled = m === '3d' && !current;
              return (
                <Pressable
                  key={m}
                  onPress={() => switchMode(m)}
                  disabled={disabled}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: mode === m, disabled }}
                  style={[styles.modeBtn, mode === m && styles.modeBtnActive, disabled && { opacity: 0.4 }]}
                >
                  <Text style={[styles.modeLabel, mode === m && styles.modeLabelActive]}>{m === 'ar' ? 'AR camera' : '3D view'}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.stage}>{stage}</View>

        <View style={styles.controlPanel}>
          {mode === 'ar' && scanning && !current ? (
            <>
              <Text style={styles.controlTitle}>Scan an AR card</Text>
              <Text style={styles.controlSubtitle}>
                Point the camera at the QR code on a printed CogniView AR card, then at the marker above it — or at a picture from your lesson. The
                model appears standing on it.
              </Text>
              <Text style={styles.controlSubtitle}>Your teacher prints AR cards and adds lesson pictures in the AR Library.</Text>
            </>
          ) : mode === 'ar' ? (
            <>
              <Text style={styles.controlTitle}>Point your camera at the AR marker or a lesson picture</Text>
              <Text style={styles.controlSubtitle}>
                The model appears standing on it. Drag to turn it · pinch to resize{pinsHint}.{scanning ? ' Scan another card to switch models.' : ''}
              </Text>
              {!scanning && (
                <Pressable onPress={() => void Linking.openURL(markerUrl)} accessibilityRole="link" hitSlop={6}>
                  <Text style={styles.markerLink}>No marker? Open it to print, or show it on another screen ↗</Text>
                </Pressable>
              )}
            </>
          ) : (
            <>
              <Text style={styles.controlTitle}>{current?.name}</Text>
              <Text style={styles.controlSubtitle}>Drag to rotate · pinch to zoom{pinsHint}</Text>
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#123C2C' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12 },
  modelName: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 15, color: '#fff' },
  modeSwitch: { flexDirection: 'row', borderWidth: 1, borderColor: AR_ACCENT, borderRadius: 100, padding: 2 },
  modeBtn: { borderRadius: 100, paddingVertical: 4, paddingHorizontal: 10 },
  modeBtnActive: { backgroundColor: AR_ACCENT },
  modeLabel: { fontFamily: fonts.bodyBold, fontSize: 11, color: AR_ACCENT },
  modeLabelActive: { color: '#123C2C' },
  stage: { flex: 1, backgroundColor: '#000' },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14, backgroundColor: '#123C2C' },
  permissionTitle: { fontFamily: fonts.bodyBold, fontSize: 18, color: '#fff', textAlign: 'center' },
  permissionText: { fontFamily: fonts.bodyRegular, fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  permissionBtn: { backgroundColor: AR_ACCENT, borderRadius: 100, paddingVertical: 12, paddingHorizontal: 22 },
  permissionBtnLabel: { fontFamily: fonts.bodyBold, fontSize: 14, color: '#123C2C' },
  link: { fontFamily: fonts.bodySemibold, fontSize: 13, color: AR_ACCENT },
  controlPanel: { backgroundColor: 'rgba(0,0,0,0.25)', paddingHorizontal: 20, paddingVertical: 14, gap: 4 },
  controlTitle: { fontFamily: fonts.bodySemibold, fontSize: 15, color: '#fff' },
  controlSubtitle: { fontFamily: fonts.bodyRegular, fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  markerLink: { fontFamily: fonts.bodySemibold, fontSize: 12, color: AR_ACCENT, marginTop: 4 },
});
