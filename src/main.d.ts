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

/** A painting of soft colour to put under the glass: applyGlass(win, { backdrop: RAINBOW }). */
export const RAINBOW: string
/** The window buttons inside a floating sidebar panel's corner. */
export const TRAFFIC_LIGHTS: Readonly<{ x: number; y: number }>
export const PANEL_CHANNEL: string
/** True on macOS 26+ with the native addon built, and on Windows 11 22H2+. */
export function glassSupported(): boolean
/** Which system glass this computer has: 'mac' (macOS 26+), 'windows' (Windows 11 22H2+), or null. */
export function glassKind(): 'mac' | 'windows' | null
/** Windows 11 22H2 (build 22621) and later: where the window manager draws Acrylic and Mica. */
export function windowsMaterialSupported(platform?: string, osRelease?: string): boolean
/** BrowserWindow options for a glass window: the title bar hidden, the system's buttons over the page. */
export function glassWindowOptions(): BrowserWindowConstructorOptions
/**
 * Puts the window on the system's glass (Apple's on macOS 26+, Acrylic or Mica on Windows 11); true when it is drawn
 * on glass now. `backdrop`: a picture under the glass inside the window (on Windows painted by the page).
 */
export function applyGlass(
  win: BrowserWindow,
  options?: { style?: 'regular' | 'clear'; backdrop?: string; windowsMaterial?: 'acrylic' | 'mica' }
): boolean
/** Takes the window off the glass. */
export function removeGlass(win: BrowserWindow): void
/** Places one floating panel by name, or takes it away. */
export function placePanel(win: BrowserWindow, name: string, rect: PanelRect | null): void
