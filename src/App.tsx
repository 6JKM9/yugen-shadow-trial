import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import './App.css'
import Gameplay from './game/Gameplay'

const assets = {
  logo: '/assets/01_yugen_logo_main.png',
  hero: '/assets/02_yugen_main_hero_character_sheet.png',
  menuBackground: '/assets/03_yugen_main_menu_background.png',
  bossPortrait: '/assets/04_akuma_no_kage_boss_portrait.png',
  boss: '/assets/05_akuma_no_kage_boss_full_body.png',
  soldier: '/assets/06_shadow_soldier_single.png',
}

type Screen = 'menu' | 'game'
type Modal = 'settings' | 'credits' | null

const particleCount = 34
const menuEmberCount = 22
const smokeCount = 8

function App() {
  const [introComplete, setIntroComplete] = useState(false)
  const [screen, setScreen] = useState<Screen>('menu')
  const [modal, setModal] = useState<Modal>(null)
  const [musicEnabled, setMusicEnabled] = useState(true)
  const [sfxEnabled, setSfxEnabled] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => setIntroComplete(true), 7000)
    return () => window.clearTimeout(timer)
  }, [])

  const openFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => undefined)
      return
    }

    document.exitFullscreen().catch(() => undefined)
  }

  return (
    <main className="yugen-app">
      {!introComplete && <OpeningCinematic />}

      {screen === 'game' ? (
        <Gameplay onBackToMenu={() => setScreen('menu')} />
      ) : (
        <MainMenu
          onNewGame={() => setScreen('game')}
          onSettings={() => setModal('settings')}
          onCredits={() => setModal('credits')}
        />
      )}

      {modal === 'settings' && (
        <SettingsModal
          musicEnabled={musicEnabled}
          sfxEnabled={sfxEnabled}
          onToggleMusic={() => setMusicEnabled((enabled) => !enabled)}
          onToggleSfx={() => setSfxEnabled((enabled) => !enabled)}
          onFullscreen={openFullscreen}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'credits' && <CreditsModal onClose={() => setModal(null)} />}
    </main>
  )
}

