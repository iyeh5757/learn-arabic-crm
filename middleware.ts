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

  // Pass pathname to server components via header
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
