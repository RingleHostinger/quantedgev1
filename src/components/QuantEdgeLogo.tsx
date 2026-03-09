import Image from 'next/image'
import Link from 'next/link'

interface QuantEdgeLogoProps {
  /** 'full' = full logo | 'icon' = icon portion only | 'auto' = full on sm+, icon on xs */
  variant?: 'full' | 'icon' | 'auto'
  /**
   * Desired rendered width in px. Height is always auto to preserve aspect ratio.
   * Full logo native size: 1316×600 (aspect ~2.193:1)
   * Icon crop (left ~40%): ~520×400 (aspect ~1.3:1)
   */
  width?: number
  /** Legacy height prop — ignored when width is set, kept for backwards compat */
  height?: number
  /** Wrap in a Link */
  linked?: boolean
  /** href override (default: /dashboard) */
  href?: string
  className?: string
}

/**
 * QuantEdge brand logo component.
 * Specify `width` in px; height is always auto so the aspect ratio is never distorted.
 * Native image: /public/quantedge-logo.png — 1316×600px (~2.193:1 aspect ratio).
 */
export function QuantEdgeLogo({
  variant = 'full',
  width,
  height,
  linked = true,
  href = '/dashboard',
  className = '',
}: QuantEdgeLogoProps) {
  // Resolve the rendered width to use.
  // If `width` is given, use it directly.
  // Otherwise fall back to deriving from legacy `height` prop (height * aspect ratio).
  const ASPECT_FULL = 2.193   // 1316 / 600
  const ASPECT_ICON = 1.3     // icon crop ~520 / 400

  const resolvedFullWidth = width ?? (height ? Math.round(height * ASPECT_FULL) : 200)
  const resolvedIconWidth = width ?? (height ? Math.round(height * ASPECT_ICON) : 60)

  // Derive native heights for next/image's required width+height props (only used as hints).
  const fullNativeHeight = Math.round(resolvedFullWidth / ASPECT_FULL)
  const iconNativeHeight = Math.round(resolvedIconWidth / ASPECT_ICON)

  const logoFilter = 'drop-shadow(0 0 6px rgba(0,255,180,0.35)) contrast(1.05) brightness(1.05)'

  const fullLogo = (
    <Image
      src="/quantedge-logo.png"
      alt="QuantEdge"
      width={resolvedFullWidth}
      height={fullNativeHeight}
      priority
      style={{
        width: resolvedFullWidth,
        height: 'auto',
        display: 'block',
        objectFit: 'contain',
        flexShrink: 0,
        filter: logoFilter,
      }}
    />
  )

  const iconLogo = (
    <div
      style={{
        width: resolvedIconWidth,
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
        lineHeight: 0,
      }}
    >
      <Image
        src="/quantedge-logo.png"
        alt="QuantEdge"
        width={resolvedFullWidth}
        height={fullNativeHeight}
        priority
        style={{
          width: resolvedFullWidth,
          height: 'auto',
          objectFit: 'contain',
          objectPosition: 'left',
          position: 'relative',
          filter: logoFilter,
        }}
      />
    </div>
  )

  const autoLogo = (
    <>
      {/* Full logo on sm+ screens */}
      <span className="hidden sm:inline-flex items-center">
        {fullLogo}
      </span>
      {/* Icon only on xs screens */}
      <span className="sm:hidden inline-flex items-center">
        {iconLogo}
      </span>
    </>
  )

  const hoverStyle: React.CSSProperties = {
    transition: 'transform 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
  }

  const content = (
    <span
      className={`inline-flex items-center ${className}`}
      style={!linked ? hoverStyle : undefined}
      onMouseEnter={!linked ? (e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.03)' } : undefined}
      onMouseLeave={!linked ? (e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' } : undefined}
    >
      {variant === 'full' && fullLogo}
      {variant === 'icon' && iconLogo}
      {variant === 'auto' && autoLogo}
    </span>
  )

  if (!linked) return content

  return (
    <Link
      href={href}
      className="inline-flex items-center focus:outline-none"
      style={hoverStyle}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)' }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      {content}
    </Link>
  )
}
