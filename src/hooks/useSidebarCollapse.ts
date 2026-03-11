'use client'

import { createContext, useContext } from 'react'

interface SidebarCollapseContextValue {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}

export const SidebarCollapseContext = createContext<SidebarCollapseContextValue>({
  collapsed: false,
  setCollapsed: () => {},
})

export function useSidebarCollapse() {
  return useContext(SidebarCollapseContext)
}
