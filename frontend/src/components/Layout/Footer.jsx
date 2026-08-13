import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Twitter, Instagram, MapPin, ShieldCheck, HeartHandshake, Leaf } from 'lucide-react';

const columns = [
  {
    title: 'Platform',
    links: [
      { to: '/browse', label: 'Browse Items' },
      { to: '/create-listing', label: 'List an Item' },
      { to: '/my-transactions', label: 'My Transactions' },
      { to: '/profile', label: 'My Profile' },
    ],
  },
  {
    title: 'Support',
    links: [
      { to: '/help', label: 'Help Center' },
      { to: '/contact', label: 'Contact Us' },
      { to: '/faq', label: 'FAQ' },
      { to: '/disputes', label: 'Dispute Resolution' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { to: '/privacy', label: 'Privacy Policy' },
      { to: '/terms', label: 'Terms of Service' },
      { to: '/guidelines', label: 'Community Guidelines' },
    ],
  },
];

const socials = [
  { icon: Facebook, label: 'Facebook' },
  { icon: Twitter, label: 'Twitter' },
  { icon: Instagram, label: 'Instagram' },
];

export default function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-5">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
              <span className="text-lg font-bold tracking-tight text-gray-900">NeighbourShare</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-gray-500">
              Community-powered sharing for Belvedere, Harare. Borrow instead of buying —
              lend, rent and share with neighbours you trust.
            </p>
            <div className="mt-5 flex items-center gap-3">
              {socials.map(({ icon: Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900">{col.title}</h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className="text-sm text-gray-500 transition hover:text-brand-700">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Trust strip */}
        <div className="mt-12 grid grid-cols-1 gap-4 rounded-2xl bg-gray-50 p-6 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 shrink-0 text-brand-600" />
            <div>
              <p className="text-sm font-semibold text-gray-900">Everything is guaranteed</p>
              <p className="text-xs text-gray-500">Escrow-protected deposits for every rental</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <HeartHandshake className="h-6 w-6 shrink-0 text-brand-600" />
            <div>
              <p className="text-sm font-semibold text-gray-900">Community Time Credits</p>
              <p className="text-xs text-gray-500">Fair, credit-based exchange between neighbours</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Leaf className="h-6 w-6 shrink-0 text-brand-600" />
            <div>
              <p className="text-sm font-semibold text-gray-900">Good for the environment</p>
              <p className="text-xs text-gray-500">The more things get used, the better</p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-gray-100 pt-8 md:flex-row">
          <p className="flex items-center gap-1.5 text-sm text-gray-500">
            <MapPin className="h-4 w-4 text-brand-600" />
            Belvedere, Harare, Zimbabwe
          </p>
          <p className="text-sm text-gray-400">© 2026 NeighbourShare. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
