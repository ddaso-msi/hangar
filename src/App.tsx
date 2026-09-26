import { useEffect, useRef } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router'
import { startScroll, stopScroll } from './scroll/lenis'
import { Nav } from './ui/Nav'
import { Footer } from './ui/Footer'
import Home from './routes/Home'
import Models from './routes/Models'
import ModelPage from './routes/Model'
import Process from './routes/Process'

function ScrollToTop() {
  const { pathname } = useLocation()
  const first = useRef(true)
  useEffect(() => {
    // Only on navigation. On the first render this is a page load, and a reload
    // should land where the viewer was: let the browser restore scroll.
    if (first.current) {
      first.current = false
      return
    }
    // Lenis patches window.scrollTo, so this must not be an implicit return:
    // React would treat the patched return value as a cleanup function.
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  useEffect(() => {
    startScroll()
    return stopScroll
  }, [])

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/models" element={<Models />} />
          <Route path="/models/:slug" element={<ModelPage />} />
          <Route path="/process" element={<Process />} />
        </Routes>
      </main>
      <Footer />
    </BrowserRouter>
  )
}
