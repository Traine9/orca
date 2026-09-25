import { loadHostCatalog } from '../transport/hosts/host-store'
import { loadCcTabdiffBaseUrl } from './preference'
import { resolveCcTabdiffBaseUrl } from './url'

/** Endpoint of the given host, else of the most recently connected one (for the settings hint). */
export async function loadCcTabdiffHostEndpoint(hostId?: string): Promise<string | null> {
  const hosts = await loadHostCatalog().catch(() => [])
  const host = hostId
    ? hosts.find((candidate) => candidate.id === hostId)
    : [...hosts].sort((a, b) => b.lastConnected - a.lastConnected)[0]
  return host?.endpoint ?? null
}

/** The base URL a viewer for `hostId` opens, or null when neither the preference nor the host gives one. */
export async function loadCcTabdiffBase(hostId?: string): Promise<string | null> {
  const [preference, endpoint] = await Promise.all([
    loadCcTabdiffBaseUrl(),
    loadCcTabdiffHostEndpoint(hostId)
  ])
  return resolveCcTabdiffBaseUrl(preference, endpoint)
}
