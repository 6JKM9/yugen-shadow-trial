import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import './Gameplay.css'

const assets = {
  logo: '/assets/01_yugen_logo_main.png',
  hero: '/assets/02_yugen_main_hero_character_sheet.png',
  bossPortrait: '/assets/04_akuma_no_kage_boss_portrait.png',
  boss: '/assets/05_akuma_no_kage_boss_full_body.png',
  soldier: '/assets/06_shadow_soldier_single.png',
  soldierGroup: '/assets/07_shadow_soldiers_group.png',
}

const arenaSize = 2400
const arenaCenter = arenaSize / 2
const playerRadius = 28
const enemyRadius = 26
const bossRadius = 62

type Vec = {
  x: number
  y: number
}

type EnemyKind = 'soldier' | 'group' | 'boss'
type VfxKind =
  | 'slash'
  | 'hitBurst'
  | 'ultimate'
  | 'death'
  | 'shockwave'
  | 'dashSmoke'
  | 'orbPop'
  | 'skillSlash'
  | 'shadowStep'
  | 'bloodMoonPulse'

type SkillId = 'crimsonSlash' | 'shadowStep' | 'bloodMoon'

type SkillState = {
  id: SkillId
  name: string
  key: string
  cooldown: number
  remaining: number
}

type BloodMoonZone = {
  id: number
  x: number
  y: number
  radius: number
  life: number
  tick: number
}

type WaveBanner = {
  title: string
  subtitle: string
  life: number
}

type Enemy = {
  id: number
  kind: EnemyKind
  x: number
  y: number
  hp: number
  maxHp: number
  speed: number
  damage: number
  radius: number
  hitFlash: number
  contactTimer: number
  shockwaveTimer: number
  knockbackX: number
  knockbackY: number
  slowTimer: number
  reward: number
}

type SoulOrb = {
  id: number
  x: number
  y: number
  value: number
  age: number
}

type DamageNumber = {
  id: number
  x: number
  y: number
  amount: number
  life: number
  critical?: boolean
}

type Vfx = {
  id: number
  kind: VfxKind
  x: number
  y: number
  radius: number
  life: number
  angle?: number
}

type Afterimage = {
  id: number
  x: number
  y: number
  life: number
}

type UpgradeId = 'slash' | 'dash' | 'bloodlust' | 'aura' | 'magnet'

type Upgrade = {
  id: UpgradeId
  title: string
  description: string
  symbol: string
}

type PlayerState = {
  x: number
  y: number
  hp: number
  maxHp: number
  level: number
  xp: number
  xpTarget: number
  souls: number
  speed: number
  slashDamage: number
  dashCooldown: number
  dashTimer: number
  dashCooldownRemaining: number
  dashDir: Vec
  invulnerable: number
  ultimate: number
  pickupRange: number
  auraDamage: number
  bloodlust: number
  facing: number
  attackPose: number
  attackCooldownRemaining: number
  attackInterval: number
}

type GameMutable = {
  player: PlayerState
  enemies: Enemy[]
  orbs: SoulOrb[]
  damageNumbers: DamageNumber[]
  vfx: Vfx[]
  afterimages: Afterimage[]
  elapsed: number
  wave: number
  waveTimer: number
  waveQuota: number
  waveKills: number
  kills: number
  bossSpawned: boolean
  pendingWaveAdvance: boolean
  victory: boolean
  victoryStats: GameStats | null
  bossesDefeated: number
  waveBanner: WaveBanner | null
  bossWarning: number
  skills: Record<SkillId, SkillState>
  bloodMoonZones: BloodMoonZone[]
  paused: boolean
  levelUp: boolean
  gameOver: boolean
  gameOverStats: GameStats | null
  upgradeChoices: Upgrade[]
  nextId: number
  attackTimer: number
  hitStop: number
  flash: number
  shake: number
  lastDir: Vec
  transition: number
}

type GameStats = {
  wave: number
  elapsed: number
  souls: number
  bossesDefeated: number
}

type GameSnapshot = {
  player: PlayerState
  enemies: Enemy[]
  orbs: SoulOrb[]
  damageNumbers: DamageNumber[]
  vfx: Vfx[]
  afterimages: Afterimage[]
  elapsed: number
  wave: number
  waveTimer: number
  bossSpawned: boolean
  victory: boolean
  victoryStats: GameStats | null
  waveBanner: WaveBanner | null
  bossWarning: number
  bossHp: number
  bossMaxHp: number
  paused: boolean
  levelUp: boolean
  gameOver: boolean
  gameOverStats: GameStats | null
  skills: Record<SkillId, SkillState>
  bloodMoonZones: BloodMoonZone[]
  upgradeChoices: Upgrade[]
  flash: number
  shake: number
  transition: number
}

type GameplayProps = {
  onBackToMenu: () => void
}

const upgrades: Upgrade[] = [
  {
    id: 'slash',
    title: 'Crimson Slash',
    description: 'Increase slash damage by 20%.',
    symbol: '斬',
  },
  {
    id: 'dash',
    title: 'Shadow Step',
    description: 'Reduce dash cooldown by 0.5 seconds.',
    symbol: '疾',
  },
  {
    id: 'bloodlust',
    title: 'Bloodlust',
    description: 'Recover 5 HP after killing an enemy.',
    symbol: '血',
  },
  {
    id: 'aura',
    title: 'Curse Aura',
    description: 'Add a small red damage aura around Yūgen.',
    symbol: '呪',
  },
  {
    id: 'magnet',
    title: 'Soul Magnet',
    description: 'Increase soul pickup range.',
    symbol: '魂',
  },
]

const skillConfigs: Record<SkillId, Omit<SkillState, 'remaining'>> = {
  crimsonSlash: {
    id: 'crimsonSlash',
    name: 'Crimson Slash',
    key: 'Q',
    cooldown: 5,
  },
  shadowStep: {
    id: 'shadowStep',
    name: 'Shadow Step',
    key: 'R',
    cooldown: 8,
  },
  bloodMoon: {
    id: 'bloodMoon',
    name: 'Blood Moon Circle',
    key: 'E',
    cooldown: 12,
  },
}

