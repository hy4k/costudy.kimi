import { Routes, Route } from 'react-router'
import Home from './pages/Home'
import Rooms from './pages/Rooms'
import Wall from './pages/Wall'
import Vault from './pages/Vault'
import AIDeck from './pages/AIDeck'
import Path from './pages/Path'
import Login from './pages/Login'
import Mentor from './pages/Mentor'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/rooms" element={<Rooms />} />
      <Route path="/wall" element={<Wall />} />
      <Route path="/vault" element={<Vault />} />
      <Route path="/ai" element={<AIDeck />} />
      <Route path="/path" element={<Path />} />
      <Route path="/mentor" element={<Mentor />} />
    </Routes>
  )
}
