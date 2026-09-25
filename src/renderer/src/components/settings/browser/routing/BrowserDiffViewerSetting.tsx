import { useState } from 'react'
import type { GlobalSettings } from '../../../../../../shared/global-settings-types'
import { Button } from '../../../ui/button'
import { Input } from '../../../ui/input'
import { Label } from '../../../ui/label'
import { SearchableSetting } from '../../section-layout/SearchableSetting'
import { translate } from '@/i18n/i18n'

type BrowserDiffViewerSettingProps = {
  settings: Pick<GlobalSettings, 'diffViewerBaseUrl'>
  updateSettings: (updates: Partial<GlobalSettings>) => void
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

export function BrowserDiffViewerSetting({
  settings,
  updateSettings
}: BrowserDiffViewerSettingProps): React.JSX.Element {
  const saved = settings.diffViewerBaseUrl ?? ''
  const [draft, setDraft] = useState(saved)
  const trimmedDraft = draft.trim()
  const invalid = trimmedDraft !== '' && !isHttpUrl(trimmedDraft)
  const title = translate('settings.browser.diffViewer.title', 'Diff viewer URL')
  const description = translate(
    'settings.browser.diffViewer.description',
    'Open MR/PR links in an external diff viewer at this address (leave empty to disable)'
  )

  const save = (): void => {
    if (!invalid && trimmedDraft !== saved) {
      updateSettings({ diffViewerBaseUrl: trimmedDraft })
    }
  }

  return (
    <SearchableSetting
      title={title}
      description={description}
      keywords={['browser', 'links', 'diff', 'viewer', 'merge request', 'pull request', 'mr', 'pr']}
      className="flex items-start justify-between gap-4 py-2"
    >
      <div className="min-w-0 shrink space-y-0.5">
        <Label>{title}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
        {invalid ? (
          <p className="text-xs text-destructive">
            {translate('settings.browser.diffViewer.invalid', 'Enter an http(s) URL.')}
          </p>
        ) : null}
      </div>
      <form
        className="flex shrink-0 items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={translate('settings.browser.diffViewer.placeholder', 'http://host:8787')}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          aria-invalid={invalid}
          className="h-7 w-52 text-xs"
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={invalid || trimmedDraft === saved}
        >
          {translate('auto.components.settings.BrowserHomePageSetting.d4ddcd0056', 'Save')}
        </Button>
      </form>
    </SearchableSetting>
  )
}