function OpeningCinematic() {
  return (
    <section className="opening-cinematic" aria-label="Yugen opening cinematic">
      <FilmGrain />
      <div className="opening-red-glow" />
      <div className="opening-smoke opening-smoke-left">
        {Array.from({ length: smokeCount }).map((_, index) => (
          <span
            key={`left-smoke-${index}`}
            style={
              {
                '--top': `${18 + index * 8}%`,
                '--smoke-width': `${80 + index * 13}px`,
                '--smoke-height': `${28 + index * 5}px`,
                '--delay': `${index * 0.11}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="opening-smoke opening-smoke-right">
        {Array.from({ length: smokeCount }).map((_, index) => (
          <span
            key={`right-smoke-${index}`}
            style={
              {
                '--top': `${18 + index * 8}%`,
                '--smoke-width': `${80 + index * 13}px`,
                '--smoke-height': `${28 + index * 5}px`,
                '--delay': `${index * 0.11}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="opening-logo-wrap">
        <div className="opening-logo-glow" />
        <img className="opening-logo" src={assets.logo} alt="Yugen" />
      </div>
      <div className="opening-slash" />
      <div className="opening-impact" />
      <RedParticles className="opening-particles" />
    </section>
  )
}

type MainMenuProps = {
  onNewGame: () => void
  onSettings: () => void
  onCredits: () => void
}

function MainMenu({ onNewGame, onSettings, onCredits }: MainMenuProps) {
  return (
    <section className="main-menu scene-fade-in" aria-label="Main menu">
      <SceneAtmosphere />
      <img className="menu-boss" src={assets.boss} alt="" aria-hidden="true" />
      <img className="menu-soldier menu-soldier-left" src={assets.soldier} alt="" aria-hidden="true" />
      <img className="menu-soldier menu-soldier-right" src={assets.soldier} alt="" aria-hidden="true" />

      <div className="menu-layout">
        <aside className="menu-panel" aria-label="Yugen Shadow Trial menu">
          <div className="menu-red-aura" aria-hidden="true" />
          <MenuAreaParticles />
          <img className="menu-logo" src={assets.logo} alt="Yugen" />
          <p className="menu-subtitle">SHADOW TRIAL</p>

          <nav className="menu-actions" aria-label="Game actions">
            <MenuButton onClick={onNewGame}>NEW GAME</MenuButton>
            <MenuButton disabled>CONTINUE</MenuButton>
            <MenuButton onClick={onSettings}>SETTINGS</MenuButton>
            <MenuButton onClick={onCredits}>CREDITS</MenuButton>
          </nav>
        </aside>

        <figure className="hero-stage" aria-hidden="true">
          <div className="hero-red-halo" />
          <img className="hero-character" src={assets.hero} alt="" />
        </figure>
      </div>
      <p className="creator-credit">Created by BossWhatsNew</p>
    </section>
  )
}

type MenuButtonProps = {
  children: string
  disabled?: boolean
  onClick?: () => void
}

function MenuButton({ children, disabled = false, onClick }: MenuButtonProps) {
  return (
    <button className="menu-button sound-ready" disabled={disabled} onClick={onClick} type="button">
      <span className="button-slash" aria-hidden="true" />
      <span>{children}</span>
    </button>
  )
}

type SettingsModalProps = {
  musicEnabled: boolean
  sfxEnabled: boolean
  onToggleMusic: () => void
  onToggleSfx: () => void
  onFullscreen: () => void
  onClose: () => void
}

function SettingsModal({
  musicEnabled,
  sfxEnabled,
  onToggleMusic,
  onToggleSfx,
  onFullscreen,
  onClose,
}: SettingsModalProps) {
  return (
    <ModalShell title="Settings" onClose={onClose}>
      <ToggleRow label="Music" enabled={musicEnabled} onClick={onToggleMusic} />
      <ToggleRow label="SFX" enabled={sfxEnabled} onClick={onToggleSfx} />
      <button className="modal-action sound-ready" type="button" onClick={onFullscreen}>
        FULLSCREEN
      </button>
      <button className="modal-action modal-action-secondary sound-ready" type="button" onClick={onClose}>
        BACK
      </button>
    </ModalShell>
  )
}

type CreditsModalProps = {
  onClose: () => void
}

function CreditsModal({ onClose }: CreditsModalProps) {
  return (
    <ModalShell title="Credits" onClose={onClose}>
      <div className="credits-copy">
        <strong>YUGEN: Shadow Trial</strong>
        <span>Created by BossWhatsNew</span>
        <span>Opening/Menu Prototype</span>
      </div>
      <button className="modal-action modal-action-secondary sound-ready" type="button" onClick={onClose}>
        BACK
      </button>
    </ModalShell>
  )
}

type ModalShellProps = {
  children: ReactNode
  title: string
  onClose: () => void
}

function ModalShell({ children, title, onClose }: ModalShellProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button className="modal-close sound-ready" type="button" onClick={onClose} aria-label="Close">
            X
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  )
}

type ToggleRowProps = {
  label: string
  enabled: boolean
  onClick: () => void
}

function ToggleRow({ label, enabled, onClick }: ToggleRowProps) {
  return (
    <button className="toggle-row sound-ready" type="button" onClick={onClick} aria-pressed={enabled}>
      <span>{label}</span>
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
      <span className="toggle-status">{enabled ? 'ON' : 'OFF'}</span>
    </button>
  )
}

function SceneAtmosphere() {
  return (
    <>
      <div className="menu-background" />
      <div className="dark-overlay" />
      <div className="fog-layer fog-layer-one" />
      <div className="fog-layer fog-layer-two" />
      <RedParticles className="menu-particles" />
      <div className="vignette" />
      <FilmGrain />
    </>
  )
}

type RedParticlesProps = {
  className: string
}

function RedParticles({ className }: RedParticlesProps) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: particleCount }).map((_, index) => (
        <span
          key={`${className}-${index}`}
          style={
            {
              '--index': index,
              '--x': `${(index * 29) % 100}%`,
              '--delay': `${(index % 10) * -0.7}s`,
              '--duration': `${7 + (index % 8)}s`,
              '--size': `${2 + (index % 4)}px`,
              '--drift': `${(index - 17) * 4}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

function MenuAreaParticles() {
  return (
    <div className="menu-area-particles" aria-hidden="true">
      {Array.from({ length: menuEmberCount }).map((_, index) => (
        <span
          key={`menu-ember-${index}`}
          style={
            {
              '--x': `${6 + ((index * 17) % 86)}%`,
              '--y': `${14 + ((index * 23) % 78)}%`,
              '--delay': `${(index % 9) * -0.55}s`,
              '--duration': `${4.5 + (index % 6) * 0.55}s`,
              '--size': `${2 + (index % 3)}px`,
              '--drift': `${(index % 2 === 0 ? 1 : -1) * (10 + index)}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

function FilmGrain() {
  return <div className="film-grain" aria-hidden="true" />
}

export default App
