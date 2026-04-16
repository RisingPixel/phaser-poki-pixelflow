/**
 * GameScene.ts — Pixel Cart Puzzle
 *
 * Core flow:
 *   1. selectCart → cart glows, lane buttons light up
 *   2. clickLane → BFS preview highlights candidate cells
 *   3. clickLane again → cells fill, score updates, phase-end checked
 */

import { ScoreSystem } from '../systems/ScoreSystem'
import { AudioManager } from '../core/AudioManager'
import { config } from '../core/Config'
import { GAME_CONFIG } from '../data/gameConfig'
import { BALANCING } from '../data/balancing'
import { formatScore } from '../utils/helpers'

// ── Constants ────────────────────────────────────────────────────────────────
const CX = GAME_CONFIG.width / 2
const CELL_SIZE = 44
const CELL_GAP  = 3

const PALETTE = [
  0xe74c3c, // Red
  0x4a90d9, // Blue
  0xf1c40f, // Yellow
  0x2ecc71, // Green
]

const LANE_ARROWS: Record<Lane, string> = {
  top:    '▲',
  bottom: '▼',
  left:   '◀',
  right:  '▶',
}

// ── Types ────────────────────────────────────────────────────────────────────
type Lane = 'top' | 'bottom' | 'left' | 'right'

interface Cell {
  row: number
  col: number
  color: number
  filled: boolean
  gfx: Phaser.GameObjects.Graphics
}

interface Cart {
  color: number
  capacity: number
  used: boolean
  container: Phaser.GameObjects.Container
  bg: Phaser.GameObjects.Graphics
  label: Phaser.GameObjects.Text
}

// ── Scene ────────────────────────────────────────────────────────────────────
export class GameScene extends Phaser.Scene {

  private score!: ScoreSystem

  // HUD
  private scoreText!:   Phaser.GameObjects.Text
  private phaseText!:   Phaser.GameObjects.Text
  private fillText!:    Phaser.GameObjects.Text
  private messageText!: Phaser.GameObjects.Text

  // State
  private phaseIndex     = 0
  private gameOver       = false
  private selectedCart   = -1
  private selectedLane: Lane | null = null
  private previewCells: { row: number; col: number }[] = []

  // Game objects
  private grid: Cell[][] = []
  private carts: Cart[]  = []

  // Containers
  private gridContainer!:  Phaser.GameObjects.Container
  private cartsContainer!: Phaser.GameObjects.Container
  private laneContainer!:  Phaser.GameObjects.Container

  // Lane button graphics refs for highlight/reset
  private laneBtns: Record<Lane, Phaser.GameObjects.Container> = {} as any

