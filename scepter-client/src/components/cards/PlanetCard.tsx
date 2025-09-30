import { useMemo } from 'react'
import Card from './Card'
import type { PlayerPlanet } from '../../types/planets'
import '../../styles/PlanetCard.css'
import { resolveAssetPath } from '../../utils/assets'
import { formatIdentifier } from '../../utils/technology'

type PlanetCardProps = {
  planet: PlayerPlanet
  onPrimaryAction: () => void
  onSecondaryAction: () => void
}

function PlanetCard({ planet, onPrimaryAction, onSecondaryAction }: PlanetCardProps) {
  const frontImage = useMemo(() => resolveAssetPath(planet.assetFront), [planet.assetFront])
  const backImage = useMemo(() => resolveAssetPath(planet.assetBack), [planet.assetBack])

  return (
    <div className="planet-card-wrapper">
      <Card
        frontImage={frontImage}
        backImage={backImage}
        alt={`${planet.name} card`}
        isFlipped={planet.isExhausted}
        onPrimaryAction={onPrimaryAction}
        onSecondaryAction={onSecondaryAction}
        className="planet-card"
      />
      <div className="planet-card-meta">
        <div className="planet-card-name">{planet.name}</div>
        <div className="planet-card-stats">
          <span className="planet-card-type">{planet.type}</span>
          <span className="planet-card-resource">
            {planet.resources}R / {planet.influence}I
          </span>
        </div>
        {planet.techSpecialty ? (
          <div className="planet-card-tech">{planet.techSpecialty}</div>
        ) : (
          <div className="planet-card-tech planet-card-tech--none">No Tech Specialty</div>
        )}
        {planet.legendary ? (
          <div className="planet-card-legendary">
            <span className="planet-card-legendary-label">Legendary</span>
            {planet.legendaryAbility ? (
              <span className="planet-card-legendary-ability">
                {formatIdentifier(planet.legendaryAbility)}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default PlanetCard
