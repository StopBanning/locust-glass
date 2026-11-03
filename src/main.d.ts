import type { BrowserWindow, BrowserWindowConstructorOptions } from 'electron'

export interface PanelRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly radius?: number
  readonly style?: 'regular' | 'clear'
  readonly followHeight?: boolean
}

/** The window buttons inside a floating sidebar panel's corner. */
export const TRAFFIC_LIGHTS: Readonly<{ x: number; y: number }>
export const PANEL_CHANNEL: string
/** True on macOS 26+ with the native addon built. */
export function glassSupported(): boolean
/** BrowserWindow options for a glass window. */
export function glassWindowOptions(): BrowserWindowConstructorOptions
/** Puts the window on macOS's glass; true when it is drawn on glass now. */
export function applyGlass(win: BrowserWindow, options?: { style?: 'regular' | 'clear'; backdrop?: string }): boolean
/** Takes the window off the glass. */
export function removeGlass(win: BrowserWindow): void
/** Places one floating panel by name, or takes it away. */
export function placePanel(win: BrowserWindow, name: string, rect: PanelRect | null): void
