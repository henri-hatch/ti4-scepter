import { useCallback, useEffect, useMemo, useState } from 'react'
import '../../styles/PlayerView.css'
import '../../styles/CardInventory.css'
import { useSocket } from '../../contexts/useSocket'
import PlayerActionMenu from './PlayerActionMenu'
import CardDrawModal from './CardDrawModal'
import ManageActionCardsModal from './ManageActionCardsModal'
import ManageExplorationCardsModal from './ManageExplorationCardsModal'
import ManageStrategemsModal from './ManageStrategemsModal'
import ActionCard from '../cards/ActionCard'
import ExplorationCard from '../cards/ExplorationCard'
import StrategemCard from '../cards/StrategemCard'
import RestoreRelicModal from './RestoreRelicModal'
import RelicAttachmentModal from './RelicAttachmentModal'
import type { PlayerActionCard, ActionCardDefinition } from '../../types/actions'
import type { ExplorationCardDefinition, PlayerExplorationCard } from '../../types/exploration'
import type { PlayerStrategem, StrategemDefinition } from '../../types/strategems'
import type { PlayerPlanet } from '../../types/planets'
import { resolveAssetPath } from '../../utils/assets'

function sortByName<T extends { name: string }>(items: T[]): T[] {
  const copy = [...items]
  copy.sort((a, b) => a.name.localeCompare(b.name))
  return copy
}

