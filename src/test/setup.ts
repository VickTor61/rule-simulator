import '@testing-library/jest-dom/vitest'

class ResizeObserverMock {
  observe(): void {}

  unobserve(): void {}

  disconnect(): void {}
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  value: ResizeObserverMock,
  writable: true,
})

beforeEach(() => {
  globalThis.localStorage?.clear()
})
