import { Download, Share2, Undo2 } from 'lucide-react'

export function ProjectHeader() {
  return (
    <header className="topbar">
      <div className="top-actions"><button className="icon-button" title="Undo"><Undo2 size={18} /></button><button className="button secondary"><Share2 size={16} /> Share</button><button className="button primary"><Download size={16} /> Export guide</button></div>
    </header>
  )
}
