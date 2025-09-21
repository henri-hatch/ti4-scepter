import { useMemo } from 'react'
import Card from './Card'
import type { PlayerTechnology } from '../../types/technology'
import '../../styles/Technology.css'
import { resolveAssetPath } from '../../utils/assets'
import { formatFactionLabel } from '../../utils/technology'

type TechnologyCardProps = {
  technology: PlayerTechnology
  onPrimaryAction: () => void
  onSecondaryAction: () => void
}

function TechnologyCard({ technology, onPrimaryAction, onSecondaryAction }: TechnologyCardProps) {
  const faceImage = useMemo(() => resolveAssetPath(technology.asset), [technology.asset])

  return (
    <div className="technology-card-wrapper">
      <Card
        frontImage={faceImage}
        backImage={faceImage}
        alt={`${technology.name} technology card`}
        isFlipped={technology.isExhausted}
        onPrimaryAction={onPrimaryAction}
        onSecondaryAction={onSecondaryAction}
        className="technology-card card--flip-vertical"
      />
      <div className="technology-card-label">{technology.name}</div>
      <div className="technology-card-meta">
        <span className="technology-card-tier">Tier {technology.tier}</span>
        {technology.faction !== 'none' ? (
          <span className="technology-card-faction">{formatFactionLabel(technology.faction)}</span>
        ) : null}
      </div>
    </div>
  )
}

export default TechnologyCard
