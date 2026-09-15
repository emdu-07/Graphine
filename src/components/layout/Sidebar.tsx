import { Aperture, Grid2X2, HelpCircle, Layers3, Moon, MousePointer2, Sun } from 'lucide-react'

interface SidebarProps {
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}

export function Sidebar({ theme, onToggleTheme }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand-mark"><Aperture size={25} /><span>graphine</span></div>
      <nav className="side-nav" aria-label="Main navigation">
        <button className="nav-button active" aria-label="Motion Canvas" title="Motion Canvas"><MousePointer2 size={19} /><span className="nav-label">Motion</span></button>
        <button className="nav-button" aria-label="Layers"><Layers3 size={19} /><span className="nav-label">Layers</span></button>
        <button className="nav-button" aria-label="Projects"><Grid2X2 size={19} /><span className="nav-label">Projects</span></button>
      </nav>
      <div className="sidebar-bottom">
        <button className="nav-button theme-toggle" onClick={() => onToggleTheme()} aria-pressed={theme === 'light'} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
          {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}<span className="nav-label">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>
        <button className="nav-button"><HelpCircle size={19} /><span className="nav-label">Help</span></button>
        <button className="account-button"><span className="avatar">EM</span><span className="nav-label">Account</span></button>
      </div>
    </aside>
  )
}
