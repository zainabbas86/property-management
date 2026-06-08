import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { user, token, logout } = useAuth()

  return (
    <div className="layout">
      <header className="navbar">
        <Link to="/" className="brand">Property Management</Link>
        <nav>
          {token ? (
            <>
              <span className="user-name">{user?.name}</span>
              <button type="button" onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </nav>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
