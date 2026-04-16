import { ScoreSystem } from '../systems/ScoreSystem'
import { AudioManager } from '../core/AudioManager'
import { config } from '../core/Config'
import { GAME_CONFIG } from '../data/gameConfig'
import { BALANCING } from '../data/balancing'
import { formatScore } from '../utils/helpers'

const CX = GAME_CONFIG.width / 2
const CY = GAME_CONFIG.height / 2

const COLORS = [
  0xe74c3c, // Red
  0x4a90d9, // Blue
  0xf1c40f, // Yellow
  0x2ecc71, // Green
  0x9b59b6  // Purple
]

interface Cell {
  row: number
  col: number
  color: number
  filled: boolean
  sprite: Phaser.GameObjects.Sprite
}

interface Cart {
  color: number
  capacity: number
  used: boolean
  uiContainer: Phaser.GameObjects.Container
  uiBg: Phaser.GameObjects.Graphics
  uiText: Phaser.GameObjects.Text
}

type Lane = 'top' | 'bottom' | 'left' | 'right'

export class GameScene extends Phaser.Scene {
  private scoreSystem!: ScoreSystem

  private scoreText!: Phaser.GameObjects.Text
  private phaseText!: Phaser.GameObjects.Text
  private messageText!: Phaser.GameObjects.Text

  private currentPhaseIndex: number = 0
  private isGameOver: boolean = false

  private grid: Cell[][] = []
  private carts: Cart[] = []
  
  private selectedCartIndex: number = -1
  private selectedLane: Lane | null = null
  private previewCells: {row: number, col: number}[] = []

  private gridContainer!: Phaser.GameObjects.Container
  private cartsContainer!: Phaser.GameObjects.Container
  private laneButtons: { [key in Lane]: Phaser.GameObjects.Sprite } = {} as any

  constructor() {
    super({ key: 'GameScene' })
  }

  create(): void {
    this.cameras.main.setBackgroundColor(config.game.backgroundColor)
    this.cameras.main.fadeIn(BALANCING.sceneFadeDuration, 0, 0, 0)

    this.scoreSystem = new ScoreSystem()
    this.currentPhaseIndex = 0
    this.isGameOver = false

    this.createHUD()
    
    this.gridContainer = this.add.container(CX, CY - 40)
    this.cartsContainer = this.add.container(CX, GAME_CONFIG.height - 100)
    
    this.createLaneButtons()

    this.startPhase(this.currentPhaseIndex)

    // Deselect cart if tapping outside
    this.input.on('pointerdown', (_pointer: Phaser.Input.Pointer, currentlyOver: any[]) => {
      // If we clicked on nothing interactive, deselect all
      if (currentlyOver.length === 0) {
        this.clearSelection()
      }
    })
  }

  // ─── Phase Management ───────────────────────────────────────────────────────

  private startPhase(index: number): void {
    if (index >= BALANCING.PHASES.length) {
      // Game endlessly loops the last phase if players beat the game. Randomness provides replayability.
      index = BALANCING.PHASES.length - 1;
    }
    this.currentPhaseIndex = index

    this.phaseText.setText(`Phase ${index + 1}`)
    this.messageText.setText('')
    this.messageText.setAlpha(0)

    this.clearSelection()
    this.generateGrid()
    this.generateCarts()
  }

  private generateGrid(): void {
    // Clear old grid
    this.gridContainer.removeAll(true)
    this.grid = []

    const phaseData = BALANCING.PHASES[this.currentPhaseIndex]
    const size = phaseData.gridSize
    const cellSize = 48
    const spacing = 2
    const totalW = size * (cellSize + spacing) - spacing
    const totalH = totalW // square

    const startX = -totalW / 2 + cellSize / 2
    const startY = -totalH / 2 + cellSize / 2

    // Set colors for this phase
    const numColors = phaseData.colors
    const activeColors = COLORS.slice(0, numColors)

    for (let r = 0; r < size; r++) {
      this.grid[r] = []
      for (let c = 0; c < size; c++) {
        // Randomly pick a color
        const colorIdx = Phaser.Math.Between(0, activeColors.length - 1)
        const theColor = activeColors[colorIdx]

        const x = startX + c * (cellSize + spacing)
        const y = startY + r * (cellSize + spacing)

        const sprite = this.add.sprite(x, y, 'cell_empty')
        sprite.setTint(theColor)
        
        // Add minimal alpha background for unfilled
        sprite.setAlpha(0.6)

        this.gridContainer.add(sprite)

        this.grid[r][c] = {
          row: r,
          col: c,
          color: theColor,
          filled: false,
          sprite: sprite
        }
      }
    }

    // Position Lane Buttons around the newly sized grid
    const margin = 50
    this.laneButtons['top'].setPosition(0, startY - margin)
    this.laneButtons['bottom'].setPosition(0, -startY + margin) // startY is negative, so this is positive equivalent
    this.laneButtons['left'].setPosition(startX - margin, 0)
    this.laneButtons['right'].setPosition(-startX + margin, 0)
  }

