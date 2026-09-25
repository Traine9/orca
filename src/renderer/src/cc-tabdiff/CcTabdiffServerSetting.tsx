import type { GlobalSettings } from '../../../shared/global-settings-types'
import { isCcTabdiffServerEnabled } from '../../../shared/cc-tabdiff/base-url'
import { SearchableSetting } from '@/components/settings/section-layout/SearchableSetting'
import { SettingsSwitchRow } from '@/components/settings/form-controls/SettingsFormControls'
import { translate } from '@/i18n/i18n'
import { isCcTabdiffBuiltInServerAvailable } from './cc-tabdiff-links'

type CcTabdiffServerSettingProps = {
  settings: Pick<GlobalSettings, 'ccTabdiffServer'>
  updateSettings: (updates: Partial<GlobalSettings>) => void
}

/** Settings → Browser toggle for the bundled cc-tabdiff server (Linux desktop only). */
export function CcTabdiffServerSetting({
  settings,
  updateSettings
}: CcTabdiffServerSettingProps): React.JSX.Element | null {
  if (!isCcTabdiffBuiltInServerAvailable()) {
    return null
  }
  const enabled = isCcTabdiffServerEnabled(settings)
  const title = translate('ccTabdiff.settings.serverTitle', 'Run built-in diff viewer server')
  const description = translate(
    'ccTabdiff.settings.serverDescription',
    'Serve per-tab Claude Code diffs on port 8787 (LAN-reachable for the phone). Skipped when another server already answers there; turning it off stops only the server Orca started.'
  )
  return (
    <SearchableSetting
      title={title}
      description={description}
      keywords={['browser', 'diff', 'viewer', 'cc-tabdiff', 'server', 'tab diff', 'phone']}
    >
      <SettingsSwitchRow
        label={title}
        description={description}
        checked={enabled}
        onChange={() => updateSettings({ ccTabdiffServer: !enabled })}
      />
    </SearchableSetting>
  )
}
