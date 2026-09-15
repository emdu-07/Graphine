import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ThemeContext } from './ThemeContext'
import { Sidebar } from './Sidebar'
import { ProjectHeader } from './ProjectHeader'

export function AppShell({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const savedTheme = window.localStorage.getItem('graphine-theme')
    if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('graphine-theme', theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={theme}>
    <div className="app-shell">
      <Sidebar theme={theme} onToggleTheme={() => setTheme(current => current === 'dark' ? 'light' : 'dark')} />
      <main className="workspace">
        <ProjectHeader />
        {children}
      </main>
    </div>
    </ThemeContext.Provider>
  )
}