  private generateCarts(): void {
    // Clear old carts
    this.cartsContainer.removeAll(true)
    this.carts = []

    const phaseData = BALANCING.PHASES[this.currentPhaseIndex]
    const numCarts = phaseData.carts
    const cartWidth = 70
    const cartHeight = 50
    const spacing = 10
    
    // We want the carts to fit across the bottom. If too many, scale down or layout differently.
    // For now we assume they fit horizontally.
    const totalW = numCarts * cartWidth + (numCarts - 1) * spacing
    let startX = -totalW / 2 + cartWidth / 2

    // Gather color distributions to give reasonable capacities
    const colorCounts = new Map<number, number>()
    for (let r = 0; r < phaseData.gridSize; r++) {
      for (let c = 0; c < phaseData.gridSize; c++) {
        const clr = this.grid[r][c].color
        colorCounts.set(clr, (colorCounts.get(clr) || 0) + 1)
      }
    }

    const activeColors = Array.from(colorCounts.keys())

    for (let i = 0; i < numCarts; i++) {
      // Pick a color for the cart. Weight towards what's still left.
      const colorSelection = Phaser.Math.Between(0, activeColors.length - 1)
      const color = activeColors[colorSelection]
      
      const maxCount = colorCounts.get(color) || 10
      // Assign capacity somewhat randomly based on grid size
      const cap = Phaser.Math.Between(Math.max(1, Math.floor(maxCount * 0.2)), Math.ceil(maxCount * 0.7))

      const container = this.add.container(startX + i * (cartWidth + spacing), 0)
      
      const gfx = this.add.graphics()
      gfx.fillStyle(color)
      gfx.fillRoundedRect(-cartWidth/2, -cartHeight/2, cartWidth, cartHeight, 8)
      gfx.lineStyle(2, 0xffffff, 0)
      gfx.strokeRoundedRect(-cartWidth/2, -cartHeight/2, cartWidth, cartHeight, 8)
      
      const text = this.add.text(0, 0, String(cap), {
        fontSize: '24px',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        color: '#ffffff'
      }).setOrigin(0.5)

      // Hit area for clicking
      const hitArea = new Phaser.Geom.Rectangle(-cartWidth/2, -cartHeight/2, cartWidth, cartHeight)
      container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains)

      container.on('pointerdown', () => this.selectCart(i))

      container.add([gfx, text])
      this.cartsContainer.add(container)

      this.carts.push({
        color: color,
        capacity: cap,
        used: false,
        uiContainer: container,
        uiBg: gfx,
        uiText: text
      })
    }
  }

  private createLaneButtons(): void {
    const createBtn = (lane: Lane) => {
      const btn = this.add.sprite(0, 0, 'lane_button')
      btn.setInteractive({ useHandCursor: true })
      btn.setAlpha(0.5)

      let angle = 0
      if (lane === 'top') angle = 180
      else if (lane === 'bottom') angle = 0
      else if (lane === 'left') angle = 90
      else if (lane === 'right') angle = 270
      
      btn.setAngle(angle) // A little rotation hack, assuming sprite has an arrow pointing up maybe? The placeholder is a solid square right now, but rotation helps if we swap to an arrow.

      btn.on('pointerdown', () => this.onLaneClicked(lane))
      this.gridContainer.add(btn)
      return btn
    }

    this.laneButtons = {
      'top': createBtn('top'),
      'bottom': createBtn('bottom'),
      'left': createBtn('left'),
      'right': createBtn('right')
    }
  }

  // ─── Interaction Logic ─────────────────────────────────────────────────────

  private selectCart(index: number): void {
    if (this.isGameOver) return
    if (this.carts[index].used) return

    AudioManager.playSfx(this, 'sfx_button') // Generic click sound fallback if no sfx_button
    
    // Deselect old
    if (this.selectedCartIndex !== -1) {
      this.resetCartUI(this.selectedCartIndex)
    }

    this.selectedCartIndex = index
    this.selectedLane = null
    this.previewCells = []
    this.clearPreviewStyles()

    // Highlight new
    const cart = this.carts[index]
    this.tweens.add({
      targets: cart.uiContainer,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 100,
      ease: 'Back.easeOut'
    })

    cart.uiBg.lineStyle(4, 0xffffff, 1)
    cart.uiBg.strokeRoundedRect(-35, -25, 70, 50, 8)
  }

  private resetCartUI(index: number): void {
    const cart = this.carts[index]
    this.tweens.killTweensOf(cart.uiContainer)
    cart.uiContainer.setScale(1)
    
    cart.uiBg.clear()
    cart.uiBg.fillStyle(cart.color)
    cart.uiBg.fillRoundedRect(-35, -25, 70, 50, 8)
    cart.uiBg.lineStyle(2, 0xffffff, 0)
    cart.uiBg.strokeRoundedRect(-35, -25, 70, 50, 8)
  }

  private clearSelection(): void {
    if (this.selectedCartIndex !== -1) {
      this.resetCartUI(this.selectedCartIndex)
      this.selectedCartIndex = -1
    }
    this.selectedLane = null
    this.previewCells = []
    this.clearPreviewStyles()
  }

  private onLaneClicked(lane: Lane): void {
    if (this.isGameOver) return
    if (this.selectedCartIndex === -1) {
      this.showMessage("Select a cart first!")
      return
    }

    if (this.selectedLane === lane) {
      // Confirm fill
      this.confirmFill()
    } else {
      // Preview fill
      this.selectedLane = lane
      this.updatePreview()
    }
  }

  private updatePreview(): void {
    this.clearPreviewStyles()

    if (this.selectedCartIndex === -1 || !this.selectedLane) return
    const cart = this.carts[this.selectedCartIndex]

    this.previewCells = this.getFillableCells(cart.color, cart.capacity, this.selectedLane)

    if (this.previewCells.length === 0) {
      this.showMessage("No valid cells to fill from here!")
      this.selectedLane = null
    } else {
      // Highlight previews
      this.previewCells.forEach(({row, col}) => {
        const sprite = this.grid[row][col].sprite
        sprite.setAlpha(1)
        // Tint to bright white slightly to show it's selected
        sprite.setTexture('cell_filled')
        // sprite.setTint Fill color is already there, but we can animate it or show a dot.
        // Let's just make alpha 1 and show the solid texture tinted.
      })
      this.showMessage("Tap again to confirm fill")
    }
  }

  private clearPreviewStyles(): void {
    if (!this.grid || this.grid.length === 0) return
    
    const phaseSize = BALANCING.PHASES[this.currentPhaseIndex].gridSize
    for (let r = 0; r < phaseSize; r++) {
      for (let c = 0; c < phaseSize; c++) {
        const cell = this.grid[r][c]
        if (!cell.filled) {
          cell.sprite.setAlpha(0.6)
          cell.sprite.setTexture('cell_empty')
        }
      }
    }
  }

  private confirmFill(): void {
    const cart = this.carts[this.selectedCartIndex]
    
    // Fill the cells
    let filledCount = 0
    this.previewCells.forEach(({row, col}) => {
      const cell = this.grid[row][col]
      cell.filled = true
      cell.sprite.setTexture('cell_filled')
      cell.sprite.setAlpha(1)
      
      // Spawn particle burst
      for(let i=0; i<3; i++) {
        const p = this.add.sprite(this.gridContainer.x + cell.sprite.x, this.gridContainer.y + cell.sprite.y, 'particle')
        p.setTint(cell.color)
        this.tweens.add({
          targets: p,
          x: p.x + Phaser.Math.Between(-20, 20),
          y: p.y + Phaser.Math.Between(-20, 20),
          alpha: 0,
          duration: 400 + Phaser.Math.Between(0, 200),
          onComplete: () => p.destroy()
        })
      }
      filledCount++
    })

    // Consume cart
    cart.used = true
    cart.uiContainer.setAlpha(0.2)
    cart.uiContainer.removeInteractive()

    // Add score
    this.scoreSystem.add(filledCount * BALANCING.pointsPerCell)
    this.updateHUD()

    AudioManager.playSfx(this, 'sfx_score') // Default positive sound

    this.clearSelection()

    // Check phase end condition
    this.checkPhaseEnd()
  }

  private getFillableCells(color: number, capacity: number, lane: Lane): {row: number, col: number}[] {
    const phaseConf = BALANCING.PHASES[this.currentPhaseIndex]
    const size = phaseConf.gridSize
    const q: {row: number, col: number}[] = []
    const visited = new Set<string>()
    const result: {row: number, col: number}[] = []

    // Add initial cells on the chosen edge
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (
          (lane === 'top' && r === 0) ||
          (lane === 'bottom' && r === size - 1) ||
          (lane === 'left' && c === 0) ||
          (lane === 'right' && c === size - 1)
        ) {
          if (this.grid[r][c] && this.grid[r][c].color === color && !this.grid[r][c].filled) {
            q.push({row: r, col: c})
            visited.add(`${r},${c}`)
          }
        }
      }
    }

    // BFS
    while(q.length > 0 && result.length < capacity) {
      const curr = q.shift()!
      result.push(curr)

      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]]
      for (const [dr, dc] of dirs) {
        const nr = curr.row + dr
        const nc = curr.col + dc
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          if (this.grid[nr][nc] && this.grid[nr][nc].color === color && !this.grid[nr][nc].filled && !visited.has(`${nr},${nc}`)) {
            visited.add(`${nr},${nc}`)
            q.push({row: nr, col: nc})
          }
        }
      }
    }
    return result
  }

  private checkPhaseEnd(): void {
    const phaseConf = BALANCING.PHASES[this.currentPhaseIndex]
    const size = phaseConf.gridSize
    const totalCells = size * size

    let filledCells = 0
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (this.grid[r][c].filled) filledCells++
      }
    }

    const fillRatio = filledCells / totalCells
    const availableCarts = this.carts.filter(c => !c.used)

    if (fillRatio >= phaseConf.targetFill) {
      // Phase Success
      const unusedCount = availableCarts.length
      if (unusedCount > 0) {
        this.scoreSystem.add(unusedCount * BALANCING.pointsPerUnusedCart)
      }
      this.showMessage(`PHASE COMPLETE!\n+${unusedCount * BALANCING.pointsPerUnusedCart} Bonus`, 2000)
      
      this.time.delayedCall(2000, () => {
        this.startPhase(this.currentPhaseIndex + 1)
      })
    } else {
      // Check if literally no moves are left
      let possibleMoves = false
      if (availableCarts.length > 0) {
        for (const cart of availableCarts) {
          for (const lane of ['top', 'bottom', 'left', 'right'] as Lane[]) {
            const cells = this.getFillableCells(cart.color, cart.capacity, lane)
            if (cells.length > 0) {
              possibleMoves = true
              break
            }
          }
          if (possibleMoves) break
        }
      }

      if (!possibleMoves) {
        // Game Over
        this.triggerGameOver()
      }
    }
  }

  // ─── HUD / Effects ────────────────────────────────────────────────────────

  private createHUD(): void {
    this.scoreText = this.add.text(CX, 30, 'Score: 0', {
      fontSize: '22px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0).setDepth(20)

    this.phaseText = this.add.text(16, 16, 'Phase 1', {
      fontSize: '20px',
      fontFamily: 'Arial, sans-serif',
      color: '#e74c3c'
    }).setDepth(20)

    this.messageText = this.add.text(CX, CY, '', {
      fontSize: '24px',
      fontFamily: 'Arial, sans-serif',
      color: '#f1c40f',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5).setDepth(30).setAlpha(0)

    // Pause functionality could be preserved if wanted, but removing here for puzzle simplicity.
  }

  private updateHUD(): void {
    this.scoreText.setText(`Score: ${formatScore(this.scoreSystem.getScore())}`)
  }

  private showMessage(msg: string, duration: number = 1000): void {
    this.messageText.setText(msg)
    this.messageText.setAlpha(1)
    this.messageText.setScale(0.8)

    this.tweens.killTweensOf(this.messageText)
    this.tweens.add({
      targets: this.messageText,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: this.messageText,
          alpha: 0,
          delay: duration,
          duration: 300
        })
      }
    })
  }

  // ─── Game Over ────────────────────────────────────────────────────────────

  private triggerGameOver(): void {
    if (this.isGameOver) return;
    this.isGameOver = true

    this.showMessage("NO MOVES LEFT!", 2000)

    this.cameras.main.shake(300, 0.012)
    this.time.delayedCall(2000, () => {
      this.cameras.main.fadeOut(BALANCING.sceneFadeDuration, 0, 0, 0)
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('ResultScene', {
          score: this.scoreSystem.getScore(),
          highScore: this.scoreSystem.getHighScore(),
          isNewHighScore: this.scoreSystem.isNewHighScore()
        })
      })
    })
  }

  shutdown(): void {
    this.input.off('pointerdown')
    this.tweens.killAll()
  }
}