function CardInventory() {
  const { playerInfo, socket } = useSocket()
  const gameName = playerInfo.gameName ?? ''
  const playerId = playerInfo.playerId ?? ''

  const [actions, setActions] = useState<PlayerActionCard[]>([])
  const [exploration, setExploration] = useState<PlayerExplorationCard[]>([])
  const [strategems, setStrategems] = useState<PlayerStrategem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [actionDefinitions, setActionDefinitions] = useState<ActionCardDefinition[]>([])
  const [explorationDefinitions, setExplorationDefinitions] = useState<ExplorationCardDefinition[]>([])
  const [strategemDefinitions, setStrategemDefinitions] = useState<StrategemDefinition[]>([])
  const [definitionsLoaded, setDefinitionsLoaded] = useState({ actions: false, exploration: false, strategems: false })
  const [definitionsLoading, setDefinitionsLoading] = useState({ actions: false, exploration: false, strategems: false })

  const [actionBusyKey, setActionBusyKey] = useState<string | null>(null)
  const [explorationBusyKey, setExplorationBusyKey] = useState<string | null>(null)
  const [strategemBusyKey, setStrategemBusyKey] = useState<string | null>(null)
  const [strategemTradeBusyKey, setStrategemTradeBusyKey] = useState<string | null>(null)

  const [pendingActionDelete, setPendingActionDelete] = useState<PlayerActionCard | null>(null)
  const [pendingExplorationDelete, setPendingExplorationDelete] = useState<PlayerExplorationCard | null>(null)
  const [pendingStrategemDelete, setPendingStrategemDelete] = useState<PlayerStrategem | null>(null)
  const [restoreModalOpen, setRestoreModalOpen] = useState(false)
  const [restoreInitialFragment, setRestoreInitialFragment] = useState<PlayerExplorationCard | null>(null)
  const [manageExplorationOpen, setManageExplorationOpen] = useState(false)
  const [manageRelicsOpen, setManageRelicsOpen] = useState(false)
  const [manageStrategemsOpen, setManageStrategemsOpen] = useState(false)

  const [drawModalOpen, setDrawModalOpen] = useState(false)
  const [manageActionModalOpen, setManageActionModalOpen] = useState(false)

  const [playerPlanets, setPlayerPlanets] = useState<PlayerPlanet[]>([])
  const [relicAttachmentTarget, setRelicAttachmentTarget] = useState<PlayerExplorationCard | null>(null)
  const [relicAttachmentLoading, setRelicAttachmentLoading] = useState(false)
  const [relicAttachmentBusy, setRelicAttachmentBusy] = useState(false)
  const [relicAttachmentError, setRelicAttachmentError] = useState<string | null>(null)

  const explorationActions = useMemo(
    () => exploration.filter((card) => card.subtype === 'action' && card.type !== 'Relic'),
    [exploration]
  )

  const relicFragments = useMemo(
    () => exploration.filter((card) => card.subtype === 'relic_fragment'),
    [exploration]
  )

  const relics = useMemo(
    () => exploration.filter((card) => card.type === 'Relic'),
    [exploration]
  )

  const manageableExploration = useMemo(
    () => exploration.filter((card) => (
      (card.subtype === 'action' && card.type !== 'Relic') || card.subtype === 'relic_fragment'
    )),
    [exploration]
  )

  const availableRelicDefinitions = useMemo(
    () => explorationDefinitions.filter((card) => card.type === 'Relic'),
    [explorationDefinitions]
  )

  const fetchActionCards = useCallback(async () => {
    if (!gameName || !playerId) {
      return
    }
    const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/actions`)
    if (!response.ok) {
      throw new Error('Failed to load action cards')
    }
    const payload = await response.json()
    const rows: PlayerActionCard[] = (payload.actions ?? []).map((card: PlayerActionCard) => {
      const raw = card as unknown as {
        backAsset?: string | null
        assetBack?: string | null
        type?: string
      }
      return {
        ...card,
        type: raw.type ?? card.type ?? 'standard',
        backAsset: raw.backAsset ?? raw.assetBack ?? null,
        isExhausted: Boolean(card.isExhausted)
      }
    })
    setActions(sortByName(rows))
  }, [gameName, playerId])

  const fetchExplorationCards = useCallback(async () => {
    if (!gameName || !playerId) {
      return
    }
    const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/exploration`)
    if (!response.ok) {
      throw new Error('Failed to load exploration cards')
    }
    const payload = await response.json()
    const rows: PlayerExplorationCard[] = (payload.exploration ?? []).map((card: PlayerExplorationCard) => ({
      ...card,
      isExhausted: Boolean(card.isExhausted)
    }))
    setExploration(sortByName(rows))
  }, [gameName, playerId])

  const fetchStrategemCards = useCallback(async () => {
    if (!gameName || !playerId) {
      return
    }
    const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/strategems`)
    if (!response.ok) {
      throw new Error('Failed to load strategems')
    }
    const payload = await response.json()
    const rows: PlayerStrategem[] = (payload.strategems ?? []).map((card: PlayerStrategem) => ({
      ...card,
      isExhausted: Boolean(card.isExhausted),
      tradeGoods: Number(card.tradeGoods ?? 0)
    }))
    setStrategems(sortByName(rows))
  }, [gameName, playerId])

  const fetchRelicAttachmentPlanets = useCallback(async () => {
    if (!gameName || !playerId) {
      return
    }
    const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/planets`)
    if (!response.ok) {
      throw new Error('Failed to load planets')
    }
    const payload = await response.json()
    const rows: PlayerPlanet[] = (payload.planets ?? []).map((planet: PlayerPlanet) => ({
      ...planet,
      techSpecialty: planet.techSpecialty ?? null,
      isExhausted: Boolean(planet.isExhausted),
      attachments: Array.isArray(planet.attachments)
        ? planet.attachments.map((attachment) => ({ ...attachment }))
        : []
    }))
    rows.sort((a, b) => a.name.localeCompare(b.name))
    setPlayerPlanets(rows)
  }, [gameName, playerId])

  const fetchInventory = useCallback(
    async ({ showError = true }: { showError?: boolean } = {}): Promise<boolean> => {
      if (!gameName || !playerId) {
        return true
      }
      setLoading(true)
      try {
        await Promise.all([fetchActionCards(), fetchExplorationCards(), fetchStrategemCards()])
        setError(null)
        return true
      } catch (err) {
        console.error(err)
        if (showError) {
          setError('Unable to load card inventory. Please try again.')
        }
        return false
      } finally {
        setLoading(false)
      }
    },
    [fetchActionCards, fetchExplorationCards, fetchStrategemCards, gameName, playerId]
  )

  useEffect(() => {
    setActions([])
    setExploration([])
    setStrategems([])
    setError(null)
    setDefinitionsLoaded({ actions: false, exploration: false, strategems: false })
    setDefinitionsLoading({ actions: false, exploration: false, strategems: false })
    setStrategemDefinitions([])
    setPendingStrategemDelete(null)
    setStrategemBusyKey(null)
    setStrategemTradeBusyKey(null)
    setPlayerPlanets([])
    setRelicAttachmentTarget(null)
    setRelicAttachmentError(null)
    setRelicAttachmentBusy(false)
    setRelicAttachmentLoading(false)
    if (!gameName || !playerId) {
      return
    }

    let cancelled = false
    let retryTimeout: ReturnType<typeof setTimeout> | null = null

    const load = async () => {
      setError(null)
      const success = await fetchInventory({ showError: false })
      if (!success && !cancelled) {
        retryTimeout = setTimeout(async () => {
          if (!cancelled) {
            await fetchInventory({ showError: true })
          }
        }, 400)
      }
    }

    load()

    return () => {
      cancelled = true
      if (retryTimeout) {
        clearTimeout(retryTimeout)
      }
    }
  }, [fetchInventory, gameName, playerId])

  useEffect(() => {
    if (!socket) {
      return
    }

    const handleTradeGoodsUpdated = (payload: { gameName?: string; strategem?: StrategemDefinition | PlayerStrategem }) => {
      if (payload?.gameName && payload.gameName !== gameName) {
        return
      }
      if (!payload?.strategem) {
        return
      }
      const strategem = payload.strategem
      const tradeGoodsValue = Number(strategem.tradeGoods ?? 0)
      setStrategems((previous) => previous.map((item) => (
        item.key === strategem.key
          ? { ...item, tradeGoods: tradeGoodsValue }
          : item
      )))
      setStrategemDefinitions((previous) => previous.map((item) => (
        item.key === strategem.key
          ? { ...item, tradeGoods: tradeGoodsValue }
          : item
      )))
    }

    socket.on('strategem_trade_goods_updated', handleTradeGoodsUpdated)
    return () => {
      socket.off('strategem_trade_goods_updated', handleTradeGoodsUpdated)
    }
  }, [gameName, socket])

  const loadActionDefinitions = useCallback(async () => {
    if (!gameName || !playerId || definitionsLoading.actions) {
      return
    }
    setDefinitionsLoading((prev) => ({ ...prev, actions: true }))
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/actions/definitions`)
      if (!response.ok) {
        throw new Error('Failed to load action definitions')
      }
      const payload = await response.json()
      const defs: ActionCardDefinition[] = (payload.actions ?? [])
        .map((card: ActionCardDefinition) => {
          const raw = card as unknown as {
            backAsset?: string | null
            assetBack?: string | null
            type?: string
          }
          return {
            ...card,
            type: raw.type ?? card.type ?? 'standard',
            backAsset: raw.backAsset ?? raw.assetBack ?? null
          }
        })
        .filter((card: ActionCardDefinition) => card.type !== 'legendary')
      setActionDefinitions(sortByName(defs))
      setDefinitionsLoaded((prev) => ({ ...prev, actions: true }))
    } catch (err) {
      console.error(err)
      setError('Unable to load action card options.')
    } finally {
      setDefinitionsLoading((prev) => ({ ...prev, actions: false }))
    }
  }, [gameName, playerId, definitionsLoading.actions])

  const loadExplorationDefinitions = useCallback(async () => {
    if (!gameName || !playerId || definitionsLoading.exploration) {
      return
    }
    setDefinitionsLoading((prev) => ({ ...prev, exploration: true }))
    try {
      const response = await fetch(
        `/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/exploration/definitions?subtypes=action,relic_fragment,attach`
      )
      if (!response.ok) {
        throw new Error('Failed to load exploration definitions')
      }
      const payload = await response.json()
      const defs: ExplorationCardDefinition[] = payload.exploration ?? []
      setExplorationDefinitions(sortByName(defs))
      setDefinitionsLoaded((prev) => ({ ...prev, exploration: true }))
    } catch (err) {
      console.error(err)
      setError('Unable to load exploration card options.')
    } finally {
      setDefinitionsLoading((prev) => ({ ...prev, exploration: false }))
    }
  }, [gameName, playerId, definitionsLoading.exploration])

  const loadStrategemDefinitions = useCallback(async () => {
    if (!gameName || !playerId || definitionsLoading.strategems) {
      return
    }
    setDefinitionsLoading((prev) => ({ ...prev, strategems: true }))
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/strategems/definitions`)
      if (!response.ok) {
        throw new Error('Failed to load strategem definitions')
      }
      const payload = await response.json()
      const defs: StrategemDefinition[] = (payload.strategems ?? []).map((item: StrategemDefinition) => ({
        ...item,
        tradeGoods: Number(item.tradeGoods ?? 0)
      }))
      setStrategemDefinitions(sortByName(defs))
      setDefinitionsLoaded((prev) => ({ ...prev, strategems: true }))
    } catch (err) {
      console.error(err)
      setError('Unable to load strategem options.')
    } finally {
      setDefinitionsLoading((prev) => ({ ...prev, strategems: false }))
    }
  }, [gameName, playerId, definitionsLoading.strategems])

  const handleToggleAction = async (card: PlayerActionCard) => {
    if (!gameName || !playerId) {
      return
    }
    setActionBusyKey(card.key)
    setError(null)
    try {
      const response = await fetch(
        `/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/actions/${encodeURIComponent(card.key)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isExhausted: !card.isExhausted })
        }
      )
      if (!response.ok) {
        throw new Error('Failed to update action card')
      }
      setActions((previous) => previous.map((item) => (
        item.key === card.key ? { ...item, isExhausted: !item.isExhausted } : item
      )))
    } catch (err) {
      console.error(err)
      setError('Unable to update action card. Please try again.')
    } finally {
      setActionBusyKey(null)
    }
  }

  const removeActionDefinition = useCallback((definition: ActionCardDefinition) => {
    setActionDefinitions((previous) => sortByName(previous.filter((item) => item.key !== definition.key)))
  }, [])

  const addActionDefinitionBack = useCallback((definition: ActionCardDefinition) => {
    setActionDefinitions((previous) => {
      const exists = previous.some((item) => item.key === definition.key)
      if (exists) {
        return previous
      }
      return sortByName([...previous, definition])
    })
  }, [])

  const removeStrategemDefinition = useCallback((definition: StrategemDefinition) => {
    setStrategemDefinitions((previous) => sortByName(previous.filter((item) => item.key !== definition.key)))
  }, [])

  const addStrategemDefinitionBack = useCallback((definition: StrategemDefinition) => {
    setStrategemDefinitions((previous) => {
      const existingIndex = previous.findIndex((item) => item.key === definition.key)
      if (existingIndex >= 0) {
        const clone = [...previous]
        clone[existingIndex] = {
          ...clone[existingIndex],
          tradeGoods: definition.tradeGoods
        }
        return sortByName(clone)
      }
      return sortByName([...previous, definition])
    })
  }, [])

  const handleAddAction = useCallback(async (definition: ActionCardDefinition) => {
    if (!gameName || !playerId) {
      return
    }
    setActionBusyKey(definition.key)
    setError(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionKey: definition.key })
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Unable to add action card')
      }
    const payload = await response.json()
    const saved: PlayerActionCard = {
      ...definition,
      ...(payload.action ?? {}),
      isExhausted: Boolean(payload.action?.isExhausted)
    }
    setActions((previous) => sortByName([...previous.filter((item) => item.key !== saved.key), saved]))
    removeActionDefinition(definition)
    } catch (err) {
      console.error(err)
      const failure = err instanceof Error ? err : new Error('Unable to add action card.')
      setError(failure.message)
      throw failure
    } finally {
      setActionBusyKey(null)
    }
  }, [gameName, playerId, removeActionDefinition])

  const removeActionCard = useCallback(async (card: PlayerActionCard) => {
    if (!gameName || !playerId) {
      return
    }
    setActionBusyKey(card.key)
    setError(null)
    try {
      const response = await fetch(
        `/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/actions/${encodeURIComponent(card.key)}`,
        { method: 'DELETE' }
      )
      if (!response.ok) {
        throw new Error('Failed to delete action card')
      }
      setActions((previous) => previous.filter((item) => item.key !== card.key))
      addActionDefinitionBack(card)
    } catch (err) {
      console.error(err)
      setError('Unable to delete action card. Please try again.')
      throw err
    } finally {
      setActionBusyKey(null)
    }
  }, [addActionDefinitionBack, gameName, playerId])

  const handleDeleteAction = async () => {
    if (!pendingActionDelete || !gameName || !playerId) {
      return
    }
    try {
      await removeActionCard(pendingActionDelete)
      setPendingActionDelete(null)
    } catch (err) {
      console.error(err)
    }
  }

  const handleToggleStrategem = async (card: PlayerStrategem) => {
    if (!gameName || !playerId) {
      return
    }
    setStrategemBusyKey(card.key)
    setError(null)
    try {
      const response = await fetch(
        `/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/strategems/${encodeURIComponent(card.key)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isExhausted: !card.isExhausted })
        }
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update strategem')
      }
      const updated = payload.strategem as PlayerStrategem | undefined
      setStrategems((previous) => previous.map((item) => {
        if (item.key !== card.key) {
          return item
        }
        if (updated) {
          return {
            ...item,
            ...updated,
            isExhausted: Boolean(updated.isExhausted),
            tradeGoods: Number(updated.tradeGoods ?? item.tradeGoods)
          }
        }
        return { ...item, isExhausted: !item.isExhausted }
      }))
    } catch (err) {
      console.error(err)
      setError('Unable to update strategem. Please try again.')
    } finally {
      setStrategemBusyKey(null)
    }
  }

  const handleAddStrategem = useCallback(async (definition: StrategemDefinition) => {
    if (!gameName || !playerId) {
      return
    }
    setStrategemBusyKey(definition.key)
    setError(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/strategems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategemKey: definition.key })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to add strategem')
      }
      const savedPayload = (payload.strategem ?? {}) as Partial<PlayerStrategem>
      const saved: PlayerStrategem = {
        ...definition,
        ...savedPayload,
        isExhausted: Boolean(savedPayload.isExhausted),
        tradeGoods: Number(savedPayload.tradeGoods ?? definition.tradeGoods ?? 0)
      }
      setStrategems((previous) => sortByName([
        ...previous.filter((item) => item.key !== saved.key),
        saved
      ]))
      removeStrategemDefinition(definition)
    } catch (err) {
      console.error(err)
      const failure = err instanceof Error ? err : new Error('Unable to add strategem.')
      setError(failure.message)
      throw failure
    } finally {
      setStrategemBusyKey(null)
    }
  }, [gameName, playerId, removeStrategemDefinition])

  const removeStrategemCard = useCallback(async (card: PlayerStrategem) => {
    if (!gameName || !playerId) {
      return
    }
    setStrategemBusyKey(card.key)
    setError(null)
    try {
      const response = await fetch(
        `/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/strategems/${encodeURIComponent(card.key)}`,
        { method: 'DELETE' }
      )
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to delete strategem')
      }
      setStrategems((previous) => previous.filter((item) => item.key !== card.key))
      addStrategemDefinitionBack(card)
    } catch (err) {
      console.error(err)
      setError('Unable to delete strategem. Please try again.')
      throw err
    } finally {
      setStrategemBusyKey(null)
    }
  }, [addStrategemDefinitionBack, gameName, playerId])

  const handleDeleteStrategem = async () => {
    if (!pendingStrategemDelete || !gameName || !playerId) {
      return
    }
    try {
      await removeStrategemCard(pendingStrategemDelete)
      setPendingStrategemDelete(null)
    } catch (err) {
      console.error(err)
    }
  }

  const handleTradeGoodsChange = useCallback(async (card: PlayerStrategem, nextTradeGoods: number) => {
    if (!gameName) {
      return
    }
    const desired = Math.max(0, Math.round(nextTradeGoods))
    setStrategemTradeBusyKey(card.key)
    setError(null)
    try {
      const response = await fetch(
        `/api/game/${encodeURIComponent(gameName)}/strategems/${encodeURIComponent(card.key)}/trade-goods`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tradeGoods: desired })
        }
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update trade goods')
      }
      const updated = payload.strategem as StrategemDefinition | undefined
      if (updated) {
        const normalisedGoods = Number(updated.tradeGoods ?? desired)
        setStrategems((previous) => previous.map((item) => (
          item.key === updated.key
            ? { ...item, tradeGoods: normalisedGoods }
            : item
        )))
        setStrategemDefinitions((previous) => previous.map((item) => (
          item.key === updated.key
            ? { ...item, tradeGoods: normalisedGoods }
            : item
        )))
      } else {
        setStrategems((previous) => previous.map((item) => (
          item.key === card.key
            ? { ...item, tradeGoods: desired }
            : item
        )))
      }
    } catch (err) {
      console.error(err)
      setError('Unable to update trade goods. Please try again.')
    } finally {
      setStrategemTradeBusyKey(null)
    }
  }, [gameName])

  const handleToggleExploration = async (card: PlayerExplorationCard) => {
    if (!gameName || !playerId) {
      return
    }
    if (card.subtype !== 'action') {
      return
    }
    setExplorationBusyKey(card.key)
    setError(null)
    try {
      const response = await fetch(
        `/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/exploration/${encodeURIComponent(card.key)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isExhausted: !card.isExhausted })
        }
      )
      if (!response.ok) {
        throw new Error('Failed to update exploration card')
      }
      setExploration((previous) => previous.map((item) => (
        item.key === card.key ? { ...item, isExhausted: !item.isExhausted } : item
      )))
    } catch (err) {
      console.error(err)
      setError('Unable to update exploration card. Please try again.')
    } finally {
      setExplorationBusyKey(null)
    }
  }

  const handleOpenRelicAttachment = useCallback(async (card: PlayerExplorationCard) => {
    if (!gameName || !playerId) {
      return
    }
    setRelicAttachmentTarget(card)
    setRelicAttachmentError(null)
    setRelicAttachmentLoading(true)
    try {
      await fetchRelicAttachmentPlanets()
    } catch (err) {
      console.error(err)
      setPlayerPlanets([])
      setRelicAttachmentError('Unable to load planets. Please try again.')
    } finally {
      setRelicAttachmentLoading(false)
    }
  }, [fetchRelicAttachmentPlanets, gameName, playerId])

  const handleCloseRelicAttachment = useCallback(() => {
    if (relicAttachmentBusy) {
      return
    }
    setRelicAttachmentTarget(null)
    setRelicAttachmentError(null)
  }, [relicAttachmentBusy])

  const handleAttachRelicToPlanet = useCallback(async (planet: PlayerPlanet) => {
    if (!gameName || !playerId || !relicAttachmentTarget) {
      return
    }
    setRelicAttachmentBusy(true)
    setRelicAttachmentError(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/planets/${encodeURIComponent(planet.key)}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ explorationKey: relicAttachmentTarget.key })
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to attach relic')
      }

      setExploration((previous) => previous.filter((item) => item.key !== relicAttachmentTarget.key))
      setRelicAttachmentTarget(null)
      setRelicAttachmentError(null)

      const attachment = payload.attachment
      if (attachment) {
        setPlayerPlanets((previous) => previous.map((entry) => (
          entry.key === planet.key
            ? { ...entry, attachments: [...entry.attachments, attachment] }
            : entry
        )))
      }
    } catch (err) {
      console.error(err)
      setRelicAttachmentError(err instanceof Error ? err.message : 'Unable to attach relic.')
    } finally {
      setRelicAttachmentBusy(false)
    }
  }, [gameName, playerId, relicAttachmentTarget])

  const removeExplorationDefinition = useCallback((definition: ExplorationCardDefinition) => {
    setExplorationDefinitions((previous) => previous.filter((item) => item.key !== definition.key))
  }, [])

  const addExplorationDefinitionBack = useCallback((definition: ExplorationCardDefinition) => {
    setExplorationDefinitions((previous) => {
      const exists = previous.some((item) => item.key === definition.key)
      if (exists) {
        return previous
      }
      return sortByName([...previous, definition])
    })
  }, [])

  const handleAddExploration = useCallback(async (definition: ExplorationCardDefinition) => {
    if (!gameName || !playerId) {
      return
    }
    setExplorationBusyKey(definition.key)
    setError(null)
    try {
      const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/exploration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ explorationKey: definition.key })
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Unable to add exploration card')
      }
      const payload = await response.json()
      const saved: PlayerExplorationCard = {
        ...definition,
        ...(payload.exploration ?? {}),
        isExhausted: Boolean(payload.exploration?.isExhausted)
      }
      setExploration((previous) => sortByName([...previous.filter((item) => item.key !== saved.key), saved]))
      removeExplorationDefinition(definition)
    } catch (err) {
      console.error(err)
      const failure = err instanceof Error ? err : new Error('Unable to add exploration card.')
      setError(failure.message)
      throw failure
    } finally {
      setExplorationBusyKey(null)
    }
  }, [gameName, playerId, removeExplorationDefinition])

  const handleRestoreRelic = useCallback(async (fragmentKeys: string[]) => {
    if (!gameName || !playerId) {
      throw new Error('Game not ready')
    }

    const response = await fetch(`/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/relics/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fragmentKeys })
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to restore relic')
    }

    const relic = payload.relic as PlayerExplorationCard | undefined
    const consumedKeys: string[] = Array.isArray(payload.consumed) ? payload.consumed : fragmentKeys

    if (!relic) {
      throw new Error('Relic restoration did not return a relic card')
    }

    const normalisedRelic: PlayerExplorationCard = {
      ...relic,
      isExhausted: Boolean(relic.isExhausted)
    }

    setExploration((previous) => {
      const remaining = previous.filter((card) => !consumedKeys.includes(card.key))
      return sortByName([...remaining, normalisedRelic])
    })
    removeExplorationDefinition(normalisedRelic)

    const fragmentsFromPayload: ExplorationCardDefinition[] = Array.isArray(payload.fragments)
      ? payload.fragments
      : []
    fragmentsFromPayload.forEach((fragment) => {
      addExplorationDefinitionBack(fragment)
    })

    return normalisedRelic
  }, [addExplorationDefinitionBack, gameName, playerId, removeExplorationDefinition])

  const removeExplorationCard = useCallback(async (card: PlayerExplorationCard) => {
    if (!gameName || !playerId) {
      return
    }
    setExplorationBusyKey(card.key)
    setError(null)
    try {
      const response = await fetch(
        `/api/game/${encodeURIComponent(gameName)}/player/${encodeURIComponent(playerId)}/exploration/${encodeURIComponent(card.key)}`,
        { method: 'DELETE' }
      )
      if (!response.ok) {
        throw new Error('Failed to delete exploration card')
      }
      setExploration((previous) => previous.filter((item) => item.key !== card.key))
      addExplorationDefinitionBack(card)
    } catch (err) {
      console.error(err)
      setError('Unable to delete exploration card. Please try again.')
      throw err
    } finally {
      setExplorationBusyKey(null)
    }
  }, [addExplorationDefinitionBack, gameName, playerId])

  const handleDeleteExploration = async () => {
    if (!pendingExplorationDelete || !gameName || !playerId) {
      return
    }
    try {
      await removeExplorationCard(pendingExplorationDelete)
      setPendingExplorationDelete(null)
    } catch (err) {
      console.error(err)
    }
  }

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
    await handleAddAction(card)
  }, [handleAddAction])

  const actionMenuOptions = useMemo(() => (
    [
      {
        label: 'Draw Action Card',
        onSelect: () => setDrawModalOpen(true),
        disabled: !gameName || !playerId
      },
      {
        label: definitionsLoading.actions ? 'Loading…' : 'Manage Action Cards',
        onSelect: async () => {
          if (!definitionsLoaded.actions) {
            await loadActionDefinitions()
          }
          setManageActionModalOpen(true)
        },
        disabled: !gameName || !playerId || definitionsLoading.actions
      },
      {
        label: definitionsLoading.strategems ? 'Loading…' : 'Manage Strategems',
        onSelect: async () => {
          if (!definitionsLoaded.strategems) {
            await loadStrategemDefinitions()
          }
          setManageStrategemsOpen(true)
        },
        disabled: !gameName || !playerId || definitionsLoading.strategems
      },
      {
        label: definitionsLoading.exploration ? 'Loading…' : 'Manage Exploration Cards',
        onSelect: async () => {
          if (!definitionsLoaded.exploration) {
            await loadExplorationDefinitions()
          }
          setManageExplorationOpen(true)
        },
        disabled: !gameName || !playerId || definitionsLoading.exploration
      },
      {
        label: definitionsLoading.exploration ? 'Loading…' : 'Manage Relics',
        onSelect: async () => {
          if (!definitionsLoaded.exploration) {
            await loadExplorationDefinitions()
          }
          setManageRelicsOpen(true)
        },
        disabled: !gameName || !playerId || definitionsLoading.exploration
      }
    ]
  ), [
    definitionsLoaded.actions,
    definitionsLoaded.exploration,
    definitionsLoaded.strategems,
    definitionsLoading.actions,
    definitionsLoading.exploration,
    definitionsLoading.strategems,
    gameName,
    loadActionDefinitions,
    loadExplorationDefinitions,
    loadStrategemDefinitions,
    playerId
  ])

  return (
    <div className="player-page card-inventory-page">
      <h1>Card Inventory</h1>
      <p className="card-inventory-description">
        Manage miscellaneous cards collected during play. Flip action cards to mark them exhausted and remove cards you no longer hold.
      </p>

      {error ? <div className="card-inventory-error">{error}</div> : null}
      {loading ? <div className="card-inventory-status">Loading cards...</div> : null}

      <section className="card-inventory-section">
        <div className="card-inventory-section-header">
          <h2>Strategems</h2>
          <span className="card-inventory-counter">{strategems.length}</span>
        </div>
        <hr className="card-inventory-divider" />
        {strategems.length > 0 ? (
          <div className="card-inventory-grid card-inventory-grid--strategems">
            {strategems.map((card) => (
              <StrategemCard
                key={card.key}
                card={card}
                onToggle={handleToggleStrategem}
                onRemove={(item) => setPendingStrategemDelete(item)}
                onTradeGoodsChange={handleTradeGoodsChange}
                disabled={strategemBusyKey === card.key}
                tradeGoodsBusy={strategemTradeBusyKey === card.key}
              />
            ))}
          </div>
        ) : (
          <div className="card-inventory-empty">No strategems assigned yet.</div>
        )}
      </section>

      <section className="card-inventory-section">
        <div className="card-inventory-section-header">
          <h2>Actions</h2>
          <span className="card-inventory-counter">{actions.length}</span>
        </div>
        <hr className="card-inventory-divider" />
        {actions.length > 0 ? (
          <div className="card-inventory-grid">
            {actions.map((card) => (
              <ActionCard
                key={card.key}
                card={card}
                onToggle={handleToggleAction}
                onRemove={(item) => setPendingActionDelete(item)}
                disabled={actionBusyKey === card.key}
              />
            ))}
          </div>
        ) : (
          <div className="card-inventory-empty">You have not drawn any action cards yet.</div>
        )}
      </section>

      <section className="card-inventory-section">
        <div className="card-inventory-section-header">
          <h2>Exploration Actions</h2>
          <span className="card-inventory-counter">{explorationActions.length}</span>
        </div>
        <hr className="card-inventory-divider" />
        {explorationActions.length > 0 ? (
          <div className="card-inventory-grid">
            {explorationActions.map((card) => (
              <ExplorationCard
                key={card.key}
                card={card}
                onToggle={handleToggleExploration}
                onRemove={(item) => setPendingExplorationDelete(item)}
                onSecondaryAction={(item) => setPendingExplorationDelete(item)}
                secondaryActionLabel="Hold or right-click to remove"
                disabled={explorationBusyKey === card.key}
              />
            ))}
          </div>
        ) : (
          <div className="card-inventory-empty">No exploration action cards in your inventory.</div>
        )}
      </section>

      <section className="card-inventory-section">
        <div className="card-inventory-section-header">
          <h2>Relic Fragments</h2>
          <span className="card-inventory-counter">{relicFragments.length}</span>
        </div>
        <hr className="card-inventory-divider" />
        {relicFragments.length > 0 ? (
          <div className="card-inventory-grid">
            {relicFragments.map((card) => (
              <ExplorationCard
                key={card.key}
                card={card}
                onSecondaryAction={(item) => {
                  setRestoreInitialFragment(item)
                  setRestoreModalOpen(true)
                }}
                secondaryActionLabel="Hold or right-click to restore"
                showRemoveButton
                onRemove={(item) => setPendingExplorationDelete(item)}
                disabled={explorationBusyKey === card.key}
              />
            ))}
          </div>
        ) : (
          <div className="card-inventory-empty">No relic fragments discovered yet.</div>
        )}
      </section>

      <section className="card-inventory-section">
        <div className="card-inventory-section-header">
          <h2>Relics</h2>
          <span className="card-inventory-counter">{relics.length}</span>
        </div>
        <hr className="card-inventory-divider" />
        {relics.length > 0 ? (
          <div className="card-inventory-grid">
            {relics.map((card) => {
              const isActionRelic = card.subtype === 'action'
              const isAttachRelic = card.subtype === 'attach'
              const cardDisabled =
                explorationBusyKey === card.key ||
                (relicAttachmentBusy && relicAttachmentTarget?.key === card.key)
              return (
                <ExplorationCard
                  key={card.key}
                  card={card}
                  onToggle={isActionRelic ? handleToggleExploration : undefined}
                  onPrimaryAction={isAttachRelic ? handleOpenRelicAttachment : undefined}
                  onSecondaryAction={(item) => setPendingExplorationDelete(item)}
                  onRemove={(item) => setPendingExplorationDelete(item)}
                  secondaryActionLabel={isAttachRelic ? 'Tap to attach · hold to remove' : 'Hold or right-click to remove'}
                  disabled={cardDisabled}
                />
              )
            })}
          </div>
        ) : (
          <div className="card-inventory-empty">No relics restored yet.</div>
        )}
      </section>

      <PlayerActionMenu options={actionMenuOptions} ariaLabel="Card inventory actions" />

      <CardDrawModal
        isOpen={drawModalOpen}
        title="Draw Action Card"
        drawCard={drawActionCard}
        onConfirm={confirmDrawnAction}
        onDismiss={() => setDrawModalOpen(false)}
        renderCard={(card) => (
          <img src={resolveAssetPath(card.asset)} alt={`${card.name} preview`} />
        )}
      />

      <ManageActionCardsModal
        isOpen={manageActionModalOpen}
        onClose={() => setManageActionModalOpen(false)}
        owned={actions}
        available={actionDefinitions}
        onAdd={async (card) => {
          try {
            await handleAddAction(card)
          } catch (err) {
            console.error(err)
          }
        }}
        onRemove={async (card) => {
          try {
            await removeActionCard(card)
          } catch (err) {
            console.error(err)
          }
        }}
        busyKey={actionBusyKey}
      />

      <ManageStrategemsModal
        isOpen={manageStrategemsOpen}
        onClose={() => setManageStrategemsOpen(false)}
        owned={strategems}
        available={strategemDefinitions}
        onAdd={async (card) => {
          try {
            await handleAddStrategem(card)
          } catch (err) {
            console.error(err)
          }
        }}
        onRemove={async (card) => {
          try {
            await removeStrategemCard(card)
          } catch (err) {
            console.error(err)
          }
        }}
        busyKey={strategemBusyKey}
      />

      <ManageExplorationCardsModal
        isOpen={manageExplorationOpen}
        title="Manage Exploration Cards"
        onClose={() => setManageExplorationOpen(false)}
        owned={manageableExploration}
        available={explorationDefinitions}
        onAdd={async (card) => {
          try {
            await handleAddExploration(card)
          } catch (err) {
            console.error(err)
          }
        }}
        onRemove={async (card) => {
          try {
            await removeExplorationCard(card)
          } catch (err) {
            console.error(err)
          }
        }}
        busyKey={explorationBusyKey}
        subtypes={['action', 'relic_fragment']}
      />

      <ManageExplorationCardsModal
        isOpen={manageRelicsOpen}
        title="Manage Relics"
        onClose={() => setManageRelicsOpen(false)}
        owned={relics}
        available={availableRelicDefinitions}
        onAdd={async (card) => {
          try {
            await handleAddExploration(card)
          } catch (err) {
            console.error(err)
          }
        }}
        onRemove={async (card) => {
          try {
            await removeExplorationCard(card)
          } catch (err) {
            console.error(err)
          }
        }}
        busyKey={explorationBusyKey}
        subtypes={['relic']}
      />

      <RestoreRelicModal
        isOpen={restoreModalOpen}
        fragments={relicFragments}
        initialFragment={restoreInitialFragment}
        onClose={() => {
          setRestoreModalOpen(false)
          setRestoreInitialFragment(null)
        }}
        onRestore={handleRestoreRelic}
      />

      <RelicAttachmentModal
        relic={relicAttachmentTarget}
        planets={playerPlanets}
        isOpen={Boolean(relicAttachmentTarget)}
        loading={relicAttachmentLoading}
        busy={relicAttachmentBusy}
        error={relicAttachmentError}
        onClose={handleCloseRelicAttachment}
        onAttach={handleAttachRelicToPlanet}
      />

      {pendingStrategemDelete ? (
        <div className="planet-action-dialog" role="dialog" aria-modal="true">
          <div className="planet-action-content">
            <h3>Remove Strategem</h3>
            <p>Remove {pendingStrategemDelete.name} from your board?</p>
            <div className="planet-action-buttons">
              <button
                type="button"
                className="danger"
                onClick={handleDeleteStrategem}
                disabled={strategemBusyKey === pendingStrategemDelete.key}
              >
                Delete
              </button>
              <button type="button" className="secondary" onClick={() => setPendingStrategemDelete(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingActionDelete ? (
        <div className="planet-action-dialog" role="dialog" aria-modal="true">
          <div className="planet-action-content">
            <h3>Remove Action Card</h3>
            <p>Remove {pendingActionDelete.name} from your inventory?</p>
            <div className="planet-action-buttons">
              <button
                type="button"
                className="danger"
                onClick={handleDeleteAction}
                disabled={actionBusyKey === pendingActionDelete.key}
              >
                Delete
              </button>
              <button type="button" className="secondary" onClick={() => setPendingActionDelete(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingExplorationDelete ? (
        <div className="planet-action-dialog" role="dialog" aria-modal="true">
          <div className="planet-action-content">
            <h3>Remove Exploration Card</h3>
            <p>Remove {pendingExplorationDelete.name} from your inventory?</p>
            <div className="planet-action-buttons">
              <button
                type="button"
                className="danger"
                onClick={handleDeleteExploration}
                disabled={explorationBusyKey === pendingExplorationDelete.key}
              >
                Delete
              </button>
              <button type="button" className="secondary" onClick={() => setPendingExplorationDelete(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default CardInventory
