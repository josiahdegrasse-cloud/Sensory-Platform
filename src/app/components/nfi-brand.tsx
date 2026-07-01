import { cn } from './ui/utils';
import { NFI_LOGO_URL } from '../lib/nfi-brand';

type NfiBrandMarkProps = {
  size?: number;
  className?: string;
  monochrome?: boolean;
};

export function NfiBrandMark({ size = 40, className, monochrome = false }: NfiBrandMarkProps) {
  return (
    <img
      src={NFI_LOGO_URL}
      alt="NFI"
      width={size}
      height={size}
      className={cn('shrink-0 rounded-[26%] object-cover', className)}
      style={{
        width: size,
        height: size,
        filter: monochrome ? 'grayscale(1) contrast(10)' : undefined,
        transform: monochrome ? 'scale(1.18)' : undefined,
      }}
    />
  );
}

type NfiBrandLockupProps = {
  markSize?: number;
  className?: string;
  textClassName?: string;
  monochromeMark?: boolean;
  muted?: boolean;
};

export function NfiBrandLockup({
  markSize = 40,
  className,
  textClassName,
  monochromeMark = false,
  muted = false,
}: NfiBrandLockupProps) {
  return (
    <div className={cn('inline-flex items-center gap-3', className)}>
      <NfiBrandMark size={markSize} monochrome={monochromeMark} />
      <div
        className={cn(
          'leading-[1.05] tracking-tight',
          muted ? 'text-slate-700' : 'text-slate-900',
          textClassName,
        )}
      >
        <div className="text-sm font-semibold">new</div>
        <div className="text-sm font-semibold">food</div>
        <div className="text-sm font-semibold">innovation</div>
      </div>
    </div>
  );
}

type TenantOrNfiLogoProps = {
  logoUrl?: string | null;
  organizationName?: string | null;
  className?: string;
  logoClassName?: string;
  textClassName?: string;
  markSize?: number;
  monochromeMark?: boolean;
};

export function TenantOrNfiLogo({
  logoUrl,
  organizationName,
  className,
  logoClassName,
  textClassName,
  markSize = 36,
  monochromeMark = false,
}: TenantOrNfiLogoProps) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={organizationName ?? 'Logo'}
        className={cn('block h-9 max-w-40 object-contain', logoClassName)}
      />
    );
  }

  return (
    <NfiBrandLockup
      markSize={markSize}
      className={className}
      textClassName={textClassName}
      monochromeMark={monochromeMark}
    />
  );
}
