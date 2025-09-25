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
  size: number
  borderRadius: number
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
  war_sun: {
    key: 'war_sun',
    label: 'War Sun',
    top: 26,
    left: 1.5,
    width: 23,
    height: 23,
    size: 135,
    borderRadius: 5
  },
  cruiser: {
    key: 'cruiser',
    label: 'Cruiser',
    top: 26,
    left: 26,
    width: 23,
    height: 23,
    size: 135,
    borderRadius: 5
  },
  dreadnought: {
    key: 'dreadnought',
    label: 'Dreadnought',
    top: 51,
    left: 1.5,
    width: 23,
    height: 23,
    size: 135,
    borderRadius: 5
  },
  carrier: {
    key: 'carrier',
    label: 'Carrier',
    top: 76,
    left: 1.5,
    width: 23,
    height: 23,
    size: 135,
    borderRadius: 5
  },
  destroyer: {
    key: 'destroyer',
    label: 'Destroyer',
    top: 51,
    left: 26,
    width: 23,
    height: 23,
    size: 135,
    borderRadius: 5
  },
  fighter: {
    key: 'fighter',
    label: 'Fighter',
    top: 76,
    left: 26,
    width: 23,
    height: 23,
    size: 135,
    borderRadius: 5
  },
  pds: {
    key: 'pds',
    label: 'PDS',
    top: 51,
    left: 51,
    width: 23,
    height: 23,
    size: 135,
    borderRadius: 5
  },
  infantry: {
    key: 'infantry',
    label: 'Infantry',
    top: 76,
    left: 51,
    width: 23,
    height: 23,
    size: 135,
    borderRadius: 5
  },
  space_dock: {
    key: 'space_dock',
    label: 'Space Dock',
    top: 76,
    left: 75.7,
    width: 23,
    height: 23,
    size: 135,
    borderRadius: 5
  }
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
