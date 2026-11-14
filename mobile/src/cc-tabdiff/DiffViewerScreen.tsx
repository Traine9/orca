import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent
} from 'react-native'
import { WebView, type WebViewNavigation } from 'react-native-webview'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ExternalLink, RotateCw, X } from 'lucide-react-native'
import { openExternalLink } from '../platform/external-link'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import { themedStyleSheet } from '../theme/themed-styles'
import { useMobileColorScheme } from '../theme/use-mobile-color-scheme'
import { loadCcTabdiffBase } from './base'
import { allDiffsUrl, isCcTabdiffUrl, openMrUrl, tabDiffUrl } from './url'

type Params = { hostId?: string; tab?: string; mr?: string }

function targetUrl(base: string, params: Params): string {
  if (params.tab) {
    return tabDiffUrl(base, params.tab)
  }
  return params.mr ? openMrUrl(base, params.mr) : allDiffsUrl(base)
}

// Edge-to-edge Android does not resize the window for the IME, so the WebView shrinks by hand.
function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0)
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const show = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates.height))
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])
  return height
}

function HeaderButton(props: { label: string; onPress: () => void; children: React.ReactNode }) {
  useMobileColorScheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      hitSlop={8}
      style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
      onPress={props.onPress}
    >
      {props.children}
    </Pressable>
  )
}

/** Full-screen cc-tabdiff page (the per-tab diff viewer served by the desktop on port 8787). */
export default function DiffViewerScreen() {
  useMobileColorScheme()
  const params = useLocalSearchParams<Params>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const keyboardHeight = useKeyboardHeight()
  const webRef = useRef<WebView>(null)
  // undefined while loading the preference; null when no URL can be derived.
  const [base, setBase] = useState<string | null | undefined>(undefined)
  const [title, setTitle] = useState('Diff viewer')
  const [currentUrl, setCurrentUrl] = useState<string | null>(null)
  const [canGoBack, setCanGoBack] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [atTop, setAtTop] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    let active = true
    void loadCcTabdiffBase(params.hostId).then((resolved) => {
      if (active) {
        setBase(resolved)
      }
    })
    return () => {
      active = false
    }
  }, [params.hostId])

  const startUrl = base ? targetUrl(base, params) : null

  const close = useCallback(() => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/')
    }
  }, [router])

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && !loadError) {
        webRef.current?.goBack()
        return true
      }
      return false
    })
    return () => sub.remove()
  }, [canGoBack, loadError])

  const reload = useCallback(() => {
    if (loadError) {
      setLoadError(null)
      setReloadKey((key) => key + 1)
      return
    }
    webRef.current?.reload()
  }, [loadError])

  const onNavigationStateChange = useCallback((nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack)
    setCurrentUrl(nav.url)
    if (nav.title && !nav.loading) {
      setTitle(nav.title)
    }
  }, [])

  const renderBody = () => {
    if (base === undefined) {
      return <ActivityIndicator style={styles.fill} color={colors.textSecondary} />
    }
    if (!base || !startUrl) {
      return (
        <View style={styles.centered}>
          <Text style={styles.message}>
            No diff viewer URL for this desktop. Set one in Settings → Browser → Diff viewer URL.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={() => router.push('/browser-settings')}
          >
            <Text style={styles.buttonLabel}>Open settings</Text>
          </Pressable>
        </View>
      )
    }
    if (loadError) {
      return (
        <View style={styles.centered}>
          <Text style={styles.message}>{`cc-tabdiff not running on the desktop at ${base}`}</Text>
          <Text style={styles.detail}>{loadError}</Text>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            onPress={reload}
          >
            <Text style={styles.buttonLabel}>Retry</Text>
          </Pressable>
          <Text style={styles.detail}>
            Start it on the desktop (docker compose up -d) or change the URL in Settings → Browser.
          </Text>
        </View>
      )
    }
    const webView = (
      <WebView
        key={reloadKey}
        ref={webRef}
        style={styles.fill}
        source={{ uri: startUrl }}
        originWhitelist={['http://*', 'https://*']}
        mixedContentMode="always"
        domStorageEnabled
        setSupportMultipleWindows={false}
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        onNavigationStateChange={onNavigationStateChange}
        onLoadEnd={() => setRefreshing(false)}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) =>
          setAtTop(e.nativeEvent.contentOffset.y <= 0)
        }
        onError={(e) => {
          setRefreshing(false)
          setLoadError(e.nativeEvent.description || 'Connection failed')
        }}
        onShouldStartLoadWithRequest={(request) => {
          // Links off the viewer (the MR on GitLab, docs) open in the phone browser instead.
          if (request.isTopFrame === false || isCcTabdiffUrl(base, request.url)) {
            return true
          }
          if (/^https?:/i.test(request.url)) {
            openExternalLink(request.url)
          }
          return false
        }}
      />
    )
    if (Platform.OS !== 'android') {
      return webView
    }
    // Android's WebView has no pull-to-refresh; the wrapper arms only while the page is at its top.
    return (
      <ScrollView
        contentContainerStyle={styles.fill}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            enabled={atTop}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              webRef.current?.reload()
            }}
          />
        }
      >
        {webView}
      </ScrollView>
    )
  }

  return (
    <View
      style={[
        styles.root,
        { paddingTop: insets.top, paddingBottom: Math.max(keyboardHeight, insets.bottom) }
      ]}
    >
      <View style={styles.header}>
        <HeaderButton label="Close diff viewer" onPress={close}>
          <X size={20} color={colors.textSecondary} />
        </HeaderButton>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <HeaderButton label="Reload" onPress={reload}>
          <RotateCw size={18} color={colors.textSecondary} />
        </HeaderButton>
        <HeaderButton
          label="Open in phone browser"
          onPress={() => {
            const url = currentUrl ?? startUrl
            if (url) {
              openExternalLink(url)
            }
          }}
        >
          <ExternalLink size={18} color={colors.textSecondary} />
        </HeaderButton>
      </View>
      {renderBody()}
    </View>
  )
}

const styles = themedStyleSheet(() => ({
  root: {
    flex: 1,
    backgroundColor: colors.bgBase
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.bgPanel,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    flex: 1,
    fontSize: typography.bodySize,
    fontWeight: '600',
    color: colors.textPrimary
  },
  fill: {
    flex: 1,
    backgroundColor: colors.bgBase
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl
  },
  message: {
    fontSize: typography.bodySize,
    color: colors.textPrimary,
    textAlign: 'center'
  },
  detail: {
    fontSize: typography.metaSize,
    color: colors.textMuted,
    textAlign: 'center'
  },
  button: {
    backgroundColor: colors.bgRaised,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.control
  },
  buttonLabel: {
    fontSize: typography.bodySize,
    fontWeight: '600',
    color: colors.textPrimary
  },
  pressed: {
    opacity: 0.7
  }
}))
