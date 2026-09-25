import AsyncStorage from '@react-native-async-storage/async-storage'

// Preference `ccTabdiffBaseUrl`: the diff viewer's base URL; empty means derive it from the host.
const CC_TABDIFF_BASE_URL_KEY = 'orca:ccTabdiffBaseUrl'

export async function loadCcTabdiffBaseUrl(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(CC_TABDIFF_BASE_URL_KEY)) ?? ''
  } catch {
    return ''
  }
}

export async function saveCcTabdiffBaseUrl(value: string): Promise<void> {
  const trimmed = value.trim()
  await (trimmed
    ? AsyncStorage.setItem(CC_TABDIFF_BASE_URL_KEY, trimmed)
    : AsyncStorage.removeItem(CC_TABDIFF_BASE_URL_KEY))
}
