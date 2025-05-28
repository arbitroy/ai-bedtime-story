import { NextResponse } from 'next/server';
import { authMiddleware } from '@/utils/middleware';

/**
 * Next.js middleware function
 * 
 * @param {Request} request - Next.js request object
 * @returns {NextResponse} NextResponse object
 */
export function middleware(request) {
    // Get the pathname from the URL
    const { pathname } = request.nextUrl;
    
    // Skip middleware for static files and API routes
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname.includes('.') // static files like images, etc.
    ) {
        return NextResponse.next();
    }
    
    // Helper function to get user from cookies
    const getUser = () => {
        try {
            // Try to get the user from cookies
            const userCookie = request.cookies.get('user')?.value;
            
            if (!userCookie) return null;
            
            return JSON.parse(userCookie);
        } catch (error) {
            console.error('Error parsing user cookie:', error);
            return null;
        }
    };
    
    // Apply the auth middleware
    return authMiddleware(request, { getUser });
}

// Configure middleware to run on specific paths
export const config = {
    matcher: [
        /*
        * Match all request paths except for:
        * - _next/static (static files)
        * - _next/image (image optimization files)
        * - favicon.ico (favicon file)
        * - public folder files
        * - api routes
        */
        '/((?!_next/static|_next/image|favicon.ico|public|api).*)',
    ],
};