  constructor() { super({ key: 'GameScene' }) }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  create(): void {
    this.cameras.main.setBackgroundColor(config.game.backgroundColor)
    this.cameras.main.fadeIn(BALANCING.sceneFadeDuration, 0, 0, 0)

    this.score      = new ScoreSystem()
    this.phaseIndex = 0
    this.gameOver   = false

    this.drawBackground()
    this.createHUD()

    // Create containers (laneContainer is world-space, inside gridContainer)
    this.gridContainer  = this.add.container(0, 0)
    this.laneContainer  = this.add.container(0, 0)
    this.cartsContainer = this.add.container(0, 0)

    this.startPhase(0)

    // Tap on blank space → deselect
    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, hits: any[]) => {
      if (hits.length === 0) this.clearSelection()
    })
  }

  // ── Background ─────────────────────────────────────────────────────────────

  private drawBackground(): void {
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x0f3460, 0x0f3460, 1)
    bg.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height)
    bg.setDepth(-10)
  }

  // ── Phase Management ───────────────────────────────────────────────────────

  private startPhase(index: number): void {
    index = Math.min(index, BALANCING.PHASES.length - 1)
    this.phaseIndex   = index
    this.selectedCart = -1
    this.selectedLane = null
    this.previewCells = []

    this.phaseText.setText(`Phase ${index + 1} / ${BALANCING.PHASES.length}`)
    this.messageText.setAlpha(0)

    this.gridContainer.destroy()
    this.laneContainer.destroy()
    this.cartsContainer.destroy()

    this.gridContainer  = this.add.container(0, 0)
    this.laneContainer  = this.add.container(0, 0)
    this.cartsContainer = this.add.container(0, 0)

    this.buildGrid()
    this.buildLaneButtons()
    this.buildCarts()
    this.updateHUD()
  }

  // ── Grid ──────────────────────────────────────────────────────────────────

  private buildGrid(): void {
    this.grid = []
    const phase  = BALANCING.PHASES[this.phaseIndex]
    const size   = phase.gridSize
    const colors = PALETTE.slice(0, phase.colors)

    const step    = CELL_SIZE + CELL_GAP
    const gridPx  = size * step - CELL_GAP
    const gridX   = (GAME_CONFIG.width  - gridPx) / 2
    const gridY   = 90   // top margin (below HUD)

    for (let r = 0; r < size; r++) {
      this.grid[r] = []
      for (let c = 0; c < size; c++) {
        const color = colors[Phaser.Math.Between(0, colors.length - 1)]
        const cx = gridX + c * step + CELL_SIZE / 2
        const cy = gridY + r * step + CELL_SIZE / 2

        const gfx = this.add.graphics()
        this.drawCell(gfx, color, false, false)
        gfx.setPosition(cx, cy)
        this.gridContainer.add(gfx)

        this.grid[r][c] = { row: r, col: c, color, filled: false, gfx }
      }
    }
  }

  private drawCell(
    gfx: Phaser.GameObjects.Graphics,
    color: number,
    filled: boolean,
    preview: boolean
  ): void {
    const half = CELL_SIZE / 2
    const rad  = 6
    gfx.clear()

    if (filled) {
      // Bright solid fill
      gfx.fillStyle(color, 1)
      gfx.fillRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, rad)
      // Inner highlight
      gfx.fillStyle(0xffffff, 0.15)
      gfx.fillRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE / 2, rad)
    } else if (preview) {
      // Bright outline + translucent fill
      gfx.fillStyle(color, 0.6)
      gfx.fillRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, rad)
      gfx.lineStyle(3, 0xffffff, 0.9)
      gfx.strokeRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, rad)
    } else {
      // Empty: colour-coded, dim
      gfx.fillStyle(color, 0.25)
      gfx.fillRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, rad)
      gfx.lineStyle(2, color, 0.55)
      gfx.strokeRoundedRect(-half, -half, CELL_SIZE, CELL_SIZE, rad)
    }
  }

  // ── Lane Buttons ──────────────────────────────────────────────────────────

  private buildLaneButtons(): void {
    const phase  = BALANCING.PHASES[this.phaseIndex]
    const size   = phase.gridSize
    const step   = CELL_SIZE + CELL_GAP
    const gridPx = size * step - CELL_GAP
    const gridX  = (GAME_CONFIG.width - gridPx) / 2
    const gridY  = 90

    const cx = gridX + gridPx / 2          // grid centre X
    const cy = gridY + gridPx / 2          // grid centre Y
    const pad = 28                          // gap from grid edge to button centre

    const positions: Record<Lane, { x: number; y: number }> = {
      top:    { x: cx,            y: gridY - pad },
      bottom: { x: cx,            y: gridY + gridPx + pad },
      left:   { x: gridX - pad,   y: cy },
      right:  { x: gridX + gridPx + pad, y: cy },
    }

    const isHoriz: Record<Lane, boolean> = {
      top: false, bottom: false, left: true, right: true
    }

    ;(Object.keys(positions) as Lane[]).forEach(lane => {
      const { x, y } = positions[lane]
      const horiz = isHoriz[lane]

      const btn = this.makeLaneButton(lane, horiz, false)
      btn.setPosition(x, y)
      this.laneContainer.add(btn)
      this.laneBtns[lane] = btn
    })
  }

  private makeLaneButton(lane: Lane, horizontal: boolean, active: boolean): Phaser.GameObjects.Container {
    const W = horizontal ? 36 : 80
    const H = horizontal ? 60 : 32
    const container = this.add.container(0, 0)

    const bg = this.add.graphics()
    this.drawLaneBtn(bg, W, H, active)

    // Arrow text
    const arrowChar = LANE_ARROWS[lane]
    const arrow = this.add.text(0, 0, arrowChar, {
      fontSize: horizontal ? '18px' : '14px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold'
    }).setOrigin(0.5)

    // Hit area
    const hit = this.add.rectangle(0, 0, Math.max(W, 48), Math.max(H, 44))
    hit.setAlpha(0.001)
    hit.setInteractive({ useHandCursor: true })
    hit.on('pointerover', () => { if (!active) bg.setAlpha(0.85) })
    hit.on('pointerout',  () => { bg.setAlpha(1) })
    hit.on('pointerdown', () => this.onLaneClicked(lane))

    container.add([bg, arrow, hit])
    return container
  }

  private drawLaneBtn(bg: Phaser.GameObjects.Graphics, W: number, H: number, active: boolean): void {
    bg.clear()
    const col = active ? 0xf1c40f : 0x4a6fa5
    bg.fillStyle(col, active ? 1 : 0.75)
    bg.fillRoundedRect(-W / 2, -H / 2, W, H, 8)
    bg.lineStyle(2, 0xffffff, active ? 0.9 : 0.35)
    bg.strokeRoundedRect(-W / 2, -H / 2, W, H, 8)
  }

  private setLaneBtnActive(lane: Lane, active: boolean): void {
    const btn = this.laneBtns[lane]
    if (!btn) return
    const bg = btn.list[0] as Phaser.GameObjects.Graphics
    const isHoriz = (lane === 'left' || lane === 'right')
    const W = isHoriz ? 36 : 80
    const H = isHoriz ? 60 : 32
    this.drawLaneBtn(bg, W, H, active)
  }

  // ── Carts Panel ───────────────────────────────────────────────────────────

  private buildCarts(): void {
    this.carts = []
    const phase     = BALANCING.PHASES[this.phaseIndex]
    const numCarts  = phase.carts
    const cartW     = 64
    const cartH     = 52
    const gap       = 8
    const totalW    = numCarts * cartW + (numCarts - 1) * gap
    const startX    = (GAME_CONFIG.width - totalW) / 2 + cartW / 2
    const panelY    = GAME_CONFIG.height - 70

    // Build color distribution map
    const colorCounts = new Map<number, number>()
    const size = phase.gridSize
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++) {
        const col = this.grid[r][c].color
        colorCounts.set(col, (colorCounts.get(col) ?? 0) + 1)
      }

    const colorList = Array.from(colorCounts.keys())

    for (let i = 0; i < numCarts; i++) {
      const color = colorList[i % colorList.length]
      const total = colorCounts.get(color) ?? 8
      const cap   = Phaser.Math.Between(
        Math.max(1, Math.floor(total * 0.2)),
        Math.ceil(total * 0.65)
      )

      const x = startX + i * (cartW + gap)
      const container = this.add.container(x, panelY)
      const bg        = this.add.graphics()
      this.drawCartBg(bg, color, cartW, cartH, false)

      const label = this.add.text(0, 4, String(cap), {
        fontSize: '22px', fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold', color: '#ffffff'
      }).setOrigin(0.5)

      const capLabel = this.add.text(0, -cartH / 2 - 10, '🛒', {
        fontSize: '14px'
      }).setOrigin(0.5)

      const hit = this.add.rectangle(0, 0, cartW, cartH)
      hit.setAlpha(0.001)
      hit.setInteractive({ useHandCursor: true })
      hit.on('pointerdown', () => this.selectCart(i))

      container.add([bg, label, capLabel, hit])
      this.cartsContainer.add(container)

      this.carts.push({ color, capacity: cap, used: false, container, bg, label })
    }
  }

  private drawCartBg(
    bg: Phaser.GameObjects.Graphics,
    color: number,
    w: number, h: number,
    selected: boolean
  ): void {
    bg.clear()
    bg.fillStyle(color, selected ? 1 : 0.85)
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10)
    if (selected) {
      bg.lineStyle(3, 0xffffff, 1)
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10)
    }
  }

  // ── Cart Selection ────────────────────────────────────────────────────────

  private selectCart(index: number): void {
    if (this.gameOver || this.carts[index]?.used) return

    if (this.selectedCart === index) {
      // Toggle off
      this.clearSelection()
      return
    }

    // Deselect previous cart
    if (this.selectedCart !== -1) this.deselectCartUI(this.selectedCart)

    this.clearPreview()
    this.selectedCart = index
    this.selectedLane = null

    const cart = this.carts[index]
    this.drawCartBg(cart.bg, cart.color, 64, 52, true)
    this.tweens.add({
      targets: cart.container, scaleX: 1.12, scaleY: 1.12,
      duration: 120, ease: 'Back.easeOut'
    })

    // Activate all lane buttons
    ;(Object.keys(this.laneBtns) as Lane[]).forEach(l => this.setLaneBtnActive(l, false))
  }

  private deselectCartUI(index: number): void {
    const cart = this.carts[index]
    if (!cart) return
    this.tweens.killTweensOf(cart.container)
    cart.container.setScale(1)
    this.drawCartBg(cart.bg, cart.color, 64, 52, false)
  }

  private clearSelection(): void {
    if (this.selectedCart !== -1) this.deselectCartUI(this.selectedCart)
    this.selectedCart = -1
    this.selectedLane = null
    this.clearPreview()
    ;(Object.keys(this.laneBtns) as Lane[]).forEach(l => this.setLaneBtnActive(l, false))
  }

  // ── Lane Interaction ─────────────────────────────────────────────────────

  private onLaneClicked(lane: Lane): void {
    if (this.gameOver) return
    if (this.selectedCart === -1) {
      this.flash('Select a cart first!')
      return
    }

    if (this.selectedLane === lane) {
      // Confirm
      this.commitFill()
    } else {
      // Preview
      this.selectedLane = lane
      ;(Object.keys(this.laneBtns) as Lane[]).forEach(l =>
        this.setLaneBtnActive(l, l === lane)
      )
      this.showPreview(lane)
    }
  }

  // ── Flood Fill ────────────────────────────────────────────────────────────

  private bfsFlood(color: number, capacity: number, lane: Lane): { row: number; col: number }[] {
    const size   = BALANCING.PHASES[this.phaseIndex].gridSize
    const q: { row: number; col: number }[] = []
    const visited = new Set<string>()
    const result:  { row: number; col: number }[] = []

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const edge =
          (lane === 'top'    && r === 0) ||
          (lane === 'bottom' && r === size - 1) ||
          (lane === 'left'   && c === 0) ||
          (lane === 'right'  && c === size - 1)
        const cell = this.grid[r]?.[c]
        if (edge && cell && cell.color === color && !cell.filled) {
          q.push({ row: r, col: c })
          visited.add(`${r},${c}`)
        }
      }
    }

    while (q.length && result.length < capacity) {
      const cur = q.shift()!
      result.push(cur)
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = cur.row + dr, nc = cur.col + dc
        const key = `${nr},${nc}`
        const ncell = this.grid[nr]?.[nc]
        if (ncell && ncell.color === color && !ncell.filled && !visited.has(key)) {
          visited.add(key)
          q.push({ row: nr, col: nc })
        }
      }
    }
    return result
  }

  private showPreview(lane: Lane): void {
    this.clearPreview()
    const cart   = this.carts[this.selectedCart]
    const cells  = this.bfsFlood(cart.color, cart.capacity, lane)
    this.previewCells = cells

    if (cells.length === 0) {
      this.flash('No cells reachable from that lane!')
      this.selectedLane = null
      ;(Object.keys(this.laneBtns) as Lane[]).forEach(l => this.setLaneBtnActive(l, false))
      return
    }

    cells.forEach(({ row, col }) => {
      const cell = this.grid[row][col]
      this.drawCell(cell.gfx, cell.color, false, true)
    })
    this.flash(`${cells.length} cells — tap lane again to fill!`)
  }

  private clearPreview(): void {
    this.previewCells.forEach(({ row, col }) => {
      const cell = this.grid[row]?.[col]
      if (cell && !cell.filled) this.drawCell(cell.gfx, cell.color, false, false)
    })
    this.previewCells = []
  }

  private commitFill(): void {
    const cart  = this.carts[this.selectedCart]
    const cells = this.previewCells.slice()

    cells.forEach(({ row, col }) => {
      const cell  = this.grid[row][col]
      cell.filled = true
      this.drawCell(cell.gfx, cell.color, true, false)

      // Burst particles
      for (let i = 0; i < 5; i++) {
        const px = cell.gfx.x + Phaser.Math.Between(-20, 20)
        const py = cell.gfx.y + Phaser.Math.Between(-20, 20)
        const dot = this.add.graphics()
        dot.fillStyle(cell.color, 1)
        dot.fillCircle(0, 0, Phaser.Math.Between(2, 5))
        dot.setPosition(cell.gfx.x, cell.gfx.y)
        this.tweens.add({
          targets: dot, x: px, y: py, alpha: 0,
          duration: 350 + Phaser.Math.Between(0, 200),
          onComplete: () => dot.destroy()
        })
      }
    })

    // Score
    this.score.add(cells.length * BALANCING.pointsPerCell)

    // Consume cart
    cart.used = true
    cart.container.setAlpha(0.3)
    cart.container.removeInteractive()
    cart.container.list.forEach(child => {
      if ('removeInteractive' in child) (child as any).removeInteractive()
    })

    AudioManager.playSfx(this, 'sfx_score')
    this.clearSelection()
    this.updateHUD()
    this.time.delayedCall(200, () => this.checkPhaseEnd())
  }

  // ── Phase End ─────────────────────────────────────────────────────────────

  private checkPhaseEnd(): void {
    const phase = BALANCING.PHASES[this.phaseIndex]
    const size  = phase.gridSize
    let filled  = 0, total = size * size

    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++)
        if (this.grid[r][c].filled) filled++

    const ratio = filled / total
    this.fillText.setText(`Fill: ${Math.round(ratio * 100)}% / ${Math.round(phase.targetFill * 100)}%`)

    // Success?
    if (ratio >= phase.targetFill) {
      const unused = this.carts.filter(c => !c.used).length
      const bonus  = unused * BALANCING.pointsPerUnusedCart
      this.score.add(bonus)
      this.updateHUD()

      this.flash(bonus > 0
        ? `Phase Complete! +${bonus} cart bonus 🎉`
        : `Phase Complete! 🎉`, 2200
      )
      // Phase-complete grid pulse
      this.tweens.add({
        targets: this.gridContainer, alpha: 0.3,
        yoyo: true, repeat: 2, duration: 180,
        onComplete: () => {
          this.time.delayedCall(1000, () => this.startPhase(this.phaseIndex + 1))
        }
      })
      return
    }

    // No moves left?
    const remaining = this.carts.filter(c => !c.used)
    let hasMoves    = false
    for (const cart of remaining) {
      if (hasMoves) break
      for (const lane of ['top', 'bottom', 'left', 'right'] as Lane[]) {
        if (this.bfsFlood(cart.color, cart.capacity, lane).length > 0) {
          hasMoves = true; break
        }
      }
    }

    if (!hasMoves) this.triggerGameOver()
  }

  // ── HUD ────────────────────────────────────────────────────────────────────

  private createHUD(): void {
    // Gradient top bar
    const bar = this.add.graphics()
    bar.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.6, 0.6, 0, 0)
    bar.fillRect(0, 0, GAME_CONFIG.width, 72)
    bar.setDepth(15)

    this.phaseText = this.add.text(16, 14, '', {
      fontSize: '18px', fontFamily: 'Arial, sans-serif',
      color: '#e0e0ff', fontStyle: 'bold'
    }).setDepth(20)

    this.scoreText = this.add.text(CX, 14, 'Score: 0', {
      fontSize: '20px', fontFamily: 'Arial, sans-serif',
      color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5, 0).setDepth(20)

    this.fillText = this.add.text(GAME_CONFIG.width - 16, 14, 'Fill: 0%', {
      fontSize: '16px', fontFamily: 'Arial, sans-serif',
      color: '#aaaacc'
    }).setOrigin(1, 0).setDepth(20)

    // Mute button
    const mute = this.add.text(GAME_CONFIG.width - 16, 46, AudioManager.muted ? '🔇' : '🔊', {
      fontSize: '24px'
    }).setOrigin(1, 0).setDepth(20).setInteractive({ useHandCursor: true })
    mute.on('pointerdown', () => {
      AudioManager.toggleMute()
      mute.setText(AudioManager.muted ? '🔇' : '🔊')
    })

    // Bottom bar
    const bbar = this.add.graphics()
    bbar.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.7, 0.7)
    bbar.fillRect(0, GAME_CONFIG.height - 110, GAME_CONFIG.width, 110)
    bbar.setDepth(15)

    this.messageText = this.add.text(CX, GAME_CONFIG.height / 2, '', {
      fontSize: '22px', fontFamily: 'Arial, sans-serif',
      color: '#f1c40f', fontStyle: 'bold', align: 'center',
      wordWrap: { width: GAME_CONFIG.width - 40 }
    }).setOrigin(0.5).setDepth(30).setAlpha(0)
  }

  private updateHUD(): void {
    this.scoreText.setText(`Score: ${formatScore(this.score.getScore())}`)
    const phase = BALANCING.PHASES[this.phaseIndex]
    const size  = phase.gridSize
    let filled  = 0
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++)
        if (this.grid[r]?.[c]?.filled) filled++
    const pct = Math.round(filled / (size * size) * 100)
    this.fillText.setText(`Fill: ${pct}% / ${Math.round(phase.targetFill * 100)}%`)
  }

  // ── Message Flash ─────────────────────────────────────────────────────────

  private flash(msg: string, duration = 1200): void {
    this.messageText.setText(msg).setAlpha(1).setScale(0.85)
    this.tweens.killTweensOf(this.messageText)
    this.tweens.add({
      targets: this.messageText, scale: 1,
      duration: 200, ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: this.messageText,
          alpha: 0, delay: duration, duration: 300
        })
      }
    })
  }

  // ── Game Over ─────────────────────────────────────────────────────────────

  private triggerGameOver(): void {
    if (this.gameOver) return
    this.gameOver = true
    this.flash('NO MOVES LEFT!', 2500)
    this.cameras.main.shake(300, 0.01)
    this.time.delayedCall(2800, () => {
      this.cameras.main.fadeOut(BALANCING.sceneFadeDuration, 0, 0, 0)
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('ResultScene', {
          score:          this.score.getScore(),
          highScore:      this.score.getHighScore(),
          isNewHighScore: this.score.isNewHighScore()
        })
      })
    })
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  shutdown(): void {
    this.input.off('pointerdown')
    this.tweens.killAll()
  }
}
