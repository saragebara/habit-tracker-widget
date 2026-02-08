export {}

declare global {
  interface Window {
    electron: any
    api: {
      closeWindow: () => void
    }
  }
}