// src/controllers/boardController.ts
import { Request, Response } from 'express';
import { boardService } from '../services/boardService.js';
import { boardCardService } from '../services/boardCardService.js';
import { reverseGeocode } from '../services/geocodingService.js';
import { createUserScopedClient } from '../lib/supabaseUser.js';

const boardController = {
  async createBoard(req: Request, res: Response) {
    try {
      const client = createUserScopedClient(req.accessToken!);
      const { name } = req.body;
      console.log('[DEBUG createBoard] req.user =', req.user);
      console.log('[DEBUG createBoard] accessToken =', req.accessToken);
      const { data: whoami } = await client.auth.getUser();
      console.log('[DEBUG createBoard] client sees user as =', whoami?.user?.id, whoami?.user?.role);
      const board = await boardService.createBoard(client, name, req.user!.id);
      return res.status(201).json({ success: true, data: board });
    } catch (error: any) {
      console.log('[DEBUG createBoard] error =', error);
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  async listBoards(req: Request, res: Response) {
    try {
      const client = createUserScopedClient(req.accessToken!);
      const boards = await boardService.listBoards(client);
      return res.status(200).json({ success: true, data: boards });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  async getBoard(req: Request, res: Response) {
    try {
      const client = createUserScopedClient(req.accessToken!);
      const board = await boardService.getBoard(client, req.params.boardId);
      if (!board) return res.status(404).json({ success: false, error: 'Board not found' });
      return res.status(200).json({ success: true, data: board });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  async joinBoard(req: Request, res: Response) {
    try {
      const client = createUserScopedClient(req.accessToken!);
      await boardService.joinBoard(client, req.params.boardId, req.user!.id);
      return res.status(200).json({ success: true });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  async listCards(req: Request, res: Response) {
    try {
      const client = createUserScopedClient(req.accessToken!);
      const cards = await boardCardService.listCards(client, req.params.boardId);
      return res.status(200).json({ success: true, data: cards });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  async createCard(req: Request, res: Response) {
    try {
      const client = createUserScopedClient(req.accessToken!);
      const { boardId } = req.params;
      const createdBy = req.user!.id;
      const file = req.file;
      const positionX = Number(req.body.positionX) || 0;
      const positionY = Number(req.body.positionY) || 0;

      let card;
      if (file) {
        card = await boardCardService.createPhotoCard(client, boardId, createdBy, {
          imageBuffer: file.buffer,
          mimeType: file.mimetype,
          positionX,
          positionY,
        });
      } else if (req.body.type === 'link') {
        card = await boardCardService.createLinkCard(client, boardId, createdBy, { url: req.body.url, positionX, positionY });
      } else {
        card = await boardCardService.createTextCard(client, boardId, createdBy, {
          content: req.body.content,
          positionX,
          positionY,
        });
      }

      return res.status(201).json({ success: true, data: card });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  async updateContent(req: Request, res: Response) {
    try {
      const client = createUserScopedClient(req.accessToken!);
      const { boardId, cardId } = req.params;
      const { type, content } = req.body;
      const card = await boardCardService.updateCardContent(client, boardId, cardId, { type, content });
      return res.status(200).json({ success: true, data: card });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  async updatePosition(req: Request, res: Response) {
    try {
      const client = createUserScopedClient(req.accessToken!);
      const { boardId, cardId } = req.params;
      const { x, y } = req.body;
      await boardCardService.updateCardPosition(client, boardId, cardId, x, y);
      return res.status(200).json({ success: true });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  async updateCardDate(req: Request, res: Response) {
    try {
      const client = createUserScopedClient(req.accessToken!);
      const { boardId, cardId } = req.params;
      const { visitDate } = req.body;
      await boardCardService.updateCardDate(client, boardId, cardId, visitDate ?? null);
      return res.status(200).json({ success: true });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  async deleteCard(req: Request, res: Response) {
    try {
      const client = createUserScopedClient(req.accessToken!);
      const { boardId, cardId } = req.params;
      await boardCardService.deleteCard(client, boardId, cardId);
      return res.status(200).json({ success: true });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  async restoreCard(req: Request, res: Response) {
    try {
      const client = createUserScopedClient(req.accessToken!);
      const { boardId } = req.params;
      const card = await boardCardService.restoreCard(client, boardId, req.user!.id, req.body);
      return res.status(201).json({ success: true, data: card });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  async createPin(req: Request, res: Response) {
    try {
      const client = createUserScopedClient(req.accessToken!);
      const { boardId } = req.params;
      const { lat, lng } = req.body;
      const name = req.body.name?.trim() || (await reverseGeocode(lat, lng)) || 'Dropped pin';
      const card = await boardCardService.createPinCard(client, boardId, req.user!.id, {
        name,
        lat,
        lng,
        positionX: 40,
        positionY: 40,
      });
      return res.status(201).json({ success: true, data: card });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  async listLocations(req: Request, res: Response) {
    try {
      const client = createUserScopedClient(req.accessToken!);
      const locations = await boardCardService.listLocations(client, req.params.boardId);
      return res.status(200).json({ success: true, data: locations });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  async listDayColors(req: Request, res: Response) {
    try {
      const client = createUserScopedClient(req.accessToken!);
      const dayColors = await boardCardService.listDayColors(client, req.params.boardId);
      return res.status(200).json({ success: true, data: dayColors });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  async setDayColor(req: Request, res: Response) {
    try {
      const client = createUserScopedClient(req.accessToken!);
      const { boardId, date } = req.params;
      const { color } = req.body;
      await boardCardService.setDayColor(client, boardId, date, color);
      return res.status(200).json({ success: true });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },
};

export { boardController };
