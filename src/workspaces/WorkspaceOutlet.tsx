import type { ReactNode } from 'react'
import type { WorkspaceId } from './types'

interface WorkspaceOutletProps {
  workspaceId: WorkspaceId
  children: ReactNode
}

export function WorkspaceOutlet({ workspaceId, children }: WorkspaceOutletProps) {
  switch (workspaceId) {
    case 'motion':
      return children
    case 'reference':
      return null
  }
}
