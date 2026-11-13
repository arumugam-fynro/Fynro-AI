import { Icon } from './Icon';
import type { Attachment } from '@/lib/types';

export function Chip({ a, onRemove }: { a: Attachment; onRemove?: () => void }) {
  const thumb = a.kind === 'image' && a.url;
  return (
    <div className="chip">
      <span className="th" style={thumb ? { backgroundImage: `url(${a.url})` } : undefined}>
        {!thumb && <Icon n={a.kind === 'image' ? 'image' : 'file'} />}
      </span>
      <span className="nm"><b>{a.name}</b><i>{a.meta}</i></span>
      {onRemove && <button className="x" title="Remove" aria-label={`Remove ${a.name}`} onClick={onRemove}><Icon n="x" size="s" /></button>}
    </div>
  );
}
