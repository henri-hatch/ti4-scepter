import { useCallback, useEffect, useMemo, useState } from 'react'
import '../../styles/PlayerView.css'
import '../../styles/CardInventory.css'
import '../../styles/Overview.css'
import PlayerActionMenu from './PlayerActionMenu'
import CardDrawModal from './CardDrawModal'
import ManageTradeGoodsModal from './ManageTradeGoodsModal'
import ManageUnitUpgradesModal, { type UnitSlotEntry } from './ManageUnitUpgradesModal'
import { useSocket } from '../../contexts/useSocket'
import type { ActionCardDefinition, PlayerActionCard } from '../../types/actions'
import type { PlayerPlanet } from '../../types/planets'
import type { PlayerTechnology, TechnologyDefinition, TechnologyType } from '../../types/technology'
import { resolveAssetPath } from '../../utils/assets'
import FactionSelectorModal from '../FactionSelectorModal'
import type { FactionDefinition } from '../../types/faction'
import {
  UNIT_SLOT_DEFAULT_TECH,
  UNIT_SLOT_ORDER,
  UNIT_SLOT_POSITIONS,
  FACTION_UNIT_OVERRIDES,
  type UnitSlotKey
} from '../../data/unitSlots'

type PlayerProfile = {
  playerId: string
  name: string
  faction: string
  resources: number
  influence: number
  commodities: number
  tradeGoods: number
  victoryPoints: number
}

type FetchState = 'idle' | 'loading' | 'loaded' | 'error'

type SortableTechnology = {
  type: TechnologyType
  tier: number
  name: string
}

const TECHNOLOGY_TYPE_PRIORITY: Record<string, number> = {
  Biotic: 0,
  Propulsion: 1,
  Cybernetic: 2,
  Warfare: 3,
  Unit: 4
}

function sortTechnology<T extends SortableTechnology>(items: T[]): void {
  items.sort((a, b) => {
    if (a.type !== b.type) {
      const aPriority = TECHNOLOGY_TYPE_PRIORITY[a.type] ?? 99
      const bPriority = TECHNOLOGY_TYPE_PRIORITY[b.type] ?? 99
      return aPriority - bPriority
    }
    if (a.tier !== b.tier) {
      return a.tier - b.tier
    }
    return a.name.localeCompare(b.name)
  })
}

