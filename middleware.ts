// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ROLE_PREFIX: Record<string, string> = {
  admin: '/admin',
  teacher: '/teacher',
  sales: '/sales',
  accountant: '/accountant',
  supervisor: '/supervisor',
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // Check for auth cookie
  const hasAuth = request.cookies.getAll().some(c => c.name.includes('auth-token'))
  if (!hasAuth) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Enforce role-based route access
  const role = request.cookies.get('user-role')?.value
  if (role) {
    const allowedPrefix = ROLE_PREFIX[role]
    const otherPrefixes = Object.values(ROLE_PREFIX).filter(p => p !== allowedPrefix)
    if (otherPrefixes.some(p => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL(allowedPrefix ?? '/dashboard', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
