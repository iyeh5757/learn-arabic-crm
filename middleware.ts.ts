import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  if (path.startsWith('/_next') || path.includes('.')) {
    return NextResponse.next()
  }

  const cookies = request.cookies.getAll()
  const hasSession = cookies.some(c => c.name.includes('auth-token'))

  if (!hasSession && path !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (hasSession && path === '/login') {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
