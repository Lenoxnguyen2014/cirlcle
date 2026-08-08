// src/routes/routes.js
import express from "express";
import multer from "multer";

import { getWalletStatus } from "../controllers/walletController.ts";
import { searchFlightsHandler } from "../controllers/searchFlightController.ts";
import { runAgentHandler } from "../controllers/flightAgentController.ts";
import { getMonitorTasks } from "../controllers/getMonitorController.ts";
import { authController } from "../controllers/authController.ts";
import { runAgent } from "../controllers/mcpController.ts";
import { boardController } from "../controllers/boardController.ts";
import { requireAuth } from "../middleware/requireAuth.ts";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/wallet/status", getWalletStatus);

router.get("/flights/search", searchFlightsHandler);
router.get("/monitor/tasks", getMonitorTasks);
router.post("/agent/run", runAgentHandler);
router.post("/mcp/run", runAgent); // New route for MCP agent execution

router.post("/signup", upload.single("passportPhoto"), authController.signUp);
router.post("/login", authController.login);
router.post("/resend-confirmation", authController.resendConfirmation);
router.get("/me", requireAuth, authController.me);
router.post("/logout", authController.logout);

router.post("/boards", requireAuth, boardController.createBoard);
router.get("/boards", requireAuth, boardController.listBoards);
router.get("/boards/:boardId", requireAuth, boardController.getBoard);
router.post("/boards/:boardId/join", requireAuth, boardController.joinBoard);

router.get("/boards/:boardId/cards", requireAuth, boardController.listCards);
router.post("/boards/:boardId/cards", requireAuth, boardController.createCard);
router.post("/boards/:boardId/cards/restore", requireAuth, boardController.restoreCard);
router.post("/boards/:boardId/cards/photo", requireAuth, upload.single("photo"), boardController.createCard);
router.patch("/boards/:boardId/cards/:cardId", requireAuth, boardController.updateContent);
router.patch("/boards/:boardId/cards/:cardId/position", requireAuth, boardController.updatePosition);
router.patch("/boards/:boardId/cards/:cardId/date", requireAuth, boardController.updateCardDate);
router.delete("/boards/:boardId/cards/:cardId", requireAuth, boardController.deleteCard);

router.get("/boards/:boardId/locations", requireAuth, boardController.listLocations);

router.get("/boards/:boardId/day-colors", requireAuth, boardController.listDayColors);
router.put("/boards/:boardId/day-colors/:date", requireAuth, boardController.setDayColor);
router.post("/boards/:boardId/pins", requireAuth, boardController.createPin);

export default router;
