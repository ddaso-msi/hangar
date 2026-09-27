import { Component, type ReactNode } from 'react'

/**
 * Contains a failure to the subtree that failed. Without one, an error thrown
 * inside the 3D viewer (a lost context, a shader that will not compile)
 * unmounts the entire app and leaves a blank page.
 */
export class ErrorBoundary extends Component<{ fallback: ReactNode; onError?: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.warn('Contained a render failure:', error)
    this.props.onError?.()
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
