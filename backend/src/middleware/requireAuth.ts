// src/middleware/requireAuth.ts
import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase.js';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email?: string };
      // The raw JWT, kept so route handlers can build a per-request Supabase
      // client scoped to this user (see lib/supabaseUser.ts) instead of
      // reaching for the service-role client for actions the user performs.
      accessToken?: string;
    }
  }
}

const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  req.user = { id: data.user.id, email: data.user.email };
  req.accessToken = token;
  next();
};

export { requireAuth };
