import { cn } from '@/lib/utils';
import { ImageIcon } from 'lucide-react';

interface ImagePlaceholderProps {
  slot: string;
  className?: string;
  aspect?: string;
  dark?: boolean;
}

export function ImagePlaceholder({ slot, className, aspect = 'aspect-[4/3]', dark = false }: ImagePlaceholderProps) {
  return (
    <div className={cn(
      aspect,
      'flex flex-col items-center justify-center gap-3 border-2 border-dashed',
      dark ? 'bg-neutral-900 border-gold/40 text-gold' : 'bg-ivory border-gold/50 text-black',
      className
    )}>
      <ImageIcon className={cn('w-10 h-10', dark ? 'text-gold/60' : 'text-gold')} />
      <p className={cn('text-xs font-bold uppercase tracking-widest text-center px-4 max-w-[200px]', dark ? 'text-gold/80' : 'text-black/70')}>
        {slot}
      </p>
      <p className={cn('text-[10px] text-center px-4', dark ? 'text-gray-500' : 'text-warm-grey')}>
        Send your image for this slot
      </p>
    </div>
  );
}
