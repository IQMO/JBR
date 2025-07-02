import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: string;
                email: string;
            };
        }
    }
}
export declare class AuthMiddleware {
    private authService;
    constructor();
    requireAuth: (req: Request, res: Response, next: NextFunction) => void;
    optionalAuth: (req: Request, res: Response, next: NextFunction) => void;
    requireOwnership: (resourceUserIdField?: string) => (req: Request, res: Response, next: NextFunction) => void;
    createRateLimiter: (maxAttempts?: number, windowMs?: number) => (req: Request, res: Response, next: NextFunction) => void;
    requireRefreshToken: (req: Request, res: Response, next: NextFunction) => void;
}
export declare const authMiddleware: AuthMiddleware;
//# sourceMappingURL=auth.middleware.d.ts.map