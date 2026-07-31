interface MonitorTask {
  id: string;
  userId?: string;
  origin: string;
  destination: string;
  date: string;
  userInstruction: string;
  active: boolean;
  createdAt: string;
}

export { MonitorTask };