function Gameplay({ onBackToMenu }: GameplayProps) {
  const initialGame = useMemo(() => createGame(), [])
  const [snapshot, setSnapshot] = useState<GameSnapshot>(() => toSnapshot(initialGame))
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [viewport, setViewport] = useState(() => getViewport())
  const stateRef = useRef<GameMutable>(initialGame)
  const keysRef = useRef(new Set<string>())
  const frameRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)
  const renderTimerRef = useRef(0)

  const restart = useCallback(() => {
    stateRef.current = createGame()
    setSettingsOpen(false)
    setSnapshot(toSnapshot(stateRef.current))
  }, [])

  const setPaused = useCallback((paused: boolean) => {
    const game = stateRef.current
    if (game.gameOver || game.levelUp) return
    game.paused = paused
    setSettingsOpen(false)
    setSnapshot(toSnapshot(game))
  }, [])

  const chooseUpgrade = useCallback((upgrade: Upgrade) => {
    applyUpgrade(stateRef.current, upgrade.id)
    setSnapshot(toSnapshot(stateRef.current))
  }, [])

  const dash = useCallback(() => {
    tryDash(stateRef.current, keysRef.current)
    setSnapshot(toSnapshot(stateRef.current))
  }, [])

  const ultimate = useCallback(() => {
    triggerUltimate(stateRef.current)
    setSnapshot(toSnapshot(stateRef.current))
  }, [])

  const activateSkill = useCallback((skill: SkillId) => {
    triggerSkill(stateRef.current, skill)
    setSnapshot(toSnapshot(stateRef.current))
  }, [])

  useEffect(() => {
    const handleResize = () => setViewport(getViewport())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      keysRef.current.add(event.key.toLowerCase())
      if (event.code === 'Space') {
        event.preventDefault()
        tryDash(stateRef.current, keysRef.current)
      }
      if (event.key.toLowerCase() === 'q') {
        triggerSkill(stateRef.current, 'crimsonSlash')
      }
      if (event.key.toLowerCase() === 'r') {
        triggerSkill(stateRef.current, 'shadowStep')
      }
      if (event.key.toLowerCase() === 'e') {
        triggerSkill(stateRef.current, 'bloodMoon')
      }
      if (event.key.toLowerCase() === 'f') {
        triggerUltimate(stateRef.current)
      }
      if (event.key.toLowerCase() === 'escape') {
        const game = stateRef.current
        if (!game.gameOver && !game.levelUp) game.paused = !game.paused
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      keysRef.current.delete(event.key.toLowerCase())
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useEffect(() => {
    const tick = (time: number) => {
      const last = lastTimeRef.current ?? time
      const delta = Math.min((time - last) / 1000, 0.04)
      lastTimeRef.current = time
      updateGame(stateRef.current, keysRef.current, delta)

      renderTimerRef.current += delta
      if (renderTimerRef.current >= 1 / 30) {
        renderTimerRef.current = 0
        setSnapshot(toSnapshot(stateRef.current))
      }

      frameRef.current = window.requestAnimationFrame(tick)
    }

    frameRef.current = window.requestAnimationFrame(tick)
    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
    }
  }, [])

  const camera = useMemo(() => {
    const maxX = arenaSize - viewport.width / 2
    const maxY = arenaSize - viewport.height / 2
    return {
      x: clamp(snapshot.player.x, viewport.width / 2, maxX),
      y: clamp(snapshot.player.y, viewport.height / 2, maxY),
    }
  }, [snapshot.player.x, snapshot.player.y, viewport.height, viewport.width])

  const worldStyle = {
    transform: `translate3d(${viewport.width / 2 - camera.x}px, ${viewport.height / 2 - camera.y}px, 0)`,
  }

  const xpPercent = (snapshot.player.xp / snapshot.player.xpTarget) * 100
  const hpPercent = (snapshot.player.hp / snapshot.player.maxHp) * 100
  const dashPercent = 100 - (snapshot.player.dashCooldownRemaining / snapshot.player.dashCooldown) * 100
  const ultimateReady = snapshot.player.ultimate >= 100
  const bossActive = snapshot.bossSpawned && snapshot.bossMaxHp > 0
  const skills = Object.values(snapshot.skills)

  return (
    <section
      className={`gameplay-screen ${snapshot.shake > 0 ? 'gameplay-shake' : ''}`}
      aria-label="Yugen Shadow Trial gameplay"
    >
      <div className="game-red-flash" style={{ opacity: snapshot.flash }} aria-hidden="true" />
      <div className="gameplay-transition" style={{ opacity: snapshot.transition }} aria-hidden="true" />
      <GameHud
        hpPercent={hpPercent}
        level={snapshot.player.level}
        wave={snapshot.wave}
        waveTimer={snapshot.waveTimer}
        elapsed={snapshot.elapsed}
        souls={snapshot.player.souls}
        onPause={() => setPaused(true)}
      />

      {bossActive && (
        <div className="boss-bar">
          <span>AKUMA NO KAGE</span>
          <div>
            <i style={{ width: `${(snapshot.bossHp / snapshot.bossMaxHp) * 100}%` }} />
          </div>
        </div>
      )}

      <div className="game-camera">
        <div className="game-world" style={worldStyle}>
          <div className="arena-floor" />
          <div className="arena-red-cracks" />
          <div className="arena-ink-stains" />
          <div className="arena-debris" aria-hidden="true">
            {Array.from({ length: 22 }).map((_, index) => (
              <span key={`debris-${index}`} />
            ))}
          </div>
          <div className="torii torii-left" />
          <div className="torii torii-right" />
          <div className="dead-tree dead-tree-one" />
          <div className="dead-tree dead-tree-two" />

          {snapshot.orbs.map((orb) => (
            <div
              className="soul-orb"
              key={orb.id}
              style={{ transform: `translate3d(${orb.x}px, ${orb.y}px, 0)` }}
            />
          ))}

          {snapshot.afterimages.map((afterimage) => (
            <div
              className="player-afterimage"
              key={afterimage.id}
              style={{
                opacity: afterimage.life / 0.34,
                transform: `translate3d(${afterimage.x}px, ${afterimage.y}px, 0)`,
              }}
            />
          ))}

          <PlayerView player={snapshot.player} />
          <div
            className="attack-cooldown"
            style={
              {
                '--attack-ready': `${100 - (snapshot.player.attackCooldownRemaining / snapshot.player.attackInterval) * 100}%`,
                transform: `translate3d(${snapshot.player.x}px, ${snapshot.player.y}px, 0)`,
              } as CSSProperties
            }
            aria-hidden="true"
          >
            <span />
          </div>

          {snapshot.bloodMoonZones.map((zone) => (
            <BloodMoonView key={zone.id} zone={zone} />
          ))}

          {snapshot.enemies.map((enemy) => (
            <EnemyView enemy={enemy} key={enemy.id} />
          ))}

          {snapshot.vfx.map((vfx) => (
            <VfxView key={vfx.id} vfx={vfx} />
          ))}

          {snapshot.damageNumbers.map((number) => (
            <span
              className={`damage-number ${number.critical ? 'damage-number-critical' : ''}`}
              key={number.id}
              style={{
                opacity: number.life / 0.75,
                transform: `translate3d(${number.x}px, ${number.y - (0.75 - number.life) * 46}px, 0)`,
              }}
            >
              {number.amount}
            </span>
          ))}
        </div>
      </div>

      <div className="game-fog" aria-hidden="true" />
      <div className="game-vignette" aria-hidden="true" />
      <div className="game-grain" aria-hidden="true" />
      <div className="mobile-joystick" aria-hidden="true">
        <span />
      </div>
      <div className="skill-buttons" aria-label="Active skills">
        {skills.map((skill) => {
          const ready = skill.remaining <= 0
          const cooldownPercent = ready ? 100 : 100 - (skill.remaining / skill.cooldown) * 100
          return (
            <button
              className={`skill-button ${ready ? 'is-ready' : 'is-cooling'}`}
              disabled={!ready || snapshot.gameOver || snapshot.paused || snapshot.levelUp || snapshot.victory}
              key={skill.id}
              onClick={() => activateSkill(skill.id)}
              style={{ '--cooldown': `${cooldownPercent}%` } as CSSProperties}
              type="button"
            >
              <span className="skill-key">{skill.key}</span>
              <strong>{skill.name}</strong>
              <small>{ready ? 'Ready' : `${skill.remaining.toFixed(1)}s`}</small>
            </button>
          )
        })}
      </div>
      <div className="combat-buttons">
        <button
          className="combat-button dash-button"
          disabled={snapshot.player.dashCooldownRemaining > 0 || snapshot.gameOver || snapshot.paused}
          onClick={dash}
          style={{ '--cooldown': `${dashPercent}%` } as CSSProperties}
          type="button"
        >
          <span>DASH</span>
        </button>
        <button
          className={`combat-button ultimate-button ${ultimateReady ? 'is-ready' : ''}`}
          disabled={!ultimateReady || snapshot.gameOver || snapshot.paused}
          onClick={ultimate}
          style={{ '--ultimate': `${snapshot.player.ultimate}%` } as CSSProperties}
          type="button"
        >
          <span>ULT</span>
        </button>
      </div>

      <div className="xp-bar" aria-label="Experience">
        <i style={{ width: `${xpPercent}%` }} />
      </div>

      {snapshot.bossWarning > 0 && (
        <div className="boss-warning" style={{ opacity: Math.min(1, snapshot.bossWarning) }}>
          WARNING
          <span>Akuma no Kage approaches</span>
        </div>
      )}

      {snapshot.waveBanner && (
        <div className="wave-banner" style={{ opacity: Math.min(1, snapshot.waveBanner.life) }}>
          <strong>{snapshot.waveBanner.title}</strong>
          <span>{snapshot.waveBanner.subtitle}</span>
        </div>
      )}

      {snapshot.paused && !snapshot.gameOver && (
        <PauseOverlay
          settingsOpen={settingsOpen}
          onResume={() => setPaused(false)}
          onSettings={() => setSettingsOpen((open) => !open)}
          onMainMenu={onBackToMenu}
        />
      )}

      {snapshot.levelUp && <LevelUpOverlay choices={snapshot.upgradeChoices} onChoose={chooseUpgrade} />}

      {snapshot.gameOver && snapshot.gameOverStats && (
        <GameOverOverlay stats={snapshot.gameOverStats} onRetry={restart} onMainMenu={onBackToMenu} />
      )}

      {snapshot.victory && snapshot.victoryStats && (
        <VictoryOverlay stats={snapshot.victoryStats} onRetry={restart} onMainMenu={onBackToMenu} />
      )}
    </section>
  )
}

type HudProps = {
  hpPercent: number
  level: number
  wave: number
  waveTimer: number
  elapsed: number
  souls: number
  onPause: () => void
}

function GameHud({ hpPercent, level, wave, waveTimer, elapsed, souls, onPause }: HudProps) {
  return (
    <header className="game-hud">
      <div className="player-panel">
        <img src={assets.hero} alt="" />
        <div>
          <strong>Yūgen</strong>
          <span>Level {level}</span>
          <div className="hp-bar">
            <i style={{ width: `${hpPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="wave-panel">
        <strong>Wave {wave}</strong>
        <span>{formatTime(waveTimer)} / {formatTime(elapsed)}</span>
      </div>

      <div className="resource-panel">
        <strong>{souls}</strong>
        <span>SOULS</span>
        <button type="button" onClick={onPause}>
          PAUSE
        </button>
      </div>
    </header>
  )
}

type PlayerViewProps = {
  player: PlayerState
}

function PlayerView({ player }: PlayerViewProps) {
  return (
    <div
      className={`player-unit ${player.invulnerable > 0 ? 'is-invulnerable' : ''} ${player.attackPose > 0 ? 'is-attacking' : ''}`}
      style={
        {
          '--attack-scale': `${1 + player.attackPose * 0.1}`,
          transform: `translate3d(${player.x}px, ${player.y}px, 0) rotate(${player.facing}rad) scale(${1 + player.attackPose * 0.1})`,
        } as CSSProperties
      }
    >
      {player.auraDamage > 0 && <span className="curse-aura" />}
      <span className="player-shadow" />
      <span className="player-cloak" />
      <span className="player-body" />
      <span className="player-core" />
      <span className="player-blade" />
    </div>
  )
}

type EnemyViewProps = {
  enemy: Enemy
}

function EnemyView({ enemy }: EnemyViewProps) {
  const isBoss = enemy.kind === 'boss'
  const asset = enemy.kind === 'group' ? assets.soldierGroup : enemy.kind === 'boss' ? assets.boss : assets.soldier
  return (
    <div
      className={`enemy-unit enemy-${enemy.kind} ${enemy.hitFlash > 0 ? 'is-hit' : ''}`}
      style={{ transform: `translate3d(${enemy.x}px, ${enemy.y}px, 0)` }}
    >
      <img src={asset} alt="" />
      {isBoss ? null : (
        <div className="enemy-hp">
          <i style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }} />
        </div>
      )}
    </div>
  )
}

type VfxViewProps = {
  vfx: Vfx
}

function VfxView({ vfx }: VfxViewProps) {
  return (
    <div
      className={`vfx vfx-${vfx.kind}`}
      style={{
        opacity: Math.max(vfx.life, 0),
        width: vfx.radius * 2,
        height: vfx.radius * 2,
        transform: `translate3d(${vfx.x - vfx.radius}px, ${vfx.y - vfx.radius}px, 0) rotate(${vfx.angle ?? 0}rad)`,
      }}
    >
      {vfx.kind === 'slash' && (
        <>
          <span className="slash-arc slash-arc-primary" />
          <span className="slash-arc slash-arc-secondary" />
          <span className="slash-arc slash-arc-tertiary" />
          {Array.from({ length: 10 }).map((_, index) => (
            <span
              className="slash-spark"
              key={`slash-spark-${index}`}
              style={{ '--spark-index': index } as CSSProperties}
            />
          ))}
        </>
      )}
      {vfx.kind === 'hitBurst' &&
        Array.from({ length: 12 }).map((_, index) => (
          <span
            className="hit-spark"
            key={`hit-spark-${index}`}
            style={{ '--spark-index': index } as CSSProperties}
          />
        ))}
      {vfx.kind === 'skillSlash' && (
        <>
          <span className="skill-slash-edge skill-slash-edge-main" />
          <span className="skill-slash-edge skill-slash-edge-shadow" />
          <span className="skill-slash-edge skill-slash-edge-tail" />
          {Array.from({ length: 14 }).map((_, index) => (
            <span
              className="skill-slash-spark"
              key={`skill-slash-spark-${index}`}
              style={{ '--spark-index': index } as CSSProperties}
            />
          ))}
        </>
      )}
      {vfx.kind === 'shadowStep' && (
        <>
          <span className="shadow-step-smoke shadow-step-smoke-one" />
          <span className="shadow-step-smoke shadow-step-smoke-two" />
          <span className="shadow-step-cut" />
        </>
      )}
    </div>
  )
}

type BloodMoonViewProps = {
  zone: BloodMoonZone
}

function BloodMoonView({ zone }: BloodMoonViewProps) {
  return (
    <div
      className="blood-moon-zone"
      style={{
        opacity: Math.min(1, zone.life),
        width: zone.radius * 2,
        height: zone.radius * 2,
        transform: `translate3d(${zone.x - zone.radius}px, ${zone.y - zone.radius}px, 0)`,
      }}
    >
      <span className="blood-moon-ring" />
      <span className="blood-moon-runes">
        {Array.from({ length: 12 }).map((_, index) => (
          <i key={`rune-${index}`} style={{ '--rune-index': index } as CSSProperties} />
        ))}
      </span>
      <span className="blood-moon-smoke" />
    </div>
  )
}

type PauseOverlayProps = {
  settingsOpen: boolean
  onResume: () => void
  onSettings: () => void
  onMainMenu: () => void
}

function PauseOverlay({ settingsOpen, onResume, onSettings, onMainMenu }: PauseOverlayProps) {
  return (
    <div className="game-overlay">
      <section className="pause-panel">
        <h2>Paused</h2>
        <button type="button" onClick={onResume}>
          Resume
        </button>
        <button type="button" onClick={onSettings}>
          Settings
        </button>
        {settingsOpen && <p>Visual prototype settings locked for Phase 1.</p>}
        <button type="button" onClick={onMainMenu}>
          Main Menu
        </button>
      </section>
    </div>
  )
}

type LevelUpOverlayProps = {
  choices: Upgrade[]
  onChoose: (upgrade: Upgrade) => void
}

function LevelUpOverlay({ choices, onChoose }: LevelUpOverlayProps) {
  return (
    <div className="game-overlay level-up-overlay">
      <section className="level-up-panel">
        <p>Level Up</p>
        <h2>Choose Your Curse</h2>
        <div className="upgrade-cards">
          {choices.map((upgrade) => (
            <button className="upgrade-card" key={upgrade.id} onClick={() => onChoose(upgrade)} type="button">
              <span>{upgrade.symbol}</span>
              <strong>{upgrade.title}</strong>
              <small>{upgrade.description}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

type GameOverOverlayProps = {
  stats: GameStats
  onRetry: () => void
  onMainMenu: () => void
}

function GameOverOverlay({ stats, onRetry, onMainMenu }: GameOverOverlayProps) {
  return (
    <div className="game-overlay">
      <section className="game-over-panel">
        <img src={assets.logo} alt="Yugen" />
        <h2>Game Over</h2>
        <dl>
          <div>
            <dt>Wave Reached</dt>
            <dd>{stats.wave}</dd>
          </div>
          <div>
            <dt>Time Survived</dt>
            <dd>{formatTime(stats.elapsed)}</dd>
          </div>
          <div>
            <dt>Souls Collected</dt>
            <dd>{stats.souls}</dd>
          </div>
        </dl>
        <button type="button" onClick={onRetry}>
          Try Again
        </button>
        <button type="button" onClick={onMainMenu}>
          Back to Main Menu
        </button>
      </section>
    </div>
  )
}

function VictoryOverlay({ stats, onRetry, onMainMenu }: GameOverOverlayProps) {
  return (
    <div className="game-overlay">
      <section className="game-over-panel victory-panel">
        <img src={assets.logo} alt="Yugen" />
        <h2>Victory</h2>
        <dl>
          <div>
            <dt>Time Survived</dt>
            <dd>{formatTime(stats.elapsed)}</dd>
          </div>
          <div>
            <dt>Souls Collected</dt>
            <dd>{stats.souls}</dd>
          </div>
          <div>
            <dt>Bosses Defeated</dt>
            <dd>{stats.bossesDefeated}</dd>
          </div>
        </dl>
        <button type="button" onClick={onMainMenu}>
          Back to Main Menu
        </button>
        <button type="button" onClick={onRetry}>
          Play Again
        </button>
      </section>
    </div>
  )
}

function createPlayer(): PlayerState {
  return {
    x: arenaCenter,
    y: arenaCenter,
    hp: 350,
    maxHp: 350,
    level: 1,
    xp: 0,
    xpTarget: 35,
    souls: 0,
    speed: 235,
    slashDamage: 34,
    dashCooldown: 3,
    dashTimer: 0,
    dashCooldownRemaining: 0,
    dashDir: { x: 1, y: 0 },
    invulnerable: 0,
    ultimate: 0,
    pickupRange: 145,
    auraDamage: 0,
    bloodlust: 0,
    facing: 0,
    attackPose: 0,
    attackCooldownRemaining: 0.8,
    attackInterval: 0.8,
  }
}

function createGame(): GameMutable {
  const game: GameMutable = {
    player: createPlayer(),
    enemies: [],
    orbs: [],
    damageNumbers: [],
    vfx: [],
    afterimages: [],
    elapsed: 0,
    wave: 1,
    waveTimer: 45,
    waveQuota: 8,
    waveKills: 0,
    kills: 0,
    bossSpawned: false,
    pendingWaveAdvance: false,
    victory: false,
    victoryStats: null,
    bossesDefeated: 0,
    waveBanner: null,
    bossWarning: 0,
    skills: createSkills(),
    bloodMoonZones: [],
    paused: false,
    levelUp: false,
    gameOver: false,
    gameOverStats: null,
    upgradeChoices: [],
    nextId: 1,
    attackTimer: 0.8,
    hitStop: 0,
    flash: 0,
    shake: 0,
    lastDir: { x: 1, y: 0 },
    transition: 1,
  }

  spawnWave(game)
  return game
}

function createSkills(): Record<SkillId, SkillState> {
  return {
    crimsonSlash: { ...skillConfigs.crimsonSlash, remaining: 0 },
    shadowStep: { ...skillConfigs.shadowStep, remaining: 0 },
    bloodMoon: { ...skillConfigs.bloodMoon, remaining: 0 },
  }
}

function updateGame(game: GameMutable, keys: Set<string>, delta: number) {
  game.flash = Math.max(0, game.flash - delta * 2.8)
  game.shake = Math.max(0, game.shake - delta * 3.2)
  game.bossWarning = Math.max(0, game.bossWarning - delta)
  game.transition = Math.max(0, game.transition - delta * 1.8)
  if (game.waveBanner) {
    game.waveBanner.life -= delta
    if (game.waveBanner.life <= 0) game.waveBanner = null
  }

  if (game.paused || game.levelUp || game.gameOver || game.victory) return

  game.elapsed += delta
  if (!isBossWave(game.wave)) game.waveTimer -= delta
  updateSkillCooldowns(game, delta)
  if (game.hitStop > 0) {
    game.hitStop = Math.max(0, game.hitStop - delta)
    updateVfx(game, delta)
    return
  }

  updatePlayer(game, keys, delta)
  updateEnemies(game, delta)
  updateBloodMoonZones(game, delta)
  updateAutoAttack(game, delta)
  updateOrbs(game, delta)
  updateVfx(game, delta)

  if (game.pendingWaveAdvance) {
    game.pendingWaveAdvance = false
    advanceWave(game)
  }

  if (!isBossWave(game.wave) && game.waveKills >= game.waveQuota) advanceWave(game)

  if (game.player.hp <= 0) {
    game.player.hp = 0
    game.gameOver = true
    game.gameOverStats = {
      wave: game.wave,
      elapsed: game.elapsed,
      souls: game.player.souls,
      bossesDefeated: game.bossesDefeated,
    }
  }
}

function updatePlayer(game: GameMutable, keys: Set<string>, delta: number) {
  const player = game.player
  const input = getInputVector(keys)

  if (input.x !== 0 || input.y !== 0) {
    game.lastDir = input
  }

  const dashSpeed = player.dashTimer > 0 ? 760 : 0
  const velocity = {
    x: input.x * player.speed + player.dashDir.x * dashSpeed,
    y: input.y * player.speed + player.dashDir.y * dashSpeed,
  }

  player.x = clamp(player.x + velocity.x * delta, 96, arenaSize - 96)
  player.y = clamp(player.y + velocity.y * delta, 96, arenaSize - 96)
  player.dashTimer = Math.max(0, player.dashTimer - delta)
  player.dashCooldownRemaining = Math.max(0, player.dashCooldownRemaining - delta)
  player.invulnerable = Math.max(0, player.invulnerable - delta)
  player.attackPose = Math.max(0, player.attackPose - delta * 6.5)
  player.attackCooldownRemaining = clamp(game.attackTimer, 0, player.attackInterval)

  if (input.x !== 0 || input.y !== 0) {
    player.facing = Math.atan2(input.y, input.x)
  }

  if (player.dashTimer > 0) {
    game.afterimages.push({ id: nextId(game), x: player.x, y: player.y, life: 0.34 })
  }

  if (player.auraDamage > 0) {
    for (const enemy of game.enemies) {
      const distance = distanceBetween(player, enemy)
      if (distance < 88 + enemy.radius) {
        enemy.hp -= player.auraDamage * delta
        enemy.hitFlash = 0.08
      }
    }
  }
}

function updateEnemies(game: GameMutable, delta: number) {
  const player = game.player

  for (const enemy of game.enemies) {
    const direction = normalize(player.x - enemy.x, player.y - enemy.y)
    const slowMultiplier = enemy.slowTimer > 0 ? 0.48 : 1
    enemy.x += (direction.x * enemy.speed * slowMultiplier + enemy.knockbackX) * delta
    enemy.y += (direction.y * enemy.speed * slowMultiplier + enemy.knockbackY) * delta
    enemy.knockbackX *= Math.max(0, 1 - delta * 8.5)
    enemy.knockbackY *= Math.max(0, 1 - delta * 8.5)
    enemy.hitFlash = Math.max(0, enemy.hitFlash - delta)
    enemy.slowTimer = Math.max(0, enemy.slowTimer - delta)
    enemy.contactTimer = Math.max(0, enemy.contactTimer - delta)
    enemy.shockwaveTimer -= delta

    const distance = distanceBetween(player, enemy)
    const collisionRange = enemy.radius + playerRadius

    if (distance < collisionRange && enemy.contactTimer <= 0 && player.invulnerable <= 0) {
      player.hp -= enemy.damage
      enemy.contactTimer = enemy.kind === 'boss' ? 0.55 : 0.85
      player.invulnerable = 0.42
      game.shake = 0.28
      game.flash = Math.max(game.flash, 0.18)
    }

    if (enemy.kind === 'boss' && enemy.shockwaveTimer <= 0) {
      enemy.shockwaveTimer = 5.2
      game.vfx.push({ id: nextId(game), kind: 'shockwave', x: enemy.x, y: enemy.y, radius: 240, life: 1 })
      game.shake = 0.48
      game.flash = 0.34
      if (distance < 260 && player.invulnerable <= 0) {
        player.hp -= 28
        player.invulnerable = 0.62
      }
    }
  }

  const survivors: Enemy[] = []
  for (const enemy of game.enemies) {
    if (enemy.hp <= 0) {
      killEnemy(game, enemy)
    } else {
      survivors.push(enemy)
    }
  }
  game.enemies = survivors
}

function updateAutoAttack(game: GameMutable, delta: number) {
  game.attackTimer -= delta
  game.player.attackCooldownRemaining = clamp(game.attackTimer, 0, game.player.attackInterval)
  if (game.attackTimer > 0) return

  const nearest = getNearestEnemy(game)
  if (!nearest) {
    game.attackTimer = 0.05
    return
  }

  const player = game.player
  const range = nearest.kind === 'boss' ? 210 : 190
  const distance = distanceBetween(player, nearest)
  if (distance > range) {
    game.attackTimer = 0.05
    return
  }

  const direction = normalize(nearest.x - player.x, nearest.y - player.y)
  const angle = Math.atan2(direction.y, direction.x)
  player.facing = angle
  player.attackPose = 1
  player.attackCooldownRemaining = player.attackInterval
  game.attackTimer = player.attackInterval
  nearest.hp -= player.slashDamage
  nearest.hitFlash = 0.18
  nearest.knockbackX += direction.x * (nearest.kind === 'boss' ? 120 : 310)
  nearest.knockbackY += direction.y * (nearest.kind === 'boss' ? 120 : 310)
  game.damageNumbers.push({
    id: nextId(game),
    x: nearest.x,
    y: nearest.y - nearest.radius,
    amount: Math.round(player.slashDamage),
    life: 0.75,
  })
  game.vfx.push({ id: nextId(game), kind: 'slash', x: player.x, y: player.y, radius: range, life: 1, angle })
  game.vfx.push({
    id: nextId(game),
    kind: 'hitBurst',
    x: nearest.x,
    y: nearest.y,
    radius: nearest.radius * 2.1,
    life: 1,
    angle,
  })
  game.afterimages.push({ id: nextId(game), x: player.x - direction.x * 12, y: player.y - direction.y * 12, life: 0.26 })
  game.afterimages.push({ id: nextId(game), x: player.x - direction.x * 24, y: player.y - direction.y * 24, life: 0.18 })
  game.afterimages.push({ id: nextId(game), x: player.x - direction.x * 36, y: player.y - direction.y * 36, life: 0.12 })
  game.hitStop = 0.08
  game.shake = 0.34
}

function updateOrbs(game: GameMutable, delta: number) {
  const player = game.player
  const remaining: SoulOrb[] = []

  for (const orb of game.orbs) {
    orb.age += delta
    const distance = distanceBetween(player, orb)
    if (distance < player.pickupRange) {
      const direction = normalize(player.x - orb.x, player.y - orb.y)
      const speed = 220 + (1 - distance / player.pickupRange) * 680
      orb.x += direction.x * speed * delta
      orb.y += direction.y * speed * delta
    }

    if (distanceBetween(player, orb) < 28) {
      game.vfx.push({ id: nextId(game), kind: 'orbPop', x: orb.x, y: orb.y, radius: 34, life: 1 })
      gainXp(game, orb.value)
      player.souls += orb.value
    } else {
      remaining.push(orb)
    }
  }

  game.orbs = remaining
}

function updateVfx(game: GameMutable, delta: number) {
  for (const vfx of game.vfx) {
    const decay =
      vfx.kind === 'ultimate'
        ? 0.65
        : vfx.kind === 'slash' || vfx.kind === 'skillSlash'
          ? 4
          : vfx.kind === 'hitBurst'
            ? 4.5
            : vfx.kind === 'bloodMoonPulse'
              ? 2.5
              : 1.7
    vfx.life -= delta * decay
  }
  for (const number of game.damageNumbers) number.life -= delta
  for (const afterimage of game.afterimages) afterimage.life -= delta

  game.vfx = game.vfx.filter((vfx) => vfx.life > 0)
  game.damageNumbers = game.damageNumbers.filter((number) => number.life > 0)
  game.afterimages = game.afterimages.filter((afterimage) => afterimage.life > 0)
}

function tryDash(game: GameMutable, keys: Set<string>) {
  const player = game.player
  if (game.paused || game.levelUp || game.gameOver || player.dashCooldownRemaining > 0) return

  const input = getInputVector(keys)
  const direction = input.x !== 0 || input.y !== 0 ? input : game.lastDir
  const startX = player.x
  const startY = player.y
  player.dashDir = direction
  player.dashTimer = 0.2
  player.invulnerable = 0.44
  player.dashCooldownRemaining = player.dashCooldown
  player.facing = Math.atan2(direction.y, direction.x)
  game.vfx.push({ id: nextId(game), kind: 'slash', x: player.x, y: player.y, radius: 92, life: 0.72, angle: player.facing })
  game.vfx.push({ id: nextId(game), kind: 'dashSmoke', x: startX, y: startY, radius: 62, life: 1, angle: player.facing })
  game.shake = 0.18
}

function triggerUltimate(game: GameMutable) {
  const player = game.player
  if (game.paused || game.levelUp || game.gameOver || player.ultimate < 100) return

  player.ultimate = 0
  const radius = 310
  game.vfx.push({ id: nextId(game), kind: 'ultimate', x: player.x, y: player.y, radius, life: 1.25 })
  game.flash = 0.62
  game.shake = 0.7

  for (const enemy of game.enemies) {
    if (distanceBetween(player, enemy) < radius + enemy.radius) {
      const damage = enemy.kind === 'boss' ? 240 : 999
      enemy.hp -= damage
      enemy.hitFlash = 0.2
      game.damageNumbers.push({
        id: nextId(game),
        x: enemy.x,
        y: enemy.y - enemy.radius,
        amount: damage,
        life: 0.75,
        critical: true,
      })
      const direction = normalize(enemy.x - player.x, enemy.y - player.y)
      enemy.knockbackX += direction.x * (enemy.kind === 'boss' ? 180 : 520)
      enemy.knockbackY += direction.y * (enemy.kind === 'boss' ? 180 : 520)
      game.vfx.push({ id: nextId(game), kind: 'hitBurst', x: enemy.x, y: enemy.y, radius: enemy.radius * 2, life: 1 })
    }
  }
}

function updateSkillCooldowns(game: GameMutable, delta: number) {
  for (const skill of Object.values(game.skills)) {
    skill.remaining = Math.max(0, skill.remaining - delta)
  }
}

function triggerSkill(game: GameMutable, skillId: SkillId) {
  const skill = game.skills[skillId]
  if (game.paused || game.levelUp || game.gameOver || game.victory || skill.remaining > 0) return
  if (skillId === 'shadowStep' && !getNearestEnemy(game)) return

  if (skillId === 'crimsonSlash') castCrimsonSlash(game)
  if (skillId === 'shadowStep') castShadowStep(game)
  if (skillId === 'bloodMoon') castBloodMoon(game)

  skill.remaining = skill.cooldown
}

function castCrimsonSlash(game: GameMutable) {
  const player = game.player
  const target = getNearestEnemy(game)
  const direction = target ? normalize(target.x - player.x, target.y - player.y) : game.lastDir
  const angle = Math.atan2(direction.y, direction.x)
  player.facing = angle
  player.attackPose = 1
  game.afterimages.push({ id: nextId(game), x: player.x - direction.x * 26, y: player.y - direction.y * 26, life: 0.28 })
  game.afterimages.push({ id: nextId(game), x: player.x - direction.x * 54, y: player.y - direction.y * 54, life: 0.2 })
  game.vfx.push({
    id: nextId(game),
    kind: 'skillSlash',
    x: player.x + direction.x * 210,
    y: player.y + direction.y * 210,
    radius: 260,
    life: 1,
    angle,
  })

  let hit = false
  const damage = 118 + player.level * 8
  for (const enemy of game.enemies) {
    const offsetX = enemy.x - player.x
    const offsetY = enemy.y - player.y
    const forward = offsetX * direction.x + offsetY * direction.y
    const side = Math.abs(offsetX * direction.y - offsetY * direction.x)
    if (forward > 0 && forward < 560 && side < 112 + enemy.radius) {
      hit = true
      damageEnemy(game, enemy, damage, direction, true)
      enemy.knockbackX += direction.x * (enemy.kind === 'boss' ? 150 : 410)
      enemy.knockbackY += direction.y * (enemy.kind === 'boss' ? 150 : 410)
    }
  }

  if (hit) {
    game.hitStop = 0.08
    game.shake = 0.42
  }
}

function castShadowStep(game: GameMutable) {
  const player = game.player
  const target = getNearestEnemy(game)
  if (!target) return

  const direction = normalize(target.x - player.x, target.y - player.y)
  const angle = Math.atan2(direction.y, direction.x)
  game.vfx.push({ id: nextId(game), kind: 'shadowStep', x: player.x, y: player.y, radius: 96, life: 1, angle })
  game.afterimages.push({ id: nextId(game), x: player.x, y: player.y, life: 0.34 })

  player.x = clamp(target.x - direction.x * 84, 96, arenaSize - 96)
  player.y = clamp(target.y - direction.y * 84, 96, arenaSize - 96)
  player.facing = angle
  player.attackPose = 1
  player.invulnerable = Math.max(player.invulnerable, 0.9)
  game.vfx.push({ id: nextId(game), kind: 'shadowStep', x: player.x, y: player.y, radius: 118, life: 1, angle })
  game.vfx.push({ id: nextId(game), kind: 'slash', x: player.x, y: player.y, radius: 170, life: 1, angle })

  let hit = false
  const damage = 142 + player.level * 10
  for (const enemy of game.enemies) {
    const distance = distanceBetween(player, enemy)
    if (distance < 150 + enemy.radius) {
      const knockDir = normalize(enemy.x - player.x, enemy.y - player.y)
      hit = true
      damageEnemy(game, enemy, damage, knockDir, true)
      enemy.knockbackX += knockDir.x * (enemy.kind === 'boss' ? 150 : 430)
      enemy.knockbackY += knockDir.y * (enemy.kind === 'boss' ? 150 : 430)
    }
  }

  if (hit) {
    game.hitStop = 0.08
    game.shake = 0.5
  }
}

function castBloodMoon(game: GameMutable) {
  const player = game.player
  const radius = 285
  game.bloodMoonZones.push({ id: nextId(game), x: player.x, y: player.y, radius, life: 3, tick: 0 })
  game.vfx.push({ id: nextId(game), kind: 'bloodMoonPulse', x: player.x, y: player.y, radius, life: 1 })
  player.attackPose = 1
  game.flash = Math.max(game.flash, 0.18)
  game.shake = Math.max(game.shake, 0.22)
}

function updateBloodMoonZones(game: GameMutable, delta: number) {
  const zones: BloodMoonZone[] = []
  for (const zone of game.bloodMoonZones) {
    zone.life -= delta
    zone.tick -= delta
    if (zone.tick <= 0) {
      zone.tick = 0.35
      for (const enemy of game.enemies) {
        if (distanceBetween(zone, enemy) < zone.radius + enemy.radius) {
          enemy.slowTimer = 0.45
          const direction = normalize(enemy.x - zone.x, enemy.y - zone.y)
          damageEnemy(game, enemy, 28 + game.player.level * 3, direction, false)
          enemy.knockbackX += direction.x * 48
          enemy.knockbackY += direction.y * 48
        }
      }
      game.vfx.push({ id: nextId(game), kind: 'bloodMoonPulse', x: zone.x, y: zone.y, radius: zone.radius, life: 1 })
      game.shake = Math.max(game.shake, 0.14)
    }
    if (zone.life > 0) zones.push(zone)
  }
  game.bloodMoonZones = zones
}

function damageEnemy(game: GameMutable, enemy: Enemy, amount: number, direction: Vec, critical: boolean) {
  enemy.hp -= amount
  enemy.hitFlash = 0.2
  game.damageNumbers.push({
    id: nextId(game),
    x: enemy.x,
    y: enemy.y - enemy.radius,
    amount: Math.round(amount),
    life: 0.75,
    critical,
  })
  game.vfx.push({
    id: nextId(game),
    kind: 'hitBurst',
    x: enemy.x,
    y: enemy.y,
    radius: enemy.radius * 2.2,
    life: 1,
    angle: Math.atan2(direction.y, direction.x),
  })
}

function spawnWave(game: GameMutable) {
  game.waveQuota = getWaveEnemyCount(game.wave)
  game.waveKills = 0
  game.bossSpawned = false
  game.waveBanner = isBossWave(game.wave)
    ? { title: 'BOSS WAVE', subtitle: 'Akuma no Kage awakens', life: 2.4 }
    : { title: `WAVE ${game.wave}`, subtitle: 'Enemies are getting stronger', life: 2.1 }

  if (isBossWave(game.wave)) {
    spawnBoss(game)
    return
  }

  for (let index = 0; index < game.waveQuota; index += 1) spawnEnemy(game, index % 5 === 0 ? 'group' : 'soldier')
}

function advanceWave(game: GameMutable) {
  if (game.wave >= 20) return
  game.wave += 1
  game.waveTimer = 45
  game.flash = Math.max(game.flash, 0.18)
  spawnWave(game)
}

function spawnBoss(game: GameMutable) {
  game.bossSpawned = true
  game.bossWarning = 3.1
  game.flash = 0.8
  game.shake = 0.9
  spawnEnemy(game, 'boss')
}

function spawnEnemy(game: GameMutable, kind: EnemyKind) {
  const side = Math.floor(Math.random() * 4)
  const player = game.player
  const spawnDistance = kind === 'boss' ? 660 : 520 + Math.random() * 260
  const lateral = (Math.random() - 0.5) * 720
  const position = {
    x:
      side === 0
        ? player.x - spawnDistance
        : side === 1
          ? player.x + spawnDistance
          : player.x + lateral,
    y:
      side === 2
        ? player.y - spawnDistance
        : side === 3
          ? player.y + spawnDistance
          : player.y + lateral,
  }
  position.x = clamp(position.x, 120, arenaSize - 120)
  position.y = clamp(position.y, 120, arenaSize - 120)

  const waveBoost = game.wave - 1
  const hpScale = Math.pow(1.12, waveBoost)
  const speedScale = Math.pow(1.03, waveBoost)
  const damageScale = Math.pow(1.08, waveBoost)
  const rewardScale = Math.pow(1.05, waveBoost)
  const isBoss = kind === 'boss'
  const baseHp = isBoss ? 1150 : kind === 'group' ? 82 : 60
  const hp = Math.round(baseHp * hpScale)
  const baseSpeed = isBoss ? 58 : kind === 'group' ? 88 : 104
  const baseDamage = isBoss ? 24 : kind === 'group' ? 12 : 10
  const baseReward = isBoss ? 42 : kind === 'group' ? 10 : 7
  game.enemies.push({
    id: nextId(game),
    kind,
    ...position,
    hp,
    maxHp: hp,
    speed: baseSpeed * speedScale,
    damage: Math.round(baseDamage * damageScale),
    radius: isBoss ? bossRadius : enemyRadius,
    hitFlash: 0,
    contactTimer: 0,
    shockwaveTimer: isBoss ? 3.8 : 999,
    knockbackX: 0,
    knockbackY: 0,
    slowTimer: 0,
    reward: Math.max(1, Math.round(baseReward * rewardScale)),
  })
}

function killEnemy(game: GameMutable, enemy: Enemy) {
  game.kills += 1
  game.waveKills += 1
  if (enemy.kind === 'boss') game.bossesDefeated += 1
  game.player.ultimate = clamp(game.player.ultimate + (enemy.kind === 'boss' ? 100 : 13), 0, 100)
  game.player.hp = clamp(game.player.hp + game.player.bloodlust, 0, game.player.maxHp)
  game.vfx.push({ id: nextId(game), kind: 'death', x: enemy.x, y: enemy.y, radius: enemy.radius * 1.6, life: 1 })
  game.orbs.push({ id: nextId(game), x: enemy.x, y: enemy.y, value: enemy.reward, age: 0 })

  if (enemy.kind === 'boss' && game.wave === 20) {
    game.victory = true
    game.victoryStats = {
      wave: game.wave,
      elapsed: game.elapsed,
      souls: game.player.souls,
      bossesDefeated: game.bossesDefeated,
    }
    game.flash = Math.max(game.flash, 0.5)
    return
  }

  if (enemy.kind === 'boss' && isBossWave(game.wave)) game.pendingWaveAdvance = true
}

function gainXp(game: GameMutable, amount: number) {
  const player = game.player
  player.xp += amount
  if (player.xp >= player.xpTarget) {
    player.xp -= player.xpTarget
    player.level += 1
    player.xpTarget = Math.round(player.xpTarget * 1.22 + 12)
    game.levelUp = true
    game.upgradeChoices = pickUpgrades(player.level)
  }
}

function applyUpgrade(game: GameMutable, upgrade: UpgradeId) {
  const player = game.player
  if (upgrade === 'slash') player.slashDamage *= 1.2
  if (upgrade === 'dash') player.dashCooldown = Math.max(1.4, player.dashCooldown - 0.5)
  if (upgrade === 'bloodlust') player.bloodlust += 5
  if (upgrade === 'aura') player.auraDamage += 12
  if (upgrade === 'magnet') player.pickupRange += 70

  game.levelUp = false
  game.upgradeChoices = []
  game.flash = 0.24
}

function pickUpgrades(level: number) {
  return [...upgrades].sort((a, b) => ((a.id.charCodeAt(0) + level) % 7) - ((b.id.charCodeAt(0) + level) % 7)).slice(0, 3)
}

function isBossWave(wave: number) {
  return wave === 5 || wave === 10 || wave === 15 || wave === 20
}

function getWaveEnemyCount(wave: number) {
  return 8 + (wave - 1) * 3
}

function getNearestEnemy(game: GameMutable) {
  let nearest: Enemy | null = null
  let nearestDistance = Infinity
  for (const enemy of game.enemies) {
    const distance = distanceBetween(game.player, enemy)
    if (distance < nearestDistance) {
      nearest = enemy
      nearestDistance = distance
    }
  }
  return nearest
}

function getInputVector(keys: Set<string>): Vec {
  const x = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'))
  const y = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'))
  return normalize(x, y)
}

function toSnapshot(game: GameMutable): GameSnapshot {
  const boss = game.enemies.find((enemy) => enemy.kind === 'boss')
  return {
    player: { ...game.player },
    enemies: game.enemies.map((enemy) => ({ ...enemy })),
    orbs: game.orbs.map((orb) => ({ ...orb })),
    damageNumbers: game.damageNumbers.map((number) => ({ ...number })),
    vfx: game.vfx.map((vfx) => ({ ...vfx })),
    afterimages: game.afterimages.map((afterimage) => ({ ...afterimage })),
    elapsed: game.elapsed,
    wave: game.wave,
    waveTimer: Math.max(0, game.waveTimer),
    bossSpawned: game.bossSpawned,
    victory: game.victory,
    victoryStats: game.victoryStats,
    waveBanner: game.waveBanner ? { ...game.waveBanner } : null,
    bossWarning: game.bossWarning,
    bossHp: boss?.hp ?? 0,
    bossMaxHp: boss?.maxHp ?? 0,
    paused: game.paused,
    levelUp: game.levelUp,
    gameOver: game.gameOver,
    gameOverStats: game.gameOverStats,
    skills: {
      crimsonSlash: { ...game.skills.crimsonSlash },
      shadowStep: { ...game.skills.shadowStep },
      bloodMoon: { ...game.skills.bloodMoon },
    },
    bloodMoonZones: game.bloodMoonZones.map((zone) => ({ ...zone })),
    upgradeChoices: game.upgradeChoices,
    flash: game.flash,
    shake: game.shake,
    transition: game.transition,
  }
}

function nextId(game: GameMutable) {
  game.nextId += 1
  return game.nextId
}

function normalize(x: number, y: number): Vec {
  const length = Math.hypot(x, y)
  if (length === 0) return { x: 0, y: 0 }
  return { x: x / length, y: y / length }
}

function distanceBetween(a: Vec, b: Vec) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function formatTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function getViewport() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

export default Gameplay
