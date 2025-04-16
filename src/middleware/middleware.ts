function withGracePeriod(expiration: number, grace: number): boolean {
  const currentTime = Math.floor(Date.now() / 1000);
  return expiration - grace < currentTime;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  try {
    const token = await withRetry(async () => {
      return await withTimeout(
        getToken({ req: request, secret: process.env.NEXTAUTH_SECRET }),
        10000,
        'Token verification timeout',
      );
    }, 3, 1000);

    if (requiresAuth(pathname) && withGracePeriod(token.exp, 30)) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    const response = NextResponse.next();
    applySecurityHeaders(response);
    return response;
  } catch (error) {
    console.error('Middleware error:', error.message);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 