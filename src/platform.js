// locust-glass: which system glass a computer has, without Electron, so it can be tested anywhere.

/** Windows 11 22H2 (build 22621) and later: where the window manager draws Acrylic and Mica. */
export function windowsMaterialSupported(platform, osRelease) {
  if (platform !== 'win32') return false
  const build = Number(String(osRelease).split('.')[2])
  return Number.isFinite(build) && build >= 22621
}
