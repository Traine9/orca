import { useEffect, useRef, useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { loadCcTabdiffBaseUrl, saveCcTabdiffBaseUrl } from '../storage/preferences'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import { themedStyleSheet } from '../theme/themed-styles'
import { useMobileColorScheme } from '../theme/use-mobile-color-scheme'
import { loadCcTabdiffHostEndpoint } from './base'
import { deriveCcTabdiffBaseUrl, normalizeCcTabdiffBaseUrl } from './url'

/** "Diff viewer URL" row for the Browser settings screen; empty = derived from the paired desktop. */
export function CcTabdiffSettingsSection() {
  useMobileColorScheme()
  const [value, setValue] = useState('')
  const [derived, setDerived] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const savedRef = useRef('')

  useEffect(() => {
    let active = true
    void Promise.all([loadCcTabdiffBaseUrl(), loadCcTabdiffHostEndpoint()]).then(
      ([saved, endpoint]) => {
        if (active) {
          savedRef.current = saved
          setValue(saved)
          setDerived(deriveCcTabdiffBaseUrl(endpoint))
        }
      }
    )
    return () => {
      active = false
    }
  }, [])

  const save = () => {
    const trimmed = value.trim()
    if (trimmed === savedRef.current) {
      return
    }
    if (trimmed && !normalizeCcTabdiffBaseUrl(trimmed)) {
      setError('Not an http(s) URL; the derived default is used instead.')
    } else {
      setError(null)
    }
    savedRef.current = trimmed
    void saveCcTabdiffBaseUrl(trimmed).catch(() => setError('Could not save the diff viewer URL.'))
  }

  return (
    <View style={styles.group}>
      <Text style={styles.heading}>DIFF VIEWER</Text>
      <Text style={styles.description}>
        cc-tabdiff on the desktop. Leave empty to use the paired desktop on port 8787.
      </Text>
      <View style={styles.section}>
        <Text style={styles.label}>Diff viewer URL</Text>
        <TextInput
          accessibilityLabel="Diff viewer URL"
          style={styles.input}
          value={value}
          onChangeText={setValue}
          onBlur={save}
          onSubmitEditing={save}
          placeholder={derived ?? 'http://<desktop-ip>:8787'}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="done"
        />
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={styles.description}>
          {error}
        </Text>
      ) : null}
    </View>
  )
}

const styles = themedStyleSheet(() => ({
  group: {
    marginTop: spacing.xl
  },
  heading: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs
  },
  description: {
    fontSize: typography.bodySize - 1,
    color: colors.textSecondary,
    lineHeight: 20,
    paddingHorizontal: spacing.xs
  },
  section: {
    marginTop: spacing.sm,
    backgroundColor: colors.bgPanel,
    borderRadius: radii.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md + 2,
    gap: spacing.sm
  },
  label: {
    fontSize: typography.bodySize,
    fontWeight: '500',
    color: colors.textPrimary
  },
  input: {
    fontSize: typography.bodySize,
    color: colors.textPrimary,
    backgroundColor: colors.bgRaised,
    borderRadius: radii.control,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  }
}))
