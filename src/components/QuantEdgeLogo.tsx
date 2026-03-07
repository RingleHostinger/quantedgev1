import Image from 'next/image'
import Link from 'next/link'

interface QuantEdgeLogoProps {
  /** 'full' = logo image + text fallback | 'icon' = icon portion only | 'auto' = full on desktop, icon on mobile */
  variant?: 'full' | 'icon' | 'auto'
  /** Height in px — width scales proportionally */
  height?: number
  /** Wrap in a Link to /dashboard */
  linked?: boolean
  /** href override (default: /dashboard) */
  href?: string
  className?: string
}

/**
 * QuantEdge brand logo component.
 * Uses the actual logo PNG from /public/quantedge-logo.png.
 * Aspect ratio of the full logo image is ~2.19:1 (1316×600).
 */
export function QuantEdgeLogo({
  variant = 'full',
  height = 40,
  linked = true,
  href = '/dashboard',
  className = '',
}: QuantEdgeLogoProps) {
  // Full logo: 1316×600 → aspect 2.193
  const fullWidth = Math.round(height * 2.193)
  // Icon portion only (left ~40% of image): 1316×600 crop ~520×400 → aspect 1.3
  const iconWidth = Math.round(height * 1.3)

  const fullLogo = (
    <Image
      src="/quantedge-logo.png"
      alt="QuantEdge"
      width={fullWidth}
      height={height}
      priority
      className="object-contain"
      style={{ height, width: 'auto', maxWidth: fullWidth }}
    />
  )

  const iconLogo = (
    // Show only the left icon portion by clipping with overflow hidden
    <div
      style={{
        width: iconWidth,
        height: height,
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      <Image
        src="/quantedge-logo.png"
        alt="QuantEdge"
        width={fullWidth}
        height={height}
        priority
        className="object-contain object-left"
        style={{
          height,
          width: 'auto',
          maxWidth: 'none',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      />
    </div>
  )

  const autoLogo = (
    <>
      {/* Full logo on md+ screens */}
      <span className="hidden sm:inline-flex items-center">
        {fullLogo}
      </span>
      {/* Icon only on small screens */}
      <span className="sm:hidden inline-flex items-center">
        {iconLogo}
      </span>
    </>
  )

  const content = (
    <span className={`inline-flex items-center ${className}`}>
      {variant === 'full' && fullLogo}
      {variant === 'icon' && iconLogo}
      {variant === 'auto' && autoLogo}
    </span>
  )

  if (!linked) return content

  return (
    <Link href={href} className="inline-flex items-center focus:outline-none">
      {content}
    </Link>
  )
}
