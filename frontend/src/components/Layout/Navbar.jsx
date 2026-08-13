import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, PlusCircle, LogOut, LayoutDashboard, Receipt, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navLink = (to, label) => (
    <Link
      to={to}
      className={`text-sm font-medium transition ${
        location.pathname === to ? 'text-brand-700' : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40">
      {/* Announcement strip */}
      <div className="bg-gradient-to-r from-brand-700 via-brand-600 to-accent-700 text-white">
        <div className="mx-auto max-w-7xl px-4 py-1.5 text-center text-xs font-medium sm:px-6 lg:px-8">
          Community-powered sharing in Belvedere, Harare — borrow instead of buying 🌱
        </div>
      </div>

      {/* Main nav */}
      <nav
        className={`bg-white/90 backdrop-blur border-b transition-shadow ${
          scrolled ? 'border-gray-200 shadow-[0_1px_8px_rgba(16,24,40,0.08)]' : 'border-gray-100'
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2.5" aria-label="NeighbourShare Home">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
                <span className="text-lg font-bold tracking-tight text-gray-900">NeighbourShare</span>
              </Link>

              <div className="hidden items-center gap-7 md:flex">
                {navLink('/browse', 'Browse')}
                <a href="/#how-it-works" className="text-sm font-medium text-gray-600 transition hover:text-gray-900">How it works</a>
                <a href="/#why" className="text-sm font-medium text-gray-600 transition hover:text-gray-900">Why NeighbourShare</a>
              </div>
            </div>

            {/* Right side */}
            <div className="hidden items-center gap-3 md:flex">
              {isAuthenticated ? (
                <>
                  <Link to="/my-transactions" className="flex items-center gap-1.5 text-sm font-medium text-gray-600 transition hover:text-gray-900">
                    <Receipt className="h-4 w-4" />
                    My Transactions
                  </Link>

                  <div className="relative">
                    <button
                      onClick={() => setProfileOpen((v) => !v)}
                      className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition hover:bg-gray-50"
                    >
                      <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-brand-700">
                        {user?.profile_photo ? (
                          <img src={user.profile_photo} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold uppercase">
                            {(user?.first_name || user?.email || 'U').slice(0, 2)}
                          </span>
                        )}
                      </span>
                      <span className="text-sm font-medium text-gray-800">{user?.first_name || 'Profile'}</span>
                      <ChevronDown className={`h-4 w-4 text-gray-400 transition ${profileOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {profileOpen && (
                      <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-gray-100 bg-white py-1.5 shadow-card-hover animate-fade-in">
                        <Link to="/profile" className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">My Profile</Link>
                        <Link to="/my-listings" className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">My Listings</Link>
                        <Link to="/my-transactions" className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">My Transactions</Link>
                        {user?.is_staff && (
                          <Link to="/admin" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                            <LayoutDashboard className="h-4 w-4 text-gray-400" /> Admin Dashboard
                          </Link>
                        )}
                        <div className="my-1.5 border-t border-gray-100" />
                        <button onClick={handleLogout} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50">
                          <LogOut className="h-4 w-4" /> Logout
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Link to="/login" className="text-sm font-semibold text-gray-700 transition hover:text-gray-900">
                    Sign In
                  </Link>
                  <Link to="/register" className="text-sm font-semibold text-gray-700 transition hover:text-gray-900">
                    Register
                  </Link>
                </>
              )}

              <Link
                to="/create-listing"
                className="bg-brand-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
              >
                <PlusCircle className="h-4 w-4" />
                Create listing
              </Link>
            </div>

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-50 md:hidden"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-t border-gray-100 bg-white px-4 pb-4 pt-2 animate-fade-in md:hidden">
            <div className="flex flex-col gap-1">
              <Link to="/browse" className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Browse</Link>
              <a href="/#how-it-works" className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">How it works</a>
              <a href="/#why" className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Why NeighbourShare</a>
              {isAuthenticated && (
                <>
                  <Link to="/profile" className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">My Profile</Link>
                  <Link to="/my-listings" className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">My Listings</Link>
                  <Link to="/my-transactions" className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">My Transactions</Link>
                  {user?.is_staff && (
                    <Link to="/admin" className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Admin Dashboard</Link>
                  )}
                </>
              )}
              <div className="mt-2 flex flex-col gap-2 border-t border-gray-100 pt-3">
                {!isAuthenticated && (
                  <>
                    <Link to="/login" className="btn-secondary w-full">Sign In</Link>
                    <Link to="/register" className="btn-primary w-full">Register</Link>
                  </>
                )}
                <Link to="/create-listing" className="btn-primary w-full bg-brand-gradient hover:brightness-110">
                  <PlusCircle className="h-4 w-4" /> Create listing
                </Link>
                {isAuthenticated && (
                  <button onClick={handleLogout} className="w-full rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">
                    Logout
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
