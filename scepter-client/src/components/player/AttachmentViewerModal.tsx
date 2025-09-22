import { resolveAssetPath } from '../../utils/assets'
import type { PlanetAttachment } from '../../types/exploration'
import '../../styles/AttachmentViewerModal.css'

type AttachmentViewerModalProps = {
  attachment: PlanetAttachment | null
  onClose: () => void
}

function AttachmentViewerModal({ attachment, onClose }: AttachmentViewerModalProps) {
  if (!attachment) {
    return null
  }

  const asset = resolveAssetPath(attachment.asset)

  return (
    <div className="attachment-viewer-backdrop" role="dialog" aria-modal="true">
      <div className="attachment-viewer">
        <button type="button" className="attachment-viewer-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <div className="attachment-viewer-card">
          <img src={asset} alt={`${attachment.name} attachment`} />
        </div>
        <div className="attachment-viewer-meta">
          <h3>{attachment.name}</h3>
          <span>{attachment.type}</span>
        </div>
      </div>
    </div>
  )
}

export default AttachmentViewerModal
