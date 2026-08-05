// src/controllers/boardController.ts
import { Request, Response } from 'express';
import { boardService } from '../services/boardService.js';
import { boardCardService } from '../services/boardCardService.js';

const boardController = {
  async createBoard(req: Request, res: Response) {
    try {
      const { name } = req.body;
      const board = await boardService.createBoard(name, req.user!.id);
      return res.status(201).json({ success: true, data: board });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  async listBoards(req: Request, res: Response) {
    try {
      const boards = await boardService.listBoards();
      return res.status(200).json({ success: true, data: boards });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  async getBoard(req: Request, res: Response) {
    try {
      const board = await boardService.getBoard(req.params.boardId);
      if (!board) return res.status(404).json({ success: false, error: 'Board not found' });
      return res.status(200).json({ success: true, data: board });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  async listCards(req: Request, res: Response) {
    try {
      const cards = await boardCardService.listCards(req.params.boardId);
      return res.status(200).json({ success: true, data: cards });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  async createCard(req: Request, res: Response) {
    try {
      const { boardId } = req.params;
      const file = req.file;
      const positionX = Number(req.body.positionX) || 0;
      const positionY = Number(req.body.positionY) || 0;

      let card;
      if (file) {
        card = await boardCardService.createPhotoCard(boardId, {
          imageBuffer: file.buffer,
          mimeType: file.mimetype,
          positionX,
          positionY,
        });
      } else if (req.body.type === 'link') {
        card = await boardCardService.createLinkCard(boardId, { url: req.body.url, positionX, positionY });
      } else {
        card = await boardCardService.createTextCard(boardId, { content: req.body.content, positionX, positionY });
      }

      return res.status(201).json({ success: true, data: card });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  async updatePosition(req: Request, res: Response) {
    try {
      const { boardId, cardId } = req.params;
      const { x, y } = req.body;
      await boardCardService.updateCardPosition(boardId, cardId, x, y);
      return res.status(200).json({ success: true });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  async deleteCard(req: Request, res: Response) {
    try {
      const { boardId, cardId } = req.params;
      await boardCardService.deleteCard(boardId, cardId);
      return res.status(200).json({ success: true });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },

  async listLocations(req: Request, res: Response) {
    try {
      const locations = await boardCardService.listLocations(req.params.boardId);
      return res.status(200).json({ success: true, data: locations });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  },
};

export { boardController };
