// src/controllers/authController.ts
import { Request, Response } from 'express';
import { authService } from '../services/authService.js';
import { createUserScopedClient } from '../lib/supabaseUser.js';

const authController = {
  /**
   * POST /api/auth/signup
   */
  async signUp(req: Request, res: Response) {
    try {
      const { email, password, firstName, lastName, phone } = req.body;
      const file = req.file;

      const result = await authService.signUp({
        email,
        password,
        firstName,
        lastName,
        phone,
        imageBuffer: file?.buffer,
        mimeType: file?.mimetype,
      });

      return res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  /**
   * POST /api/auth/login
   */
  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);

      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(401).json({ success: false, error: error.message, code: error.code });
    }
  },

  /**
   * POST /api/auth/resend-confirmation
   */
  async resendConfirmation(req: Request, res: Response) {
    try {
      const { email } = req.body;
      const result = await authService.resendConfirmation(email);
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  /**
   * GET /api/me
   */
  async me(req: Request, res: Response) {
    try {
      const client = createUserScopedClient(req.accessToken!);
      const profile = await authService.getProfile(client, req.user!.id);
      return res.status(200).json({ success: true, data: profile });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  /**
   * POST /api/auth/logout
   */
  async logout(req: Request, res: Response) {
    try {
      await authService.logout();
      return res.status(200).json({ success: true, message: 'Logged out successfully' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
};

export { authController };