function formatFactionLabel(key: string | null): string {
  if (!key) {
    return 'None selected'
  }
  return key
    .split(/[_-]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function getSlotTechnologyKey(slot: UnitSlotKey, factionKey: string | null): string {
  const overrides = factionKey ? FACTION_UNIT_OVERRIDES[factionKey] : undefined
  return overrides?.[slot] ?? UNIT_SLOT_DEFAULT_TECH[slot]
}

function Overview() {
  const { playerInfo } = useSocket()
  const gameName = playerInfo.gameName ?? ''
  const playerId = playerInfo.playerId ?? ''

  const [drawModalOpen, setDrawModalOpen] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [planets, setPlanets] = useState<PlayerPlanet[]>([])
  const [technology, setTechnology] = useState<PlayerTechnology[]>([])
  const [actionCards, setActionCards] = useState<PlayerActionCard[]>([])
  const [overviewState, setOverviewState] = useState<FetchState>('idle')
  const [overviewError, setOverviewError] = useState<string | null>(null)

  const [playerFaction, setPlayerFaction] = useState<string | null>(null)
  const [factionDefinition, setFactionDefinition] = useState<FactionDefinition | null>(null)
  const [factionCatalog, setFactionCatalog] = useState<Record<string, FactionDefinition>>({})
  const [factionCatalogState, setFactionCatalogState] = useState<FetchState>('idle')

  const [factionModalOpen, setFactionModalOpen] = useState(false)
  const [factionUpdating, setFactionUpdating] = useState(false)

  const [tradeModalOpen, setTradeModalOpen] = useState(false)
  const [economySaving, setEconomySaving] = useState(false)
  const [economyError, setEconomyError] = useState<string | null>(null)

  const [unitModalOpen, setUnitModalOpen] = useState(false)
  const [unitModalBusyKey, setUnitModalBusyKey] = useState<string | null>(null)
  const [unitModalError, setUnitModalError] = useState<string | null>(null)
  const [unitCatalogState, setUnitCatalogState] = useState<FetchState>('idle')
  const [unitDefinitions, setUnitDefinitions] = useState<Record<string, TechnologyDefinition>>({})

  const [boardFace, setBoardFace] = useState<'front' | 'back'>('front')

  useEffect(() => {
    setProfile(null)
    setPlanets([])
    setTechnology([])
    setActionCards([])
    setOverviewState('idle')
    setOverviewError(null)
    setPlayerFaction(null)
    setFactionDefinition(null)
    setBoardFace('front')
  }, [gameName, playerId])

  const fetchFactionCatalog = useCallback(async () => {
    if (factionCatalogState === 'loaded' || factionCatalogState === 'loading') {
      return
    }
    setFactionCatalogState('loading')
    try {
      const response = await fetch('/api/factions')
      if (!response.ok) {
        throw new Error('Failed to load faction catalog')
      }
      const payload = await response.json()
      const entries: FactionDefinition[] = Array.isArray(payload?.factions) ? payload.factions : []
      const map: Record<string, FactionDefinition> = {}
      entries.forEach((entry) => {
        map[entry.key] = entry
      })
      setFactionCatalog(map)
      setFactionCatalogState('loaded')
    } catch (error) {
      console.error(error)
      setFactionCatalogState('error')
    }
  }, [factionCatalogState])

  const refreshOverview = useCallback(async () => {
    if (!gameName || !playerId) {
      return
    }
    setOverviewState('loading')
    setOverviewError(null)
    try {
      const [profileResponse, planetsResponse, technologyResponse, actionsResponse] = await Promise.all([
        fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}`),
        fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/planets`),
        fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/technology`),
        fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/actions`)
      ])

      if (!profileResponse.ok) {
        throw new Error('profile')
      }
      if (!planetsResponse.ok) {
        throw new Error('planets')
      }
      if (!technologyResponse.ok) {
        throw new Error('technology')
      }
      if (!actionsResponse.ok) {
        throw new Error('actions')
      }

      const profilePayload = await profileResponse.json()
      const planetsPayload = await planetsResponse.json()
      const technologyPayload = await technologyResponse.json()
      const actionsPayload = await actionsResponse.json()

      const rawProfile = profilePayload.player ?? {}
      const normalizedProfile: PlayerProfile = {
        playerId: rawProfile.playerId ?? playerId,
        name: rawProfile.name ?? 'Unknown Player',
        faction: (rawProfile.faction ?? 'none').toLowerCase(),
        resources: Number(rawProfile.resources ?? 0),
        influence: Number(rawProfile.influence ?? 0),
        commodities: Number(rawProfile.commodities ?? 0),
        tradeGoods: Number(rawProfile.tradeGoods ?? 0),
        victoryPoints: Number(rawProfile.victoryPoints ?? 0)
      }

      const planetRows: PlayerPlanet[] = Array.isArray(planetsPayload?.planets)
        ? planetsPayload.planets.map((planet: PlayerPlanet) => ({
            ...planet,
            resources: Number(planet.resources ?? 0),
            influence: Number(planet.influence ?? 0),
            isExhausted: Boolean(planet.isExhausted),
            attachments: Array.isArray(planet.attachments) ? planet.attachments.map((attachment) => ({ ...attachment })) : []
          }))
        : []

      const technologyRows: PlayerTechnology[] = Array.isArray(technologyPayload?.technology)
        ? technologyPayload.technology.map((tech: PlayerTechnology) => ({
            ...tech,
            faction: (tech.faction ?? 'none').toLowerCase(),
            tier: Number(tech.tier ?? 0),
            isExhausted: Boolean(tech.isExhausted)
          }))
        : []
      sortTechnology(technologyRows)

      const actionRows: PlayerActionCard[] = Array.isArray(actionsPayload?.actions)
        ? actionsPayload.actions.map((card: PlayerActionCard) => ({
            ...card,
            isExhausted: Boolean(card.isExhausted)
          }))
        : []

      setProfile(normalizedProfile)
      setPlanets(planetRows)
      setTechnology(technologyRows)
      setActionCards(actionRows)
      setPlayerFaction(normalizedProfile.faction !== 'none' ? normalizedProfile.faction : null)
      setOverviewState('loaded')
    } catch (error) {
      console.error('Failed to load overview data:', error)
      setOverviewState('error')
      setOverviewError('Unable to load player snapshot. Please try again later.')
    }
  }, [gameName, playerId])

  useEffect(() => {
    refreshOverview()
  }, [refreshOverview])

  useEffect(() => {
    if (!playerFaction) {
      setFactionDefinition(null)
      return
    }

    const normalised = playerFaction.toLowerCase()

    if (factionCatalogState === 'idle') {
      fetchFactionCatalog()
      return
    }

    if (factionCatalogState === 'loaded') {
      setFactionDefinition(factionCatalog[normalised] ?? null)
    }
  }, [playerFaction, factionCatalog, factionCatalogState, fetchFactionCatalog])

  useEffect(() => {
    if (unitModalOpen && unitCatalogState === 'idle') {
      if (!gameName || !playerId) {
        return
      }
      const loadUnits = async () => {
        setUnitCatalogState('loading')
        setUnitModalError(null)
        try {
          const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/technology/definitions`)
          if (!response.ok) {
            throw new Error('Failed to load technology catalog')
          }
          const payload = await response.json()
          const definitions: TechnologyDefinition[] = Array.isArray(payload?.technology)
            ? payload.technology.map((def: TechnologyDefinition) => ({
                ...def,
                faction: (def.faction ?? 'none').toLowerCase(),
                tier: Number(def.tier ?? 0)
              }))
            : []
          const unitMap: Record<string, TechnologyDefinition> = {}
          definitions
            .filter((def) => def.type === 'Unit')
            .forEach((def) => {
              unitMap[def.key] = def
            })
          setUnitDefinitions(unitMap)
          setUnitCatalogState('loaded')
        } catch (error) {
          console.error(error)
          setUnitCatalogState('error')
          setUnitModalError('Unable to load unit upgrade catalog.')
        }
      }
      loadUnits()
    }
  }, [gameName, playerId, unitCatalogState, unitModalOpen])

  useEffect(() => {
    setBoardFace('front')
  }, [playerFaction])

  const drawActionCard = useCallback(async (): Promise<ActionCardDefinition> => {
    if (!gameName || !playerId) {
      throw new Error('Game not ready')
    }
    const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/actions/draw`, {
      method: 'POST'
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.error || 'Unable to draw action card')
    }
    const payload = await response.json()
    return payload.action as ActionCardDefinition
  }, [gameName, playerId])

  const confirmDrawnAction = useCallback(async (card: ActionCardDefinition) => {
    if (!gameName || !playerId) {
      return
    }
    setBusy(true)
    setErrorMessage(null)
    setStatusMessage(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionKey: card.key })
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Unable to add action card')
      }
      setStatusMessage(`${card.name} added to your inventory.`)
      setActionCards((previous) => [...previous, { ...card, isExhausted: false }])
    } catch (error) {
      console.error(error)
      setErrorMessage(error instanceof Error ? error.message : 'Unable to add action card.')
      throw error instanceof Error ? error : new Error('Unable to add action card.')
    } finally {
      setBusy(false)
    }
  }, [gameName, playerId])

  const handleFactionConfirm = useCallback(async (selection: FactionDefinition | null) => {
    if (!gameName || !playerId) {
      throw new Error('Game not ready')
    }

    setFactionUpdating(true)
    setStatusMessage(null)
    setErrorMessage(null)

    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/faction`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factionKey: selection ? selection.key : null })
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        const message = typeof payload.error === 'string' ? payload.error : 'Failed to update faction'
        throw new Error(message)
      }

      const factionValue = (payload.player?.faction ?? 'none').toLowerCase()
      setPlayerFaction(factionValue !== 'none' ? factionValue : null)
      setStatusMessage(selection ? `${selection.name} assigned. Starting assets updated.` : 'Faction cleared. Starting assets reset.')
      await refreshOverview()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update faction.'
      setErrorMessage(message)
      throw error instanceof Error ? error : new Error(message)
    } finally {
      setFactionUpdating(false)
    }
  }, [gameName, playerId, refreshOverview])

  const handleEconomyConfirm = useCallback(async ({ tradeGoods, commodities }: { tradeGoods: number; commodities: number }) => {
    if (!gameName || !playerId) {
      return
    }
    setEconomySaving(true)
    setEconomyError(null)
    setStatusMessage(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/economy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeGoods, commodities })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message = typeof payload.error === 'string' ? payload.error : 'Failed to update economy'
        throw new Error(message)
      }
      setProfile((previous) => {
        if (!previous) {
          return previous
        }
        return {
          ...previous,
          tradeGoods,
          commodities
        }
      })
      setStatusMessage('Trade goods updated successfully.')
      setTradeModalOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update trade goods.'
      setEconomyError(message)
    } finally {
      setEconomySaving(false)
    }
  }, [gameName, playerId])

  const handleAddUnitUpgrade = useCallback(async (definition: TechnologyDefinition) => {
    if (!gameName || !playerId || unitModalBusyKey) {
      return
    }
    setUnitModalBusyKey(definition.key)
    setUnitModalError(null)
    setStatusMessage(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/technology`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technologyKey: definition.key })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message = typeof payload.error === 'string' ? payload.error : 'Failed to add technology'
        throw new Error(message)
      }
      const saved = payload.technology as PlayerTechnology
      const merged: PlayerTechnology = {
        ...definition,
        ...saved,
        faction: (saved?.faction ?? definition.faction ?? 'none').toLowerCase(),
        tier: Number(saved?.tier ?? definition.tier ?? 0),
        isExhausted: Boolean(saved?.isExhausted)
      }
      setTechnology((previous) => {
        const next = previous.filter((item) => item.key !== merged.key)
        next.push(merged)
        sortTechnology(next)
        return next
      })
      setStatusMessage(`${definition.name} added to your unit roster.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to add unit upgrade.'
      setUnitModalError(message)
    } finally {
      setUnitModalBusyKey(null)
    }
  }, [gameName, playerId, unitModalBusyKey])

  const handleRemoveUnitUpgrade = useCallback(async (definition: TechnologyDefinition) => {
    if (!gameName || !playerId || unitModalBusyKey) {
      return
    }
    setUnitModalBusyKey(definition.key)
    setUnitModalError(null)
    setStatusMessage(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/technology/${encodeURIComponent(definition.key)}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        const message = typeof payload.error === 'string' ? payload.error : 'Failed to remove technology'
        throw new Error(message)
      }
      setTechnology((previous) => previous.filter((item) => item.key !== definition.key))
      setStatusMessage(`${definition.name} removed from your unit roster.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to remove unit upgrade.'
      setUnitModalError(message)
    } finally {
      setUnitModalBusyKey(null)
    }
  }, [gameName, playerId, unitModalBusyKey])

  const actionOptions = useMemo(() => (
    [
      {
        label: 'Draw Action Card',
        onSelect: () => {
          setStatusMessage(null)
          setErrorMessage(null)
          setDrawModalOpen(true)
        },
        disabled: !gameName || !playerId || busy
      },
      {
        label: 'Manage Trade Goods',
        onSelect: () => {
          setStatusMessage(null)
          setErrorMessage(null)
          setEconomyError(null)
          setTradeModalOpen(true)
        },
        disabled: !gameName || !playerId || economySaving
      },
      {
        label: 'Manage Unit Upgrades',
        onSelect: () => {
          setStatusMessage(null)
          setErrorMessage(null)
          setUnitModalError(null)
          setUnitModalOpen(true)
        },
        disabled: !gameName || !playerId || !playerFaction || Boolean(unitModalBusyKey)
      },
      {
        label: 'Change Faction',
        onSelect: () => {
          setStatusMessage(null)
          setErrorMessage(null)
          setFactionModalOpen(true)
        },
        disabled: !gameName || !playerId || factionUpdating
      }
    ]
  ), [busy, economySaving, factionUpdating, gameName, playerFaction, playerId, unitModalBusyKey])

  const tradeGoodIcon = resolveAssetPath('tokens/trade_good.png')
  const commodityIcon = resolveAssetPath('tokens/commodity.png')

  const planetTotals = useMemo(() => {
    return planets.reduce(
      (totals, planet) => {
        totals.resources += Number(planet.resources ?? 0)
        totals.influence += Number(planet.influence ?? 0)
        return totals
      },
      { resources: 0, influence: 0 }
    )
  }, [planets])

  const unitTechnologyMap = useMemo(() => {
    const map = new Map<string, PlayerTechnology>()
    technology.forEach((tech) => {
      if (tech.type === 'Unit') {
        map.set(tech.key, tech)
      }
    })
    return map
  }, [technology])

  const unitSlotEntries = useMemo<UnitSlotEntry[]>(() => (
    UNIT_SLOT_ORDER.map((slot) => {
      const techKey = getSlotTechnologyKey(slot, playerFaction)
      const ownedTechnology = unitTechnologyMap.get(techKey)
      const fallbackDefinition = ownedTechnology
        ? {
            key: ownedTechnology.key,
            name: ownedTechnology.name,
            type: ownedTechnology.type,
            faction: ownedTechnology.faction,
            tier: ownedTechnology.tier,
            asset: ownedTechnology.asset
          }
        : null
      return {
        slot,
        label: UNIT_SLOT_POSITIONS[slot].label,
        definition: unitDefinitions[techKey] ?? fallbackDefinition,
        owned: Boolean(ownedTechnology)
      }
    })
  ), [playerFaction, unitDefinitions, unitTechnologyMap])

  const boardOverlays = useMemo(() => {
    if (boardFace === 'back') {
      return []
    }
    return UNIT_SLOT_ORDER.map((slot) => {
      const techKey = getSlotTechnologyKey(slot, playerFaction)
      const tech = unitTechnologyMap.get(techKey)
      if (!tech) {
        return null
      }
      const position = UNIT_SLOT_POSITIONS[slot]
      return {
        slot,
        key: tech.key,
        name: tech.name,
        asset: resolveAssetPath(tech.asset),
        position
      }
    }).filter(Boolean) as Array<{
      slot: UnitSlotKey
      key: string
      name: string
      asset: string
      position: typeof UNIT_SLOT_POSITIONS[UnitSlotKey]
    }>
  }, [boardFace, playerFaction, unitTechnologyMap])

  const factionLabel = formatFactionLabel(playerFaction)

  const currentTradeGoods = profile?.tradeGoods ?? 0
  const currentCommodities = profile?.commodities ?? 0
  const victoryPoints = profile?.victoryPoints ?? 0
  const technologyCount = technology.length
  const actionCount = actionCards.length

  const isOverviewLoading = overviewState === 'loading' && !profile

  const frontAsset = factionDefinition?.sheetFrontAsset ? resolveAssetPath(factionDefinition.sheetFrontAsset) : null
  const backAsset = factionDefinition?.sheetBackAsset ? resolveAssetPath(factionDefinition.sheetBackAsset) : null
  const canFlipBoard = Boolean(frontAsset && backAsset)

  return (
    <div className="player-page overview-page">
      <h1>Overview</h1>
      <p>
        Quick access to frequently used player actions plus a live snapshot of your current standing.
      </p>
      <div className="overview-faction-summary">
        <strong>Current faction:</strong> {factionLabel}
      </div>

      {statusMessage ? <div className="card-inventory-status">{statusMessage}</div> : null}
      {errorMessage ? <div className="card-inventory-error">{errorMessage}</div> : null}
      {overviewError ? <div className="card-inventory-error">{overviewError}</div> : null}

      <PlayerActionMenu options={actionOptions} ariaLabel="Overview actions" />

      <div className="overview-layout">
        <section className="overview-section">
          <div className="overview-section-header">
            <h2>Player Snapshot</h2>
            {overviewState === 'loading' ? <span className="overview-status">Refreshing…</span> : null}
          </div>

          {isOverviewLoading ? (
            <div className="overview-loading">Loading summary…</div>
          ) : (
            <div className="overview-stats-grid">
              <div className="overview-stat-card">
                <span className="stat-label">Victory Points</span>
                <span className="stat-value">{victoryPoints}</span>
              </div>
              <div className="overview-stat-card">
                <span className="stat-label">Planets Owned</span>
                <span className="stat-value">{planets.length}</span>
              </div>
              <div className="overview-stat-card">
                <span className="stat-label">Action Cards</span>
                <span className="stat-value">{actionCount}</span>
              </div>
              <div className="overview-stat-card">
                <span className="stat-label">Technology Cards</span>
                <span className="stat-value">{technologyCount}</span>
              </div>
              <div className="overview-stat-card overview-stat-card--economy">
                <span className="stat-label">Trade Goods</span>
                <span className="stat-value stat-value--with-icon">
                  {currentTradeGoods}
                  <img src={tradeGoodIcon} alt="" aria-hidden="true" className="stat-value-icon" />
                </span>
              </div>
              <div className="overview-stat-card overview-stat-card--economy">
                <span className="stat-label">Commodities</span>
                <span className="stat-value stat-value--with-icon">
                  {currentCommodities}
                  <img src={commodityIcon} alt="" aria-hidden="true" className="stat-value-icon" />
                </span>
              </div>
              <div className="overview-stat-card">
                <span className="stat-label">Planet Resources</span>
                <span className="stat-value">{planetTotals.resources}</span>
              </div>
              <div className="overview-stat-card">
                <span className="stat-label">Planet Influence</span>
                <span className="stat-value">{planetTotals.influence}</span>
              </div>
            </div>
          )}
        </section>

        <section className="overview-section">
          <div className="overview-section-header">
            <h2>Faction Board</h2>
            <div className="overview-board-controls">
              <button
                type="button"
                className="overview-board-toggle"
                onClick={() => setBoardFace((face) => (face === 'front' ? 'back' : 'front'))}
                disabled={!canFlipBoard}
              >
                {boardFace === 'front' ? 'Show Back' : 'Show Front'}
              </button>
            </div>
          </div>

          {!frontAsset ? (
            <div className="overview-board-empty">Select a faction to view the board and manage unit upgrades.</div>
          ) : (
            <div className="faction-board-wrapper">
              <div className={boardFace === 'back' ? 'faction-board-card card-base is-flipped' : 'faction-board-card card-base'}>
                <div className="card-inner">
                  <div className="card-face card-face--front">
                    <img src={frontAsset} alt="Faction board front" />
                    <div className="faction-board-overlays">
                      {boardOverlays.map((overlay) => (
                        <div
                          key={overlay.key}
                          className="unit-overlay visible"
                          style={{
                            top: `${overlay.position.top}%`,
                            left: `${overlay.position.left}%`,
                            width: `${overlay.position.width}%`,
                            height: `${overlay.position.height}%`
                          }}
                        >
                          <img src={overlay.asset} alt={`${overlay.name} unit upgrade`} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="card-face card-face--back">
                    {backAsset ? <img src={backAsset} alt="Faction board back" /> : <div className="faction-board-back-placeholder">No back artwork available</div>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <CardDrawModal
        isOpen={drawModalOpen}
        title="Draw Action Card"
        drawCard={drawActionCard}
        onConfirm={async (card) => {
          await confirmDrawnAction(card)
          setDrawModalOpen(false)
        }}
        onDismiss={() => setDrawModalOpen(false)}
        renderCard={(card) => (
          <img src={resolveAssetPath(card.asset)} alt={`${card.name} preview`} />
        )}
        confirmLabel={busy ? 'Saving…' : 'Add to Inventory'}
      />
      <FactionSelectorModal
        isOpen={factionModalOpen}
        onClose={() => setFactionModalOpen(false)}
        onConfirm={handleFactionConfirm}
        selectedKey={playerFaction}
        title="Change Faction"
        allowUnset
      />
      <ManageTradeGoodsModal
        isOpen={tradeModalOpen}
        tradeGoods={currentTradeGoods}
        commodities={currentCommodities}
        onClose={() => {
          if (!economySaving) {
            setTradeModalOpen(false)
          }
        }}
        onConfirm={handleEconomyConfirm}
        saving={economySaving}
        errorMessage={economyError}
      />
      <ManageUnitUpgradesModal
        isOpen={unitModalOpen}
        entries={unitSlotEntries}
        busyKey={unitModalBusyKey}
        onAdd={handleAddUnitUpgrade}
        onRemove={handleRemoveUnitUpgrade}
        onClose={() => {
          if (!unitModalBusyKey) {
            setUnitModalOpen(false)
          }
        }}
        errorMessage={unitModalError}
      />
    </div>
  )
}

export default Overview
