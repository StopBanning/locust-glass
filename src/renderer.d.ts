export interface LensOptions { bezel?: number; strength?: number; blur?: number; saturate?: number; dispersion?: number }
export interface GooOptions { melt?: number; selector?: string; blur?: number; saturate?: number }

/** Every [data-glass-panel] gets real glass under it (macOS 26+). Returns the stop. */
export function watchPanels(place?: (name: string, rect: object | null) => void): () => void
/** The lens's displacement field for a rounded rectangle (red: x, green: y, 128: still). */
export function lensField(width: number, height: number, radius: number, bezel: number): { width: number; height: number; data: Uint8ClampedArray }
/** The lens field as a data URL. */
export function lensMap(width: number, height: number, radius: number, bezel: number): string
/** Cuts a blurred alpha channel at about half, in place. */
export function cutAtHalf(data: Uint8ClampedArray): Uint8ClampedArray
/** Makes an element bend what is behind it. Returns the stop. */
export function lens(node: HTMLElement, options?: LensOptions): () => void
/** Makes a group's children share one gooey sheet of glass. */
export function goo(group: HTMLElement, options?: GooOptions): { wake(): void; stop(): void }
/** The highlight on [data-shine] glass follows the pointer. Returns the stop. */
export function shine(root?: Document | HTMLElement): () => void
/** All of it, for [data-glass-panel], [data-lens] and [data-goo]. Returns the stop. */
export function glassPage(): () => void
