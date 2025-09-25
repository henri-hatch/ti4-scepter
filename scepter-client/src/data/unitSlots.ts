export type UnitSlotKey =
  | 'war_sun'
  | 'cruiser'
  | 'dreadnought'
  | 'carrier'
  | 'destroyer'
  | 'fighter'
  | 'pds'
  | 'infantry'
  | 'space_dock'

export interface UnitSlotPosition {
  key: UnitSlotKey
  label: string
  top: number
  left: number
  width: number
  height: number
}

export const UNIT_SLOT_ORDER: UnitSlotKey[] = [
  'war_sun',
  'cruiser',
  'dreadnought',
  'carrier',
  'destroyer',
  'fighter',
  'pds',
  'infantry',
  'space_dock'
]

export const UNIT_SLOT_POSITIONS: Record<UnitSlotKey, UnitSlotPosition> = {
  war_sun: { key: 'war_sun', label: 'War Sun', top: 30, left: 1, width: 24, height: 16 },
  cruiser: { key: 'cruiser', label: 'Cruiser', top: 30, left: 26, width: 24, height: 16 },
  dreadnought: { key: 'dreadnought', label: 'Dreadnought', top: 55, left: 1, width: 24, height: 16 },
  carrier: { key: 'carrier', label: 'Carrier', top: 80, left: 1, width: 24, height: 16 },
  destroyer: { key: 'destroyer', label: 'Destroyer', top: 55, left: 26, width: 24, height: 16 },
  fighter: { key: 'fighter', label: 'Fighter', top: 80, left: 26, width: 24, height: 16 },
  pds: { key: 'pds', label: 'PDS', top: 55, left: 50.5, width: 24, height: 16 },
  infantry: { key: 'infantry', label: 'Infantry', top: 80, left: 51, width: 24, height: 16 },
  space_dock: { key: 'space_dock', label: 'Space Dock', top: 80, left: 75, width: 24, height: 16 }
}

export const UNIT_SLOT_DEFAULT_TECH: Record<UnitSlotKey, string> = {
  war_sun: 'war_sun',
  cruiser: 'cruiser_ii',
  dreadnought: 'dreadnought_ii',
  carrier: 'carrier_ii',
  destroyer: 'destroyer_ii',
  fighter: 'fighter_ii',
  pds: 'pds_ii',
  infantry: 'infantry_ii',
  space_dock: 'space_dock_ii'
}

export const FACTION_UNIT_OVERRIDES: Record<string, Partial<Record<UnitSlotKey, string>>> = {
  mahact_gene_sorcerers: {
    infantry: 'crimson_legionnaire_ii'
  }
}
